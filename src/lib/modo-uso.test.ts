import { describe, expect, it } from "vitest";

import {
  MODOS_USO,
  MODO_LABEL,
  blocosDoModo,
  ehModoUso,
  mensagemAcessoAutoguiado,
  normalizarModo,
  podePedirAcompanhamento,
  trilhaServeAoModo,
} from "./modo-uso";

describe("modo de uso", () => {
  it("reconhece apenas os dois modos existentes", () => {
    expect(MODOS_USO).toEqual(["acompanhado", "autoguiado"]);
    expect(ehModoUso("autoguiado")).toBe(true);
    expect(ehModoUso("qualquer")).toBe(false);
    expect(ehModoUso(null)).toBe(false);
  });

  it("cai no modo acompanhado quando o valor é desconhecido", () => {
    expect(normalizarModo(undefined)).toBe("acompanhado");
    expect(normalizarModo("autoguiado")).toBe("autoguiado");
  });

  it("tem rótulo humano para cada modo", () => {
    for (const modo of MODOS_USO) expect(MODO_LABEL[modo].length).toBeGreaterThan(0);
  });

  describe("blocos da interface", () => {
    it("mostra plano e apoio só para quem é acompanhado", () => {
      const b = blocosDoModo("acompanhado");
      expect(b.planoDaTerapeuta).toBe(true);
      expect(b.pedirApoio).toBe(true);
      expect(b.vitrinePacotes).toBe(false);
      expect(b.pedirAcompanhamento).toBe(false);
    });

    it("mostra vitrine e pedido de acompanhamento só para quem usa sozinho", () => {
      const b = blocosDoModo("autoguiado");
      expect(b.vitrinePacotes).toBe(true);
      expect(b.pedirAcompanhamento).toBe(true);
      expect(b.escolherTrilha).toBe(true);
      expect(b.planoDaTerapeuta).toBe(false);
      expect(b.pedirApoio).toBe(false);
    });

    it("não oferece compartilhar diário quando não há terapeuta", () => {
      expect(blocosDoModo("autoguiado").compartilharDiario).toBe(false);
      expect(blocosDoModo("acompanhado").compartilharDiario).toBe(true);
    });
  });

  describe("trilha por modo", () => {
    it("trata acervo sem marcação como acompanhado", () => {
      expect(trilhaServeAoModo(null, "acompanhado")).toBe(true);
      expect(trilhaServeAoModo(undefined, "autoguiado")).toBe(false);
    });

    it("respeita a marcação da trilha", () => {
      expect(trilhaServeAoModo(["autoguiado"], "autoguiado")).toBe(true);
      expect(trilhaServeAoModo(["autoguiado"], "acompanhado")).toBe(false);
      expect(trilhaServeAoModo(["acompanhado", "autoguiado"], "acompanhado")).toBe(true);
    });
  });

  describe("pedido de acompanhamento", () => {
    it("não é oferecido a quem já é acompanhado", () => {
      expect(podePedirAcompanhamento("acompanhado")).toBe(false);
    });

    it("é oferecido a quem usa sozinho e não tem pedido em aberto", () => {
      expect(podePedirAcompanhamento("autoguiado")).toBe(true);
      expect(podePedirAcompanhamento("autoguiado", [{ status: "recusada" }])).toBe(true);
    });

    it("não repete enquanto há pedido aguardando resposta", () => {
      expect(podePedirAcompanhamento("autoguiado", [{ status: "aberta" }])).toBe(false);
    });
  });

  it("explica o acesso conforme o pacote", () => {
    expect(mensagemAcessoAutoguiado(true)).toMatch(/ativo/i);
    expect(mensagemAcessoAutoguiado(false)).toMatch(/pacote/i);
  });
});
