import { useEffect, useState } from "react";

export const CONSULTA_MOVIMENTO_REDUZIDO = "(prefers-reduced-motion: reduce)";

/**
 * Diz se a pessoa pediu menos movimento no sistema operacional.
 *
 * Usamos isso para desligar transições, deslizes e rolagem suave no player e
 * nos avisos de acessibilidade — quem tem sensibilidade vestibular, enxaqueca
 * ou usa leitor de tela recebe a mesma informação sem animação.
 *
 * Começa em `false` (SSR e primeiro render não têm `matchMedia`) e se ajusta na
 * hidratação; também acompanha mudanças da preferência em tempo real.
 */
export function useMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(CONSULTA_MOVIMENTO_REDUZIDO);
    setReduzido(mq.matches);
    const aoMudar = (e: MediaQueryListEvent | MediaQueryList) => setReduzido(e.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", aoMudar as (e: MediaQueryListEvent) => void);
      return () => mq.removeEventListener("change", aoMudar as (e: MediaQueryListEvent) => void);
    }
    // Safari antigo
    mq.addListener?.(aoMudar as (e: MediaQueryListEvent) => void);
    return () => mq.removeListener?.(aoMudar as (e: MediaQueryListEvent) => void);
  }, []);

  return reduzido;
}

/** Escolhe entre a classe animada e a estática conforme a preferência. */
export function classeMovimento(reduzido: boolean, animada: string, estatica = ""): string {
  return reduzido ? estatica : animada;
}

/** Comportamento de rolagem respeitando a preferência. */
export function rolagem(reduzido: boolean): ScrollBehavior {
  return reduzido ? "auto" : "smooth";
}
