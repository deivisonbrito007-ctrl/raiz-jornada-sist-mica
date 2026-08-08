import type { Anuncio } from "@/hooks/use-anuncio";

/**
 * Duas live regions permanentes (uma educada, uma assertiva) para que o leitor
 * de tela receba as mudanças de progresso sem que nada apareça na tela.
 */
export function RegiaoAnuncio({ anuncio }: { anuncio: Anuncio | null }) {
  const polido = anuncio && anuncio.urgencia === "polite" ? anuncio : null;
  const assertivo = anuncio && anuncio.urgencia === "assertive" ? anuncio : null;
  return (
    <>
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="anuncio-polido"
      >
        {polido?.texto ?? ""}
      </p>
      <p
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="anuncio-assertivo"
      >
        {assertivo?.texto ?? ""}
      </p>
    </>
  );
}
