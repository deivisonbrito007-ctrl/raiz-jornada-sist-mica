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

/**
 * Ordem de preferência quando o controle guardado não existe mais na tela.
 * Começa pelo comando principal (tocar/pausar) e desce para os controles de
 * navegação; se nada disso existir, qualquer controle marcado serve.
 */
const PREFERENCIA: ControlePlayer[] = ["play", "voltar15", "avancar15", "concluir"];

/**
 * Primeiro controle relevante do player disponível agora.
 *
 * Usado como rede de segurança: o controle que estava em foco antes do bloqueio
 * pode ter desaparecido (o player foi remontado com outros comandos, a prática
 * mudou de formato ou aquele botão deixou de ser oferecido). Em vez de deixar o
 * foco cair no `body` — que faria o leitor de tela perder o contexto e o Tab
 * voltar ao começo da página — devolvemos o foco a um ponto útil e previsível.
 */
export function primeiroControleRelevante(): HTMLElement | null {
  for (const nome of PREFERENCIA) {
    const el = document.querySelector<HTMLElement>(`[data-foco-player="${nome}"]`);
    if (el && !el.hasAttribute("disabled")) return el;
  }
  const candidatos = Array.from(document.querySelectorAll<HTMLElement>("[data-foco-player]"));
  return candidatos.find((el) => !el.hasAttribute("disabled")) ?? null;
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
    const alvo =
      document.querySelector<HTMLElement>(`[data-foco-player="${desejado}"]`) ??
      primeiroControleRelevante();
    if (!alvo) return;
    jaRestauradoRef.current = true;
    alvo.focus();
    // o controle pode estar fora da vista (a página mudou de tamanho enquanto o
    // aviso ocupava a tela): trazemos ele junto com o foco
    rolarParaVista(alvo, "center");
    gravar(conteudoId, null);
  }, [bloqueado, liberado, conteudoId]);

  return { lembrarFoco };
}
