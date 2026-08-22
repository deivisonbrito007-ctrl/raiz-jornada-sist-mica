import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { esperarSemViolacoes } from "@/test/axe";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Acessibilidade e comportamento do Diário de Reflexão redesenhado.
 *
 * Cobre: varredura axe (vazio, com entradas e vinculado a uma prática), teclado,
 * anúncios em live region, privacidade explícita no modo acompanhado e as ações
 * de editar, apagar e mudar quem pode ler.
 */

const search: { conteudoId?: string } = {};

const fetchDiario = vi.fn<() => Promise<any>>();
const fetchConteudo = vi.fn<(args: any) => Promise<any>>();
const fetchPratica = vi.fn<() => Promise<any>>();
const salvarFn = vi.fn<(args: any) => Promise<any>>();
const editarFn = vi.fn<(args: any) => Promise<any>>();
const apagarFn = vi.fn<(args: any) => Promise<any>>();
const visibilidadeFn = vi.fn<(args: any) => Promise<any>>();

const listarDiarioMock = Symbol("listarDiario");
const getConteudoMock = Symbol("getConteudo");
const salvarDiarioMock = Symbol("salvarDiario");
const editarDiarioMock = Symbol("editarDiario");
const apagarDiarioMock = Symbol("apagarDiario");
const visibilidadeMock = Symbol("definirVisibilidadeDiario");
const praticaMock = Symbol("getPraticaSemReflexao");

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => search,
  }),
  Link: ({ children, ...resto }: any) => (
    <a href="#" {...resto}>
      {children}
    </a>
  ),
}));

const middlewareStub = () => {
  const chain: any = {
    server: () => chain,
    client: () => chain,
    middleware: () => chain,
    inputValidator: () => chain,
    validator: () => chain,
    handler: () => chain,
  };
  return chain;
};

const mapa = new Map<unknown, unknown>();

vi.mock("@tanstack/react-start", () => ({
  createMiddleware: middlewareStub,
  createServerFn: middlewareStub,
  createStart: () => ({}),
  createCsrfMiddleware: middlewareStub,
  useServerFn: (fn: unknown) => mapa.get(fn) ?? salvarFn,
}));

const getBibliotecaMock = Symbol("getMinhaBiblioteca");
const fetchBibliotecaDiario = vi.fn(async () => ({ eixos: [] }));

vi.mock("@/lib/raiz.functions", () => ({
  listarDiario: listarDiarioMock,
  getConteudo: getConteudoMock,
  salvarDiario: salvarDiarioMock,
  editarDiario: editarDiarioMock,
  apagarDiario: apagarDiarioMock,
  definirVisibilidadeDiario: visibilidadeMock,
  getPraticaSemReflexao: praticaMock,
  getMeuContexto: Symbol("getMeuContexto"),
  getMinhaBiblioteca: getBibliotecaMock,
}));

mapa.set(listarDiarioMock, fetchDiario);
mapa.set(getConteudoMock, fetchConteudo);
mapa.set(salvarDiarioMock, salvarFn);
mapa.set(editarDiarioMock, editarFn);
mapa.set(apagarDiarioMock, apagarFn);
mapa.set(visibilidadeMock, visibilidadeFn);
mapa.set(praticaMock, fetchPratica);
mapa.set(getBibliotecaMock, fetchBibliotecaDiario);

const contexto: { modo: string } = { modo: "acompanhado" };
vi.mock("@/hooks/use-meu-contexto", () => ({
  useMeuContexto: () => ({ data: { modo: contexto.modo, perfil: { nome: "Ana Maria" } } }),
}));

const toastMock = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("sonner", () => ({ toast: toastMock }));

const { Route } = await import("./app.diario");
const Diario = (Route as any).component as () => React.ReactElement;

function renderizar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Diario />
    </QueryClientProvider>,
  );
}

/** O convite muda a cada dia: buscamos o campo pelo papel. */
function campoReflexao() {
  return screen.findByRole("textbox", { name: /\?$/ });
}

const entradas = [
  {
    id: "d-1",
    created_at: "2026-08-01T12:00:00.000Z",
    texto: "Senti o peito abrir durante a respiração.",
    conteudo_id: "c-1",
    visibilidade: "somente_eu",
    conteudos: { titulo: "Respiração da raiz", eixos: { nome: "Corpo" } },
  },
  {
    id: "d-2",
    created_at: "2026-07-28T12:00:00.000Z",
    texto: "Lembrei da minha avó.",
    conteudo_id: null,
    visibilidade: "compartilhado",
    conteudos: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  delete search.conteudoId;
  contexto.modo = "acompanhado";
  fetchDiario.mockResolvedValue([]);
  fetchPratica.mockResolvedValue(null);
  fetchConteudo.mockResolvedValue({
    conteudo: { titulo: "Respiração da raiz", eixos: { nome: "Corpo" } },
  });
  salvarFn.mockResolvedValue({ ok: true });
  editarFn.mockResolvedValue({ ok: true });
  apagarFn.mockResolvedValue({ ok: true });
  visibilidadeFn.mockResolvedValue({ ok: true });
});

describe("Diário de reflexão — acessibilidade", () => {
  it("não tem violações axe no estado vazio", async () => {
    const { container } = renderizar();
    await screen.findByText(/Suas reflexões aparecerão aqui/);
    await esperarSemViolacoes(container);
  });

  it("não tem violações axe com entradas anteriores", async () => {
    fetchDiario.mockResolvedValue(entradas);
    const { container } = renderizar();
    await screen.findByText("Senti o peito abrir durante a respiração.");
    await esperarSemViolacoes(container);
  });

  it("não tem violações axe quando o diário está vinculado a uma prática", async () => {
    search.conteudoId = "c-1";
    fetchDiario.mockResolvedValue(entradas);
    const { container } = renderizar();
    await screen.findByLabelText(/Depois de/);
    await esperarSemViolacoes(container);
  });

  it("não tem violações axe enquanto salva (botão em aria-busy)", async () => {
    let liberar: (v: unknown) => void = () => {};
    salvarFn.mockImplementation(() => new Promise((r) => (liberar = r)));
    const { container } = renderizar();
    const campo = await campoReflexao();
    await userEvent.type(campo, "uma reflexão");
    await userEvent.click(screen.getByRole("button", { name: "Guardar reflexão" }));
    const botao = await screen.findByRole("button", { name: "Guardando..." });
    expect(botao).toHaveAttribute("aria-busy", "true");
    await esperarSemViolacoes(container);
    liberar({ ok: true });
  });

  it("associa o campo de escrita a um rótulo e a uma dica", async () => {
    renderizar();
    const campo = await campoReflexao();
    expect(campo).toHaveAttribute("aria-describedby", "dica-reflexao");
  });

  it("expõe as entradas como lista para leitores de tela", async () => {
    fetchDiario.mockResolvedValue(entradas);
    renderizar();
    await screen.findByText("Lembrei da minha avó.");
    const listas = screen
      .getAllByRole("list")
      .filter((l) => (l.getAttribute("aria-label") ?? "").startsWith("Reflexões de "));
    const itens = listas.flatMap((l) => Array.from(l.querySelectorAll(":scope > li")));
    expect(itens).toHaveLength(2);
  });

  it("anuncia sucesso na live region após salvar", async () => {
    renderizar();
    const campo = await campoReflexao();
    await userEvent.type(campo, "guardar isto");
    await userEvent.click(screen.getByRole("button", { name: "Guardar reflexão" }));
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Reflexão guardada."));
  });

  it("anuncia o erro na live region quando o salvamento falha", async () => {
    salvarFn.mockRejectedValue(new Error("Sem conexão"));
    renderizar();
    const campo = await campoReflexao();
    await userEvent.type(campo, "tentativa");
    await userEvent.click(screen.getByRole("button", { name: "Guardar reflexão" }));
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Erro ao salvar: Sem conexão"));
  });

  it("mantém o botão desabilitado com o campo vazio", async () => {
    renderizar();
    await campoReflexao();
    expect(screen.getByRole("button", { name: "Guardar reflexão" })).toBeDisabled();
  });
});

describe("Diário de reflexão — privacidade e ações", () => {
  it("guarda como privada por padrão no modo acompanhado", async () => {
    renderizar();
    const campo = await campoReflexao();
    expect(screen.getByRole("radio", { name: /Só para mim/ })).toBeChecked();
    await userEvent.type(campo, "reflexão privada");
    await userEvent.click(screen.getByRole("button", { name: "Guardar reflexão" }));
    await waitFor(() =>
      expect(salvarFn).toHaveBeenCalledWith({
        data: expect.objectContaining({ visibilidade: "somente_eu" }),
      }),
    );
  });

  it("permite escolher compartilhar com quem acompanha", async () => {
    renderizar();
    const campo = await campoReflexao();
    await userEvent.click(screen.getByRole("radio", { name: /Compartilhar/ }));
    await userEvent.type(campo, "quero mostrar isto");
    await userEvent.click(screen.getByRole("button", { name: "Guardar reflexão" }));
    await waitFor(() =>
      expect(salvarFn).toHaveBeenCalledWith({
        data: expect.objectContaining({ visibilidade: "compartilhado" }),
      }),
    );
  });

  it("no modo autoguiado não oferece compartilhamento", async () => {
    contexto.modo = "autoguiado";
    renderizar();
    await campoReflexao();
    expect(screen.queryByRole("radio", { name: /Compartilhar/ })).toBeNull();
    expect(screen.getByText(/Este diário é privado/)).toBeInTheDocument();
  });

  it("edita uma reflexão existente", async () => {
    fetchDiario.mockResolvedValue(entradas);
    renderizar();
    await screen.findByText("Lembrei da minha avó.");
    await userEvent.click(screen.getAllByRole("button", { name: /Editar/ })[0]!);
    const campo = screen.getByLabelText("Editar reflexão");
    await userEvent.clear(campo);
    await userEvent.type(campo, "texto revisado");
    await userEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() =>
      expect(editarFn).toHaveBeenCalledWith({ data: { id: "d-1", texto: "texto revisado" } }),
    );
  });

  it("pede confirmação antes de apagar", async () => {
    fetchDiario.mockResolvedValue(entradas);
    renderizar();
    await screen.findByText("Lembrei da minha avó.");
    await userEvent.click(screen.getAllByRole("button", { name: /Apagar/ })[0]!);
    expect(screen.getByText("Apagar para sempre?")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Apagar" })[0]!);
    await waitFor(() => expect(apagarFn).toHaveBeenCalledWith({ data: { id: "d-1" } }));
  });

  it("alterna quem pode ler uma reflexão já guardada", async () => {
    fetchDiario.mockResolvedValue(entradas);
    renderizar();
    await screen.findByText("Lembrei da minha avó.");
    await userEvent.click(screen.getAllByRole("button", { name: /^Compartilhar$/ })[0]!);
    await waitFor(() =>
      expect(visibilidadeFn).toHaveBeenCalledWith({
        data: { id: "d-1", visibilidade: "compartilhado" },
      }),
    );
  });

  it("filtra apenas as reflexões compartilhadas", async () => {
    fetchDiario.mockResolvedValue(entradas);
    renderizar();
    await screen.findByText("Lembrei da minha avó.");
    await userEvent.click(screen.getByRole("button", { name: "Compartilhadas" }));
    expect(screen.queryByText("Senti o peito abrir durante a respiração.")).toBeNull();
    expect(screen.getByText("Lembrei da minha avó.")).toBeInTheDocument();
  });

  it("busca por palavra dentro das reflexões", async () => {
    fetchDiario.mockResolvedValue(entradas);
    renderizar();
    await screen.findByText("Lembrei da minha avó.");
    await userEvent.type(screen.getByLabelText("Buscar nas suas reflexões"), "avó");
    expect(screen.queryByText("Senti o peito abrir durante a respiração.")).toBeNull();
  });

  it("convida a escrever sobre a prática concluída sem reflexão", async () => {
    fetchPratica.mockResolvedValue({
      conteudoId: "c-9",
      titulo: "Aterramento breve",
      eixoNome: "Corpo",
      concluidoEm: new Date().toISOString(),
    });
    renderizar();
    expect(await screen.findByText(/Ficou uma prática sem palavras/)).toBeInTheDocument();
  });
});
