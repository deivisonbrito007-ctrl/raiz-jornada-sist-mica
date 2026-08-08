import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Handler = (evento?: any) => void;
let porTabela: Record<string, Handler[]> = {};
let agendadas: { liberar_em: string | null }[] = [];

const canalFake = (nome: string) => {
  const canal: any = {
    nome,
    on: (_evento: string, config: any, handler: Handler) => {
      (porTabela[config.table] ??= []).push(handler);
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
    removeChannel: () => {},
    from: () => ({
      select: () => ({
        eq: () => ({ not: async () => ({ data: agendadas }) }),
      }),
    }),
  },
}));

const { useSincronizarLiberacoes, removerSequenciaDoCache } = await import(
  "./use-sincronizar-liberacoes"
);

let buscas = 0;

function Trilha() {
  useSincronizarLiberacoes();
  const { data } = useQuery({
    queryKey: ["biblioteca"],
    queryFn: async () => {
      buscas += 1;
      return buscas;
    },
  });
  return <span>busca {data ?? 0}</span>;
}

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <Trilha />
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
}

beforeEach(() => {
  porTabela = {};
  agendadas = [];
  buscas = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("expiração e remoção de sequência em tempo real", () => {
  it("assina também a tabela de sequências (eixos)", async () => {
    montar();
    await waitFor(() => expect(porTabela["eixos"]?.length).toBe(1));
  });

  it("descarta o cache da sequência removida pelo terapeuta", async () => {
    const { queryClient } = montar();
    queryClient.setQueryData(["trilha", "eixo-1"], { nome: "Raiz" });
    await waitFor(() => expect(porTabela["eixos"]?.length).toBe(1));

    act(() => {
      porTabela["eixos"]![0]!({ eventType: "DELETE", old: { id: "eixo-1" } });
    });

    expect(queryClient.getQueryData(["trilha", "eixo-1"])).toBeUndefined();
  });

  it("revalida no instante em que uma liberação agendada vira/expira", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    agendadas = [{ liberar_em: new Date(Date.now() + 2000).toISOString() }];
    montar();
    await waitFor(() => expect(porTabela["liberacoes"]?.length).toBe(1));
    await waitFor(() => expect(buscas).toBe(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    await waitFor(() => expect(buscas).toBeGreaterThan(1));
  });

  it("ignora agendamentos já vencidos ou inválidos", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    agendadas = [{ liberar_em: "data-invalida" }, { liberar_em: null }];
    montar();
    await waitFor(() => expect(buscas).toBe(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(buscas).toBe(1);
  });

  it("remove a sequência do cache diretamente pela função exportada", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["trilha", "eixo-9"], { nome: "Vínculo" });
    removerSequenciaDoCache(queryClient, "eixo-9");
    expect(queryClient.getQueryData(["trilha", "eixo-9"])).toBeUndefined();
  });
});
