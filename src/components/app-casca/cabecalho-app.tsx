import { Link } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";

import { RaizWordmark } from "@/components/raiz-logo";
import { AvisosApp } from "./avisos-app";

type Props = {
  /** mostra o atalho para o painel apenas para quem também é terapeuta */
  mostrarPainel?: boolean;
};

/**
 * Cabeçalho do cliente: marca ao centro, recados à direita.
 *
 * "Sair" não vive mais aqui — sair da conta é uma decisão, não um botão de
 * navegação, e agora acontece só no Perfil, com confirmação.
 */
export function CabecalhoApp({ mostrarPainel = false }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto grid max-w-2xl grid-cols-[3rem_minmax(0,1fr)_3rem] items-center px-4 py-2.5">
        <div className="flex items-center">
          {mostrarPainel ? (
            <Link
              to="/admin"
              aria-label="Ir para o painel da terapeuta"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-salvia transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        <Link
          to="/app"
          aria-label="Raiz — ir para o Início"
          className="mx-auto inline-flex min-h-11 items-center justify-center"
        >
          <RaizWordmark />
        </Link>

        <div className="flex items-center justify-end">
          <AvisosApp />
        </div>
      </div>
    </header>
  );
}
