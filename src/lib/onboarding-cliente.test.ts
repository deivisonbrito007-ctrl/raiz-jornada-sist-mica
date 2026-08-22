import { describe, expect, it } from "vitest";

import {
  deveMostrarOnboarding,
  passosOnboarding,
  progressoOnboarding,
} from "@/lib/onboarding-cliente";

const zerado = {
  escolheuEixos: false,
  fezPratica: false,
  escreveuDiario: false,
  definiuRitmo: false,
};

describe("boas-vindas do cliente", () => {
  it("oferece quatro passos com destinos reais do app", () => {
    const passos = passosOnboarding(zerado);
    expect(passos.map((p) => p.para)).toEqual([
      "/app/eixos-preferidos",
      "/app/jornada",
      "/app/diario",
      "/app/lembretes",
    ]);
  });

  it("mostra enquanto há passo pendente", () => {
    expect(deveMostrarOnboarding(zerado)).toBe(true);
    expect(
      deveMostrarOnboarding({
        escolheuEixos: true,
        fezPratica: true,
        escreveuDiario: true,
        definiuRitmo: true,
      }),
    ).toBe(false);
  });

  it("respeita quem dispensou as boas-vindas", () => {
    expect(deveMostrarOnboarding({ ...zerado, dispensadoEm: "2026-01-01T00:00:00Z" })).toBe(false);
  });

  it("conta o progresso em porcentagem", () => {
    const { feitos, percentual, completo } = progressoOnboarding({
      ...zerado,
      escolheuEixos: true,
      fezPratica: true,
    });
    expect(feitos).toBe(2);
    expect(percentual).toBe(50);
    expect(completo).toBe(false);
  });
});
