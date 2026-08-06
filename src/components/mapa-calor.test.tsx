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

describe("MapaCalor", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(HOJE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mostra um botão por dia com prática e tooltip nos dias vazios", () => {
    renderMapa();

    expect(screen.getByRole("button", { name: rotulo(1, 2) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: rotulo(3, 1) })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);

    const d = new Date(HOJE);
    d.setDate(d.getDate() - 2);
    const vazio = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    expect(document.querySelector(`[title="${vazio} — nenhuma prática"]`)).toBeTruthy();
  });

  it("abre o popover do dia e lista as práticas concluídas com tempo total", async () => {
    const user = userEvent.setup();
    renderMapa();

    await user.click(screen.getByRole("button", { name: rotulo(1, 2) }));

    const popover = await screen.findByRole("dialog");
    expect(within(popover).getByText("2 práticas · 15 min registrados")).toBeInTheDocument();
    expect(within(popover).getByText("Carta ao pai")).toBeInTheDocument();
    expect(within(popover).getByText(/Pai · Exercício · 10 min/)).toBeInTheDocument();
    expect(within(popover).getByText("Respiração da raiz")).toBeInTheDocument();
    expect(within(popover).getByText(/Ancestralidade · Áudio · 5 min/)).toBeInTheDocument();
    expect(within(popover).queryByText("Vídeo introdutório")).not.toBeInTheDocument();
  });

  it("abre o popover de outro dia com apenas a prática daquele dia", async () => {
    const user = userEvent.setup();
    renderMapa();

    await user.click(screen.getByRole("button", { name: rotulo(3, 1) }));

    const popover = await screen.findByRole("dialog");
    expect(within(popover).getByText("1 prática · 15 min registrados")).toBeInTheDocument();
    expect(within(popover).getByText("Vídeo introdutório")).toBeInTheDocument();
    expect(within(popover).getAllByRole("listitem")).toHaveLength(1);
  });
});
