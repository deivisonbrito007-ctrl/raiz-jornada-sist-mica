import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHAVE_CARIMBO,
  CHAVE_DESTINO,
  VALIDADE_INTENCAO_MS,
  destinoSeguro,
  gravarIntencaoLogin,
  lerIntencaoLogin,
  limparIntencaoLogin,
} from "./intencao-login";

describe("intenção de login preservada pelo Google", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T21:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aceita só destinos internos", () => {
    expect(destinoSeguro("/convite/abc")).toBe("/convite/abc");
    expect(destinoSeguro("//site.com")).toBeNull();
    expect(destinoSeguro("https://site.com")).toBeNull();
    expect(destinoSeguro("/auth")).toBeNull();
    expect(destinoSeguro("/auth?modo=cadastro")).toBeNull();
    expect(destinoSeguro("/reset-password")).toBeNull();
    expect(destinoSeguro(null)).toBeNull();
  });

  it("guarda e devolve destino, caminho e papel", () => {
    gravarIntencaoLogin({ destino: "/convite/1", caminho: "acompanhado", papel: "cliente" });
    expect(lerIntencaoLogin()).toEqual({
      destino: "/convite/1",
      caminho: "acompanhado",
      papel: "cliente",
    });
  });

  it("ignora valores inválidos em vez de propagá-los", () => {
    gravarIntencaoLogin({ destino: "https://fora.com", caminho: "qualquer", papel: "admin" });
    expect(lerIntencaoLogin()).toEqual({ destino: null, caminho: null, papel: null });
  });

  it("nunca pede acompanhamento quando o papel é terapeuta", () => {
    gravarIntencaoLogin({ destino: "/entrada", caminho: "acompanhado", papel: "terapeuta" });
    expect(lerIntencaoLogin().caminho).toBeNull();
    expect(lerIntencaoLogin().papel).toBe("terapeuta");
  });

  it("a última escolha sobrescreve a anterior", () => {
    gravarIntencaoLogin({ caminho: "acompanhado", papel: "cliente" });
    gravarIntencaoLogin({ caminho: "autoguiado", papel: "cliente" });
    expect(lerIntencaoLogin().caminho).toBe("autoguiado");
  });

  it("descarta intenção vencida ou sem carimbo", () => {
    gravarIntencaoLogin({ destino: "/entrada", caminho: "autoguiado" });
    vi.setSystemTime(Date.now() + VALIDADE_INTENCAO_MS + 1000);
    expect(lerIntencaoLogin()).toEqual({ destino: null, caminho: null, papel: null });

    window.sessionStorage.setItem(CHAVE_DESTINO, "/entrada");
    expect(lerIntencaoLogin().destino).toBeNull();
    expect(window.sessionStorage.getItem(CHAVE_CARIMBO)).toBeNull();
  });

  it("limpa tudo ao pedir", () => {
    gravarIntencaoLogin({ destino: "/entrada", caminho: "autoguiado", papel: "cliente" });
    limparIntencaoLogin();
    expect(lerIntencaoLogin()).toEqual({ destino: null, caminho: null, papel: null });
  });
});
