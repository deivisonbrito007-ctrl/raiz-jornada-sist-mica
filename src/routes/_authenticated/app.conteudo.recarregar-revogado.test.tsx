import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Recarregar a página (F5 / novo acesso) depois da revogação: o cliente não pode
 * voltar a ver nem tocar os trechos que já tinha visualizado. A cada nova carga
 * o servidor responde revogado e a tela mostra sempre a mesma falha, sem URL
 * assinada, sem controles do player e sem gravar posição/progresso.
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

const URL_ANTIGA = "https://exemplo.test/audio-visualizado.mp3";

function liberado(posicao = 45) {
  return {
    conteudo,
    url: URL_ANTIGA,
    urlExpiraEm: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: "em_andamento",
    posicaoSegundos: posicao,
  };
}

function revogado() {
  return { conteudo: null, url: null, urlExpiraEm: null, status: "nao_iniciado", posicaoSegundos: 0 };
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
  localStorage.clear();
  sessionStorage.clear();
});

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Simula uma carga da página: novo QueryClient, nova montagem, nada em cache. */
function recarregar() {
  cleanup();
  handlers = [];
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tela = render(
    <QueryClientProvider client={queryClient}>
      <PlayerPage />
    </QueryClientProvider>,
  );
  return { ...tela, queryClient };
}

async function pronto() {
  await waitFor(() => expect(handlers.length).toBeGreaterThan(0));
}

describe("recarregar a página após a revogação", () => {
  it("não devolve a mídia visualizada em uma nova carga da página", async () => {
    // primeira visita: cliente assiste parte da prática
    fetchConteudo.mockResolvedValue(liberado());
    recarregar();
    expect(await screen.findByText("Respiração da raiz")).toBeInTheDocument();
    expect(document.querySelector(`audio[src="${URL_ANTIGA}"]`)).not.toBeNull();

    // terapeuta revoga e o cliente dá F5
    fetchConteudo.mockResolvedValue(revogado());
    recarregar();

    expect(await screen.findByText(/Prática não está mais liberada/i)).toBeInTheDocument();
    expect(document.querySelector("audio")).toBeNull();
    expect(document.querySelector(`[src="${URL_ANTIGA}"]`)).toBeNull();
    expect(screen.queryByLabelText("Reproduzir")).toBeNull();
    expect(screen.queryByText("Respiração da raiz")).toBeNull();
  });

  it("não expõe a posição já visualizada nem o botão de concluir", async () => {
    fetchConteudo.mockResolvedValue(revogado());
    const { queryClient } = recarregar();
    await screen.findByText(/Prática não está mais liberada/i);

    expect(screen.queryByRole("button", { name: /Marcar como concluída/i })).toBeNull();
    expect(screen.queryByText(/00:45/)).toBeNull();
    const emCache = JSON.stringify(queryClient.getQueryData(["conteudo", params.conteudoId]));
    expect(emCache).not.toContain(URL_ANTIGA);
    expect(emCache).not.toContain("45");
  });

  it("bloqueia gravação de posição e progresso depois do recarregamento", async () => {
    fetchConteudo.mockResolvedValue(revogado());
    recarregar();
    await screen.findByText(/Prática não está mais liberada/i);
    await pronto();

    await espera(80);
    expect(salvarProgresso).not.toHaveBeenCalled();
    expect(salvarPosicaoFn).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("mantém a mesma falha consistente em recarregamentos repetidos", async () => {
    fetchConteudo.mockResolvedValue(revogado());

    for (let i = 0; i < 3; i++) {
      recarregar();
      expect(await screen.findByText(/Prática não está mais liberada/i)).toBeInTheDocument();
      expect(document.querySelector("audio")).toBeNull();
    }

    // nenhuma tentativa produz sucesso e a orientação nunca muda de texto
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(new Set(toastError.mock.calls.map((c) => c[0])).size).toBeLessThanOrEqual(1);
  });

  it("tentar novamente após o recarregamento continua falhando do mesmo jeito", async () => {
    fetchConteudo.mockResolvedValue(revogado());
    recarregar();
    const botao = await screen.findByRole("button", { name: /Tentar novamente/i });

    fireEvent.click(botao);
    await waitFor(() => expect(fetchConteudo.mock.calls.length).toBeGreaterThan(1));

    expect(screen.getByText(/Prática não está mais liberada/i)).toBeInTheDocument();
    expect(document.querySelector("audio")).toBeNull();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("não deixa resquício do conteúdo revogado no armazenamento local", async () => {
    fetchConteudo.mockResolvedValue(revogado());
    recarregar();
    await screen.findByText(/Prática não está mais liberada/i);

    const dump = JSON.stringify({ ...localStorage, ...sessionStorage });
    expect(dump).not.toContain(URL_ANTIGA);
    expect(dump).not.toContain("Respiração da raiz");
  });
});
