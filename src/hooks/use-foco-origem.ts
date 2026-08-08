import { useCallback, useEffect, useRef } from "react";
import { rolarParaVista } from "@/lib/rolar-para-vista";

/**
 * Guarda o elemento que estava em foco antes de um aviso (`role="alert"`) abrir
 * e devolve o foco para ele quando o aviso é dispensado.
 *
 * Por que existe: o aviso de remoção em tempo real rouba o foco para ser
 * anunciado por leitor de tela. Se, ao dispensar, o foco cair no `<body>`, quem
 * navega por teclado perde o lugar e precisa varrer a página de novo. Aqui o
 * foco volta exatamente para o controle de origem — e, se ele não existir mais
 * (a prática removida saiu da tela), para o primeiro controle relevante do
 * conteúdo principal, nunca para o nada.
 */

/** Primeiro controle relevante da página, usado quando a origem desapareceu. */
export function primeiroControleRelevante(): HTMLElement | null {
  const escopo = document.querySelector("main") ?? document.body;
  const candidatos = escopo.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  for (const el of candidatos) {
    if (el.getAttribute("aria-hidden") === "true") continue;
    if (el.closest('[role="alert"]')) continue; // não devolver o foco ao próprio aviso
    if (el.offsetParent === null && el.getClientRects().length === 0) continue;
    return el;
  }
  return null;
}

export function useFocoOrigem(aberto: boolean) {
  const origemRef = useRef<HTMLElement | null>(null);

  // Enquanto o aviso está fechado, seguimos anotando quem tem o foco: é para
  // esse elemento que voltaremos depois.
  useEffect(() => {
    if (aberto) return;
    const aoFocar = (evento: FocusEvent) => {
      const alvo = evento.target as HTMLElement | null;
      if (!alvo || alvo === document.body) return;
      if (alvo.closest?.('[role="alert"]')) return;
      origemRef.current = alvo;
    };
    document.addEventListener("focusin", aoFocar);
    return () => document.removeEventListener("focusin", aoFocar);
  }, [aberto]);

  /** Devolve o foco à origem (ou ao primeiro controle relevante). */
  const devolverFoco = useCallback(() => {
    const origem = origemRef.current;
    const vivo = origem?.isConnected && (origem.offsetParent !== null || origem.getClientRects().length > 0);
    const alvo = vivo ? origem! : primeiroControleRelevante();
    if (!alvo) return;
    alvo.focus();
    rolarParaVista(alvo, "center");
  }, []);

  return { devolverFoco };
}
