import { describe, expect, it } from "vitest";
import { cicloAtual, eixoPreferido, ordenarPorAfinidade } from "./inicio-cliente";

const eixo = (over: Partial<Parameters<typeof eixoPreferido>[0][number]> & { id: string }) => ({
  nome: over.id,
  liberado: true,
  concluidos: 0,
  total: 4,
  datasConclusao: [],
  ...over,
});

describe("cicloAtual", () => {
  it("conta a semana desde o início", () => {
    const c = cicloAtual({
      inicioEm: "2026-08-01T00:00:00Z",
      concluidos: 1,
      total: 4,
      agora: new Date("2026-08-16T12:00:00Z"),
    });
    expect(c.semana).toBe(3);
    expect(c.rotulo).toBe("Semana 3 do seu ciclo");
  });

  it("fala de preparo quando não há nada liberado", () => {
    expect(cicloAtual({ inicioEm: null }).frase).toMatch(/preparado/);
  });

  it("celebra o ciclo completo", () => {
    expect(cicloAtual({ inicioEm: null, concluidos: 4, total: 4 }).frase).toMatch(/completo/);
  });
});

describe("eixoPreferido", () => {
  it("escolhe o mais concluído entre os liberados", () => {
    const escolhido = eixoPreferido([
      eixo({ id: "a", concluidos: 1 }),
      eixo({ id: "b", concluidos: 3 }),
      eixo({ id: "c", concluidos: 9, liberado: false }),
    ]);
    expect(escolhido?.id).toBe("b");
  });

  it("desempata pela conclusão mais recente", () => {
    const escolhido = eixoPreferido([
      eixo({ id: "a", concluidos: 2, datasConclusao: ["2026-01-01T00:00:00Z"] }),
      eixo({ id: "b", concluidos: 2, datasConclusao: ["2026-05-01T00:00:00Z"] }),
    ]);
    expect(escolhido?.id).toBe("b");
  });

  it("não escolhe nada sem prática concluída", () => {
    expect(eixoPreferido([eixo({ id: "a" })])).toBeNull();
  });
});

describe("ordenarPorAfinidade", () => {
  it("põe o preferido antes e os fechados no fim", () => {
    const ordem = ordenarPorAfinidade([
      eixo({ id: "fechado", liberado: false }),
      eixo({ id: "a" }),
      eixo({ id: "pref", concluidos: 2 }),
    ]).map((e) => e.id);
    expect(ordem).toEqual(["pref", "a", "fechado"]);
  });
});
