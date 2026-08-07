import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  useServerFn: (fn: unknown) => (fn === getConteudoMock ? fetchConteudo : salvarProgresso),
}));

const getConteudoMock = Symbol("getConteudo");
vi.mock("@/lib/raiz.functions", () => ({
  getConteudo: getConteudoMock,
  marcarProgresso: Symbol("marcarProgresso"),
}));

vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess, info: toastInfo } }));

/** Captura o handler de tempo real para simular o terapeuta liberando/revogando. */
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

async function avisarMudanca() {
  await waitFor(() => expect(handlers.length).toBeGreaterThan(0));
  handlers.forEach((h) => h());
}

describe("player reage a liberação e revogação em tempo real", () => {
  it("bloqueia a mídia na hora quando o terapeuta revoga, sem recarregar a página", async () => {
    fetchConteudo.mockResolvedValueOnce(liberado());
    montar();
    expect(await screen.findByText("Respiração da raiz")).toBeInTheDocument();

    fetchConteudo.mockResolvedValueOnce(revogado());
    await avisarMudanca();

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Esta prática não está mais liberada para você."),
    );
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("libera o player de novo quando o terapeuta volta a liberar", async () => {
    fetchConteudo.mockResolvedValueOnce(liberado());
    montar();
    expect(await screen.findByText("Respiração da raiz")).toBeInTheDocument();

    fetchConteudo.mockResolvedValueOnce(revogado());
    await avisarMudanca();
    await waitFor(() => expect(toastError).toHaveBeenCalled());

    fetchConteudo.mockResolvedValue(liberado());
    await avisarMudanca();

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Esta prática foi liberada de novo pelo seu terapeuta.",
      ),
    );
  });

  it("não mostra falso bloqueio quando o evento chega e a prática segue liberada", async () => {
    fetchConteudo.mockResolvedValue(liberado());
    montar();
    expect(await screen.findByText("Respiração da raiz")).toBeInTheDocument();

    await avisarMudanca();

    await waitFor(() => expect(fetchConteudo.mock.calls.length).toBeGreaterThan(1));
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
