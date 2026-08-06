import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RaizLogo } from "@/components/raiz-logo";
import { Button } from "@/components/ui/button";

type AutorizacaoDetalhes = {
  client?: { name?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
};

type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AutorizacaoDetalhes | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AutorizacaoDetalhes | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AutorizacaoDetalhes | null; error: { message: string } | null }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("authorization_id ausente");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } as never });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consentimento,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md px-6 py-16 text-sm text-muted-foreground">
      Não foi possível carregar este pedido de autorização:{" "}
      {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consentimento() {
  const detalhes = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const nomeCliente = detalhes?.client?.name ?? "este aplicativo";

  async function decidir(aprovar: boolean) {
    setOcupado(true);
    setErro(null);
    const api = oauthApi();
    const { data, error } = aprovar
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setOcupado(false);
      setErro(error.message);
      return;
    }
    const destino = data?.redirect_url ?? data?.redirect_to;
    if (!destino) {
      setOcupado(false);
      setErro("O servidor de autorização não devolveu um endereço de retorno.");
      return;
    }
    window.location.href = destino;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <RaizLogo className="mb-4 h-20 self-center" />
      <div className="rounded-3xl bg-card p-7 shadow-[var(--shadow-organico)]">
        <h1 className="text-2xl text-floresta">Conectar {nomeCliente} à sua conta</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Ao aprovar, {nomeCliente} poderá ver suas práticas liberadas, seu progresso e seu diário,
          e registrar novas entradas em seu nome.
        </p>
        {erro && (
          <p role="alert" className="mt-4 text-sm text-terracota">
            {erro}
          </p>
        )}
        <div className="mt-7 space-y-3">
          <Button
            disabled={ocupado}
            onClick={() => decidir(true)}
            className="w-full rounded-full bg-terracota py-6 text-base font-semibold text-terracota-foreground hover:bg-terracota/90"
          >
            {ocupado ? "Um instante..." : "Aprovar"}
          </Button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => decidir(false)}
            className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Recusar
          </button>
        </div>
      </div>
    </main>
  );
}
