import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Concorrência: o terapeuta libera e revoga o mesmo cliente em sequência rápida.
 * O cliente precisa terminar sempre no último estado, mesmo quando as respostas
 * do servidor chegam fora de ordem.
 */

const params = { conteudoId: "c-1" };
const navigate = vi.fn();

const fetchConteudo = vi.fn<(args: any) => Promise<any>>();
const salvarProgresso = vi.fn<(args: any) => Promise<any>>();

const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => params,
  }),
  useNavigate: () => navigate,
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) =>
    fn === getConteudoMock ? fetchConteudo : fn === salvarPosicaoMock ? salvarPosicaoFn : salvarProgresso,
}));

const getConteudoMock = Symbol("getConteudo");
const salvarPosicaoMock = Symbol("salvarPosicao");
const salvarPosicaoFn = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/raiz.functions", () => ({
  salvarPosicao: salvarPosicaoMock,
  getConteudo: getConteudoMock,
  marcarProgresso: Symbol("marcarProgresso"),
}));

vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess, info: toastInfo } }));

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

const { Route } = await import("./app.conteudo.$conteudoId");
const PlayerPage = (Route as unknown as { component: () => React.ReactElement }).component;

const conteudo = {
  id: "c-1",
  eixo_id: "e-1",
  titulo: "Respiração da raiz",
  descricao: "Uma prática curta de ancoragem.",
  tipo: "audio" as const,
  corpo_texto: null,
  eixos: { nome: "Pertencimento" },
};

function liberado() {
  return {
    conteudo,
    url: "https://exemplo.test/audio.mp3",
    urlExpiraEm: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: "nao_iniciado",
  };
}

function revogado() {
  return { conteudo: null, url: null, urlExpiraEm: null, status: "nao_iniciado" };
}

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
});

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlayerPage />
    </QueryClientProvider>,
  );
}

async function pronto() {
  await waitFor(() => expect(handlers.length).toBeGreaterThan(0));
}

/** Dispara os eventos de tempo real como o terapeuta salvando em sequência rápida. */
function rajada(vezes: number) {
  for (let i = 0; i < vezes; i += 1) handlers.forEach((h) => h());
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("alterações concorrentes do terapeuta no mesmo cliente", () => {
  it("termina bloqueado quando a última alteração da rajada é uma revogação", async () => {
    fetchConteudo.mockResolvedValueOnce(liberado());
    montar();
    expect(await screen.findByText("Respiração da raiz")).toBeInTheDocument();
    await pronto();

    // libera -> revoga -> libera -> revoga, em sequência rápida
    fetchConteudo
      .mockResolvedValueOnce(liberado())
      .mockResolvedValueOnce(revogado())
      .mockResolvedValueOnce(liberado())
      .mockResolvedValue(revogado());
    rajada(4);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Esta prática não está mais liberada para você."),
    );
    expect(await screen.findByText(/Prática não está mais liberada/i)).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("termina liberado quando a última alteração da rajada é uma liberação", async () => {
    fetchConteudo.mockResolvedValueOnce(revogado());
    montar();
    await pronto();

    fetchConteudo
      .mockResolvedValueOnce(revogado())
      .mockResolvedValueOnce(liberado())
      .mockResolvedValueOnce(revogado())
      .mockResolvedValue(liberado());
    rajada(4);

    expect(await screen.findByText("Respiração da raiz")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Prática não está mais liberada/i)).toBeNull());
  });

  it("ignora resposta antiga que chega depois da mais recente (fora de ordem)", async () => {
    fetchConteudo.mockResolvedValueOnce(liberado());
    montar();
    expect(await screen.findByText("Respiração da raiz")).toBeInTheDocument();
    await pronto();

    // A revogação (mais antiga) responde devagar; a liberação seguinte responde rápido.
    fetchConteudo.mockImplementationOnce(async () => {
      await espera(80);
      return revogado();
    });
    fetchConteudo.mockImplementation(async () => liberado());
    rajada(2);

    await espera(200);
    await waitFor(() => expect(screen.getByText("Respiração da raiz")).toBeInTheDocument());
    expect(screen.queryByText(/Prática não está mais liberada/i)).toBeNull();
  });

  it("não duplica avisos quando a mesma revogação chega várias vezes", async () => {
    fetchConteudo.mockResolvedValueOnce(liberado());
    montar();
    expect(await screen.findByText("Respiração da raiz")).toBeInTheDocument();
    await pronto();

    fetchConteudo.mockResolvedValue(revogado());
    rajada(3);
    await espera(150);
    rajada(2);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    await espera(100);
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
