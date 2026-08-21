import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { iniciarDiagnostico, medirNavegacao } from "@/lib/diagnostico";
import { ProvedorCache } from "@/components/provedor-cache";
import { definirUsuarioCache, limparCachePersistido } from "@/lib/cache-persistente";
import { AplicarIntencaoLogin } from "@/components/auth/aplicar-intencao-login";
import { AvisoReinstalarApp } from "@/components/aviso-reinstalar-app";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-semibold text-floresta">404</h1>
        <h2 className="mt-4 text-xl text-foreground">Este caminho não existe</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Talvez a raiz tenha crescido para outro lado. Volte ao início.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-terracota px-5 py-2.5 text-sm font-medium text-terracota-foreground transition-colors hover:opacity-90"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Algo não carregou</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente novamente em instantes ou volte para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-terracota px-5 py-2.5 text-sm font-medium text-terracota-foreground"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "Raiz" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#1b2a1d" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Raiz" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=Public+Sans:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", type: "image/png", sizes: "64x64", href: "/favicon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    // diagnóstico interno: mede tempo por rota e conta requisições (só agregados)
    iniciarDiagnostico();
    let fechar: (() => void) | null = null;
    const aoIniciar = router.subscribe("onBeforeLoad", ({ toLocation }) => {
      fechar = medirNavegacao(toLocation.pathname);
    });
    const aoTerminar = router.subscribe("onResolved", () => {
      fechar?.();
      fechar = null;
    });
    return () => {
      aoIniciar();
      aoTerminar();
    };
  }, [router]);

  useEffect(() => {
    // Amarra o cache persistido à conta já na abertura da aba.
    void supabase.auth.getSession().then(({ data }) => {
      definirUsuarioCache(data.session?.user?.id ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") {
        // Sem sessão, nada do que estava guardado pode sobreviver ao recarregamento.
        limparCachePersistido();
        definirUsuarioCache(null);
        router.invalidate();
        return;
      }
      // Troca de conta descarta o cache da anterior antes de revalidar.
      definirUsuarioCache(session?.user?.id ?? null);
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <ProvedorCache queryClient={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <AplicarIntencaoLogin />
      <Toaster position="top-center" />
    </ProvedorCache>

  );
}

