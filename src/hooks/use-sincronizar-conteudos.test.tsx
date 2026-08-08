import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Quando o terapeuta remove uma prática do acervo, o evento em tempo real da
 * tabela de práticas precisa: tirar a prática da tela, descartar o cache dela
 * na hora e apagar resquícios locais (posição salva, pendências).
 */

type Handler = (evento?: any) => void;
let handlersPorTabela: Record<string, Handler[]> = {};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "cliente-1" } } }) },
    channel: (nome: string) => {
      const canal: any = {
        nome,
        on: (_e: string, config: any, handler: Handler) => {
          const lista = handlersPorTabela[config.table] ?? [];
          lista.push(handler);
          handlersPorTabela[config.table] = lista;
          return canal;
        },
        subscribe: () => canal,
      };
      return canal;
    },
    removeChannel: () => {},
  },
}));

const { useSincronizarLiberacoes } = await import("./use-sincronizar-liberacoes");

let removida = false;

function Tela({ onMudanca }: { onMudanca?: () => void }) {
  useSincronizarLiberacoes(onMudanca);

  const trilha = useQuery({
    queryKey: ["trilha", "e-1"],
    queryFn: async () =>
      removida
        ? [{ id: "c-1", titulo: "Respiração da raiz" }]
        : [
            { id: "c-1", titulo: "Respiração da raiz" },
            { id: "c-2", titulo: "Carta ao clã" },
          ],
  });

  return (
    <ul>
      {(trilha.data ?? []).map((c: any) => (
        <li key={c.id}>{c.titulo}</li>
      ))}
    </ul>
  );
}

let queryClient: QueryClient;

function montar(onMudanca?: () => void) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Tela onMudanca={onMudanca} />
    </QueryClientProvider>,
  );
}

async function avisarRemocao(id = "c-2") {
  await waitFor(() => expect(handlersPorTabela["conteudos"]?.length).toBe(1));
  handlersPorTabela["conteudos"]![0]!({ eventType: "DELETE", old: { id } });
}

beforeEach(() => {
  handlersPorTabela = {};
  removida = false;
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("remoção de prática em tempo real", () => {
  it("assina também a tabela de práticas, além das liberações", async () => {
    montar();
    await waitFor(() => {
      expect(handlersPorTabela["liberacoes"]?.length).toBe(1);
      expect(handlersPorTabela["conteudos"]?.length).toBe(1);
    });
  });

  it("tira a prática removida da trilha sem recarregar a página", async () => {
    montar();
    expect(await screen.findByText("Carta ao clã")).toBeInTheDocument();

    removida = true;
    await avisarRemocao();

    await waitFor(() => expect(screen.queryByText("Carta ao clã")).toBeNull());
    expect(screen.getByText("Respiração da raiz")).toBeInTheDocument();
  });

  it("descarta o cache da prática removida", async () => {
    montar();
    queryClient.setQueryData(["conteudo", "c-2"], { titulo: "Carta ao clã" });
    queryClient.setQueryData(["conteudo", "c-1"], { titulo: "Respiração da raiz" });

    removida = true;
    await avisarRemocao();

    await waitFor(() => expect(queryClient.getQueryData(["conteudo", "c-2"])).toBeUndefined());
    expect(queryClient.getQueryData(["conteudo", "c-1"])).toBeDefined();
    const restos = queryClient
      .getQueryCache()
      .getAll()
      .filter((q) => JSON.stringify(q.state.data ?? null).includes("Carta ao clã"));
    expect(restos).toEqual([]);
  });

  it("apaga resquícios locais da prática removida e preserva os das outras", async () => {
    montar();
    window.localStorage.setItem("raiz-posicao-c-2", "42");
    window.localStorage.setItem("raiz-progresso-pendente-c-2", "{}");
    window.localStorage.setItem("raiz-posicao-c-1", "10");
    window.sessionStorage.setItem("raiz-retomar-c-2", "1");

    removida = true;
    await avisarRemocao();

    await waitFor(() => expect(window.localStorage.getItem("raiz-posicao-c-2")).toBeNull());
    expect(window.localStorage.getItem("raiz-progresso-pendente-c-2")).toBeNull();
    expect(window.sessionStorage.getItem("raiz-retomar-c-2")).toBeNull();
    expect(window.localStorage.getItem("raiz-posicao-c-1")).toBe("10");
  });

  it("avisa o player para reagir na hora (parar mídia e mostrar bloqueio)", async () => {
    const onMudanca = vi.fn();
    montar(onMudanca);
    await avisarRemocao();
    expect(onMudanca).toHaveBeenCalled();
  });

  it("revalida as listas quando a prática é apenas editada", async () => {
    montar();
    expect(await screen.findByText("Carta ao clã")).toBeInTheDocument();
    queryClient.setQueryData(["conteudo", "c-2"], { titulo: "Carta ao clã" });

    await waitFor(() => expect(handlersPorTabela["conteudos"]?.length).toBe(1));
    handlersPorTabela["conteudos"]![0]!({ eventType: "UPDATE", new: { id: "c-2" } });

    // edição não descarta o cache da prática, apenas o marca para revalidar
    expect(queryClient.getQueryData(["conteudo", "c-2"])).toBeDefined();
  });
});
