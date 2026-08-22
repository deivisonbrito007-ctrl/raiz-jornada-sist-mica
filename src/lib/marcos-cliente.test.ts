import { describe, expect, it } from "vitest";

import { conquistas, percentuaisPorEixo, resumoMarcos } from "@/lib/marcos-cliente";

const eixos = [
  { id: "a", nome: "Pai", liberado: true, concluidos: 3, total: 3 },
  { id: "b", nome: "Mãe", liberado: true, concluidos: 1, total: 4 },
  { id: "c", nome: "Bloqueado", liberado: false, concluidos: 0, total: 5 },
  { id: "d", nome: "Vazio", liberado: true, concluidos: 0, total: 0 },
];

describe("marcos do cliente", () => {
  it("calcula porcentagem só dos eixos liberados e com práticas", () => {
    const fatias = percentuaisPorEixo(eixos);
    expect(fatias.map((f) => f.id)).toEqual(["a", "b"]);
    expect(fatias[0]!.percentual).toBe(100);
    expect(fatias[1]!.percentual).toBe(25);
  });

  it("marca conquistas conforme o caminho já feito", () => {
    const lista = conquistas({
      streakSemanas: 1,
      cicloSemana: 2,
      totalConcluidos: 4,
      reflexoes: 2,
      diasEscrevendo: 3,
      eixos,
    });
    const por = (chave: string) => lista.find((c) => c.chave === chave)!;
    expect(por("primeira-pratica").conquistada).toBe(true);
    expect(por("primeira-reflexao").conquistada).toBe(true);
    expect(por("semana-de-ritmo").conquistada).toBe(true);
    expect(por("sete-praticas").conquistada).toBe(false);
    expect(por("eixo-inteiro").conquistada).toBe(true);
    expect(por("mes-de-escuta").conquistada).toBe(false);
  });

  it("acolhe quem ainda não começou, sem cobrar", () => {
    const resumo = resumoMarcos({
      streakSemanas: 0,
      cicloSemana: 1,
      totalConcluidos: 0,
      reflexoes: 0,
      diasEscrevendo: 0,
      eixos: [],
    });
    expect(resumo.conquistadas).toBe(0);
    expect(resumo.frase).toContain("quando você quiser");
  });
});
