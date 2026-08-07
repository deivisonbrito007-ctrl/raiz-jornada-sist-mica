import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Botão "Renovar acesso": precisa pedir SEMPRE uma URL assinada nova ao backend
 * (nunca reaproveitar o cache), devolver o player no ponto onde a pessoa parou
 * e, quando a prática foi revogada, falhar de forma consistente — mesma
 * mensagem, botão em espera e nenhuma mídia tocando.
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
  useServerFn: (fn: unknown) => (fn === getConteudoMock ? fetchConteudo : salvarProgresso),
}));

const getConteudoMock = Symbol("getConteudo");
vi.mock("@/lib/raiz.functions", () => ({
  getConteudo: getConteudoMock,
  marcarProgresso: Symbol("marcarProgresso"),
}));

vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess, info: toastInfo } }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "cliente-1" } } }) },
    channel: () => {
      const canal: any = { on: () => canal, subscribe: () => canal };
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

function resposta(url: string | null, validadeMs = 60_000, status = "nao_iniciado") {
  return {
    conteudo,
    url,
    urlExpiraEm: url ? new Date(Date.now() + validadeMs).toISOString() : null,
    status,
  };
}

const revogado = () => ({ conteudo: null, url: null, urlExpiraEm: null, status: "nao_iniciado" });

let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;

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
  Object.defineProperty(HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get() {
      return (this as any)._paused !== false;
    },
  });
});

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

const audio = () => document.querySelector("audio") as HTMLAudioElement | null;

/** Monta o player, opcionalmente com a resposta já no cache (staleTime longo). */
function montar(comCache?: ReturnType<typeof resposta>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 10 * 60 * 1000 } },
  });
  if (comCache) queryClient.setQueryData(["conteudo", params.conteudoId], comCache);
  const tela = render(
    <QueryClientProvider client={queryClient}>
      <PlayerPage />
    </QueryClientProvider>,
  );
  return { ...tela, queryClient };
}

async function esperarPlayer() {
  await waitFor(() =>
    expect(audio() || screen.queryByRole("heading", { name: /expirou/i })).toBeTruthy(),
  );
}

async function esperarTitulo(titulo: RegExp) {
  await waitFor(() => expect(screen.getByRole("heading", { name: titulo })).toBeInTheDocument());
}

/** Deixa o link vencer com a mídia carregada (opcionalmente tocando, na posição dada). */
async function expirar(
  user: ReturnType<typeof userEvent.setup>,
  opcoes: { tocando?: boolean; segundo?: number } = {},
) {
  await esperarPlayer();
  const el = audio()!;
  if (opcoes.tocando) await user.click(screen.getByLabelText("Reproduzir"));
  if (opcoes.segundo !== undefined) {
    el.currentTime = opcoes.segundo;
    fireEvent.timeUpdate(el);
  }
  fireEvent.error(el);
  await esperarTitulo(/O link seguro expirou/);
}

describe("botão Renovar acesso", () => {
  it("pede uma URL assinada nova ao backend mesmo com o cache ainda fresco", async () => {
    const user = userEvent.setup();
    const antiga = resposta("https://midia/antiga.mp3");
    fetchConteudo.mockResolvedValue(antiga);
    montar(antiga);
    await expirar(user);

    fetchConteudo.mockClear();
    fetchConteudo.mockResolvedValue(resposta("https://midia/nova.mp3"));
    await user.click(screen.getByRole("button", { name: "Renovar acesso" }));

    // a renovação ignora o cache e chama o servidor com o id correto
    await waitFor(() => expect(fetchConteudo).toHaveBeenCalledTimes(1));
    expect(fetchConteudo).toHaveBeenCalledWith({ data: { conteudoId: "c-1" } });
    await waitFor(() => expect(audio()?.src).toBe("https://midia/nova.mp3"));
    expect(screen.queryByRole("heading", { name: /O link seguro expirou/ })).toBeNull();
  });

  it("mostra 'Renovando...' e desabilita o botão enquanto busca a nova URL", async () => {
    const user = userEvent.setup();
    fetchConteudo.mockResolvedValue(resposta("https://midia/antiga.mp3"));
    montar();
    await expirar(user);

    let liberar: (v: any) => void = () => {};
    fetchConteudo.mockImplementation(
      () => new Promise((r) => { liberar = r; }),
    );
    await user.click(screen.getByRole("button", { name: "Renovar acesso" }));

    const botao = await screen.findByRole("button", { name: "Renovando..." });
    expect(botao).toBeDisabled();

    liberar(resposta("https://midia/nova.mp3"));
    await waitFor(() => expect(audio()?.src).toBe("https://midia/nova.mp3"));
  });

  it("retoma automaticamente do ponto salvo quando o link venceu tocando", async () => {
    const user = userEvent.setup();
    fetchConteudo.mockResolvedValue(resposta("https://midia/antiga.mp3"));
    montar();
    await expirar(user, { tocando: true, segundo: 73 });

    fetchConteudo.mockResolvedValue(resposta("https://midia/nova.mp3"));
    await user.click(screen.getByRole("button", { name: "Renovar acesso" }));

    await waitFor(() => expect(audio()?.src).toBe("https://midia/nova.mp3"));
    fireEvent.loadedMetadata(audio()!);
    expect(audio()!.currentTime).toBe(73);
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith(
      "Mídia liberada novamente. Voltando de onde você parou.",
    );
  });

  it("não toca sozinho quando o link venceu com a mídia pausada", async () => {
    const user = userEvent.setup();
    fetchConteudo.mockResolvedValue(resposta("https://midia/antiga.mp3"));
    montar();
    await expirar(user, { segundo: 20 });

    play.mockClear();
    fetchConteudo.mockResolvedValue(resposta("https://midia/nova.mp3"));
    await user.click(screen.getByRole("button", { name: "Renovar acesso" }));

    await waitFor(() => expect(audio()?.src).toBe("https://midia/nova.mp3"));
    fireEvent.loadedMetadata(audio()!);
    expect(audio()!.currentTime).toBe(20);
    expect(play).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(
      "Mídia liberada novamente. Você pode continuar de onde parou.",
    );
  });

  it("mídia revogada: falha consistente, botão em espera e nenhuma nova busca", async () => {
    const user = userEvent.setup();
    fetchConteudo.mockResolvedValue(resposta("https://midia/antiga.mp3"));
    montar();
    await expirar(user);

    fetchConteudo.mockClear();
    fetchConteudo.mockResolvedValue(revogado());
    await user.click(screen.getByRole("button", { name: "Renovar acesso" }));

    await esperarTitulo(/Prática não está mais liberada/);
    expect(toastError).toHaveBeenCalledWith("Esta prática não está mais liberada para você.");
    expect(audio()).toBeNull();

    // retentativa fica em espera: cliques repetidos não disparam novas chamadas
    const tentar = screen.getByRole("button", { name: "Tentar novamente" });
    expect(tentar).toBeDisabled();
    await user.click(tentar).catch(() => {});
    fireEvent.click(tentar);
    expect(fetchConteudo).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("falha de rede na renovação não revela revogação e mantém a mensagem de conexão", async () => {
    const user = userEvent.setup();
    fetchConteudo.mockResolvedValue(resposta("https://midia/antiga.mp3"));
    montar();
    await expirar(user);

    fetchConteudo.mockRejectedValue(new Error("timeout"));
    await user.click(screen.getByRole("button", { name: "Renovar acesso" }));

    await esperarTitulo(/Não conseguimos renovar agora/);
    expect(toastError).toHaveBeenCalledWith("Não foi possível renovar o acesso à mídia.");
    expect(screen.queryByRole("heading", { name: /Prática não está mais liberada/ })).toBeNull();
    expect(audio()).toBeNull();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeDisabled();
    expect(salvarProgresso).not.toHaveBeenCalled();
  });
});
