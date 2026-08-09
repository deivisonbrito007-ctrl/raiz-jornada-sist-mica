import { createFileRoute, redirect } from "@tanstack/react-router";

/** Rota antiga: a página passou a se chamar Monitoramento. */
export const Route = createFileRoute("/_authenticated/admin/acompanhamento")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/monitoramento", replace: true });
  },
});
