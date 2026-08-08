import type React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Página de histórico do cliente: práticas liberadas e concluídas por trilha,
 * com as reflexões do diário ligadas a cada prática.
 */

const fetchHistorico = vi.fn<() => Promise<any>>();
const getMeuHistoricoMock = Symbol("getMeuHistorico");

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options }),
  Link: ({ children, to, params, ...props }: any) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => fetchHistorico,
}));

vi.mock("@/lib/raiz.functions", () => ({
  getMeuHistorico: getMeuHistoricoMock,
}));

vi.mock("@/hooks/use-sincronizar-liberacoes", () => ({
  useSincronizarLiberacoes: () => undefined,
}));

const { Route } = await import("./app.historico");
const Historico = (Route as any).component as () => React.ReactElement;

const HISTORICO = {
  trilhas: [
    {
      id: "e-1",
      nome: "Relacionamentos",
      descricao: "",
      icone: "sprout",
      total: 2,
      concluidos: 1,
      praticas: [
        {
          id: "c-1",
          tipo: "video",
          titulo: "Abertura do eixo",
          duracaoSegundos: 300,
          status: "concluido",
          concluidoEm: "2026-08-01T10:00:00.000Z",
          atualizadoEm: "2026-08-01T10:00:00.000Z",
          reflexoes: [{ id: "d-1", texto: "Senti alívio no peito", criadoEm: "2026-08-01T11:00:00.000Z" }],
        },
        {
          id: "c-2",
          tipo: "audio",
          titulo: "Respiração guiada",
          duracaoSegundos: 600,
          status: "nao_iniciado",
          concluidoEm: null,
          atualizadoEm: null,
          reflexoes: [],
        },
      ],
    },
  ],
  reflexoesGerais: [{ id: "d-2", texto: "Reflexão solta da semana", criadoEm: "2026-08-02T09:00:00.000Z" }],
  resumo: {
    totalItens: 2,
    totalConcluidos: 1,
    percentual: 50,
    totalReflexoes: 2,
    ultimaConclusao: "2026-08-01T10:00:00.000Z",
  },
};

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Historico />
    </QueryClientProvider>,
  );
}

describe("histórico do cliente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchHistorico.mockResolvedValue(HISTORICO);
  });

  it("agrupa práticas por trilha com estado e data de conclusão", async () => {
    renderizar();
    expect(await screen.findByRole("heading", { level: 1, name: "Meu histórico" })).toBeTruthy();
    expect(await screen.findByRole("heading", { level: 2, name: "Relacionamentos" })).toBeTruthy();
    expect(screen.getByText("Abertura do eixo")).toBeTruthy();
    expect(screen.getByText(/Concluída em/)).toBeTruthy();
    expect(screen.getByText("Não iniciada")).toBeTruthy();
    expect(screen.getByText("1 de 2 concluídas")).toBeTruthy();
  });

  it("mostra as reflexões ligadas à prática somente ao expandir", async () => {
    renderizar();
    const botao = await screen.findByRole("button", { name: /Ver reflexões \(1\)/ });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Senti alívio no peito").closest("ul")?.hasAttribute("hidden")).toBe(true);

    await userEvent.click(botao);
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Senti alívio no peito").closest("ul")?.hasAttribute("hidden")).toBe(false);
  });

  it("filtra por estado e por busca, inclusive no texto das reflexões", async () => {
    renderizar();
    await screen.findByText("Abertura do eixo");

    await userEvent.click(screen.getByRole("button", { name: "Concluídas" }));
    expect(screen.queryByText("Respiração guiada")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Todas" }));
    await userEvent.type(screen.getByLabelText(/Buscar por prática/), "alívio");
    await waitFor(() => expect(screen.queryByText("Respiração guiada")).toBeNull());
    expect(screen.getByText("Abertura do eixo")).toBeTruthy();
  });

  it("lista reflexões sem prática vinculada em bloco próprio", async () => {
    renderizar();
    expect(await screen.findByRole("heading", { level: 2, name: "Reflexões gerais" })).toBeTruthy();
    expect(screen.getByText("Reflexão solta da semana")).toBeTruthy();
  });

  it("mostra estado vazio com atalho para a biblioteca", async () => {
    fetchHistorico.mockResolvedValue({
      trilhas: [],
      reflexoesGerais: [],
      resumo: {
        totalItens: 0,
        totalConcluidos: 0,
        percentual: 0,
        totalReflexoes: 0,
        ultimaConclusao: null,
      },
    });
    renderizar();
    expect(await screen.findByText(/Ainda não há práticas liberadas/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver minha biblioteca" })).toBeTruthy();
  });
});
