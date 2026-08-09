import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder exibido enquanto a próxima rota carrega. Mantém o leitor de tela
 * ciente da transição e evita a sensação de tela travada ao trocar de aba.
 */
export function CarregandoRota() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-4">
      <span className="sr-only">Carregando a página…</span>
      <Skeleton className="h-8 w-48 rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
      </div>
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  );
}
