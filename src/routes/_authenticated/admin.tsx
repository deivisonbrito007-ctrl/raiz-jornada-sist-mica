import { createFileRoute, Outlet, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RaizWordmark } from "@/components/raiz-logo";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: papeis } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    if (!(papeis ?? []).some((p) => p.role === "terapeuta")) throw redirect({ to: "/app" });
  },
  component: AdminLayout,
});

const links = [
  { to: "/admin", label: "Clientes", exact: true },
  { to: "/admin/conteudos", label: "Conteúdos", exact: false },
  { to: "/admin/pacotes", label: "Pacotes", exact: false },
];

function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
              Painel do terapeuta
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {links.map((link) => (
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
        <Outlet />
      </main>
    </div>
  );
}
