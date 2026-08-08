import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Gerenciamento de foco no aviso do player (alerta/modal):
 * - ao bloquear, o foco vai para o aviso (botão de nova tentativa);
 * - Tab circula apenas dentro do aviso;
 * - Esc sai do aviso pelo caminho de volta;
 * - ao liberar o acesso, o foco volta para o elemento de origem — ou para o
 *   botão de reprodução recriado, quando a origem foi desmontada no bloqueio.
 */

const params = { conteudoId: "c-1", eixoId: "e-1" };

const fetchConteudo = vi.fn<(args: any) => Promise<any>>();
const salvarPosicaoFn = vi.fn(async () => ({ ok: true }));
const salvarProgresso = vi.fn(async () => ({ ok: true }));

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
    fn === getConteudoMock
      ? fetchConteudo
      : fn === salvarPosicaoMock
        ? salvarPosicaoFn
        : salvarProgresso,
}));

vi.mock("@/lib/raiz.functions", () => ({
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

const { Route } = await import("./app.conteudo.$conteudoId");
const Player = (Route as unknown as { component: () => React.ReactElement }).component;

// ---------------------------------------------------------------- utilitários

const conteudo = {
  id: "c-1",
  eixo_id: "e-1",
  titulo: "Respiração da raiz",
  descricao: "Cinco minutos de respiração.",
  tipo: "audio" as const,
  corpo_texto: null,
  eixos: { nome: "Pertencimento" },
};

const liberado = (validadeMs = 300_000) => ({
  conteudo,
  url: `https://exemplo.test/respiracao.mp3?v=${validadeMs}`,
  urlExpiraEm: new Date(Date.now() + validadeMs).toISOString(),
  status: "em_andamento",
});

const revogado = () => ({ conteudo: null, url: null, urlExpiraEm: null, status: "nao_iniciado" });

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <main>
        <Player />
      </main>
    </QueryClientProvider>,
  );
}

const audio = () => document.querySelector("audio") as HTMLAudioElement | null;
const aviso = () => screen.getByRole("alertdialog");

async function comMidiaLiberada() {
  fetchConteudo.mockResolvedValue(liberado());
  montar();
  await waitFor(() => expect(audio()).not.toBeNull());
}

/** Expira o link seguro como o navegador faz: erro ao carregar a mídia. */
async function expirarLink() {
  fireEvent.error(audio()!);
  await screen.findByRole("heading", { name: "O link seguro expirou" });
}

async function avancarEspera() {
  // a espera entre tentativas é curta; deixamos o botão liberar de novo
  await waitFor(
    () => expect(screen.getByRole("button", { name: /Renovar acesso/ })).toHaveAttribute(
      "aria-disabled",
      "false",
    ),
    { timeout: 8000 },
  );
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
});

// ---------------------------------------------------------------------- casos

describe("foco ao abrir o aviso do player", () => {
  it("move o foco para o botão de renovar assim que a mídia é bloqueada", async () => {
    await comMidiaLiberada();
    screen.getByLabelText("Reproduzir").focus();

    await expirarLink();

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Renovar acesso" })),
    );
  });

  it("descreve o aviso como alertdialog com título e texto associados", async () => {
    await comMidiaLiberada();
    await expirarLink();

    const caixa = aviso();
    expect(caixa).toHaveAccessibleName("O link seguro expirou");
    expect(caixa).toHaveAccessibleDescription(/tempo de validade por segurança/);
    expect(caixa.contains(document.activeElement)).toBe(true);
  });

  it("mantém o Tab circulando dentro do aviso quando há mais de um controle", async () => {
    fetchConteudo.mockResolvedValue(liberado());
    montar();
    await waitFor(() => expect(audio()).not.toBeNull());
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0));

    fetchConteudo.mockResolvedValue(revogado());
    await act(async () => {
      handlers.forEach((h) => h());
    });
    await screen.findByRole("heading", { name: "Prática não está mais liberada" });

    const botao = screen.getByRole("button", { name: "Tentar novamente" });
    const voltar = screen.getByRole("link", { name: "Voltar à trilha" });
    await waitFor(() => expect(document.activeElement).toBe(botao));

    await userEvent.tab();
    expect(document.activeElement).toBe(voltar);
    // no último controle, o Tab volta ao primeiro: o foco não escapa do aviso
    await userEvent.tab();
    expect(document.activeElement).toBe(botao);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(voltar);
  });

  it("devolve o foco para fora quando a pessoa pressiona Esc", async () => {
    await comMidiaLiberada();
    await expirarLink();

    await userEvent.keyboard("{Escape}");

    expect(document.activeElement).toBe(screen.getByRole("link", { name: /Voltar/ }));
    // o aviso continua na tela: Esc apenas move o foco, não libera o acesso
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("retorno do foco após liberar o acesso", () => {
  it("foca o botão de reprodução recriado quando a origem foi desmontada", async () => {
    await comMidiaLiberada();
    screen.getByLabelText("Reproduzir").focus();
    await expirarLink();
    expect(screen.queryByLabelText("Reproduzir")).toBeNull();

    fetchConteudo.mockResolvedValue(liberado(400_000));
    await userEvent.click(screen.getByRole("button", { name: "Renovar acesso" }));

    await waitFor(() => expect(audio()).not.toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Reproduzir")),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("devolve o foco ao botão de origem quando ele continua na tela", async () => {
    // aviso prévio de expiração: o botão "Renovar acesso" do banner é a origem
    fetchConteudo.mockResolvedValue(liberado(300_000));
    montar();
    await waitFor(() => expect(audio()).not.toBeNull());

    await expirarLink();
    fetchConteudo.mockResolvedValue(liberado(500_000));
    await userEvent.click(screen.getByRole("button", { name: "Renovar acesso" }));

    // o foco não fica perdido no body depois que o aviso sai da tela
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
  });

  it("não deixa o foco no body quando o aviso desaparece", async () => {
    await comMidiaLiberada();
    await expirarLink();
    expect(document.body.contains(document.activeElement)).toBe(true);

    fetchConteudo.mockResolvedValue(liberado(600_000));
    await userEvent.click(screen.getByRole("button", { name: "Renovar acesso" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
  });

  it("mantém o foco no aviso enquanto o botão está em espera", async () => {
    fetchConteudo.mockResolvedValue(liberado());
    montar();
    await waitFor(() => expect(audio()).not.toBeNull());
    await expirarLink();

    fetchConteudo.mockResolvedValue(revogado());
    await userEvent.click(screen.getByRole("button", { name: "Renovar acesso" }));

    await screen.findByRole("heading", { name: "Prática não está mais liberada" });
    const caixa = screen.getByRole("alertdialog");
    await waitFor(() => expect(caixa.contains(document.activeElement)).toBe(true));
    await avancarEspera().catch(() => {});
  });
});
