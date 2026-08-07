import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

/** resposta do backend com a URL assinada e sua validade */
function resposta(url: string | null, validadeMs: number, status = "nao_iniciado") {
  return {
    conteudo,
    url,
    urlExpiraEm: url ? new Date(Date.now() + validadeMs).toISOString() : null,
    status,
  };
}

let pause: ReturnType<typeof vi.fn>;
let play: ReturnType<typeof vi.fn>;

beforeAll(() => {
  // jsdom não implementa reprodução de mídia nem duração/posição graváveis
  Object.defineProperty(HTMLMediaElement.prototype, "duration", {
    configurable: true,
    get() {
      return 120;
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
});

function renderPlayer() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <PlayerPage />
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
}

const audio = () => document.querySelector("audio") as HTMLAudioElement;

async function esperarPlayer() {
  await waitFor(() => expect(audio()).toBeTruthy());
}

async function esperarBloqueio(titulo: string) {
  await waitFor(() => expect(screen.getByRole("heading", { name: titulo })).toBeInTheDocument());
}

describe("player — expiração da URL assinada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    play = vi.fn(function (this: HTMLMediaElement) {
      (this as any)._paused = false;
      fireEvent.play(this);
      return Promise.resolve();
    });
    pause = vi.fn(function (this: HTMLMediaElement) {
      (this as any)._paused = true;
      fireEvent.pause(this);
    });
    HTMLMediaElement.prototype.play = play as unknown as HTMLMediaElement["play"];
    HTMLMediaElement.prototype.pause = pause as unknown as HTMLMediaElement["pause"];
  });

  it("pausa sozinho e mostra a mensagem de link expirado", async () => {
    fetchConteudo.mockResolvedValue(resposta("https://midia/uma.mp3", 120));
    renderPlayer();
    await esperarPlayer();

    await esperarBloqueio("O link seguro expirou");
    expect(pause).toHaveBeenCalled();
    expect(document.querySelector("audio")).toBeNull();
    expect(screen.getByRole("button", { name: "Renovar acesso" })).toBeInTheDocument();
    expect(screen.getByText(/o ponto onde você parou está guardado/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Pausar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Reproduzir")).not.toBeInTheDocument();
  });

  it("trata link morto: erro de carregamento também expira o acesso", async () => {
    fetchConteudo.mockResolvedValue(resposta("https://midia/morta.mp3", 60_000));
    renderPlayer();
    await esperarPlayer();

    fireEvent.error(audio());

    await esperarBloqueio("O link seguro expirou");
    expect(pause).toHaveBeenCalled();
    expect(screen.getByText(/O link de reprodução desta mídia tem tempo de validade/)).toBeInTheDocument();
  });

  it("bloqueia novas tentativas de progresso enquanto o acesso está expirado", async () => {
    const user = userEvent.setup();
    fetchConteudo.mockResolvedValue(resposta("https://midia/uma.mp3", 60_000));
    renderPlayer();
    await esperarPlayer();

    fireEvent.error(audio());
    await esperarBloqueio("O link seguro expirou");

    await user.click(screen.getByRole("button", { name: "Marcar como concluída" }));

    expect(salvarProgresso).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Acesso à mídia expirado. Renove antes de concluir a prática.");
    expect(screen.getByRole("button", { name: "Marcar como concluída" })).toBeInTheDocument();
    expect(play).not.toHaveBeenCalled();
  });

  it("renova o acesso, volta o player pausado e retoma a posição salva", async () => {
    const user = userEvent.setup();
    fetchConteudo.mockResolvedValue(resposta("https://midia/uma.mp3", 60_000));
    renderPlayer();
    await esperarPlayer();

    // a pessoa avança na prática antes de o link vencer
    const el = audio();
    el.currentTime = 42;
    fireEvent.timeUpdate(el);
    fireEvent.error(el);
    await esperarBloqueio("O link seguro expirou");

    fetchConteudo.mockResolvedValue(resposta("https://midia/nova.mp3", 60_000));
    await user.click(screen.getByRole("button", { name: "Renovar acesso" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "O link seguro expirou" })).toBeNull());
    expect(fetchConteudo).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(audio()?.src).toBe("https://midia/nova.mp3"));

    fireEvent.loadedMetadata(audio());
    expect(audio().currentTime).toBe(42);
    expect(audio().paused).toBe(true);
    expect(screen.getByLabelText("Reproduzir")).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith("Mídia liberada novamente. Você pode continuar de onde parou.");
  });

  it("mídia revogada: exibe mensagem específica, link de volta e não grava progresso", async () => {
    const user = userEvent.setup();
    fetchConteudo.mockResolvedValue(resposta("https://midia/uma.mp3", 60_000));
    renderPlayer();
    await esperarPlayer();

    fireEvent.error(audio());
    await esperarBloqueio("O link seguro expirou");

    fetchConteudo.mockResolvedValue({ conteudo, url: null, urlExpiraEm: null, status: "nao_iniciado" });
    await user.click(screen.getByRole("button", { name: "Renovar acesso" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Prática não está mais liberada" })).toBeInTheDocument(),
    );
    expect(screen.getByText(/O terapeuta recolheu o acesso a esta prática/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    const voltar = screen.getAllByText("Voltar à trilha");
    expect(voltar.some((el) => el.tagName === "A")).toBe(true);



    expect(toastError).toHaveBeenCalledWith("Esta prática não está mais liberada para você.");
    expect(document.querySelector("audio")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Marcar como concluída" }));
    expect(salvarProgresso).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "Esta prática não está mais liberada. Fale com seu terapeuta se quiser continuar.",
    );
  });

  it("falha de rede na renovação: mensagem separada de erro de conexão e botão de tentar", async () => {
    const user = userEvent.setup();
    fetchConteudo.mockResolvedValue(resposta("https://midia/uma.mp3", 60_000));
    renderPlayer();
    await esperarPlayer();

    fireEvent.error(audio());
    await esperarBloqueio("O link seguro expirou");

    fetchConteudo.mockRejectedValue(new Error("falha"));
    await user.click(screen.getByRole("button", { name: "Renovar acesso" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Não conseguimos renovar agora" })).toBeInTheDocument(),
    );
    expect(screen.getByText(/Aconteceu uma falha de conexão/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith("Não foi possível renovar o acesso à mídia.");
    expect(salvarProgresso).not.toHaveBeenCalled();
  });

  /** toca, avança até `segundo` e deixa o link vencer com a mídia tocando */
  async function tocarEExpirar(user: ReturnType<typeof userEvent.setup>, segundo: number) {
    fetchConteudo.mockResolvedValue(resposta("https://midia/uma.mp3", 60_000));
    renderPlayer();
    await esperarPlayer();

    await user.click(screen.getByLabelText("Reproduzir"));
    const el = audio();
    el.currentTime = segundo;
    fireEvent.timeUpdate(el);
    fireEvent.error(el);
    await esperarBloqueio("O link seguro expirou");
  }

  it("retoma a reprodução sozinha, do ponto anterior, quando estava tocando na expiração", async () => {
    const user = userEvent.setup();
    await tocarEExpirar(user, 42);
    play.mockClear();

    fetchConteudo.mockResolvedValue(resposta("https://midia/nova.mp3", 60_000, "em_andamento"));
    await user.click(screen.getByRole("button", { name: "Renovar acesso" }));

    await waitFor(() => expect(audio()?.src).toBe("https://midia/nova.mp3"));
    fireEvent.loadedMetadata(audio());

    expect(audio().currentTime).toBe(42);
    expect(play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByLabelText("Pausar")).toBeInTheDocument());
    expect(toastSuccess).toHaveBeenCalledWith("Mídia liberada novamente. Voltando de onde você parou.");
  });

  it("não registra um segundo progresso 'em andamento' ao retomar depois da renovação", async () => {
    const user = userEvent.setup();
    await tocarEExpirar(user, 30);

    expect(salvarProgresso).toHaveBeenCalledTimes(1);
    expect(salvarProgresso).toHaveBeenCalledWith({ data: { conteudoId: "c-1", status: "em_andamento" } });

    fetchConteudo.mockResolvedValue(resposta("https://midia/nova.mp3", 60_000, "em_andamento"));
    await user.click(screen.getByRole("button", { name: "Renovar acesso" }));
    await waitFor(() => expect(audio()?.src).toBe("https://midia/nova.mp3"));
    fireEvent.loadedMetadata(audio());

    // pausa e volta a tocar manualmente também não duplica o registro
    await waitFor(() => expect(screen.getByLabelText("Pausar")).toBeInTheDocument());
    await user.click(screen.getByLabelText("Pausar"));
    await user.click(screen.getByLabelText("Reproduzir"));

    expect(salvarProgresso).toHaveBeenCalledTimes(1);
  });

  it("se o navegador barrar o autoplay, orienta a tocar play sem quebrar a tela", async () => {
    const user = userEvent.setup();
    await tocarEExpirar(user, 20);

    fetchConteudo.mockResolvedValue(resposta("https://midia/nova.mp3", 60_000, "em_andamento"));
    await user.click(screen.getByRole("button", { name: "Renovar acesso" }));
    await waitFor(() => expect(audio()?.src).toBe("https://midia/nova.mp3"));

    play.mockImplementation(() => Promise.reject(new Error("NotAllowedError")));
    fireEvent.loadedMetadata(audio());

    await waitFor(() =>
      expect(toastInfo).toHaveBeenCalledWith("Toque em play para continuar de onde parou."),
    );
    expect(audio().currentTime).toBe(20);
    expect(screen.getByLabelText("Reproduzir")).toBeInTheDocument();
  });

  it("estava pausado na expiração: renova sem dar play automático", async () => {
    const user = userEvent.setup();
    fetchConteudo.mockResolvedValue(resposta("https://midia/uma.mp3", 60_000));
    renderPlayer();
    await esperarPlayer();

    fireEvent.error(audio());
    await esperarBloqueio("O link seguro expirou");

    fetchConteudo.mockResolvedValue(resposta("https://midia/nova.mp3", 60_000));
    await user.click(screen.getByRole("button", { name: "Renovar acesso" }));
    await waitFor(() => expect(audio()?.src).toBe("https://midia/nova.mp3"));
    fireEvent.loadedMetadata(audio());

    expect(play).not.toHaveBeenCalled();
    expect(audio().paused).toBe(true);
    expect(toastSuccess).toHaveBeenCalledWith("Mídia liberada novamente. Você pode continuar de onde parou.");
  });
});
