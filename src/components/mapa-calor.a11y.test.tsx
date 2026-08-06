import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapaCalor } from "./mapa-calor";
import { mapaCalorDiario, type ConclusaoDetalhe } from "@/lib/raiz-format";

const HOJE = new Date("2026-08-06T12:00:00.000Z");

function iso(diasAtras: number, hora = 9) {
  const d = new Date(HOJE);
  d.setHours(hora, 0, 0, 0);
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString();
}

const conclusoes: ConclusaoDetalhe[] = [
  {
    titulo: "Carta ao pai",
    eixoNome: "Pai",
    tipo: "exercicio",
    duracaoSegundos: 600,
    concluidoEm: iso(1, 8),
  },
  {
    titulo: "Respiração da raiz",
    eixoNome: "Ancestralidade",
    tipo: "audio",
    duracaoSegundos: 300,
    concluidoEm: iso(1, 20),
  },
  {
    titulo: "Vídeo introdutório",
    eixoNome: "Mãe",
    tipo: "video",
    duracaoSegundos: 900,
    concluidoEm: iso(3, 10),
  },
];

function renderMapa() {
  const datas = conclusoes.map((c) => c.concluidoEm);
  const colunas = mapaCalorDiario(datas, 12, conclusoes);
  return render(<MapaCalor colunas={colunas} />);
}

function rotulo(diasAtras: number, praticas: number) {
  const d = new Date(HOJE);
  d.setDate(d.getDate() - diasAtras);
  const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${label} — ${praticas} prática${praticas === 1 ? "" : "s"}`;
}

describe("MapaCalor — acessibilidade", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(HOJE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("expõe cada dia com prática como botão nomeado e com semântica de popover", () => {
    renderMapa();

    const dias = screen.getAllByRole("button");
    expect(dias).toHaveLength(2);

    for (const dia of dias) {
      expect(dia).toHaveAccessibleName();
      expect(dia).toHaveAttribute("aria-haspopup", "dialog");
      expect(dia).toHaveAttribute("aria-expanded", "false");
      expect(dia).not.toHaveAttribute("tabindex", "-1");
    }
  });

  it("mantém dias sem prática fora da ordem de tabulação", async () => {
    const user = userEvent.setup();
    renderMapa();

    const primeiro = screen.getByRole("button", { name: rotulo(3, 1) });
    const segundo = screen.getByRole("button", { name: rotulo(1, 2) });

    await user.tab();
    expect(primeiro).toHaveFocus();

    // O próximo Tab pula os dias vazios (spans) e vai direto para o outro dia com prática.
    await user.tab();
    expect(segundo).toHaveFocus();
  });

  it("abre o popover pelo teclado com Enter e devolve o foco ao fechar com Escape", async () => {
    const user = userEvent.setup();
    renderMapa();

    const dia = screen.getByRole("button", { name: rotulo(1, 2) });
    dia.focus();
    expect(dia).toHaveFocus();

    await user.keyboard("{Enter}");

    const popover = await screen.findByRole("dialog");
    expect(dia).toHaveAttribute("aria-expanded", "true");
    expect(within(popover).getByText("Carta ao pai")).toBeInTheDocument();
    expect(popover).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(dia).toHaveAttribute("aria-expanded", "false");
    expect(dia).toHaveFocus();
  });

  it("também abre o popover com a barra de espaço", async () => {
    const user = userEvent.setup();
    renderMapa();

    const dia = screen.getByRole("button", { name: rotulo(3, 1) });
    dia.focus();

    await user.keyboard(" ");

    const popover = await screen.findByRole("dialog");
    expect(within(popover).getByText("Vídeo introdutório")).toBeInTheDocument();
  });
});
