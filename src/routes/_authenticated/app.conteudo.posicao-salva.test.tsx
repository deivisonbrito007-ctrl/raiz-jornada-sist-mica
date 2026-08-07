import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

const params = { conteudoId: "c-1" };
const navigate = vi.fn();

const fetchConteudo = vi.fn<(args: any) => Promise<any>>();
const salvarProgresso = vi.fn<(args: any) => Promise<any>>();

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

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
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

function resposta(posicaoSegundos = 0, estavaTocando = false) {
  return {
    conteudo,
    url: "https://exemplo/midia.mp3",
    urlExpiraEm: new Date(Date.now() + 60_000).toISOString(),
    status: posicaoSegundos > 0 ? "em_andamento" : "nao_iniciado",
    posicaoSegundos,
    estavaTocando,
    posicaoAtualizadaEm: null,
    limitado: false,
    esperarSegundos: 0,
  };
}

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "duration", {
    configurable: true,
    get() {
      return 300;
    },
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
  Object.defineProperty(HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get() {
      return (this as any)._paused !== false;
    },
  });
  HTMLMediaElement.prototype.play = vi.fn(async function (this: any) {
    this._paused = false;
  });
  HTMLMediaElement.prototype.pause = vi.fn(function (this: any) {
    this._paused = true;
  });
});

function renderPlayer() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlayerPage />
    </QueryClientProvider>,
  );
}

const audio = () => document.querySelector("audio") as HTMLAudioElement;

describe("player — posição de reprodução salva no backend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retoma o ponto exato salvo no backend após recarregar a página", async () => {
    fetchConteudo.mockResolvedValue(resposta(92));
    renderPlayer();
    await waitFor(() => expect(audio()).toBeTruthy());
    fireEvent.loadedMetadata(audio());
    await waitFor(() => expect(audio().currentTime).toBe(92));
    // o tempo mostrado também parte do ponto salvo
    expect(screen.getByText("1 min 32s")).toBeInTheDocument();

  });

  it("grava a posição no backend ao pausar", async () => {
    fetchConteudo.mockResolvedValue(resposta(0));
    renderPlayer();
    await waitFor(() => expect(audio()).toBeTruthy());
    fireEvent.loadedMetadata(audio());
    audio().currentTime = 47;
    (audio() as any)._paused = true;
    fireEvent.pause(audio());
    await waitFor(() =>
      expect(salvarPosicaoFn).toHaveBeenCalledWith({
        data: { conteudoId: "c-1", posicaoSegundos: 47, tocando: false },
      }),
    );
  });

  it("não grava a cada segundo: espera avançar alguns segundos entre gravações", async () => {
    fetchConteudo.mockResolvedValue(resposta(0));
    renderPlayer();
    await waitFor(() => expect(audio()).toBeTruthy());
    fireEvent.loadedMetadata(audio());
    audio().currentTime = 1;
    fireEvent.timeUpdate(audio());
    audio().currentTime = 2;
    fireEvent.timeUpdate(audio());
    expect(salvarPosicaoFn).not.toHaveBeenCalled();
    audio().currentTime = 12;
    fireEvent.timeUpdate(audio());
    await waitFor(() => expect(salvarPosicaoFn).toHaveBeenCalledTimes(1));
    expect(salvarPosicaoFn.mock.calls[0]).toMatchObject([
      { data: { posicaoSegundos: 12 } },
    ]);

  });

  it("zera a posição quando a prática chega ao fim", async () => {
    fetchConteudo.mockResolvedValue(resposta(280));
    renderPlayer();
    await waitFor(() => expect(audio()).toBeTruthy());
    fireEvent.loadedMetadata(audio());
    fireEvent.ended(audio());
    await waitFor(() =>
      expect(salvarPosicaoFn).toHaveBeenCalledWith({
        data: { conteudoId: "c-1", posicaoSegundos: 0, tocando: false },
      }),
    );
  });

  it("salva o ponto atual quando a aba fica oculta (app fechado)", async () => {
    fetchConteudo.mockResolvedValue(resposta(0));
    renderPlayer();
    await waitFor(() => expect(audio()).toBeTruthy());
    fireEvent.loadedMetadata(audio());
    audio().currentTime = 33;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() =>
      expect(salvarPosicaoFn).toHaveBeenCalledWith({
        data: { conteudoId: "c-1", posicaoSegundos: 33, tocando: false },
      }),
    );
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });
});
