import { describe, expect, it } from "vitest";
import {
  etapaAtual,
  filtrarPlanos,
  planoFechado,
  resumoDaJornada,
  seloDeFechamento,
} from "./jornada-cliente";

const plano = (over: Partial<Parameters<typeof planoFechado>[0]> = {}) => ({
  status: "em_andamento",
  total: 4,
  concluidas: 1,
  percentual: 25,
  ...over,
});

describe("planoFechado", () => {
  it("fecha por status", () => {
    expect(planoFechado(plano({ status: "concluido" }))).toBe(true);
    expect(planoFechado(plano({ status: "encerrado" }))).toBe(true);
  });

  it("fecha quando todas as etapas foram concluídas", () => {
    expect(planoFechado(plano({ concluidas: 4 }))).toBe(true);
  });

  it("não fecha plano vazio nem em andamento", () => {
    expect(planoFechado(plano())).toBe(false);
    expect(planoFechado(plano({ total: 0, concluidas: 0 }))).toBe(false);
  });
});

describe("filtrarPlanos", () => {
  const lista = [plano(), plano({ status: "concluido" })];

  it("separa por estado e mantém todas quando pedido", () => {
    expect(filtrarPlanos(lista, "andamento")).toHaveLength(1);
    expect(filtrarPlanos(lista, "concluidas")).toHaveLength(1);
    expect(filtrarPlanos(lista, "todas")).toHaveLength(2);
  });
});

describe("resumoDaJornada", () => {
  it("soma etapas e calcula percentual geral", () => {
    const r = resumoDaJornada([plano(), plano({ total: 6, concluidas: 3 })]);
    expect(r.ativos).toBe(2);
    expect(r.etapasFeitas).toBe(4);
    expect(r.etapasTotais).toBe(10);
    expect(r.percentual).toBe(40);
  });

  it("acolhe quem ainda não começou", () => {
    expect(resumoDaJornada([]).frase).toMatch(/pressa/i);
    expect(resumoDaJornada([plano({ concluidas: 0, percentual: 0 })]).frase).toMatch(/primeiro passo/i);
  });

  it("celebra jornada completa", () => {
    const r = resumoDaJornada([plano({ concluidas: 4, percentual: 100 })]);
    expect(r.fechados).toBe(1);
    expect(r.frase).toMatch(/assentar/i);
  });
});

describe("seloDeFechamento", () => {
  it("varia pelo tamanho do caminho", () => {
    expect(seloDeFechamento(plano({ total: 9 }))).toMatch(/profundo/i);
    expect(seloDeFechamento(plano({ total: 5 }))).toBe("Ciclo concluído");
    expect(seloDeFechamento(plano({ total: 2 }))).toBe("Caminho fechado");
  });
});

describe("etapaAtual", () => {
  it("ignora concluídas e atividades combinadas fora do app", () => {
    const atual = etapaAtual([
      { id: "a", ordem: 1, status: "concluido", personalizada: false },
      { id: "b", ordem: 2, status: "nao_iniciado", personalizada: true },
      { id: "c", ordem: 3, status: "nao_iniciado", personalizada: false },
    ]);
    expect(atual?.id).toBe("c");
  });

  it("devolve null quando tudo foi feito", () => {
    expect(etapaAtual([{ id: "a", ordem: 1, status: "concluido", personalizada: false }])).toBeNull();
  });
});
