import { useEffect, useRef, type RefObject } from "react";
import { limparFocoPlayer } from "@/hooks/use-foco-player";

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

  // Enquanto o aviso está aberto, acompanhamos se o foco está dentro dele.
  const focoNoAvisoRef = useRef(false);
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

  // A prática mudou: marcamos que o foco precisa voltar e limpamos o registro
  // de foco da prática anterior.
  useEffect(() => {
    const anterior = anteriorRef.current;
    if (anterior === conteudoId) return;
    anteriorRef.current = conteudoId;
    limparFocoPlayer(anterior);
    if (focoNoAvisoRef.current || avisoAberto) {
      devolverRef.current = true;
      focoNoAvisoRef.current = false;
    }
  }, [conteudoId, avisoAberto]);

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
    alvo.scrollIntoView?.({ block: "start" });
  }, [pronto, conteudoId, tituloRef]);
}
