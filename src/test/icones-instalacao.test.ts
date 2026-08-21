import { describe, expect, it } from "vitest";
// @ts-expect-error script utilitário em JS puro
import { verificarIcones } from "../../scripts/verificar-icones.mjs";

describe("ícones de instalação", () => {
  it("manifest e arquivos estão completos e centralizados", () => {
    const problemas = verificarIcones() as string[];
    expect(problemas).toEqual([]);
  });
});
