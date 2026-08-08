import { useCallback, useEffect, useRef } from "react";
import { rolarParaVista } from "@/lib/rolar-para-vista";

/**
 * Guarda qual controle do player estava em foco quando o acesso caiu (link
 * vencido, revogação ou sessão expirada) e devolve o foco para o mesmo lugar
 * quando a prática volta a ficar liberada — inclusive depois de reautenticar,
 * quando a página é montada de novo.
 *
 * O controle é identificado pelo atributo `data-foco-player`, então a
 * restauração funciona mesmo que o elemento anterior tenha sido desmontado.
 */
const PREFIXO = "raiz:foco-player:";

export type ControlePlayer = string;

function chave(conteudoId: string) {
  return `${PREFIXO}${conteudoId}`;
}

function ler(conteudoId: string): ControlePlayer | null {
  try {
    return window.sessionStorage.getItem(chave(conteudoId));
  } catch {
    return null;
  }
}

function gravar(conteudoId: string, controle: ControlePlayer | null) {
  try {
    if (controle) window.sessionStorage.setItem(chave(conteudoId), controle);
    else window.sessionStorage.removeItem(chave(conteudoId));
  } catch {
    /* sessionStorage indisponível: a restauração apenas não acontece */
  }
}

/** Descarta o ponto de foco guardado de uma prática (ex.: troca de conteúdo). */
export function limparFocoPlayer(conteudoId: string) {
  gravar(conteudoId, null);
}

/** Nome do controle do player em foco agora, se houver. */
export function controleEmFoco(): ControlePlayer | null {
  const ativo = document.activeElement as HTMLElement | null;
  const nome = ativo?.getAttribute?.("data-foco-player");
  return nome || null;
}

export function useFocoPlayer(conteudoId: string, opcoes: { bloqueado: boolean; liberado: boolean }) {
  const { bloqueado, liberado } = opcoes;
  const ultimoRef = useRef<ControlePlayer | null>(null);
  const jaRestauradoRef = useRef(false);

  /** Chame quando o acesso cair: guarda o controle em foco (ou um informado). */
  const lembrarFoco = useCallback(
    (controle?: ControlePlayer | null) => {
      const nome = controle ?? controleEmFoco();
      if (!nome) return;
      ultimoRef.current = nome;
      gravar(conteudoId, nome);
    },
    [conteudoId],
  );

  // Enquanto o player está liberado, acompanhamos o último controle usado para
  // saber onde a pessoa estava caso o acesso caia sem aviso.
  useEffect(() => {
    if (bloqueado) return;
    const aoFocar = (evento: FocusEvent) => {
      const alvo = evento.target as HTMLElement | null;
      const nome = alvo?.getAttribute?.("data-foco-player");
      if (nome) ultimoRef.current = nome;
    };
    document.addEventListener("focusin", aoFocar);
    return () => document.removeEventListener("focusin", aoFocar);
  }, [bloqueado]);

  // O acesso caiu: registramos o ponto de foco para depois da reautenticação.
  useEffect(() => {
    if (!bloqueado) return;
    jaRestauradoRef.current = false;
    lembrarFoco(ultimoRef.current ?? controleEmFoco() ?? "play");
  }, [bloqueado, lembrarFoco]);

  // Voltou a ficar liberado (nesta visita ou após reautenticar): devolvemos o
  // foco ao mesmo controle, uma única vez.
  useEffect(() => {
    if (bloqueado || !liberado || jaRestauradoRef.current) return;
    const desejado = ultimoRef.current ?? ler(conteudoId);
    if (!desejado) return;
    const alvo = document.querySelector<HTMLElement>(`[data-foco-player="${desejado}"]`);
    if (!alvo) return;
    jaRestauradoRef.current = true;
    alvo.focus();
    // o controle pode estar fora da vista (a página mudou de tamanho enquanto o
    // aviso estava aberto): trazemos ele para a tela junto com o foco
    rolarParaVista(alvo, "center");
    gravar(conteudoId, null);
  }, [bloqueado, liberado, conteudoId]);

  return { lembrarFoco };
}
