import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useMemo, type ReactNode } from "react";

import { opcoesPersistencia } from "@/lib/cache-persistente";

/**
 * Provedor do cache de consultas.
 *
 * No navegador, o cache é persistido no `sessionStorage`: a barra lateral, o
 * contexto e as listas do painel voltam na hora depois de um recarregamento, e
 * revalidam em segundo plano. No servidor (SSR) e onde não há armazenamento,
 * cai no provedor comum, só em memória.
 */
export function ProvedorCache({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  const opcoes = useMemo(() => opcoesPersistencia(), []);

  if (!opcoes) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={opcoes}>
      {children}
    </PersistQueryClientProvider>
  );
}
