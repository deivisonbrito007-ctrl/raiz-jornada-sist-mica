import { useCallback, useRef, useState } from "react";

export type Urgencia = "polite" | "assertive";

export type Anuncio = {
  texto: string;
  urgencia: Urgencia;
  /** muda a cada anúncio para o leitor de tela reler mensagens repetidas */
  selo: number;
};

/**
 * Fila simples de anúncios para leitores de tela, com proteção contra
 * repetição: a mesma mensagem seguida não é anunciada duas vezes.
 */
export function useAnuncio() {
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null);
  const ultimoRef = useRef<string>("");
  const seloRef = useRef(0);

  const anunciar = useCallback((texto: string, urgencia: Urgencia = "polite") => {
    const limpo = texto.trim();
    if (!limpo) return;
    const assinatura = `${urgencia}:${limpo}`;
    if (assinatura === ultimoRef.current) return;
    ultimoRef.current = assinatura;
    seloRef.current += 1;
    setAnuncio({ texto: limpo, urgencia, selo: seloRef.current });
  }, []);

  const limparAnuncio = useCallback(() => {
    ultimoRef.current = "";
    setAnuncio(null);
  }, []);

  return { anuncio, anunciar, limparAnuncio };
}
