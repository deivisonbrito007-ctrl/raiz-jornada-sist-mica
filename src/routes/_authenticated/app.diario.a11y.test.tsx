import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { esperarSemViolacoes } from "@/test/axe";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Acessibilidade das telas do Diário de Reflexão.
 *
 * Cobre: varredura axe (estado vazio, com entradas e com prática vinculada),
 * navegação apenas por teclado (campo -> botão) e anúncios em live region
 * para sucesso e erro ao salvar.
 */

const search: { conteudoId?: string } = {};

const fetchDiario = vi.fn<() => Promise<any>>();
const fetchConteudo = vi.fn<(args: any) => Promise<any>>();
const salvarFn = vi.fn<(args: any) => Promise<any>>();

const listarDiarioMock = Symbol("listarDiario");
const getConteudoMock = Symbol("getConteudo");
const salvarDiarioMock = Symbol("salvarDiario");

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => search,
  }),
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

vi.mock("@tanstack/react-start", () => ({
  createMiddleware: middlewareStub,
  createServerFn: middlewareStub,
  createStart: () => ({}),
  createCsrfMiddleware: middlewareStub,
  useServerFn: (fn: unknown) =>
    fn === listarDiarioMock ? fetchDiario : fn === getConteudoMock ? fetchConteudo : salvarFn,
}));

vi.mock("@/lib/raiz.functions", () => ({
  listarDiario: listarDiarioMock,
  getConteudo: getConteudoMock,
  salvarDiario: salvarDiarioMock,
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

/** O convite do dia muda conforme o dia da semana: buscamos o campo pelo papel. */
function campoReflexao() {
  return screen.findByRole("textbox", { name: /.+/ });
}

const entradas = [
  {
    id: "d-1",
    created_at: "2026-08-01T12:00:00.000Z",
    texto: "Senti o peito abrir durante a respiração.",
    conteudos: { titulo: "Respiração da raiz" },
  },
  {
    id: "d-2",
    created_at: "2026-07-28T12:00:00.000Z",
    texto: "Lembrei da minha avó.",
    conteudos: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  delete search.conteudoId;
  fetchDiario.mockResolvedValue([]);
  fetchConteudo.mockResolvedValue({ conteudo: { titulo: "Respiração da raiz" } });
  salvarFn.mockResolvedValue({ ok: true });
});

describe("Diário de reflexão — acessibilidade", () => {
  it("não tem violações axe no estado vazio", async () => {
    const { container } = renderizar();
    await screen.findByText("Suas reflexões aparecerão aqui.");
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
    await userEvent.click(screen.getByRole("button", { name: "Salvar reflexão" }));
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

  it("expõe as entradas anteriores como lista para leitores de tela", async () => {
    fetchDiario.mockResolvedValue(entradas);
    renderizar();
    const lista = await screen.findByRole("list");
    expect(lista).toHaveAccessibleName("Entradas anteriores");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("permite escrever e salvar somente com o teclado", async () => {
    renderizar();
    const campo = await campoReflexao();
    campo.focus();
    await userEvent.keyboard("reflexão via teclado");
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Salvar reflexão" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(salvarFn).toHaveBeenCalled());
  });

  it("anuncia sucesso na live region após salvar", async () => {
    renderizar();
    const campo = await campoReflexao();
    await userEvent.type(campo, "guardar isto");
    await userEvent.click(screen.getByRole("button", { name: "Salvar reflexão" }));
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Reflexão guardada."));
  });

  it("anuncia o erro na live region quando o salvamento falha", async () => {
    salvarFn.mockRejectedValue(new Error("Sem conexão"));
    renderizar();
    const campo = await campoReflexao();
    await userEvent.type(campo, "tentativa");
    await userEvent.click(screen.getByRole("button", { name: "Salvar reflexão" }));
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Erro ao salvar: Sem conexão"));
  });

  it("mantém o botão desabilitado com o campo vazio", async () => {
    renderizar();
    await campoReflexao();
    expect(screen.getByRole("button", { name: "Salvar reflexão" })).toBeDisabled();
  });
});
