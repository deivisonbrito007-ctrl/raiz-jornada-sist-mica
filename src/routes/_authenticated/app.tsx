import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Home, Compass, NotebookPen, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RaizWordmark } from "@/components/raiz-logo";
import { getMeuContexto, listarNotificacoes, marcarNotificacoesLidas } from "@/lib/raiz.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";
import { formatarData } from "@/lib/raiz-format";
import { AvisoRemocaoRealtime } from "@/components/aviso-remocao-realtime";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

const abas = [
  { to: "/app", label: "Início", icone: Home, exact: true },
  { to: "/app/progresso", label: "Progresso", icone: Compass, exact: false },
  { to: "/app/diario", label: "Diário", icone: NotebookPen, exact: false },
  { to: "/app/perfil", label: "Perfil", icone: User, exact: false },
];

function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchContexto = useServerFn(getMeuContexto);
  const fetchNotificacoes = useServerFn(listarNotificacoes);
  const lerNotificacoes = useServerFn(marcarNotificacoesLidas);

  const { data: contexto } = useQuery({ queryKey: ["contexto"], queryFn: () => fetchContexto() });
  const { data: notificacoes } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: () => fetchNotificacoes(),
  });

  const naoLidas = (notificacoes ?? []).filter((n) => !n.lida).length;

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <Link to="/app" aria-label="Raiz — ir para a biblioteca" className="inline-flex min-h-11 items-center">
            <RaizWordmark />
          </Link>
          <div className="flex items-center gap-1">
            <Popover
              onOpenChange={(aberto) => {
                if (aberto && naoLidas > 0) {
                  void lerNotificacoes().then(() =>
                    queryClient.invalidateQueries({ queryKey: ["notificacoes"] }),
                  );
                }
              }}
            >
              <PopoverTrigger
                aria-label="Avisos"
                className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full p-2 text-floresta transition-colors hover:bg-secondary"
              >
                <Bell className="h-5 w-5" />
                {naoLidas > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-terracota" />
                )}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 rounded-2xl">
                <p className="mb-3 font-display text-base text-floresta">Avisos</p>
                {(notificacoes ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Nada novo por aqui.</p>
                )}
                <ul className="space-y-3">
                  {(notificacoes ?? []).slice(0, 8).map((n) => (
                    <li key={n.id} className="rounded-xl bg-secondary p-3">
                      <p className="text-sm font-medium text-floresta">{n.titulo}</p>
                      <p className="text-xs text-muted-foreground">{n.mensagem}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatarData(n.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
            {contexto?.papel === "terapeuta" && (
              <Link
                to="/admin"
                className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-xs font-medium text-salvia hover:bg-secondary"
              >
                Painel
              </Link>
            )}
            <button
              onClick={sair}
              className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6">
        <AvisoRemocaoRealtime />
        <Outlet />
      </main>

      <nav aria-label="Navegação principal" className="fixed bottom-0 left-0 right-0 z-20 border-t border-floresta/15 bg-floresta">
        <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 py-2">
          {abas.map((aba) => (
            <Link
              key={aba.to}
              to={aba.to}
              activeOptions={{ exact: aba.exact }}
              activeProps={{ className: "text-ocre" }}
              inactiveProps={{ className: "text-floresta-foreground/60" }}
              className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-medium"
            >
              <aba.icone className="h-5 w-5" />
              {aba.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
