import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { esperarSemViolacoes, auditarAcessibilidade } from "@/test/axe";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Rotina automatizada de acessibilidade (axe-core) nas telas principais do
 * cliente: biblioteca, trilha (sequência) e player — incluindo os estados de
 * carregamento, filtros abertos e mídia bloqueada.
 */

const params = { conteudoId: "c-1", eixoId: "e-1" };

const fetchBiblioteca = vi.fn<() => Promise<any>>();
const fetchContexto = vi.fn<() => Promise<any>>();
const fetchTrilha = vi.fn<(args: any) => Promise<any>>();
const fetchConteudo = vi.fn<(args: any) => Promise<any>>();
const salvarPosicaoFn = vi.fn(async () => ({ ok: true }));
const salvarProgresso = vi.fn(async () => ({ ok: true }));

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
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, params: _p, search: _s, ...props }: any) => (
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
        : fn === getEixoTrilhaMock
          ? fetchTrilha
          : fn === getConteudoMock
            ? fetchConteudo
            : fn === salvarPosicaoMock
              ? salvarPosicaoFn
              : salvarProgresso,
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

// ---------------------------------------------------------------- dados de apoio

const TITULO = "Respiração da raiz";

function bibliotecaCompleta() {
  const hoje = new Date().toISOString().slice(0, 10);
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
        total: 2,
        concluidos: 1,
        datasConclusao: [hoje],
      },
      {
        id: "e-2",
        nome: "Limites",
        descricao: "Dizer não com cuidado.",
        icone: "shield",
        ordem: 2,
        liberado: false,
        abreEm: null,
        total: 1,
        concluidos: 0,
        datasConclusao: [],
      },
    ],
    praticas: [
      {
        id: "c-1",
        eixoId: "e-1",
        eixoNome: "Pertencimento",
        tipo: "audio",
        titulo: TITULO,
        duracaoSegundos: 300,
        status: "em_andamento",
      },
      {
        id: "c-2",
        eixoId: "e-1",
        eixoNome: "Pertencimento",
        tipo: "texto",
        titulo: "Carta ao pai",
        duracaoSegundos: 240,
        status: "concluido",
      },
    ],
    retomar: { conteudoId: "c-1", titulo: TITULO, eixoNome: "Pertencimento" },
    resumo: {
      totalItens: 2,
      totalConcluidos: 1,
      percentual: 50,
      emAndamento: 1,
      datasConclusao: [hoje],
      conclusoes: [{ data: hoje, titulo: "Carta ao pai", eixoNome: "Pertencimento" }],
    },
  };
}

function trilhaCompleta() {
  return {
    eixo: { id: "e-1", nome: "Pertencimento", descricao: "Reconhecer o lugar de origem." },
    conteudos: [
      {
        id: "c-1",
        tipo: "audio",
        titulo: TITULO,
        descricao: "Cinco minutos de respiração.",
        duracao_segundos: 300,
        ordem: 0,
        status: "em_andamento",
      },
      {
        id: "c-2",
        tipo: "texto",
        titulo: "Carta ao pai",
        descricao: "Escrever sem enviar.",
        duracao_segundos: 240,
        ordem: 1,
        status: "concluido",
      },
    ],
  };
}

const conteudo = {
  id: "c-1",
  eixo_id: "e-1",
  titulo: TITULO,
  descricao: "Cinco minutos de respiração.",
  tipo: "audio" as const,
  corpo_texto: null,
  eixos: { nome: "Pertencimento" },
};

const liberado = (validadeMs = 300_000) => ({
  conteudo,
  url: "https://exemplo.test/respiracao.mp3",
  urlExpiraEm: new Date(Date.now() + validadeMs).toISOString(),
  status: "em_andamento",
});

const revogado = () => ({ conteudo: null, url: null, urlExpiraEm: null, status: "nao_iniciado" });

function montar(Tela: () => React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <main>
        <Tela />
      </main>
    </QueryClientProvider>,
  );
}

const audio = () => document.querySelector("audio") as HTMLAudioElement | null;

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "duration", {
    configurable: true,
    get: () => 120,
  });
  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get() {
      return (this as any)._t ?? 0;
    },
    set(v: number) {
      (this as any)._t = v;
    },
  });
  HTMLMediaElement.prototype.play = vi.fn(async () => {});
  HTMLMediaElement.prototype.pause = vi.fn(() => {});
});

beforeEach(() => {
  handlers = [];
  vi.clearAllMocks();
  localStorage.clear();
  fetchContexto.mockResolvedValue({ perfil: { nome: "Ana Souza", meta_semanal: 3 } });
  fetchBiblioteca.mockResolvedValue(bibliotecaCompleta());
  fetchTrilha.mockResolvedValue(trilhaCompleta());
  fetchConteudo.mockResolvedValue(liberado());
});

// ---------------------------------------------------------------------- casos

describe("acessibilidade da biblioteca", () => {
  it("não tem violações de acessibilidade com os dados carregados", async () => {
    const { container } = montar(Biblioteca);
    await screen.findByText(TITULO);
    await esperarSemViolacoes(container);
  });

  it("não tem violações durante o carregamento", async () => {
    fetchBiblioteca.mockReturnValue(new Promise(() => {}));
    const { container } = montar(Biblioteca);
    await esperarSemViolacoes(container);
  });

  it("mantém os campos de busca e filtros com nome acessível", async () => {
    const { container } = montar(Biblioteca);
    await screen.findByText(TITULO);

    const resultado = await auditarAcessibilidade(container);
    const semNome = resultado.violations.filter((v) =>
      ["label", "select-name", "button-name", "aria-input-field-name"].includes(v.id),
    );
    expect(semNome, JSON.stringify(semNome.map((v) => v.id))).toHaveLength(0);
  });
});

describe("acessibilidade da trilha", () => {
  it("não tem violações de acessibilidade com a sequência carregada", async () => {
    const { container } = montar(Trilha);
    await screen.findByText(TITULO);
    await esperarSemViolacoes(container);
  });

  it("não tem violações durante o carregamento", async () => {
    fetchTrilha.mockReturnValue(new Promise(() => {}));
    const { container } = montar(Trilha);
    await esperarSemViolacoes(container);
  });
});

describe("acessibilidade do player", () => {
  it("não tem violações com a mídia liberada", async () => {
    const { container } = montar(Player);
    await waitFor(() => expect(audio()).not.toBeNull());
    await esperarSemViolacoes(container);
  });

  it("não tem violações quando o link seguro expira", async () => {
    const { container } = montar(Player);
    await waitFor(() => expect(audio()).not.toBeNull());

    fireEvent.error(audio()!);
    await screen.findByRole("heading", { name: "O link seguro expirou" });

    await esperarSemViolacoes(container);
  });

  it("não tem violações quando o acesso é revogado", async () => {
    const { container } = montar(Player);
    await waitFor(() => expect(audio()).not.toBeNull());
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0));

    fetchConteudo.mockResolvedValue(revogado());
    handlers.forEach((h) => h());
    await screen.findByRole("heading", { name: "Prática não está mais liberada" });

    await esperarSemViolacoes(container);
  });
});
