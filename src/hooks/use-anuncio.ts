import { useCallback, useEffect, useRef, useState } from "react";

export type TomAnuncio = "polite" | "assertive";

export type Anuncio = {
  texto: string;
  tom: TomAnuncio;
};

/**
 * Fila simples de anúncios para leitores de tela.
 *
 * Regras:
 * - mensagens idênticas em sequência não são repetidas (evita ruído em
 *   re-renders, refetches e cliques repetidos);
 * - erros e bloqueios usam tom "assertive"; confirmações usam "polite";
 * - `limpar()` zera o estado, permitindo anunciar a mesma mensagem de novo
 *   quando ela representa um evento realmente novo.
 */
export function useAnuncio() {
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null);
  const ultimoRef = useRef<string | null>(null);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const anunciar = useCallback((texto: string, tom: TomAnuncio = "polite") => {
    const limpo = texto.trim();
    if (!limpo) return false;
    const chave = `${tom}::${limpo}`;
    if (ultimoRef.current === chave) return false;
    ultimoRef.current = chave;
    if (montadoRef.current) setAnuncio({ texto: limpo, tom });
    return true;
  }, []);

  const limpar = useCallback(() => {
    ultimoRef.current = null;
    if (montadoRef.current) setAnuncio(null);
  }, []);

  return { anuncio, anunciar, limpar };
}
