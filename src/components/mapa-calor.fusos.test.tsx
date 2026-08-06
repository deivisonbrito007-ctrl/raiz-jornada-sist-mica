import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapaCalor } from "./mapa-calor";
import { mapaCalorDiario, type ConclusaoDetalhe } from "@/lib/raiz-format";

const AGORA = new Date("2026-08-06T12:00:00.000Z");
const TZ_ORIGINAL = process.env.TZ;

const FUSOS = [
  "UTC",
  "America/Sao_Paulo", // -03
  "Europe/Lisbon", // +01 (verão)
  "Asia/Tokyo", // +09
  "Pacific/Kiritimati", // +14
  "Pacific/Midway", // -11
];

function usarFuso(tz: string) {
  process.env.TZ = tz;
}

/** ISO de um instante no horário LOCAL do fuso ativo. */
function isoLocal(diasAtras: number, hora: number, minuto = 0) {
  const d = new Date(AGORA);
  d.setHours(hora, minuto, 0, 0);
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString();
}

function rotuloLocal(diasAtras: number) {
  const d = new Date(AGORA);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - diasAtras);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function renderMapa(conclusoes: ConclusaoDetalhe[]) {
  const colunas = mapaCalorDiario(
    conclusoes.map((c) => c.concluidoEm),
    12,
    conclusoes,
  );
  return render(<MapaCalor colunas={colunas} />);
}

describe("MapaCalor — tempo total do dia por fuso horário", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(AGORA);
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = TZ_ORIGINAL;
    cleanup();
  });

  it.each(FUSOS)("soma o tempo do dia local corretamente em %s", async (tz) => {
    usarFuso(tz);
    const user = userEvent.setup();

    // Duas práticas no MESMO dia local (00:30 e 23:30) — nos extremos do dia,
    // onde uma conversão de fuso incorreta empurraria o registro para outro dia.
    const conclusoes: ConclusaoDetalhe[] = [
      {
        titulo: "Prática da madrugada",
        eixoNome: "Pai",
        tipo: "audio",
        duracaoSegundos: 600,
        concluidoEm: isoLocal(2, 0, 30),
      },
      {
        titulo: "Prática da noite",
        eixoNome: "Mãe",
        tipo: "exercicio",
        duracaoSegundos: 300,
        concluidoEm: isoLocal(2, 23, 30),
      },
      // Outro dia local, para garantir que não vaza para o total anterior.
      {
        titulo: "Prática de outro dia",
        eixoNome: "Dinheiro",
        tipo: "video",
        duracaoSegundos: 1800,
        concluidoEm: isoLocal(4, 10),
      },
    ];

    renderMapa(conclusoes);

    const dia = screen.getByRole("button", {
      name: `${rotuloLocal(2)} — 2 práticas`,
    });
    await user.click(dia);

    const popover = await screen.findByRole("dialog");
    expect(within(popover).getByText(rotuloLocal(2))).toBeInTheDocument();
    expect(within(popover).getByText("2 práticas · 15 min registrados")).toBeInTheDocument();
    expect(within(popover).getAllByRole("listitem")).toHaveLength(2);
    expect(within(popover).getByText("Prática da madrugada")).toBeInTheDocument();
    expect(within(popover).getByText("Prática da noite")).toBeInTheDocument();
    expect(within(popover).queryByText("Prática de outro dia")).not.toBeInTheDocument();
  });

  it.each(FUSOS)("mantém práticas de dias distintos separadas em %s", async (tz) => {
    usarFuso(tz);
    const user = userEvent.setup();

    const conclusoes: ConclusaoDetalhe[] = [
      {
        titulo: "Fim do dia",
        eixoNome: "Saúde",
        tipo: "audio",
        duracaoSegundos: 900,
        concluidoEm: isoLocal(3, 23, 59),
      },
      {
        titulo: "Começo do dia seguinte",
        eixoNome: "Saúde",
        tipo: "audio",
        duracaoSegundos: 120,
        concluidoEm: isoLocal(2, 0, 1),
      },
    ];

    renderMapa(conclusoes);

    await user.click(
      screen.getByRole("button", { name: `${rotuloLocal(3)} — 1 prática` }),
    );
    let popover = await screen.findByRole("dialog");
    expect(within(popover).getByText("1 prática · 15 min registrados")).toBeInTheDocument();
    expect(within(popover).getAllByRole("listitem")).toHaveLength(1);

    await user.keyboard("{Escape}");

    await user.click(
      screen.getByRole("button", { name: `${rotuloLocal(2)} — 1 prática` }),
    );
    popover = await screen.findByRole("dialog");
    expect(within(popover).getByText("1 prática · 2 min registrados")).toBeInTheDocument();
    expect(within(popover).getByText("Começo do dia seguinte")).toBeInTheDocument();
  });
});
