import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Revogação com conteúdo já em cache: mesmo que o cliente esteja com a prática
 * carregada (dados e URL assinada no cache do TanStack Query), a revogação tem
 * de bloquear o acesso na hora — sem tocar trechos, sem gravar progresso e com
 * a mesma falha consistente em qualquer tentativa de renovar.
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

const URL_CACHE = "https://exemplo.test/audio-em-cache.mp3";

function liberado() {
  return {
    conteudo,
    url: URL_CACHE,
    urlExpiraEm: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: "em_andamento",
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

/** Monta o player com a prática já em cache (como quem voltou para a tela). */
function montarComCache() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });
  queryClient.setQueryData(["conteudo", params.conteudoId], liberado());
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

function revogar() {
  fetchConteudo.mockResolvedValue(revogado());
  handlers.forEach((h) => h());
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("revogação com conteúdo já carregado em cache", () => {
  it("usa o cache para exibir a prática antes de qualquer nova busca", async () => {
    montarComCache();
    expect(await screen.findByText("Respiração da raiz")).toBeInTheDocument();
    expect(document.querySelector(`audio[src="${URL_CACHE}"]`)).not.toBeNull();
  });

  it("remove a mídia em cache e bloqueia assim que a revogação chega", async () => {
    montarComCache();
    expect(await screen.findByText("Respiração da raiz")).toBeInTheDocument();
    await pronto();

    revogar();

    expect(await screen.findByText(/Prática não está mais liberada/i)).toBeInTheDocument();
    // nenhum trecho da mídia em cache pode continuar disponível para tocar
    expect(document.querySelector("audio")).toBeNull();
    expect(document.querySelector(`[src="${URL_CACHE}"]`)).toBeNull();
    expect(screen.queryByLabelText("Reproduzir")).toBeNull();
    expect(toastError).toHaveBeenCalledWith("Esta prática não está mais liberada para você.");
  });

  it("substitui o cache pelo estado revogado, sem deixar URL assinada guardada", async () => {
    const { queryClient } = montarComCache();
    await screen.findByText("Respiração da raiz");
    await pronto();

    revogar();
    await screen.findByText(/Prática não está mais liberada/i);

    await waitFor(() => {
      const emCache: any = queryClient.getQueryData(["conteudo", params.conteudoId]);
      expect(emCache?.url).toBeNull();
      expect(emCache?.conteudo).toBeNull();
    });
    expect(JSON.stringify(queryClient.getQueryData(["conteudo", params.conteudoId]))).not.toContain(
      URL_CACHE,
    );
  });

  it("não grava progresso a partir do estado que estava em cache", async () => {
    montarComCache();
    const tocar = await screen.findByLabelText("Reproduzir");
    await pronto();

    revogar();
    await screen.findByText(/Prática não está mais liberada/i);

    // botão antigo (do render em cache) não pode mais iniciar nem registrar nada
    fireEvent.click(tocar);
    await espera(60);
    expect(salvarProgresso).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("retorna a mesma falha consistente em toda tentativa de renovar acesso", async () => {
    montarComCache();
    await screen.findByText("Respiração da raiz");
    await pronto();

    revogar();
    const renovar = await screen.findByRole("button", { name: /Tentar novamente/i });

    fireEvent.click(renovar);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Esta prática não está mais liberada para você."),
    );
    // a mensagem é sempre a mesma e o bloqueio permanece
    expect(new Set(toastError.mock.calls.map((c) => c[0])).size).toBe(1);
    expect(screen.getByText(/Prática não está mais liberada/i)).toBeInTheDocument();
    expect(document.querySelector("audio")).toBeNull();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("volta a liberar somente com confirmação do servidor, nunca pelo cache antigo", async () => {
    montarComCache();
    await screen.findByText("Respiração da raiz");
    await pronto();

    revogar();
    await screen.findByText(/Prática não está mais liberada/i);

    fetchConteudo.mockResolvedValue(liberado());
    handlers.forEach((h) => h());

    await waitFor(() => expect(document.querySelector("audio")).not.toBeNull());
    expect(screen.queryByText(/Prática não está mais liberada/i)).toBeNull();
  });
});
