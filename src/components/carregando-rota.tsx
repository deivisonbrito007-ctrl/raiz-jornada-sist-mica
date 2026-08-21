import { RaizLogo } from "@/components/raiz-logo";

/**
 * Placeholder exibido enquanto a próxima rota carrega. Mantém o leitor de tela
 * ciente da transição, usa as cores da marca e evita a sensação de tela travada
 * ao trocar de aba.
 */
export function CarregandoRota() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-4">
      <span className="sr-only">Carregando a página…</span>

      <div className="flex items-center gap-3">
        <RaizLogo className="h-8 w-auto animate-respirar opacity-90" />
        <div className="h-1 w-24 overflow-hidden rounded-full bg-floresta/10">
          <div className="h-full w-1/2 animate-deslizar rounded-full bg-terracota/70" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 animate-pulse rounded-3xl bg-floresta/[0.07]" />
        <div className="h-28 animate-pulse rounded-3xl bg-floresta/[0.07]" />
      </div>
      <div className="h-64 animate-pulse rounded-3xl bg-floresta/[0.07]" />
    </div>
  );
}
