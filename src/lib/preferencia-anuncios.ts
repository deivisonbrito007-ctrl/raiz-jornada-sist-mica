import { useEffect, useState } from "react";

/**
 * Preferência de acessibilidade para anúncios em live region.
 *
 * Algumas pessoas usam leitor de tela com verbosidade alta e sofrem com o
 * excesso de falas do player (contagem regressiva, estado da mídia, progresso).
 * Outras preferem silenciar tudo e ler as mensagens na tela. A preferência fica
 * no dispositivo (localStorage), sem depender do backend.
 *
 * - `completo`: anuncia tudo (padrão).
 * - `reduzido`: anuncia apenas o que é importante (bloqueio, erro, remoção).
 * - `desativado`: não anuncia nada; mensagens importantes ganham um aviso
 *   visível na tela como fallback.
 */
export type PreferenciaAnuncios = "completo" | "reduzido" | "desativado";

export const CHAVE_PREFERENCIA_ANUNCIOS = "raiz:preferencia-anuncios";
const EVENTO = "raiz:preferencia-anuncios-mudou";

const VALIDAS: PreferenciaAnuncios[] = ["completo", "reduzido", "desativado"];

export function lerPreferenciaAnuncios(): PreferenciaAnuncios {
  try {
    const bruto = window.localStorage.getItem(CHAVE_PREFERENCIA_ANUNCIOS);
    return VALIDAS.includes(bruto as PreferenciaAnuncios)
      ? (bruto as PreferenciaAnuncios)
      : "completo";
  } catch {
    return "completo";
  }
}

export function salvarPreferenciaAnuncios(valor: PreferenciaAnuncios) {
  try {
    window.localStorage.setItem(CHAVE_PREFERENCIA_ANUNCIOS, valor);
  } catch {
    /* modo privado ou storage cheio: a preferência vale só para esta tela */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: valor }));
  } catch {
    /* ambientes sem CustomEvent: os componentes já montados seguem com o valor atual */
  }
}

/** Diz se um anúncio de determinado nível deve ir para a live region. */
export function deveAnunciar(
  preferencia: PreferenciaAnuncios,
  nivel: "rotina" | "importante",
) {
  if (preferencia === "desativado") return false;
  if (preferencia === "reduzido") return nivel === "importante";
  return true;
}

/**
 * Lê a preferência e acompanha mudanças (nesta aba e em outras).
 *
 * Inicia em `completo` e sincroniza no efeito para não divergir entre servidor e
 * cliente na hidratação.
 */
export function usePreferenciaAnuncios(): PreferenciaAnuncios {
  const [preferencia, setPreferencia] = useState<PreferenciaAnuncios>("completo");

  useEffect(() => {
    setPreferencia(lerPreferenciaAnuncios());

    const aoMudar = () => setPreferencia(lerPreferenciaAnuncios());
    window.addEventListener(EVENTO, aoMudar);
    window.addEventListener("storage", aoMudar);
    return () => {
      window.removeEventListener(EVENTO, aoMudar);
      window.removeEventListener("storage", aoMudar);
    };
  }, []);

  return preferencia;
}
