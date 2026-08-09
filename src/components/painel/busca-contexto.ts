import { createContext, useContext } from "react";

type Busca = { termo: string; definir: (valor: string) => void };

export const PainelBuscaContext = createContext<Busca>({
  termo: "",
  definir: () => {},
});

/** Pesquisa contextual do cabeçalho do painel, consumida pela página atual. */
export function usePainelBusca() {
  return useContext(PainelBuscaContext);
}
