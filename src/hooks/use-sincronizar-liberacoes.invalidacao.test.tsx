import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Ao atualizar liberações, tudo que depende delas precisa ser invalidado:
 * biblioteca, trilhas de cada eixo, o conteúdo aberto e as sequências
 * (contexto/progresso). Nenhum resquício do conteúdo revogado pode continuar
 * acessível — nem na tela, nem no cache.
 */

type Handler = () => void;
let handlers: Handler[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "cliente-1" } } }) },
    channel: (nome: string) => {
      const canal: any = {
        nome,
        on: (_e: string, _c: any, handler: Handler) => {
          handlers.push(handler);
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

/** Estado do servidor: "c-2" (Carta ao clã) é revogado na segunda rodada. */
let revogado = false;

const chamadas: Record<string, number> = {};
function contar(chave: string) {
  chamadas[chave] = (chamadas[chave] ?? 0) + 1;
}

const conteudosDoEixo = (eixoId: string) =>
  eixoId === "e-1"
    ? revogado
      ? [{ id: "c-1", titulo: "Respiração da raiz" }]
      : [
          { id: "c-1", titulo: "Respiração da raiz" },
          { id: "c-2", titulo: "Carta ao clã" },
        ]
    : [{ id: "c-3", titulo: "Linha do tempo familiar" }];

function Tela() {
  useSincronizarLiberacoes();

  const biblioteca = useQuery({
    queryKey: ["biblioteca"],
    queryFn: async () => {
      contar("biblioteca");
      return {
        eixos: [
          { id: "e-1", nome: "Pertencimento", conteudos: conteudosDoEixo("e-1") },
          { id: "e-2", nome: "Ordem", conteudos: conteudosDoEixo("e-2") },
        ],
      };
    },
  });

  const trilha1 = useQuery({
    queryKey: ["trilha", "e-1"],
    queryFn: async () => {
      contar("trilha:e-1");
      return { conteudos: conteudosDoEixo("e-1") };
    },
  });

  const trilha2 = useQuery({
    queryKey: ["trilha", "e-2"],
    queryFn: async () => {
      contar("trilha:e-2");
      return { conteudos: conteudosDoEixo("e-2") };
    },
  });

  const conteudo = useQuery({
    queryKey: ["conteudo", "c-2"],
    queryFn: async () => {
      contar("conteudo:c-2");
      return revogado ? { conteudo: null } : { conteudo: { id: "c-2", titulo: "Carta ao clã" } };
    },
  });

  const contexto = useQuery({
    queryKey: ["contexto"],
    queryFn: async () => {
      contar("contexto");
      return {
        sequencia: revogado ? 2 : 3,
        praticas: revogado ? ["Respiração da raiz"] : ["Respiração da raiz", "Carta ao clã"],
      };
    },
  });

  return (
    <div>
      <ul aria-label="biblioteca">
        {(biblioteca.data?.eixos ?? []).flatMap((e: any) =>
          e.conteudos.map((c: any) => <li key={`b-${c.id}`}>{`biblioteca: ${c.titulo}`}</li>),
        )}
      </ul>
      <ul aria-label="trilha e-1">
        {(trilha1.data?.conteudos ?? []).map((c: any) => (
          <li key={`t1-${c.id}`}>{`trilha 1: ${c.titulo}`}</li>
        ))}
      </ul>
      <ul aria-label="trilha e-2">
        {(trilha2.data?.conteudos ?? []).map((c: any) => (
          <li key={`t2-${c.id}`}>{`trilha 2: ${c.titulo}`}</li>
        ))}
      </ul>
      <p>{`conteudo aberto: ${conteudo.data?.conteudo?.titulo ?? "sem acesso"}`}</p>
      <p>{`sequencia: ${contexto.data?.sequencia ?? 0}`}</p>
      <ul aria-label="sequencia">
        {(contexto.data?.praticas ?? []).map((t: string) => (
          <li key={`s-${t}`}>{`sequencia: ${t}`}</li>
        ))}
      </ul>
    </div>
  );
}

let queryClient: QueryClient;

function montar() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Tela />
    </QueryClientProvider>,
  );
}

async function avisarMudanca() {
  await waitFor(() => expect(handlers.length).toBeGreaterThan(0));
  handlers.forEach((h) => h());
}

beforeEach(() => {
  handlers = [];
  revogado = false;
  for (const k of Object.keys(chamadas)) delete chamadas[k];
});

describe("atualização de liberações invalida trilhas, eixos e sequências", () => {
  it("refaz biblioteca, todas as trilhas, o conteúdo aberto e as sequências", async () => {
    montar();
    expect(await screen.findByText("trilha 1: Carta ao clã")).toBeInTheDocument();
    await waitFor(() => expect(chamadas["contexto"]).toBe(1));

    revogado = true;
    await avisarMudanca();

    await waitFor(() => {
      expect(chamadas["biblioteca"]).toBe(2);
      expect(chamadas["trilha:e-1"]).toBe(2);
      expect(chamadas["trilha:e-2"]).toBe(2);
      expect(chamadas["conteudo:c-2"]).toBe(2);
      expect(chamadas["contexto"]).toBe(2);
    });
  });

  it("remove o conteúdo revogado da biblioteca, da trilha e da sequência", async () => {
    montar();
    expect(await screen.findByText("biblioteca: Carta ao clã")).toBeInTheDocument();
    expect(await screen.findByText("sequencia: Carta ao clã")).toBeInTheDocument();

    revogado = true;
    await avisarMudanca();

    await waitFor(() => expect(screen.queryByText("biblioteca: Carta ao clã")).toBeNull());
    expect(screen.queryByText("trilha 1: Carta ao clã")).toBeNull();
    expect(screen.queryByText("sequencia: Carta ao clã")).toBeNull();
    expect(screen.getByText("sequencia: 2")).toBeInTheDocument();
    expect(screen.getByText("conteudo aberto: sem acesso")).toBeInTheDocument();
    // o que continua liberado permanece visível
    expect(screen.getByText("trilha 1: Respiração da raiz")).toBeInTheDocument();
    expect(screen.getByText("trilha 2: Linha do tempo familiar")).toBeInTheDocument();
  });

  it("não deixa resquício do conteúdo revogado no cache de nenhuma chave", async () => {
    montar();
    expect(await screen.findByText("trilha 1: Carta ao clã")).toBeInTheDocument();

    revogado = true;
    await avisarMudanca();
    await waitFor(() => expect(chamadas["contexto"]).toBe(2));

    const restos = queryClient
      .getQueryCache()
      .getAll()
      .filter((q) => JSON.stringify(q.state.data ?? null).includes("Carta ao clã"))
      .map((q) => q.queryKey);

    expect(restos).toEqual([]);
  });

  it("mantém as trilhas de outros eixos consistentes após reliberar", async () => {
    revogado = true;
    montar();
    expect(await screen.findByText("trilha 1: Respiração da raiz")).toBeInTheDocument();
    expect(screen.queryByText("trilha 1: Carta ao clã")).toBeNull();

    revogado = false;
    await avisarMudanca();

    expect(await screen.findByText("trilha 1: Carta ao clã")).toBeInTheDocument();
    expect(screen.getByText("biblioteca: Carta ao clã")).toBeInTheDocument();
    expect(screen.getByText("sequencia: 3")).toBeInTheDocument();
    expect(screen.getByText("conteudo aberto: Carta ao clã")).toBeInTheDocument();
    expect(screen.getByText("trilha 2: Linha do tempo familiar")).toBeInTheDocument();
  });
});
