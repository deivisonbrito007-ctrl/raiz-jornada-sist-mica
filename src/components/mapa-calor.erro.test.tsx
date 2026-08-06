import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapaCalor } from "./mapa-calor";
import { mapaCalorDiario, type ConclusaoDetalhe } from "@/lib/raiz-format";

/**
 * Integração: mensagens de erro e fallback do heatmap/popover
 * quando a consulta ao backend falha (total ou parcialmente).
 */

const HOJE = new Date("2026-08-06T12:00:00.000Z");

function iso(diasAtras: number, hora = 9) {
  const d = new Date(HOJE);
  d.setHours(hora, 0, 0, 0);
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString();
}

function rotulo(diasAtras: number, praticas: number) {
  const d = new Date(HOJE);
  d.setDate(d.getDate() - diasAtras);
  const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${label} — ${praticas} prática${praticas === 1 ? "" : "s"}`;
}

const conclusoes: ConclusaoDetalhe[] = [
  {
    titulo: "Carta ao pai",
    eixoNome: "Pai",
    tipo: "exercicio",
    duracaoSegundos: 600,
    concluidoEm: iso(1, 8),
  },
];

describe("MapaCalor com falha na consulta", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(HOJE);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("mostra mensagem de erro e esconde o calendário quando a consulta falha", () => {
    render(
      <MapaCalor
        colunas={[]}
        erro="permission denied for table progresso"
        onTentarNovamente={() => {}}
      />,
    );

    const alerta = screen.getByRole("alert");
    expect(
      within(alerta).getByText("Não foi possível carregar o calendário de prática."),
    ).toBeInTheDocument();
    expect(within(alerta).getByText("permission denied for table progresso")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /prática/ })).toHaveLength(0);
  });

  it("permite tentar novamente após o erro", async () => {
    const user = userEvent.setup();
    const tentar = vi.fn();
    render(<MapaCalor colunas={[]} erro="Failed to fetch" onTentarNovamente={tentar} />);

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(tentar).toHaveBeenCalledTimes(1);
  });

  it("não mostra botão de recarregar quando não há handler", () => {
    render(<MapaCalor colunas={[]} erro="Erro inesperado" />);
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  });

  it("popover usa fallback quando os detalhes do dia não carregam", async () => {
    const user = userEvent.setup();
    const tentar = vi.fn();
    // datas chegaram, mas a consulta de detalhes falhou (lista vazia)
    const colunas = mapaCalorDiario(
      conclusoes.map((c) => c.concluidoEm),
      12,
      [],
    );
    render(<MapaCalor colunas={colunas} erroDetalhes onTentarNovamente={tentar} />);

    await user.click(screen.getByRole("button", { name: rotulo(1, 1) }));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText(/1 prática/)).toBeInTheDocument();
    expect(
      within(painel).getByText("Não foi possível carregar os detalhes deste dia."),
    ).toBeInTheDocument();

    await user.click(within(painel).getByRole("button", { name: "Tentar novamente" }));
    expect(tentar).toHaveBeenCalledTimes(1);
  });

  it("dia sem prática mantém estado vazio, não a mensagem de erro, mesmo com erroDetalhes", async () => {
    const user = userEvent.setup();
    const colunas = mapaCalorDiario([], 12, []);
    render(<MapaCalor colunas={colunas} erroDetalhes />);

    const label = rotulo(2, 0).split(" — ")[0];
    await user.click(screen.getByRole("button", { name: `${label} — nenhuma prática` }));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText(/0 prática · 0 min registrados/)).toBeInTheDocument();
    expect(
      within(painel).queryByText("Não foi possível carregar os detalhes deste dia."),
    ).not.toBeInTheDocument();
  });

  it("volta a renderizar o calendário quando o erro é resolvido", async () => {
    const colunas = mapaCalorDiario(
      conclusoes.map((c) => c.concluidoEm),
      12,
      conclusoes,
    );
    const { rerender } = render(<MapaCalor colunas={[]} erro="Failed to fetch" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(<MapaCalor colunas={colunas} erro={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: rotulo(1, 1) })).toBeInTheDocument();
  });
});
