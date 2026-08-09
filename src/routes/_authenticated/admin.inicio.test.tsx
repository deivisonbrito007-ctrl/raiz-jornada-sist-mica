import type React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Aba "Início" do painel da terapeuta: primeira tela após o login.
 * Cobre os quatro estados (carregando, vazio, com dados, erro), o recorte por
 * permissão e o cuidado com a privacidade do diário.
 */

const fetchInicio = vi.fn<() => Promise<any>>();
const permissoes = { conjunto: new Set<string>(), carregando: false };

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options }),
  Link: ({ children, to, ...props }: any) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: () => fetchInicio }));

vi.mock("@/lib/inicio.functions", () => ({ adminInicio: Symbol("adminInicio") }));

vi.mock("@/hooks/use-minhas-permissoes", () => ({
  useMinhasPermissoes: () => ({
    pode: (p: string) => permissoes.conjunto.has(p),
    carregando: permissoes.carregando,
  }),
}));

vi.mock("@/hooks/use-meu-contexto", () => ({
  useMeuContexto: () => ({ data: { perfil: { nome: "Marina Alves" } } }),
}));

vi.mock("@/components/permissao-ui", () => ({
  SecaoSemPermissao: ({ titulo }: any) => <p>{titulo}</p>,
}));

const { Route } = await import("./admin.inicio");
const Inicio = (Route as any).component as () => React.ReactElement;

const VAZIO = {
  clientes: [],
  perfis: [],
  atribuicoes: [],
  trilhas: [],
  revisoes: [],
  apoio: [],
  convites: [],
  etapas: [],
  praticas: [],
  compartilhados: [],
};

const CLI = "11111111-1111-4111-8111-111111111111";

const COM_DADOS = {
  ...VAZIO,
  clientes: [{ id: CLI, nome: "Ana Souza", email: "ana@ex.com", status: "ativo" }],
  perfis: [{ id: CLI, nome: "Ana Souza", email: "ana@ex.com" }],
  trilhas: [{ id: "t1", nome: "Raízes" }],
  atribuicoes: [
    {
      id: "a1",
      cliente_id: CLI,
      terapeuta_id: null,
      trilha_id: "t1",
      objetivo: "Reduzir a autocrítica",
      status: "ativa",
      data_inicio: "2026-08-01",
      data_revisao: "2026-08-12",
      created_at: "2026-08-01T10:00:00Z",
      updated_at: "2026-08-01T10:00:00Z",
    },
  ],
  apoio: [
    { id: "s1", cliente_id: CLI, status: "aberta", origem: "etapa", created_at: new Date().toISOString() },
  ],
  compartilhados: [{ id: "d1", cliente_id: CLI, compartilhado_em: new Date().toISOString() }],
};

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Inicio />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchInicio.mockReset();
  permissoes.conjunto = new Set(["ver_clientes", "gerenciar_liberacoes", "gerenciar_conteudos"]);
  permissoes.carregando = false;
});

describe("aba Início do painel", () => {
  it("cumprimenta pelo primeiro nome e situa a data", () => {
    fetchInicio.mockResolvedValue(VAZIO);
    montar();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Olá, Marina");
    expect(screen.getByText(/de 20\d\d/)).toBeInTheDocument();
  });

  it("avisa o leitor de tela enquanto carrega", () => {
    fetchInicio.mockReturnValue(new Promise(() => {}));
    montar();
    expect(screen.getByRole("status")).toHaveTextContent(/carregando o panorama/i);
  });

  it("sem nenhum cliente ainda, mostra zeros com frases de convite", async () => {
    fetchInicio.mockResolvedValue(VAZIO);
    montar();
    const resumo = await screen.findByRole("region", { name: /resumo/i });
    expect(within(resumo).getAllByText("0")).toHaveLength(6);
    expect(await screen.findByText(/nenhuma pendência para hoje/i)).toBeInTheDocument();
    expect(screen.getByText(/nenhuma revisão programada/i)).toBeInTheDocument();
  });

  it("mostra prioridades, agenda e atividade quando há dados", async () => {
    fetchInicio.mockResolvedValue(COM_DADOS);
    montar();
    expect(await screen.findByText(/solicitou contato/i)).toBeInTheDocument();

    const agenda = screen.getByRole("region", { name: /agenda de revisões/i });
    expect(within(agenda).getAllByText("Ana Souza").length).toBeGreaterThan(0);
    expect(within(agenda).getAllByText(/não atribuído/i).length).toBeGreaterThan(0);

    const atividade = screen.getByRole("region", { name: /atividade recente/i });
    expect(within(atividade).getByText(/compartilhou um registro do diário/i)).toBeInTheDocument();
  });

  it("nunca imprime o texto do diário na atividade recente", async () => {
    fetchInicio.mockResolvedValue(COM_DADOS);
    const { container } = montar();
    await screen.findByRole("region", { name: /atividade recente/i });
    expect(container.textContent).not.toMatch(/senti|chorei|lembrei/i);
  });

  it("sem permissão de clientes, explica o bloqueio e não busca dados", async () => {
    permissoes.conjunto = new Set(["gerenciar_conteudos"]);
    fetchInicio.mockResolvedValue(VAZIO);
    montar();
    expect(await screen.findByText(/indicadores de clientes restritos/i)).toBeInTheDocument();
    expect(fetchInicio).not.toHaveBeenCalled();
    expect(screen.queryByText(/adicionar cliente/i)).not.toBeInTheDocument();
  });

  it("mostra apenas as ações rápidas permitidas", async () => {
    permissoes.conjunto = new Set(["ver_clientes"]);
    fetchInicio.mockResolvedValue(VAZIO);
    montar();
    const acoes = await screen.findByRole("region", { name: /ações rápidas/i });
    expect(within(acoes).getByRole("link", { name: /clientes/i })).toBeInTheDocument();
    expect(within(acoes).queryByRole("link", { name: /conteúdos/i })).not.toBeInTheDocument();
  });

  it("na falha, tranquiliza e oferece tentar de novo", async () => {
    fetchInicio.mockRejectedValueOnce(new Error("rede"));
    montar();
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/seus dados estão salvos/i);

    fetchInicio.mockResolvedValue(VAZIO);
    await userEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
