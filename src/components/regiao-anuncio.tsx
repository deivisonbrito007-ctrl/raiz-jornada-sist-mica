import type { Anuncio } from "@/hooks/use-anuncio";

/**
 * Região viva (aria-live) usada para anunciar mudanças de progresso e diário.
 * Renderiza as duas polidezes sempre, porque trocar o valor de aria-live no
 * mesmo nó faz alguns leitores de tela perderem o anúncio.
 */
export function RegiaoAnuncio({
  anuncio,
  rotulo = "Avisos",
}: {
  anuncio: Anuncio | null;
  rotulo?: string;
}) {
  return (
    <div className="sr-only">
      <p role="status" aria-live="polite" aria-atomic="true" aria-label={rotulo}>
        {anuncio && anuncio.tom === "polite" ? anuncio.texto : ""}
      </p>
      <p role="alert" aria-live="assertive" aria-atomic="true">
        {anuncio && anuncio.tom === "assertive" ? anuncio.texto : ""}
      </p>
    </div>
  );
}
