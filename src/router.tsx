import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { CarregandoRota } from "./components/carregando-rota";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Evita repetir a mesma consulta a cada montagem de componente ou volta para a aba.
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        retry: 2,
        retryDelay: (tentativa) => Math.min(1000 * 2 ** tentativa, 8000),
      },
      mutations: { retry: 0 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Baixa o código (e roda os guards) já ao passar o mouse/foco no link,
    // então o clique troca de aba praticamente na hora.
    defaultPreload: "intent",
    defaultPreloadDelay: 60,
    // Resposta visual imediata enquanto a próxima tela chega.
    defaultPendingMs: 150,
    defaultPendingMinMs: 200,
    defaultPendingComponent: CarregandoRota,
  });

  return router;
};
