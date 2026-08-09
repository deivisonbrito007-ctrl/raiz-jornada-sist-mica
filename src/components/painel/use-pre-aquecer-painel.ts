import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";

import {
  adminAcompanhamento,
  adminListarClientes,
  adminListarTrilhas,
} from "@/lib/trilhas.functions";
import { preCarregar } from "@/lib/pre-carregamento";

/**
 * Pré-aquece os dados das abas mais usadas do painel quando o terapeuta passa o
 * mouse (ou o foco) no item da barra lateral. Usa o mesmo limitador do
 * pré-carregamento das trilhas: no máximo 2 buscas simultâneas, 8 por minuto,
 * uma vez por chave, e nada em economia de dados/2G/offline/aba em segundo plano.
 */
export function usePreAquecerPainel() {
  const queryClient = useQueryClient();
  const listarClientes = useServerFn(adminListarClientes);
  const listarTrilhas = useServerFn(adminListarTrilhas);
  const acompanhamento = useServerFn(adminAcompanhamento);

  return useCallback(
    (to: string) => {
      const alvo: Record<string, { queryKey: readonly unknown[]; carregar: () => Promise<unknown> }> =
        {
          "/admin": { queryKey: ["admin-clientes"], carregar: () => listarClientes() },
          "/admin/clientes": { queryKey: ["admin-clientes"], carregar: () => listarClientes() },
          "/admin/trilhas": { queryKey: ["admin-trilhas"], carregar: () => listarTrilhas() },
          "/admin/acompanhamento": {
            queryKey: ["admin-acompanhamento"],
            carregar: () => acompanhamento(),
          },
        };

      const item = alvo[to];
      if (!item) return;
      if (queryClient.getQueryData(item.queryKey) !== undefined) return;

      void preCarregar(`painel:${to}`, async () => {
        await queryClient.prefetchQuery({
          queryKey: item.queryKey,
          queryFn: item.carregar,
          staleTime: 60_000,
        });
      });
    },
    [queryClient, listarClientes, listarTrilhas, acompanhamento],
  );
}
