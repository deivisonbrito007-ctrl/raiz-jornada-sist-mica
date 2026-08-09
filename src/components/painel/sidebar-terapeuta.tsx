import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { RaizLogo } from "@/components/raiz-logo";
import { useMinhasPermissoes } from "@/hooks/use-minhas-permissoes";
import { GRUPOS_PAINEL, itemAtual } from "./navegacao";

export function SidebarTerapeuta() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const recolhida = state === "collapsed" && !isMobile;
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { pode, ehTerapeuta, carregando } = useMinhasPermissoes();
  const atual = itemAtual(pathname);

  const grupos = GRUPOS_PAINEL.map((grupo) => ({
    ...grupo,
    itens: grupo.itens.filter((item) => !item.permissao || pode(item.permissao)),
  })).filter((grupo) => grupo.itens.length > 0);

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="gap-0 px-3 py-4">
        <Link
          to="/admin/inicio"
          aria-label="Raiz — visão geral do painel"
          onClick={() => setOpenMobile(false)}
          className="flex items-center gap-3 rounded-2xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <RaizLogo className={recolhida ? "h-8" : "h-12"} />
          {!recolhida && (
            <span className="min-w-0">
              <span className="block font-display text-2xl font-semibold tracking-tight text-sidebar-foreground">
                Raiz
              </span>
              <span className="block truncate text-[11px] uppercase tracking-wider text-ocre">
                {ehTerapeuta ? "Painel do terapeuta" : "Painel administrativo"}
              </span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-1">
        {grupos.map((grupo) => (
          <SidebarGroup key={grupo.id} className="py-1">
            <SidebarGroupLabel className="text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/60">
              {grupo.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {grupo.itens.map((item) => {
                  const ativo = !item.externo && atual?.to === item.to;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={ativo}
                        tooltip={item.label}
                        className="min-h-11 gap-3 rounded-xl text-sidebar-foreground/80 data-[active=true]:bg-sidebar-accent data-[active=true]:text-ocre"
                      >
                        <Link
                          to={item.to}
                          onClick={() => setOpenMobile(false)}
                          {...(ativo ? { "aria-current": "page" as const } : {})}
                        >
                          <item.icone aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {!carregando && grupos.length === 0 && (
          <p className="px-3 py-2 text-xs text-sidebar-foreground/70">
            Nenhuma área liberada para você ainda.
          </p>
        )}
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4">
        {!recolhida && (
          <p className="text-[11px] leading-relaxed text-sidebar-foreground/50">
            Cuidado no tempo de cada pessoa.
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
