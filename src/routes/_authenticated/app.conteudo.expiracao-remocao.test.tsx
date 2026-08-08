import type React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toastCalls = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() };
vi.mock("sonner", () => ({ toast: toastCalls }));

const fetchConteudo = vi.fn();
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => (fn as { __nome?: string }).__nome === "getConteudo"
    ? fetchConteudo
    : vi.fn(async () => ({})),
}));

vi.mock("@/lib/raiz.functions", () => ({
  getConteudo: Object.assign(() => {}, { __nome: "getConteudo" }),
  marcarProgresso: Object.assign(() => {}, { __nome: "marcarProgresso" }),
  salvarPosicao: Object.assign(() => {}, { __nome: "salvarPosicao" }),
}));

let aoMudar: ((m: { tipo: string; conteudoId?: string }) => void) | undefined;
vi.mock("@/hooks/use-sincronizar-liberacoes", () => ({
  useSincronizarLiberacoes: (cb?: (m: { tipo: string; conteudoId?: string }) => void) => {
    aoMudar = cb;
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opcoes: Record<string, unknown>) => ({
    ...opcoes,
    useParams: () => ({ conteudoId: "c1" }),
    useSearch: () => ({}),
  }),
  Link: ({ children, ...resto }: { children: React.ReactNode }) => <a {...resto}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

const { Route } = await import("./app.conteudo.$conteudoId");
const Player = (Route as unknown as { component: () => React.ReactElement }).component;

function pratica(urlExpiraEm: string) {
  return {
    conteudo: {
      id: "c1",
      eixo_id: "e1",
      titulo: "Respiração da raiz",
      descricao: "",
      tipo: "audio",
      duracao_segundos: 300,
    },
    url: "https://exemplo.test/audio.mp3",
    urlExpiraEm,
    status: "em_andamento",
    posicaoSegundos: 0,
  };
}

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Player />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  Element.prototype.scrollIntoView = vi.fn();
  for (const fn of Object.values(toastCalls)) fn.mockClear();
  fetchConteudo.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("avisos de prática prestes a expirar e removida", () => {
  it("notifica com antecedência quando a prática está prestes a expirar, sem bloquear ainda", async () => {
    const expira = new Date(Date.now() + 90_000).toISOString();
    fetchConteudo.mockResolvedValue(pratica(expira));
    montar();

    await waitFor(() => expect(screen.getByText("Respiração da raiz")).toBeInTheDocument());
    expect(toastCalls.warning).not.toHaveBeenCalled();

    // 30s antes do fim (aviso é 60s antes de expirar)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(toastCalls.warning).toHaveBeenCalledTimes(1);
    expect(String(toastCalls.warning.mock.calls[0]?.[0])).toMatch(/expira em cerca de/i);
    expect(screen.getByText(/prestes a expirar/i)).toBeInTheDocument();
    // ainda liberada: os CTAs seguem na tela
    expect(screen.getByRole("button", { name: /Marcar como concluída/i })).toBeInTheDocument();
  });

  it("ao expirar, mostra o aviso certo, notifica e esconde os CTAs na hora", async () => {
    const expira = new Date(Date.now() + 5_000).toISOString();
    fetchConteudo.mockResolvedValue(pratica(expira));
    montar();

    await waitFor(() => expect(screen.getByText("Respiração da raiz")).toBeInTheDocument());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });

    expect(screen.getByRole("heading", { name: "O link seguro expirou" })).toBeInTheDocument();
    expect(String(toastCalls.error.mock.calls.at(-1)?.[0])).toMatch(/link seguro desta prática expirou/i);
    expect(screen.queryByRole("button", { name: /Marcar como concluída/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Ir ao diário/i })).toBeNull();
    expect(screen.queryByText(/prestes a expirar/i)).toBeNull();
    expect(document.querySelector("audio")).toBeNull();
  });

  it("ao ser removida em tempo real, notifica e mostra o aviso de prática removida", async () => {
    fetchConteudo.mockResolvedValue(pratica(new Date(Date.now() + 600_000).toISOString()));
    montar();

    await waitFor(() => expect(screen.getByText("Respiração da raiz")).toBeInTheDocument());

    await act(async () => {
      aoMudar?.({ tipo: "removido", conteudoId: "c1" });
    });

    expect(screen.getByRole("heading", { name: "Esta prática foi removida" })).toBeInTheDocument();
    expect(String(toastCalls.error.mock.calls.at(-1)?.[0])).toMatch(/removida pelo seu terapeuta/i);
    expect(screen.queryByRole("button", { name: /Marcar como concluída/i })).toBeNull();
    expect(document.querySelector("audio")).toBeNull();
  });

  it("ignora a remoção de outra prática", async () => {
    fetchConteudo.mockResolvedValue(pratica(new Date(Date.now() + 600_000).toISOString()));
    montar();
    await waitFor(() => expect(screen.getByText("Respiração da raiz")).toBeInTheDocument());

    await act(async () => {
      aoMudar?.({ tipo: "removido", conteudoId: "outra" });
    });

    expect(screen.queryByRole("heading", { name: "Esta prática foi removida" })).toBeNull();
    expect(screen.getByRole("button", { name: /Marcar como concluída/i })).toBeInTheDocument();
  });
});
