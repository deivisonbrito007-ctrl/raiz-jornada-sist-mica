import { useEffect, useRef, type RefObject } from "react";
import { limparFocoPlayer } from "@/hooks/use-foco-player";
import { rolarParaVista } from "@/lib/rolar-para-vista";

/**
 * Troca de conteúdo com o aviso do player aberto.
 *
 * Quando o aviso de bloqueio (link vencido, revogação, remoção) está aberto, o
 * foco do teclado está dentro dele. Se a pessoa navega para outra prática nesse
 * momento, o aviso antigo é desmontado e o foco cairia no `body` — o leitor de
 * tela perderia o contexto e o Tab voltaria ao começo da página.
 *
 * Este hook detecta a troca de prática e devolve o foco a um ponto previsível
 * da nova tela (o título da prática), além de descartar o ponto de foco
 * guardado da prática anterior, que não vale mais.
 */
export function useFocoTrocaConteudo(
  conteudoId: string,
  opcoes: {
    /** o aviso de bloqueio está visível agora? */
    avisoAberto: boolean;
    /** título da prática — recebe o foco após a troca */
    tituloRef: RefObject<HTMLElement | null>;
    /** já é possível focar o título (a nova prática terminou de carregar) */
    pronto: boolean;
  },
) {
  const { avisoAberto, tituloRef, pronto } = opcoes;

  const anteriorRef = useRef(conteudoId);
  /** o aviso estava aberto (e com o foco dentro) quando a prática mudou? */
  const devolverRef = useRef(false);

  const focoNoAvisoRef = useRef(false);
  /** o aviso estava aberto na render anterior? */
  const avisoAnteriorRef = useRef(avisoAberto);

  // A prática mudou: marcamos que o foco precisa voltar e limpamos o registro
  // de foco da prática anterior. Roda antes do observador de foco abaixo, para
  // ainda ver o estado do aviso da prática que acabou de sair da tela.
  useEffect(() => {
    const anterior = anteriorRef.current;
    if (anterior !== conteudoId) {
      anteriorRef.current = conteudoId;
      limparFocoPlayer(anterior);
      if (focoNoAvisoRef.current || avisoAnteriorRef.current || avisoAberto) {
        devolverRef.current = true;
        focoNoAvisoRef.current = false;
      }
    }
    avisoAnteriorRef.current = avisoAberto;
  }, [conteudoId, avisoAberto]);

  // Enquanto o aviso está aberto, acompanhamos se o foco está dentro dele.
  useEffect(() => {
    if (!avisoAberto) {
      focoNoAvisoRef.current = false;
      return;
    }
    const conferir = () => {
      const ativo = document.activeElement;
      focoNoAvisoRef.current = Boolean(ativo?.closest?.('[role="alertdialog"]'));
    };
    conferir();
    document.addEventListener("focusin", conferir);
    return () => document.removeEventListener("focusin", conferir);
  }, [avisoAberto]);


  // A nova prática carregou: o foco vai para o título, uma única vez por troca.
  useEffect(() => {
    if (!devolverRef.current || !pronto) return;
    const alvo = tituloRef.current;
    if (!alvo) return;
    // O aviso da nova prática cuida do próprio foco; não disputamos com ele.
    if (document.activeElement?.closest?.('[role="alertdialog"]')) {
      devolverRef.current = false;
      return;
    }
    devolverRef.current = false;
    alvo.focus();
    rolarParaVista(alvo, "start");
  }, [pronto, conteudoId, tituloRef]);
}
