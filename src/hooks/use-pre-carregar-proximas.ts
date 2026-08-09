import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { preCarregar } from "@/lib/pre-carregamento";

/** No máximo 3 alvos por tela: adiantar mais do que isso não encurta espera nenhuma. */
export const MAX_ALVOS = 3;

export type AlvoPreCarregamento = {
  /** chave de cache do TanStack Query */
  queryKey: readonly unknown[];
  carregar: () => Promise<unknown>;
};

/**
 * Pré-carrega, com limite, os próximos passos que o cliente provavelmente vai
 * abrir (próxima etapa da trilha). Usa o cache do Query, então ao navegar a
 * tela abre com os dados já prontos, sem espera.
 */
export function usePreCarregarProximas(alvos: AlvoPreCarregamento[], ativo = true) {
  const queryClient = useQueryClient();
  const assinatura = alvos.map((a) => JSON.stringify(a.queryKey)).join("|");

  useEffect(() => {
    if (!ativo || alvos.length === 0) return;

    let cancelado = false;
    for (const alvo of alvos.slice(0, MAX_ALVOS)) {
      const chave = JSON.stringify(alvo.queryKey);
      // já em cache? não há nada a adiantar
      if (queryClient.getQueryData(alvo.queryKey) !== undefined) continue;
      void preCarregar(chave, async () => {
        if (cancelado) return;
        await queryClient.prefetchQuery({
          queryKey: alvo.queryKey,
          queryFn: alvo.carregar,
          staleTime: 60_000,
        });
      });
    }

    return () => {
      cancelado = true;
    };
    // assinatura resume as chaves; alvos/carregar mudam de identidade a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, ativo, queryClient]);
}
