import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Eye, LogOut, Search, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listarNotificacoes, marcarNotificacoesLidas } from "@/lib/raiz.functions";
import { formatarData } from "@/lib/raiz-format";
import { cabecalhoDoCaminho, iniciaisDe } from "./navegacao";

type Props = {
  nome?: string | null;
  email?: string | null;
  termoBusca: string;
  onBusca: (valor: string) => void;
};

export function CabecalhoPainel({ nome, email, termoBusca, onBusca }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { titulo, trilha, pesquisa } = cabecalhoDoCaminho(pathname);

  const fetchNotificacoes = useServerFn(listarNotificacoes);
  const lerNotificacoes = useServerFn(marcarNotificacoesLidas);
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
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger
            aria-label="Abrir ou fechar o menu"
            className="min-h-11 min-w-11 shrink-0 text-floresta"
          />
          <div className="min-w-0">
            {trilha.length > 0 && (
              <nav aria-label="Trilha de navegação" className="flex items-center gap-1.5">
                {trilha.map((t) => (
                  <span key={t.label} className="flex items-center gap-1.5">
                    {t.to ? (
                      <Link
                        to={t.to}
                        className="truncate text-[11px] uppercase tracking-wider text-salvia hover:text-floresta"
                      >
                        {t.label}
                      </Link>
                    ) : (
                      <span className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                        {t.label}
                      </span>
                    )}
                    <span aria-hidden="true" className="text-[11px] text-muted-foreground">
                      ›
                    </span>
                  </span>
                ))}
              </nav>
            )}
            <p className="truncate font-display text-xl text-floresta sm:text-2xl">{titulo}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {pesquisa !== false && (
            <div className="relative hidden md:block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={termoBusca}
                onChange={(e) => onBusca(e.target.value)}
                placeholder={pesquisa.placeholder}
                aria-label={pesquisa.placeholder}
                className="h-11 w-64 rounded-full border-border bg-card pl-9"
              />
            </div>
          )}

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
              aria-label={naoLidas > 0 ? `Avisos (${naoLidas} não lidos)` : "Avisos"}
              className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-floresta transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {naoLidas > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-terracota" />
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

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Menu do perfil"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-full bg-floresta text-xs font-semibold text-floresta-foreground"
              >
                {iniciaisDe(nome, email)}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              <DropdownMenuLabel className="truncate">{nome ?? email ?? "Conta"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/admin/perfil" className="cursor-pointer">
                  <UserCircle className="h-4 w-4" aria-hidden="true" />
                  <span>Perfil</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/app" className="cursor-pointer">
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span>Ver como cliente</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={sair} className="cursor-pointer">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {pesquisa !== false && (
        <div className="px-4 pb-3 md:hidden">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={termoBusca}
              onChange={(e) => onBusca(e.target.value)}
              placeholder={pesquisa.placeholder}
              aria-label={pesquisa.placeholder}
              className="h-11 w-full rounded-full border-border bg-card pl-9"
            />
          </div>
        </div>
      )}
    </header>
  );
}
