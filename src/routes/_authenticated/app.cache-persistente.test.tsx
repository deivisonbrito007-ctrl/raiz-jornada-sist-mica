import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Remoção de conteúdo de uma sequência (trilha) e cache persistente/local.
 *
 * Quando o terapeuta remove uma prática da sequência, o cliente não pode
 * continuar vendo resquícios dela: nem no cache do TanStack Query (que sobrevive
 * à troca de páginas), nem em armazenamento local do navegador. Estes testes
 * navegam para outra página e voltam usando o MESMO cache, como acontece no app.
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

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

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

const REMOVIDA = "Carta ao pai";
const MANTIDA = "Respiração da raiz";

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

function bibliotecaCom(praticas: string[]) {
  return {
    eixos: [
      {
        id: "e-1",
        nome: "Pertencimento",
        descricao: "Reconhecer o lugar de origem.",
        icone: "sprout",
        ordem: 1,
        liberado: true,
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

/** Cache que sobrevive à navegação: dados “frescos” por 5 min e nunca coletados. */
function criarCachePersistente() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 5 * 60 * 1000, gcTime: Infinity },
    },
  });
}

function montar(Tela: () => React.ReactElement, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <Tela />
    </QueryClientProvider>,
  );
}

async function prontoParaEventos() {
  await waitFor(() => expect(handlers.length).toBeGreaterThan(0));
}

function eventoDeRemocao() {
  handlers.forEach((h) => h());
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function textoDoCache(queryClient: QueryClient) {
  return JSON.stringify(queryClient.getQueryCache().getAll().map((q) => q.state.data));
}

beforeEach(() => {
  handlers = [];
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  fetchContexto.mockResolvedValue({ perfil: { nome: "Ana Souza" } });
});

// ---------------------------------------------------------------------- casos

describe("remoção de conteúdo da sequência invalida cache persistente", () => {
  it("apaga a prática removida dos dados guardados em cache", async () => {
    const queryClient = criarCachePersistente();
    fetchTrilha.mockResolvedValue(trilhaCom([MANTIDA, REMOVIDA]));
    montar(Trilha, queryClient);
    expect(await screen.findByText(REMOVIDA)).toBeInTheDocument();
    await prontoParaEventos();

    fetchTrilha.mockResolvedValue(trilhaCom([MANTIDA]));
    eventoDeRemocao();

    await waitFor(() => expect(screen.queryByText(REMOVIDA)).not.toBeInTheDocument());
    expect(textoDoCache(queryClient)).not.toContain(REMOVIDA);
    expect(textoDoCache(queryClient)).toContain(MANTIDA);
  });

  it("não reexibe a prática removida ao sair da página e voltar", async () => {
    const queryClient = criarCachePersistente();
    fetchTrilha.mockResolvedValue(trilhaCom([MANTIDA, REMOVIDA]));
    const tela = montar(Trilha, queryClient);
    await screen.findByText(REMOVIDA);
    await prontoParaEventos();

    fetchTrilha.mockResolvedValue(trilhaCom([MANTIDA]));
    eventoDeRemocao();
    await waitFor(() => expect(screen.queryByText(REMOVIDA)).not.toBeInTheDocument());

    // navega para outra página (desmonta) e volta reusando o mesmo cache
    tela.unmount();
    handlers = [];
    montar(Trilha, queryClient);

    expect(await screen.findByText(MANTIDA)).toBeInTheDocument();
    await tick();
    await tick();
    expect(screen.queryByText(REMOVIDA)).not.toBeInTheDocument();
  });

  it("a biblioteca também volta sem resquício da prática removida", async () => {
    const queryClient = criarCachePersistente();
    fetchBiblioteca.mockResolvedValue(bibliotecaCom([MANTIDA, REMOVIDA]));
    const tela = montar(Biblioteca, queryClient);
    expect(await screen.findByText(REMOVIDA)).toBeInTheDocument();
    await prontoParaEventos();

    fetchBiblioteca.mockResolvedValue(bibliotecaCom([MANTIDA]));
    eventoDeRemocao();
    await waitFor(() => expect(screen.queryByText(REMOVIDA)).not.toBeInTheDocument());

    tela.unmount();
    handlers = [];
    montar(Biblioteca, queryClient);

    expect(await screen.findByText(MANTIDA)).toBeInTheDocument();
    await tick();
    await tick();
    expect(screen.queryByText(REMOVIDA)).not.toBeInTheDocument();
    expect(textoDoCache(queryClient)).not.toContain(REMOVIDA);
  });

  it("marca o cache do player da prática removida como inválido, forçando nova checagem", async () => {
    const queryClient = criarCachePersistente();
    queryClient.setQueryData(["conteudo", "c-2"], {
      conteudo: { id: "c-2", titulo: REMOVIDA, eixo_id: "e-1" },
      url: "https://exemplo.test/carta-ao-pai.mp3",
      urlExpiraEm: new Date(Date.now() + 3600_000).toISOString(),
      status: "em_andamento",
    });

    fetchTrilha.mockResolvedValue(trilhaCom([MANTIDA, REMOVIDA]));
    montar(Trilha, queryClient);
    await screen.findByText(REMOVIDA);
    await prontoParaEventos();

    fetchTrilha.mockResolvedValue(trilhaCom([MANTIDA]));
    eventoDeRemocao();
    await waitFor(() => expect(screen.queryByText(REMOVIDA)).not.toBeInTheDocument());

    const consulta = queryClient.getQueryCache().find({ queryKey: ["conteudo", "c-2"] });
    expect(consulta?.state.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["conteudo", "c-2"])?.isInvalidated).toBe(true);
  });

  it("não deixa resquício da prática removida no armazenamento local do navegador", async () => {
    const queryClient = criarCachePersistente();
    fetchTrilha.mockResolvedValue(trilhaCom([MANTIDA, REMOVIDA]));
    const tela = montar(Trilha, queryClient);
    await screen.findByText(REMOVIDA);
    await prontoParaEventos();

    fetchTrilha.mockResolvedValue(trilhaCom([MANTIDA]));
    eventoDeRemocao();
    await waitFor(() => expect(screen.queryByText(REMOVIDA)).not.toBeInTheDocument());

    tela.unmount();
    handlers = [];
    montar(Trilha, queryClient);
    await screen.findByText(MANTIDA);

    const local = Object.keys(localStorage).map((k) => `${k}:${localStorage.getItem(k)}`).join("|");
    const sessao = Object.keys(sessionStorage)
      .map((k) => `${k}:${sessionStorage.getItem(k)}`)
      .join("|");
    expect(local).not.toContain(REMOVIDA);
    expect(local).not.toContain("c-2");
    expect(sessao).not.toContain(REMOVIDA);
  });
});
