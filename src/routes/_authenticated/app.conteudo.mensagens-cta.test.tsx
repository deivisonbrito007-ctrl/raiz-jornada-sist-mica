import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Estados de UI no fluxo real: o que a pessoa vê quando o link seguro expira e
 * quando a prática é removida da sequência. Em ambos os casos o aviso correto
 * aparece, o selo muda e o CTA de acesso (reproduzir / continuar / abrir a
 * prática) desaparece da tela.
 */

const params = { conteudoId: "c-2", eixoId: "e-1" };

const fetchConteudo = vi.fn<(args: any) => Promise<any>>();
const fetchTrilha = vi.fn<(args: any) => Promise<any>>();
const fetchBiblioteca = vi.fn<() => Promise<any>>();
const fetchContexto = vi.fn<() => Promise<any>>();
const salvarProgresso = vi.fn(async () => ({ ok: true }));
const salvarPosicaoFn = vi.fn(async () => ({ ok: true }));

const toastError = vi.fn();

const getConteudoMock = Symbol("getConteudo");
const salvarPosicaoMock = Symbol("salvarPosicao");
const marcarProgressoMock = Symbol("marcarProgresso");
const getEixoTrilhaMock = Symbol("getEixoTrilha");
const getMinhaBibliotecaMock = Symbol("getMinhaBiblioteca");
const getMeuContextoMock = Symbol("getMeuContexto");

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => params,
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, params: p, search, ...props }: any) => (
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
        : fn === marcarProgressoMock
          ? salvarProgresso
          : fn === getEixoTrilhaMock
            ? fetchTrilha
            : fn === getMinhaBibliotecaMock
              ? fetchBiblioteca
              : fetchContexto,
}));

vi.mock("@/lib/raiz.functions", () => ({
  getConteudo: getConteudoMock,
  salvarPosicao: salvarPosicaoMock,
  marcarProgresso: marcarProgressoMock,
  getEixoTrilha: getEixoTrilhaMock,
  getMinhaBiblioteca: getMinhaBibliotecaMock,
  getMeuContexto: getMeuContextoMock,
}));

vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn(), info: vi.fn() },
}));

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

const { Route: RotaPlayer } = await import("./app.conteudo.$conteudoId");
const { Route: RotaTrilha } = await import("./app.eixo.$eixoId");
const Player = (RotaPlayer as unknown as { component: () => React.ReactElement }).component;
const Trilha = (RotaTrilha as unknown as { component: () => React.ReactElement }).component;

// ---------------------------------------------------------------- utilitários

const TITULO = "Carta ao pai";

const conteudo = {
  id: "c-2",
  eixo_id: "e-1",
  titulo: TITULO,
  descricao: "Escrever sem enviar.",
  tipo: "audio" as const,
  corpo_texto: null,
  eixos: { nome: "Pertencimento" },
};

function liberado(validadeMs = 60_000) {
  return {
    conteudo,
    url: "https://exemplo.test/carta.mp3",
    urlExpiraEm: new Date(Date.now() + validadeMs).toISOString(),
    status: "em_andamento",
  };
}

const revogado = () => ({ conteudo: null, url: null, urlExpiraEm: null, status: "nao_iniciado" });

function trilhaCom(titulos: string[]) {
  return {
    eixo: { id: "e-1", nome: "Pertencimento", descricao: "Reconhecer o lugar de origem." },
    conteudos: titulos.map((titulo, i) => ({
      id: `c-${i + 1}`,
      tipo: "audio",
      titulo,
      descricao: "",
      duracao_segundos: 300,
      ordem: i,
      status: "nao_iniciado",
    })),
  };
}

function montar(Tela: () => React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return { ...render(
    <QueryClientProvider client={queryClient}>
      <Tela />
    </QueryClientProvider>,
  ), queryClient };
}

const audio = () => document.querySelector("audio") as HTMLAudioElement | null;

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
  fetchContexto.mockResolvedValue({ perfil: { nome: "Ana Souza" } });
});

// ---------------------------------------------------------------------- casos

describe("estados de UI quando o link seguro expira", () => {
  it("mostra o aviso de validade, o selo expirado e esconde o CTA de reprodução", async () => {
    fetchConteudo.mockResolvedValue(liberado(60_000));
    montar(Player);
    await waitFor(() => expect(audio()).not.toBeNull());
    expect(screen.getByRole("status", { name: /Mídia liberada/ })).toBeInTheDocument();

    fireEvent.error(audio()!);

    expect(
      await screen.findByRole("heading", { name: "O link seguro expirou" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /Acesso expirado/ })).toBeInTheDocument();
    // CTA de acesso à mídia sai da tela; sobra apenas renovar
    expect(screen.queryByLabelText("Reproduzir")).toBeNull();
    expect(screen.queryByLabelText("Pausar")).toBeNull();
    expect(screen.queryByLabelText("Avançar 15 segundos")).toBeNull();
    expect(audio()).toBeNull();
    expect(screen.getByRole("button", { name: "Renovar acesso" })).toBeInTheDocument();
    // mensagem errada não pode aparecer
    expect(screen.queryByText(/não está mais liberada/i)).toBeNull();
  });

  it("anuncia o estado do player para leitores de tela quando expira", async () => {
    fetchConteudo.mockResolvedValue(liberado(60_000));
    montar(Player);
    await waitFor(() => expect(audio()).not.toBeNull());

    fireEvent.error(audio()!);
    await screen.findByRole("heading", { name: "O link seguro expirou" });

    await waitFor(() =>
      expect(screen.getByText(/Player pausado: o link seguro expirou/i)).toBeInTheDocument(),
    );
  });
});

describe("estados de UI quando a prática é removida da sequência", () => {
  it("troca o aviso, o selo e remove todo CTA de acesso no player", async () => {
    fetchConteudo.mockResolvedValue(liberado(60_000));
    montar(Player);
    await waitFor(() => expect(audio()).not.toBeNull());
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0));

    fetchConteudo.mockResolvedValue(revogado());
    handlers.forEach((h) => h());

    expect(
      await screen.findByRole("heading", { name: "Prática não está mais liberada" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /Acesso revogado/ })).toBeInTheDocument();
    expect(audio()).toBeNull();
    expect(screen.queryByLabelText("Reproduzir")).toBeNull();
    expect(screen.queryByRole("button", { name: "Marcar como concluída" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Renovar acesso" })).toBeNull();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith("Esta prática não está mais liberada para você.");
    // não confunde com o aviso de expiração
    expect(screen.queryByRole("heading", { name: "O link seguro expirou" })).toBeNull();
  });

  it("anuncia player indisponível e mantém apenas o caminho de volta", async () => {
    fetchConteudo.mockResolvedValue(liberado(60_000));
    montar(Player);
    await waitFor(() => expect(audio()).not.toBeNull());
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0));

    fetchConteudo.mockResolvedValue(revogado());
    handlers.forEach((h) => h());
    await screen.findByRole("heading", { name: "Prática não está mais liberada" });

    await waitFor(() =>
      expect(screen.getByText(/Player indisponível/i)).toBeInTheDocument(),
    );
    expect(screen.getAllByText("Voltar à trilha").length).toBeGreaterThan(0);
  });

  it("remove o CTA da prática na sequência assim que ela sai da trilha", async () => {
    fetchTrilha.mockResolvedValue(trilhaCom(["Respiração da raiz", TITULO]));
    montar(Trilha);
    expect(await screen.findByText(TITULO)).toBeInTheDocument();
    await waitFor(() => expect(handlers.length).toBeGreaterThan(0));

    fetchTrilha.mockResolvedValue(trilhaCom(["Respiração da raiz"]));
    handlers.forEach((h) => h());

    await waitFor(() => expect(screen.queryByText(TITULO)).toBeNull());
    // nenhum link continua apontando para a prática removida
    const destinos = Array.from(document.querySelectorAll("a")).map((a) => a.textContent);
    expect(destinos.join(" ")).not.toContain(TITULO);
    expect(screen.getByText("Respiração da raiz")).toBeInTheDocument();
  });
});
