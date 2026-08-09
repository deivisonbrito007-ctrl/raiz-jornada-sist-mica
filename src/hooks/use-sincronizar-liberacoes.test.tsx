import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Handler = () => void;
let handlers: Handler[] = [];
let canaisRemovidos: string[] = [];
let filtros: string[] = [];

const canalFake = (nome: string) => {
  const canal: any = {
    nome,
    on: (_evento: string, config: any, handler: Handler) => {
      filtros.push(config.filter);
      handlers.push(handler);
      return canal;
    },
    subscribe: () => canal,
  };
  return canal;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "cliente-1" } } }) },
    channel: (nome: string) => canalFake(nome),
    removeChannel: (canal: any) => {
      canaisRemovidos.push(canal.nome);
    },
  },
}));

const { useSincronizarLiberacoes } = await import("./use-sincronizar-liberacoes");

let buscas = 0;

function Biblioteca({ onMudanca }: { onMudanca?: (() => void) | undefined }) {
  useSincronizarLiberacoes(onMudanca);
  const { data } = useQuery({
    queryKey: ["biblioteca"],
    queryFn: async () => {
      buscas += 1;
      return { liberados: buscas === 1 ? ["Respiração da raiz"] : ["Respiração da raiz", "Carta ao clã"] };
    },
  });
  return (
    <ul>
      {(data?.liberados ?? []).map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function montar(onMudanca?: () => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <Biblioteca onMudanca={onMudanca} />
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
}

beforeEach(() => {
  handlers = [];
  canaisRemovidos = [];
  filtros = [];
  buscas = 0;
});

describe("sincronização de liberações na interface do cliente", () => {
  it("assina apenas as liberações do próprio cliente", async () => {
    montar();
    await waitFor(() => expect(handlers.length).toBe(3));
    expect(filtros).toEqual(["cliente_id=eq.cliente-1", undefined, undefined]);
  });

  it("atualiza a biblioteca ao receber uma liberação nova, sem recarregar", async () => {
    montar();
    expect(await screen.findByText("Respiração da raiz")).toBeInTheDocument();
    expect(screen.queryByText("Carta ao clã")).not.toBeInTheDocument();

    await waitFor(() => expect(handlers.length).toBe(3));
    handlers[0]!();

    expect(await screen.findByText("Carta ao clã")).toBeInTheDocument();
    expect(buscas).toBe(2);
  });

  it("avisa o player (onMudanca) a cada liberação ou revogação recebida", async () => {
    const onMudanca = vi.fn();
    montar(onMudanca);
    await waitFor(() => expect(handlers.length).toBe(3));

    handlers[0]!();
    handlers[0]!();

    expect(onMudanca).toHaveBeenCalledTimes(2);
  });

  it("encerra a assinatura ao sair da tela", async () => {
    const { unmount } = montar();
    await waitFor(() => expect(handlers.length).toBe(3));
    unmount();
    // o tópico leva um sufixo único por instância do hook, evitando conflito
    // com outra tela montada ao mesmo tempo
    await waitFor(() => expect(canaisRemovidos).toHaveLength(3));
    expect(
      canaisRemovidos.map((nome) => nome.replace(/-[a-z0-9]+$/, "")),
    ).toEqual([
      "raiz-liberacoes-cliente-1",
      "raiz-conteudos-cliente-1",
      "raiz-eixos-cliente-1",
    ]);
  });
});
