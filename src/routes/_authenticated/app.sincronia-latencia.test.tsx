import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Sincronização sob latência e reordenação de eventos.
 *
 * O terapeuta pode liberar e revogar em sequência enquanto a conexão do cliente
 * está instável: respostas antigas chegam depois das novas, um refetch falha no
 * meio do caminho. Em todos os casos a interface precisa terminar exibindo o
 * último estado consistente vindo do servidor — nunca uma resposta atrasada.
 */

const params = { eixoId: "e-1" };

const fetchBiblioteca = vi.fn<() => Promise<any>>();
const fetchContexto = vi.fn<() => Promise<any>>();
const fetchTrilha = vi.fn<(args: any) => Promise<any>>();

const getMinhaBibliotecaMock = Symbol("getMinhaBiblioteca");
const getMeuContextoMock = Symbol("getMeuContexto");
const getEixoTrilhaMock = Symbol("getEixoTrilha");

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => params,
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...props }: any) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) =>
    fn === getMinhaBibliotecaMock
      ? fetchBiblioteca
      : fn === getMeuContextoMock
        ? fetchContexto
        : fetchTrilha,
}));

vi.mock("@/lib/raiz.functions", () => ({
  getMinhaBiblioteca: getMinhaBibliotecaMock,
  getMeuContexto: getMeuContextoMock,
  getEixoTrilha: getEixoTrilhaMock,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/** Handlers de tempo real capturados: cada chamada simula um evento de liberação. */
let handlers: Array<() => void> = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "cliente-1" } } }) },
    channel: (nome: string) => {
      const canal: any = {
        nome,
        on: (_e: string, _c: any, handler: () => void) => {
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

const { Route: RotaBiblioteca } = await import("./app.index");
const { Route: RotaTrilha } = await import("./app.eixo.$eixoId");
const Biblioteca = (RotaBiblioteca as unknown as { component: () => React.ReactElement }).component;
const Trilha = (RotaTrilha as unknown as { component: () => React.ReactElement }).component;

// ---------------------------------------------------------------- utilitários

/** Promessa controlada à mão: permite responder fora da ordem em que foi pedida. */
function diferido<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: unknown) => void;
  const promessa = new Promise<T>((ok, falha) => {
    resolver = ok;
    rejeitar = falha;
  });
  return { promessa, resolver, rejeitar };
}

/** Enfileira respostas controladas para um mock, na ordem em que ele for chamado. */
function filaControlada(mock: ReturnType<typeof vi.fn>, quantidade: number) {
  const fila = Array.from({ length: quantidade }, () => diferido<any>());
  let indice = 0;
  mock.mockImplementation(() => {
    const atual = fila[Math.min(indice, fila.length - 1)]!;
    indice += 1;
    return atual.promessa;
  });
  return fila;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function bibliotecaComEixoLiberado(liberado: boolean, praticas: string[] = []) {
  return {
    eixos: [
      {
        id: "e-1",
        nome: "Pertencimento",
        descricao: "Reconhecer o lugar de origem.",
        icone: "sprout",
        ordem: 1,
        liberado,
        abreEm: null,
        total: praticas.length,
        concluidos: 0,
        datasConclusao: [],
      },
    ],
    praticas: praticas.map((titulo, i) => ({
      id: `c-${i + 1}`,
      eixoId: "e-1",
      eixoNome: "Pertencimento",
      tipo: "audio",
      titulo,
      duracaoSegundos: 300,
      status: "nao_iniciado",
    })),
    retomar: null,
    resumo: {
      totalItens: praticas.length,
      totalConcluidos: 0,
      percentual: 0,
      emAndamento: 0,
      datasConclusao: [],
      conclusoes: [],
    },
  };
}

function trilhaCom(praticas: string[]) {
  return {
    eixo: { id: "e-1", nome: "Pertencimento", descricao: "Reconhecer o lugar de origem." },
    conteudos: praticas.map((titulo, i) => ({
      id: `c-${i + 1}`,
      tipo: "audio",
      titulo,
      descricao: "",
      duracao_segundos: 300,
      ordem: i,
      status: "nao_iniciado",
    })),
  };
}

function montar(Tela: () => React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <Tela />
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
}

async function prontoParaEventos() {
  await waitFor(() => expect(handlers.length).toBeGreaterThan(0));
}

function evento() {
  handlers.forEach((h) => h());
}

beforeEach(() => {
  handlers = [];
  vi.clearAllMocks();
  fetchContexto.mockResolvedValue({ perfil: { nome: "Ana Souza" } });
});

// ---------------------------------------------------------------------- casos

describe("sincronização de liberações sob latência e eventos fora de ordem", () => {
  it("mantém o último estado quando a resposta antiga chega depois da nova (biblioteca)", async () => {
    const fila = filaControlada(fetchBiblioteca, 3);
    montar(Biblioteca);
    fila[0]!.resolver(bibliotecaComEixoLiberado(true, ["Respiração da raiz"]));
    expect(await screen.findByText("Pertencimento")).toBeInTheDocument();
    await prontoParaEventos();

    // evento 1 (revogação) fica lento; evento 2 (nova liberação) responde antes
    evento();
    await waitFor(() => expect(fetchBiblioteca).toHaveBeenCalledTimes(2));
    evento();
    await waitFor(() => expect(fetchBiblioteca).toHaveBeenCalledTimes(3));

    fila[2]!.resolver(bibliotecaComEixoLiberado(false));
    await waitFor(() =>
      expect(
        screen.getByText("Este eixo será liberado quando for o momento do seu processo."),
      ).toBeInTheDocument(),
    );

    // a resposta atrasada do evento anterior não pode "ressuscitar" o acesso
    fila[1]!.resolver(bibliotecaComEixoLiberado(true, ["Respiração da raiz"]));
    await tick();
    await tick();
    expect(
      screen.getByText("Este eixo será liberado quando for o momento do seu processo."),
    ).toBeInTheDocument();
  });

  it("não reexibe práticas de uma resposta atrasada na trilha do eixo", async () => {
    const fila = filaControlada(fetchTrilha, 3);
    montar(Trilha);
    fila[0]!.resolver(trilhaCom(["Respiração da raiz", "Carta ao pai", "Linha do tempo"]));
    expect(await screen.findByText("Carta ao pai")).toBeInTheDocument();
    await prontoParaEventos();

    evento();
    await waitFor(() => expect(fetchTrilha).toHaveBeenCalledTimes(2));
    evento();
    await waitFor(() => expect(fetchTrilha).toHaveBeenCalledTimes(3));

    // estado final do servidor: só uma prática segue liberada
    fila[2]!.resolver(trilhaCom(["Respiração da raiz"]));
    await waitFor(() => expect(screen.queryByText("Carta ao pai")).not.toBeInTheDocument());

    fila[1]!.resolver(trilhaCom(["Respiração da raiz", "Carta ao pai", "Linha do tempo"]));
    await tick();
    await tick();
    expect(screen.queryByText("Carta ao pai")).not.toBeInTheDocument();
    expect(screen.queryByText("Linha do tempo")).not.toBeInTheDocument();
    expect(screen.getByText("Respiração da raiz")).toBeInTheDocument();
  });

  it("preserva o estado visível quando a conexão cai e converge no próximo evento", async () => {
    const fila = filaControlada(fetchBiblioteca, 3);
    montar(Biblioteca);
    fila[0]!.resolver(bibliotecaComEixoLiberado(true, ["Respiração da raiz"]));
    expect(await screen.findByText("Pertencimento")).toBeInTheDocument();
    await prontoParaEventos();

    // conexão instável: o refetch falha
    evento();
    await waitFor(() => expect(fetchBiblioteca).toHaveBeenCalledTimes(2));
    fila[1]!.rejeitar(new Error("Failed to fetch"));
    await tick();
    await tick();
    // nada de tela em branco: o último estado consistente continua visível
    expect(screen.getByText("Pertencimento")).toBeInTheDocument();

    // reconectou: o evento seguinte traz o estado atual e a tela converge
    evento();
    await waitFor(() => expect(fetchBiblioteca).toHaveBeenCalledTimes(3));
    fila[2]!.resolver(bibliotecaComEixoLiberado(false));
    await waitFor(() =>
      expect(
        screen.getByText("Este eixo será liberado quando for o momento do seu processo."),
      ).toBeInTheDocument(),
    );
  });

  it("uma rajada de eventos converge para a última resposta, mesmo com respostas embaralhadas", async () => {
    const fila = filaControlada(fetchBiblioteca, 5);
    montar(Biblioteca);
    fila[0]!.resolver(bibliotecaComEixoLiberado(true, ["Respiração da raiz"]));
    expect(await screen.findByText("Pertencimento")).toBeInTheDocument();
    await prontoParaEventos();

    for (let i = 2; i <= 4; i += 1) {
      evento();
      await waitFor(() => expect(fetchBiblioteca).toHaveBeenCalledTimes(i));
    }

    // a última resposta responde primeiro; as anteriores chegam embaralhadas
    fila[3]!.resolver(bibliotecaComEixoLiberado(true, ["Nova prática liberada"]));
    await waitFor(() => expect(screen.getByText("0/1 concluídos")).toBeInTheDocument());

    fila[1]!.resolver(bibliotecaComEixoLiberado(false));
    fila[2]!.resolver(bibliotecaComEixoLiberado(true, ["Antiga", "Outra"]));
    await tick();
    await tick();

    expect(screen.getByText("0/1 concluídos")).toBeInTheDocument();
    expect(
      screen.queryByText("Este eixo será liberado quando for o momento do seu processo."),
    ).not.toBeInTheDocument();
  });
});
