import { createFileRoute, Outlet } from "@tanstack/react-router";

import { useMeuContexto } from "@/hooks/use-meu-contexto";
import { AvisoRemocaoRealtime } from "@/components/aviso-remocao-realtime";
import { CabecalhoApp } from "@/components/app-casca/cabecalho-app";
import { AbasApp } from "@/components/app-casca/abas-app";
import { TransicaoRota } from "@/components/app-casca/transicao-rota";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const { data: contexto } = useMeuContexto();

  return (
    <div className="min-h-screen bg-background pb-28">
      <CabecalhoApp mostrarPainel={contexto?.papel === "terapeuta"} />

      <main className="mx-auto max-w-2xl overflow-x-hidden px-5 pb-6 pt-5">
        <AvisoRemocaoRealtime />
        <TransicaoRota>
          <Outlet />
        </TransicaoRota>
      </main>

      <AbasApp />
    </div>
  );
}
