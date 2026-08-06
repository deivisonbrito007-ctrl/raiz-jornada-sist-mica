import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapaCalor } from "./mapa-calor";
import { mapaCalorDiario, type ConclusaoDetalhe } from "@/lib/raiz-format";

const AGORA = new Date("2026-08-06T12:00:00.000Z");
const TZ_ORIGINAL = process.env["TZ"];

/** ISO (UTC) para um instante no horário LOCAL do fuso ativo. */
function isoLocal(diasAtras: number, hora: number, minuto = 0) {
  const d = new Date(AGORA);
  d.setHours(hora, minuto, 0, 0);
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString();
}

/** Mesmo instante, mas escrito com deslocamento de fuso (+09:00) em vez de Z. */
function isoComOffset(iso: string, offsetHoras: number) {
  const d = new Date(iso);
  const deslocado = new Date(d.getTime() + offsetHoras * 3600_000);
  const sinal = offsetHoras >= 0 ? "+" : "-";
  const abs = Math.abs(offsetHoras).toString().padStart(2, "0");
  return `${deslocado.toISOString().slice(0, 19)}${sinal}${abs}:00`;
}

function rotuloLocal(diasAtras: number) {
  const d = new Date(AGORA);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - diasAtras);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function pratica(parcial: Partial<ConclusaoDetalhe> & { concluidoEm: string }): ConclusaoDetalhe {
  return {
    titulo: "Prática",
    eixoNome: "Pai",
    tipo: "video",
    duracaoSegundos: 300,
    ...parcial,
  };
}

function renderMapa(conclusoes: ConclusaoDetalhe[]) {
  const colunas = mapaCalorDiario(
    conclusoes.map((c) => c.concluidoEm),
    12,
    conclusoes,
  );
  return render(<MapaCalor colunas={colunas} />);
}

async function abrirDia(diasAtras: number, total: number) {
  const plural = total === 1 ? "" : "s";
  const botao = screen.getByRole("button", {
    name: `${rotuloLocal(diasAtras)} — ${total} prática${plural}`,
  });
  await userEvent.click(botao);
  return within(await screen.findByRole("dialog"));
}

describe("MapaCalor — ordem e formatação do popover no fuso local", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(AGORA);
    process.env["TZ"] = "America/Sao_Paulo";
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env["TZ"] = TZ_ORIGINAL;
    cleanup();
  });

  it("lista as práticas em ordem cronológica local, mesmo com entrada fora de ordem", async () => {
    renderMapa([
      pratica({ titulo: "Terceira (20h)", concluidoEm: isoLocal(1, 20) }),
      pratica({ titulo: "Primeira (07h)", concluidoEm: isoLocal(1, 7) }),
      pratica({ titulo: "Segunda (13h30)", concluidoEm: isoLocal(1, 13, 30) }),
    ]);

    const painel = await abrirDia(1, 3);
    const itens = painel.getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(itens).toHaveLength(3);
    expect(itens[0]).toContain("Primeira (07h)");
    expect(itens[1]).toContain("Segunda (13h30)");
    expect(itens[2]).toContain("Terceira (20h)");
  });

  it("ordena corretamente quando os registros vêm com deslocamentos de fuso diferentes", async () => {
    renderMapa([
      // 22h local, escrito como +09:00 — comparação textual colocaria antes das 08h
      pratica({ titulo: "Noite", concluidoEm: isoComOffset(isoLocal(1, 22), 9) }),
      pratica({ titulo: "Manhã", concluidoEm: isoLocal(1, 8) }),
    ]);

    const painel = await abrirDia(1, 2);
    const itens = painel.getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(itens[0]).toContain("Manhã");
    expect(itens[1]).toContain("Noite");
  });

  it("formata a data do dia no padrão pt-BR do fuso local", async () => {
    renderMapa([pratica({ concluidoEm: isoLocal(2, 9) })]);

    const painel = await abrirDia(2, 1);
    expect(painel.getByText(rotuloLocal(2))).toBeInTheDocument();
    // dd de mmm (ex.: "04 de ago.")
    expect(rotuloLocal(2)).toMatch(/^\d{2} de [a-z]{3}\.?$/);
  });

  it("formata durações de forma consistente por item e no total do dia", async () => {
    renderMapa([
      pratica({ titulo: "Áudio curto", concluidoEm: isoLocal(1, 7), duracaoSegundos: 45 }),
      pratica({ titulo: "Vídeo", concluidoEm: isoLocal(1, 9), duracaoSegundos: 90 }),
      pratica({ titulo: "Meditação", concluidoEm: isoLocal(1, 11), duracaoSegundos: 720 }),
    ]);

    const painel = await abrirDia(1, 3);
    const itens = painel.getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(itens[0]).toContain("45s");
    expect(itens[1]).toContain("1 min 30s");
    expect(itens[2]).toContain("12 min");
    // 45 + 90 + 720 = 855s = 14 min 15s
    expect(painel.getByText("3 práticas · 14 min 15s registrados")).toBeInTheDocument();
  });

  it("mantém contagem singular/plural e total coerentes com um único item", async () => {
    renderMapa([
      pratica({ titulo: "Exercício prático", concluidoEm: isoLocal(3, 18), duracaoSegundos: 300 }),
    ]);

    const painel = await abrirDia(3, 1);
    expect(painel.getByText("1 prática · 5 min registrados")).toBeInTheDocument();
    expect(painel.getAllByRole("listitem")).toHaveLength(1);
  });

  it.each(["UTC", "Asia/Tokyo", "Pacific/Midway"])(
    "preserva ordem e formatação no fuso %s",
    async (tz) => {
      process.env["TZ"] = tz;
      renderMapa([
        pratica({ titulo: "Tarde", concluidoEm: isoLocal(1, 15), duracaoSegundos: 600 }),
        pratica({ titulo: "Início do dia", concluidoEm: isoLocal(1, 0, 30), duracaoSegundos: 300 }),
        pratica({ titulo: "Fim do dia", concluidoEm: isoLocal(1, 23, 30), duracaoSegundos: 300 }),
      ]);

      const painel = await abrirDia(1, 3);
      const itens = painel.getAllByRole("listitem").map((li) => li.textContent ?? "");
      expect(itens[0]).toContain("Início do dia");
      expect(itens[1]).toContain("Tarde");
      expect(itens[2]).toContain("Fim do dia");
      expect(painel.getByText("3 práticas · 20 min registrados")).toBeInTheDocument();
    },
  );
});
