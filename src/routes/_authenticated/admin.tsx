import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { podeAdministrarEmCache } from "@/lib/acesso-admin";
import { limparCachePersistido } from "@/lib/cache-persistente";
import { useMeuContexto } from "@/hooks/use-meu-contexto";
import { useVigiaPermissoes } from "@/hooks/use-vigia-permissoes";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SidebarTerapeuta } from "@/components/painel/sidebar-terapeuta";
import { CabecalhoPainel } from "@/components/painel/cabecalho-painel";
import { PainelBuscaContext } from "@/components/painel/busca-contexto";
import { GRUPOS_PAINEL } from "@/components/painel/navegacao";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/auth" });
    if (!(await podeAdministrarEmCache())) throw redirect({ to: "/app" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Mesma consulta do app do cliente (chave única): uma busca serve as duas
  // telas. O vigia em tempo real (useVigiaPermissoes) derruba o painel na hora
  // em que o acesso muda; a revalidação periódica é só uma rede de segurança.
  const { data: contexto } = useMeuContexto({
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  useVigiaPermissoes();
  const [termo, setTermo] = useState("");
  const busca = useMemo(() => ({ termo, definir: setTermo }), [termo]);

  const ehTerapeuta = contexto?.papel === "terapeuta";
  const minhasPermissoes = contexto?.permissoes ?? [];
  const areasLiberadas = GRUPOS_PAINEL.flatMap((g) => g.itens).filter(
    (i) => i.permissao && (ehTerapeuta || minhasPermissoes.includes(i.permissao)),
  );

  // Bloqueio imediato: se o acesso administrativo for revogado, sai do painel.
  useEffect(() => {
    if (!contexto) return;
    if (contexto.podeAdministrar) return;
    queryClient.clear();
    limparCachePersistido();
    toast.error("Seu acesso administrativo foi removido.");
    navigate({ to: "/app", replace: true });
  }, [contexto, navigate, queryClient]);

  return (
    <PainelBuscaContext.Provider value={busca}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <SidebarTerapeuta />
          <SidebarInset className="min-w-0 bg-background">
            <CabecalhoPainel
              nome={contexto?.perfil?.nome}
              email={contexto?.perfil?.email}
              termoBusca={termo}
              onBusca={setTermo}
            />
            <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
              {contexto && areasLiberadas.length === 0 ? (
                <div
                  role="status"
                  className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground"
                >
                  <p className="font-medium text-foreground">
                    Nenhuma área liberada para você ainda
                  </p>
                  <p className="mt-1">
                    Seu acesso administrativo existe, mas nenhuma permissão foi concedida. Peça a um
                    gestor da equipe para liberar as áreas que você precisa.
                  </p>
                </div>
              ) : (
                <Outlet />
              )}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PainelBuscaContext.Provider>
  );
}
