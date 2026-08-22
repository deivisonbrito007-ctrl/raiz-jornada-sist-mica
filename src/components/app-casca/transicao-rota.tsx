import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Transição suave entre as telas do cliente.
 *
 * A chave muda a cada rota, então o conteúdo entra com um fade e uma subida
 * curta. Quem prefere menos movimento não vê animação nenhuma (regra no CSS
 * da utilidade `animate-surgir`).
 */
export function TransicaoRota({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <div key={pathname} className="animate-surgir">
      {children}
    </div>
  );
}
