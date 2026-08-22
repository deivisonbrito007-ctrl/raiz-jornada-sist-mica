import { describe, expect, it } from "vitest";

import {
  itensPrivacidade,
  limitarMeta,
  retratoDoCaminho,
  rotuloMeta,
  textoDoModo,
  validarNome,
} from "./perfil-cliente";

describe("textoDoModo", () => {
  it("no modo acompanhado com terapeuta, oferece o canal de apoio", () => {
    const t = textoDoModo("acompanhado", true);
    expect(t.acao).toBe("pedir-apoio");
    expect(t.descricao).toMatch(/terapeuta/i);
  });

  it("no modo acompanhado sem vínculo ainda, não oferece ação", () => {
    expect(textoDoModo("acompanhado", false).acao).toBeNull();
  });

  it("no modo autoguiado, oferece pedir acompanhamento", () => {
    const t = textoDoModo("autoguiado", false);
    expect(t.acao).toBe("pedir-acompanhamento");
    expect(t.rotuloAcao).toBe("Quero acompanhamento");
  });
});

describe("rotuloMeta", () => {
  it("muda o tom conforme o ritmo", () => {
    expect(rotuloMeta(1)).toMatch(/leve/i);
    expect(rotuloMeta(3)).toMatch(/constante/i);
    expect(rotuloMeta(5)).toMatch(/dedicado/i);
    expect(rotuloMeta(7)).toMatch(/intenso/i);
  });
});

describe("limitarMeta", () => {
  it("mantém a meta entre 1 e 7 e arredonda", () => {
    expect(limitarMeta(0)).toBe(1);
    expect(limitarMeta(99)).toBe(7);
    expect(limitarMeta(3.4)).toBe(3);
    expect(limitarMeta(Number.NaN)).toBe(3);
  });
});

describe("retratoDoCaminho", () => {
  it("descreve as três medidas com detalhes de estado vazio", () => {
    const medidas = retratoDoCaminho({ praticasConcluidas: 0, streakSemanas: 0, reflexoes: 0 });
    expect(medidas.map((m) => m.chave)).toEqual(["praticas", "sequencia", "reflexoes"]);
    expect(medidas[0]!.detalhe).toMatch(/primeira/i);
    expect(medidas[2]!.detalhe).toMatch(/branco/i);
  });

  it("usa singular na sequência de uma semana", () => {
    const medidas = retratoDoCaminho({ praticasConcluidas: 4, streakSemanas: 1, reflexoes: 2 });
    expect(medidas[1]!.rotulo).toBe("Semana seguida");
  });
});

describe("validarNome", () => {
  it("recusa nome curto e aceita nome normalizado", () => {
    expect(validarNome(" a ").ok).toBe(false);
    expect(validarNome("  Maria   Clara ")).toEqual({ ok: true, nome: "Maria Clara", erro: null });
    expect(validarNome("x".repeat(81)).ok).toBe(false);
  });
});

describe("itensPrivacidade", () => {
  it("fala da terapeuta só no modo acompanhado", () => {
    expect(itensPrivacidade("acompanhado")[1]!.titulo).toMatch(/terapeuta/i);
    expect(itensPrivacidade("autoguiado")[1]!.titulo).toMatch(/ninguém/i);
  });
});
