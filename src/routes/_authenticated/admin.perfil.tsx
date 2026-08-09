import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { limparCachePersistido } from "@/lib/cache-persistente";
import { useMeuContexto } from "@/hooks/use-meu-contexto";
import { Button } from "@/components/ui/button";
import { PERMISSAO_LABEL, ehPermissao } from "@/lib/permissoes";
import { iniciaisDe } from "@/components/painel/navegacao";
import { formatarData } from "@/lib/raiz-format";

export const Route = createFileRoute("/_authenticated/admin/perfil")({
  component: AdminPerfil,
});

function AdminPerfil() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useMeuContexto();

  const perfil = data?.perfil;
  const ehTerapeuta = data?.papel === "terapeuta";
  const permissoes = (data?.permissoes ?? []).filter(ehPermissao);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    limparCachePersistido();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl text-floresta">Meu perfil</h1>

      <section className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]">
        <span
          aria-hidden="true"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-floresta font-display text-xl text-floresta-foreground"
        >
          {iniciaisDe(perfil?.nome, perfil?.email)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-xl text-floresta">
            {perfil?.nome ?? perfil?.email ?? "—"}
          </p>
          <p className="truncate text-sm text-muted-foreground">{perfil?.email ?? ""}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-salvia">
            {ehTerapeuta ? "Terapeuta" : "Administrativo"}
            {perfil?.created_at ? ` · desde ${formatarData(perfil.created_at)}` : ""}
          </p>
        </div>
      </section>

      <section
        aria-labelledby="titulo-minhas-permissoes"
        className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]"
      >
        <h2 id="titulo-minhas-permissoes" className="font-display text-xl text-floresta">
          Minhas permissões
        </h2>
        {ehTerapeuta ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Como terapeuta, você tem acesso a todas as áreas do painel.
          </p>
        ) : permissoes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma permissão concedida ainda. Peça a um gestor da equipe.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {permissoes.map((p) => (
              <li
                key={p}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-floresta"
              >
                {PERMISSAO_LABEL[p]}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button onClick={sair} variant="outline" className="min-h-11 rounded-full">
        <LogOut className="h-4 w-4" aria-hidden="true" />
        <span>Sair da conta</span>
      </Button>
    </div>
  );
}
