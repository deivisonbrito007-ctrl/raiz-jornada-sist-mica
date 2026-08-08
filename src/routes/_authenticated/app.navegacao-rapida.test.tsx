import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Navegação rápida entre biblioteca, trilha e player enquanto o terapeuta
 * libera e revoga em sequência.
 *
 * Todas as telas montam sobre o MESMO QueryClient (como no app, onde o cache
 * sobrevive à troca de páginas). Se o cache servir um estado antigo, o cliente
 * veria uma prática revogada continuar clicável — ou o contrário, uma prática
 * recém-liberada sumida. Estes testes alternam telas em rajada e conferem que o
 * estado exibido é sempre o último estado do servidor.
 */

const params = { eixoId: "e-1", conteudoId: "c-1" };
let search: Record<string, unknown> = {};

const fetchBiblioteca = vi.fn<() => Promise<any>>();
const fetchContexto = vi.fn<() => Promise<any>>();
const fetchTrilha = vi.fn<(args: any) => Promise<any>>();
const fetchConteudo = vi.fn<(args: any) => Promise<any>>();
const salvarProgresso = vi.fn(async () => ({ ok: true }));
const salvarPosicaoFn = vi.fn(async () => ({ ok: true }));

const getMinhaBibliotecaMock = Symbol("getMinhaBiblioteca");
const getMeuContextoMock = Symbol("getMeuContexto");
const getEixoTrilhaMock = Symbol("getEixoTrilha");
const getConteudoMock = Symbol("getConteudo");
const salvarPosicaoMock = Symbol("salvarPosicao");
const marcarProgressoMock = Symbol("marcarProgresso");

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => params,
    useSearch: () => search,
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...props }: any) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => {
    if (fn === getMinhaBibliotecaMock) return fetchBiblioteca;
    if (fn === getMeuContextoMock) return fetchContexto;
    if (fn === getEixoTrilhaMock) return fetchTrilha;
    if (fn === getConteudoMock) return fetchConteudo;
    if (fn === salvarPosicaoMock) return salvarPosicaoFn;
    return salvarProgresso;
  },
}));

vi.mock("@/lib/raiz.functions", () => ({
  getMinhaBiblioteca: getMinhaBibliotecaMock,
  getMeuContexto: getMeuContextoMock,
  getEixoTrilha: getEixoTrilhaMock,
  getConteudo: getConteudoMock,
  salvarPosicao: salvarPosicaoMock,
  marcarProgresso: marcarProgressoMock,
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
const { Route: RotaPlayer } = await import("./app.conteudo.$conteudoId");
const Biblioteca = (RotaBiblioteca as unknown as { component: () => React.ReactElement }).component;
const Trilha = (RotaTrilha as unknown as { component: () => React.ReactElement }).component;
const Player = (RotaPlayer as unknown as { component: () => React.ReactElement }).component;

// ---------------------------------------------------------------- utilitários

const PRATICA = "Respiração da raiz";
const CARD_LIBERADO = "0/1 concluídos";
const SEM_ACESSO = "Este eixo será liberado quando for o momento do seu processo.";

const conteudo = {
  id: "c-1",
  eixo_id: "e-1",
  titulo: PRATICA,
  descricao: "Uma prática curta de ancoragem.",
  tipo: "audio" as const,
  corpo_texto: null,
  eixos: { nome: "Pertencimento" },
};

function bibliotecaCom(liberado: boolean) {
  const praticas = liberado
    ? [
        {
          id: "c-1",
          eixoId: "e-1",
          eixoNome: "Pertencimento",
          tipo: "audio",
          titulo: PRATICA,
          duracaoSegundos: 300,
          status: "nao_iniciado",
        },
      ]
    : [];
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
    praticas,
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

function trilhaCom(liberado: boolean) {
  return {
    eixo: { id: "e-1", nome: "Pertencimento", descricao: "Reconhecer o lugar de origem." },
    conteudos: liberado
      ? [
          {
            id: "c-1",
            tipo: "audio",
            titulo: PRATICA,
            descricao: "",
            duracao_segundos: 300,
            ordem: 0,
            status: "nao_iniciado",
          },
        ]
      : [],
  };
}

function playerCom(liberado: boolean) {
  return liberado
    ? {
        conteudo,
        url: "https://exemplo.test/audio.mp3",
        urlExpiraEm: new Date(Date.now() + 60_000).toISOString(),
        status: "nao_iniciado",
        posicaoSegundos: 0,
      }
    : { conteudo: null, url: null, urlExpiraEm: null, status: "nao_iniciado", posicaoSegundos: 0 };
}

/** Estado atual do lado do terapeuta: toda tela montada lê daqui. */
let liberadoNoServidor = true;

function definirServidor(liberado: boolean) {
  liberadoNoServidor = liberado;
  fetchBiblioteca.mockImplementation(async () => bibliotecaCom(liberadoNoServidor));
  fetchTrilha.mockImplementation(async () => trilhaCom(liberadoNoServidor));
  fetchConteudo.mockImplementation(async () => playerCom(liberadoNoServidor));
}

/** Cache único, compartilhado por todas as telas — igual ao app real. */
let queryClient: QueryClient;

/** "Navega" para uma tela: desmonta a anterior e monta a próxima no mesmo cache. */
function navegarPara(Tela: () => React.ReactElement) {
  cleanup();
  handlers = [];
  return render(
    <QueryClientProvider client={queryClient}>
      <Tela />
    </QueryClientProvider>,
  );
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "duration", {
    configurable: true,
    get: () => 300,
  });
  HTMLMediaElement.prototype.play = vi.fn(async () => {});
  HTMLMediaElement.prototype.pause = vi.fn(() => {});
  HTMLMediaElement.prototype.load = vi.fn(() => {});
});

beforeEach(() => {
  handlers = [];
  search = {};
  vi.clearAllMocks();
  queryClient = new QueryClient({
    // igual ao app: dados podem vir do cache ao voltar, mas revalidam
    defaultOptions: { queries: { retry: false } },
  });
  fetchContexto.mockResolvedValue({ perfil: { nome: "Ana Souza" } });
  definirServidor(true);
});

// ---------------------------------------------------------------------- casos

describe("alternância rápida entre biblioteca, trilha e player com liberação/revogação em sequência", () => {
  it("ida e volta pelas três telas mostra a prática enquanto ela está liberada", async () => {
    navegarPara(Biblioteca);
    expect(await screen.findByText(CARD_LIBERADO)).toBeInTheDocument();

    navegarPara(Trilha);
    expect(await screen.findByText(PRATICA)).toBeInTheDocument();

    navegarPara(Player);
    expect(await screen.findByRole("heading", { name: PRATICA })).toBeInTheDocument();

    navegarPara(Biblioteca);
    expect(await screen.findByText(CARD_LIBERADO)).toBeInTheDocument();
  });

  it("após revogar, voltar do player para a trilha e para a biblioteca não reexibe do cache", async () => {
    navegarPara(Biblioteca);
    await screen.findByText(CARD_LIBERADO);
    navegarPara(Player);
    await screen.findByRole("heading", { name: PRATICA });

    // o terapeuta revoga enquanto o cliente está no player
    definirServidor(false);

    navegarPara(Trilha);
    await waitFor(() => expect(screen.queryByText(PRATICA)).not.toBeInTheDocument());

    navegarPara(Biblioteca);
    await waitFor(() => expect(screen.getByText(SEM_ACESSO)).toBeInTheDocument());
    expect(screen.queryByText(PRATICA)).not.toBeInTheDocument();
  });

  it("abrir o player depois da revogação bloqueia, mesmo tendo passado por lá antes", async () => {
    navegarPara(Player);
    await screen.findByRole("heading", { name: PRATICA });

    definirServidor(false);

    navegarPara(Player);
    expect(await screen.findByText(/Prática não está mais liberada/i)).toBeInTheDocument();
    expect(document.querySelector("audio")).toBeNull();
    expect(document.querySelector("video")).toBeNull();
    expect(screen.queryByRole("button", { name: /Marcar como concluída/i })).toBeNull();
  });

  it("nova liberação aparece nas três telas sem exigir recarregar a página", async () => {
    definirServidor(false);
    navegarPara(Biblioteca);
    expect(await screen.findByText(SEM_ACESSO)).toBeInTheDocument();

    definirServidor(true);

    navegarPara(Trilha);
    expect(await screen.findByText(PRATICA)).toBeInTheDocument();

    navegarPara(Player);
    expect(await screen.findByRole("heading", { name: PRATICA })).toBeInTheDocument();

    navegarPara(Biblioteca);
    expect(await screen.findByText(CARD_LIBERADO)).toBeInTheDocument();
    expect(screen.queryByText(SEM_ACESSO)).not.toBeInTheDocument();
  });

  it("rajada de trocas de tela com liberações e revogações alternadas converge no último estado", async () => {
    const roteiro: Array<{ Tela: () => React.ReactElement; liberado: boolean }> = [
      { Tela: Biblioteca, liberado: true },
      { Tela: Trilha, liberado: false },
      { Tela: Player, liberado: true },
      { Tela: Biblioteca, liberado: false },
      { Tela: Trilha, liberado: true },
      { Tela: Player, liberado: false },
    ];

    for (const passo of roteiro) {
      definirServidor(passo.liberado);
      navegarPara(passo.Tela);
      // troca rápida: nem espera a resposta assentar antes da próxima navegação
      await espera(5);
    }

    // estado final do servidor: revogado, no player
    expect(await screen.findByText(/Prática não está mais liberada/i)).toBeInTheDocument();
    expect(document.querySelector("audio")).toBeNull();

    // e as telas de lista concordam com o servidor
    navegarPara(Trilha);
    await waitFor(() => expect(screen.queryByText(PRATICA)).not.toBeInTheDocument());
    navegarPara(Biblioteca);
    await waitFor(() => expect(screen.getByText(SEM_ACESSO)).toBeInTheDocument());
  });

  it("não grava progresso da prática revogada quando o cliente volta ao player em seguida", async () => {
    navegarPara(Player);
    await screen.findByRole("heading", { name: PRATICA });

    definirServidor(false);
    navegarPara(Player);
    await screen.findByText(/Prática não está mais liberada/i);
    await espera(80);

    expect(salvarProgresso).not.toHaveBeenCalled();
    expect(salvarPosicaoFn).not.toHaveBeenCalled();
  });
});
