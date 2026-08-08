import { Info } from "lucide-react";
import { deveAnunciar, usePreferenciaAnuncios } from "@/lib/preferencia-anuncios";

type Props = {
  /** Texto a anunciar. Vazio/nulo não gera fala nem fallback. */
  texto?: string | null | undefined;
  /**
   * `importante` = bloqueio, erro, remoção, expiração (sobrevive ao modo
   * reduzido e ganha fallback visível quando os anúncios estão desativados).
   * `rotina` = contagem, progresso, confirmações.
   */
  nivel?: "rotina" | "importante" | undefined;
  /** Usa `assertive` em vez de `polite` (só para mudanças que interrompem). */
  assertivo?: boolean | undefined;
  /** Muda a chave do texto para forçar uma nova fala do mesmo conteúdo. */
  chaveAnuncio?: string | number | undefined;
  /** Desliga o fallback visível (quando a tela já mostra a mesma mensagem). */
  semFallbackVisivel?: boolean | undefined;
  className?: string | undefined;
};

/**
 * Live region que respeita a preferência de anúncios do cliente.
 *
 * Quando a pessoa reduz ou desativa os anúncios, mensagens importantes não
 * simplesmente desaparecem: elas passam a aparecer na tela, para que ninguém
 * perca um bloqueio de acesso por causa da preferência.
 */
export function RegiaoAnuncio({
  texto,
  nivel = "rotina",
  assertivo = false,
  chaveAnuncio,
  semFallbackVisivel = false,
  className,
}: Props) {
  const preferencia = usePreferenciaAnuncios();
  const anunciar = deveAnunciar(preferencia, nivel);

  if (anunciar) {
    return (
      <p
        role={assertivo ? "alert" : "status"}
        aria-live={assertivo ? "assertive" : "polite"}
        aria-atomic="true"
        className={`sr-only ${className ?? ""}`}
      >
        {texto ? <span key={chaveAnuncio ?? texto}>{texto}</span> : null}
      </p>
    );
  }

  // Sem anúncio: mensagens importantes viram aviso visível (sem live region,
  // para não falar contra a preferência de quem desativou).
  if (nivel !== "importante" || semFallbackVisivel || !texto) return null;

  return (
    <p
      data-testid="fallback-anuncio-visivel"
      aria-live="off"
      className={`mt-3 flex items-start gap-2 rounded-2xl border border-floresta/15 bg-secondary px-3 py-2 text-xs leading-relaxed text-floresta ${className ?? ""}`}
    >
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-salvia" />
      <span>{texto}</span>
    </p>
  );
}
