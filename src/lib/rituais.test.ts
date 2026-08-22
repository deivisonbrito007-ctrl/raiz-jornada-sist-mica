import { describe, expect, it } from "vitest";

import {
  DURACAO_ABERTURA_SEGUNDOS,
  RESPIROS,
  ancoragemDoDia,
  faseDoRespiro,
  respirosFeitos,
  sementeDoFecho,
} from "@/lib/rituais";

describe("rituais de abertura e fecho", () => {
  it("percorre inspirar, segurar e soltar dentro de um respiro", () => {
    expect(faseDoRespiro(0).fase).toBe("inspire");
    expect(faseDoRespiro(4).fase).toBe("segure");
    expect(faseDoRespiro(8).fase).toBe("solte");
    expect(faseDoRespiro(12).fase).toBe("inspire");
  });

  it("conta respiros completos sem passar do total", () => {
    expect(respirosFeitos(0)).toBe(0);
    expect(respirosFeitos(12)).toBe(1);
    expect(respirosFeitos(DURACAO_ABERTURA_SEGUNDOS * 3)).toBe(RESPIROS);
  });

  it("mantém a ancoragem estável no mesmo dia e muda de um dia para o outro", () => {
    const hoje = new Date("2026-03-10T08:00:00Z");
    expect(ancoragemDoDia(hoje)).toBe(ancoragemDoDia(new Date("2026-03-10T22:00:00Z")));
    expect(ancoragemDoDia(hoje)).not.toBe(ancoragemDoDia(new Date("2026-03-11T08:00:00Z")));
  });

  it("semeia o fecho com a intenção e fica vazio quando não há intenção", () => {
    expect(sementeDoFecho("Ir devagar")).toContain("ir devagar");
    expect(sementeDoFecho("   ")).toBe("");
  });
});
