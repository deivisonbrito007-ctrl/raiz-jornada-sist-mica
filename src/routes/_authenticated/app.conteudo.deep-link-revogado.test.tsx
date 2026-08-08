import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Deep link para uma prática revogada: abrir a URL direto do conteúdo (link
 * salvo, histórico do navegador, compartilhado) tem de cair no aviso de bloqueio
 * na hora — sem carregar mídia, sem tocar nada, sem gravar posição/progresso e
 * com um caminho claro de volta para a trilha.
 */

let params = { conteudoId: "c-1" };
let search: Record<string, unknown> = {};
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
    useSearch: () => search,
  }),
  useNavigate: () => navigate,
  Link: ({ children, to, ...props }: any) => (
    <a href={typeof to === "string" ? to : undefined} {...props}>
      {children}
    </a>
  ),
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

const URL_ASSINADA = "https://exemplo.test/video-revogado.mp4";

function revogado() {
  return { conteudo: null, url: null, urlExpiraEm: null, status: "nao_iniciado", posicaoSegundos: 0 };
}

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
  params = { conteudoId: "c-1" };
  search = {};
  vi.clearAllMocks();
  fetchConteudo.mockResolvedValue(revogado());
});

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Abre a rota do player direto na URL, como um deep link (nada em cache). */
function abrirDeepLink() {
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

describe("deep link para conteúdo revogado", () => {
  it("mostra o aviso de bloqueio imediatamente ao abrir a URL direta", async () => {
    abrirDeepLink();

    expect(await screen.findByText(/Prática não está mais liberada/i)).toBeInTheDocument();
    expect(screen.getByText(/Acesso revogado/i)).toBeInTheDocument();
    // o aviso é um diálogo de alerta, então leitores de tela recebem o estado
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("não carrega nenhuma mídia a partir do deep link", async () => {
    abrirDeepLink();
    await screen.findByText(/Prática não está mais liberada/i);

    expect(document.querySelector("video")).toBeNull();
    expect(document.querySelector("audio")).toBeNull();
    expect(document.querySelector(`[src="${URL_ASSINADA}"]`)).toBeNull();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Reproduzir")).toBeNull();
    expect(screen.queryByRole("button", { name: /Marcar como concluída/i })).toBeNull();
  });

  it("não grava progresso nem posição em nenhum momento da abertura", async () => {
    abrirDeepLink();
    await screen.findByText(/Prática não está mais liberada/i);
    await espera(80);

    expect(salvarProgresso).not.toHaveBeenCalled();
    expect(salvarPosicaoFn).not.toHaveBeenCalled();
  });

  it("ignora o pedido de retomada automática do deep link (?retomar=1)", async () => {
    search = { retomar: true };
    abrirDeepLink();
    await screen.findByText(/Prática não está mais liberada/i);
    await espera(80);

    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(salvarPosicaoFn).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("oferece saída imediata para a trilha em vez de deixar a tela vazia", async () => {
    abrirDeepLink();
    await screen.findByText(/Prática não está mais liberada/i);

    const voltar = screen.getByText(/Voltar à trilha/i).closest("a");
    expect(voltar).not.toBeNull();
    expect(voltar).toHaveAttribute("href", "/app");
  });

  it("responde igual para um id de conteúdo inexistente ou adivinhado", async () => {
    for (const id of ["c-9999", "00000000-0000-4000-8000-000000000000", "nao-existe"]) {
      params = { conteudoId: id };
      abrirDeepLink();
      expect(await screen.findByText(/Prática não está mais liberada/i)).toBeInTheDocument();
      expect(document.querySelector("video")).toBeNull();
      expect(document.querySelector("audio")).toBeNull();
    }
    // a mesma resposta para todos: o deep link não revela se o conteúdo existe
    expect(new Set(fetchConteudo.mock.results.map(() => "revogado")).size).toBe(1);
    expect(salvarProgresso).not.toHaveBeenCalled();
  });

  it("mantém o bloqueio enquanto o servidor continuar negando o acesso", async () => {
    abrirDeepLink();
    await screen.findByText(/Prática não está mais liberada/i);
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0));

    // avisos de mudança de liberação chegam, mas o servidor segue negando
    handlers.forEach((h) => h());
    await espera(60);

    expect(screen.getByText(/Prática não está mais liberada/i)).toBeInTheDocument();
    expect(document.querySelector("video")).toBeNull();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
