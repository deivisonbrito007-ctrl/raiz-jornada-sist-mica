import { createFileRoute, Outlet, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { RaizWordmark } from "@/components/raiz-logo";
import { getMeuContexto } from "@/lib/raiz.functions";
import type { Permissao } from "@/lib/permissoes";
import { useVigiaPermissoes } from "@/hooks/use-vigia-permissoes";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: podeAdministrar } = await supabase.rpc("pode_administrar");
    if (podeAdministrar !== true) throw redirect({ to: "/app" });
  },
  component: AdminLayout,
});

const links: { to: string; label: string; exact: boolean; permissao: Permissao }[] = [
  { to: "/admin", label: "Clientes", exact: true, permissao: "ver_clientes" },
  { to: "/admin/clientes", label: "Atribuições", exact: false, permissao: "ver_clientes" },
  { to: "/admin/trilhas", label: "Trilhas", exact: false, permissao: "gerenciar_conteudos" },
  {
    to: "/admin/acompanhamento",
    label: "Acompanhamento",
    exact: false,
    permissao: "ver_clientes",
  },
  { to: "/admin/conteudos", label: "Conteúdos", exact: false, permissao: "gerenciar_conteudos" },
  { to: "/admin/pacotes", label: "Pacotes", exact: false, permissao: "gerenciar_pacotes" },
  { to: "/admin/equipe", label: "Equipe", exact: false, permissao: "gerenciar_equipe" },
  { to: "/admin/auditoria", label: "Auditoria", exact: false, permissao: "gerenciar_equipe" },
];



function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchContexto = useServerFn(getMeuContexto);
  const { data: contexto } = useQuery({
    queryKey: ["meu-contexto"],
    queryFn: () => fetchContexto(),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
  useVigiaPermissoes();
  const ehTerapeuta = contexto?.papel === "terapeuta";
  const minhasPermissoes = contexto?.permissoes ?? [];
  const visiveis = links.filter(
    (l) => ehTerapeuta || minhasPermissoes.includes(l.permissao),
  );

  // Bloqueio imediato: se o acesso administrativo for revogado, sai do painel.
  useEffect(() => {
    if (!contexto) return;
    if (contexto.podeAdministrar) return;
    queryClient.clear();
    toast.error("Seu acesso administrativo foi removido.");
    navigate({ to: "/app", replace: true });
  }, [contexto, navigate, queryClient]);


  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-floresta text-floresta-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <RaizWordmark className="text-floresta-foreground" />
            <span className="rounded-full bg-floresta-foreground/10 px-3 py-1 text-[11px] uppercase tracking-wider text-ocre">
              {ehTerapeuta ? "Painel do terapeuta" : "Painel administrativo"}
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {visiveis.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeOptions={{ exact: link.exact }}
                activeProps={{ className: "bg-floresta-foreground/15 text-ocre" }}
                inactiveProps={{ className: "text-floresta-foreground/70" }}
                className="rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-floresta-foreground/10"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/app"
              className="rounded-full px-4 py-2 text-sm text-floresta-foreground/70 hover:bg-floresta-foreground/10"
            >
              Ver como cliente
            </Link>
            <button
              onClick={sair}
              className="rounded-full px-4 py-2 text-sm text-floresta-foreground/70 hover:bg-floresta-foreground/10"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {contexto && visiveis.length === 0 ? (
          <div
            role="status"
            className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground"
          >
            <p className="font-medium text-foreground">Nenhuma área liberada para você ainda</p>
            <p className="mt-1">
              Seu acesso administrativo existe, mas nenhuma permissão foi concedida. Peça a um gestor
              da equipe para liberar as áreas que você precisa.
            </p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

    </div>
  );
}
