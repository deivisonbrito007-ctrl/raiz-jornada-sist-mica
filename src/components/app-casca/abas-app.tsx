import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Compass, NotebookPen, User } from "lucide-react";

/** Abas inferiores do cliente, com indicador que desliza para a aba ativa. */
const ABAS = [
  { to: "/app", label: "Início", icone: Home, exact: true },
  { to: "/app/jornada", label: "Jornada", icone: Compass, exact: false },
  { to: "/app/diario", label: "Diário", icone: NotebookPen, exact: false },
  { to: "/app/perfil", label: "Perfil", icone: User, exact: false },
] as const;

function indiceAtivo(pathname: string) {
  if (pathname === "/app" || pathname === "/app/") return 0;
  const i = ABAS.findIndex((a) => !a.exact && pathname.startsWith(a.to));
  return i === -1 ? 0 : i;
}

export function AbasApp() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const ativo = indiceAtivo(pathname);

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-floresta-foreground/10 bg-imersao pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative mx-auto max-w-2xl px-2 py-2">
        <span
          aria-hidden="true"
          className="absolute left-2 top-1 h-[calc(100%-0.5rem)] rounded-2xl bg-floresta-foreground/10 transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            width: `calc((100% - 1rem) / ${ABAS.length})`,
            transform: `translateX(${ativo * 100}%)`,
          }}
        />
        <ul className="relative flex items-stretch">
          {ABAS.map((aba, i) => (
            <li key={aba.to} className="flex-1">
              <Link
                to={aba.to}
                activeOptions={{ exact: aba.exact }}
                aria-current={i === ativo ? "page" : undefined}
                className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocre"
              >
                <aba.icone
                  aria-hidden="true"
                  className={
                    i === ativo
                      ? "h-5 w-5 text-ocre transition-transform duration-300 -translate-y-0.5 motion-reduce:transition-none"
                      : "h-5 w-5 text-floresta-foreground/60"
                  }
                  strokeWidth={i === ativo ? 2.4 : 1.8}
                />
                <span className={i === ativo ? "text-ocre" : "text-floresta-foreground/60"}>
                  {aba.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
