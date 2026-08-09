import { beforeEach, describe, expect, it } from "vitest";

import {
  CHAVE_ARMAZENAMENTO,
  IDADE_MAXIMA_MS,
  definirUsuarioCache,
  limparCachePersistido,
  opcoesPersistencia,
  podePersistir,
} from "./cache-persistente";

function consulta(chave: unknown[], status = "success") {
  return { queryKey: chave, state: { status } } as never;
}

describe("cache persistido por sessão", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("persiste dados de navegação da barra lateral e dos painéis", () => {
    expect(podePersistir(consulta(["contexto"]))).toBe(true);
    expect(podePersistir(consulta(["biblioteca"]))).toBe(true);
    expect(podePersistir(consulta(["minha-jornada"]))).toBe(true);
    expect(podePersistir(consulta(["admin-clientes"]))).toBe(true);
    expect(podePersistir(consulta(["admin-acompanhamento"]))).toBe(true);
  });

  it("nunca persiste mídia assinada, diário, check-in nem progresso", () => {
    expect(podePersistir(consulta(["conteudo", "c-1"]))).toBe(false);
    expect(podePersistir(consulta(["diario"]))).toBe(false);
    expect(podePersistir(consulta(["minha-etapa", "c-1"]))).toBe(false);
    expect(podePersistir(consulta(["progresso", "c-1"]))).toBe(false);
    expect(podePersistir(consulta(["preferencias-lembretes"]))).toBe(false);
  });

  it("ignora consultas com erro ou sem raiz de texto", () => {
    expect(podePersistir(consulta(["biblioteca"], "error"))).toBe(false);
    expect(podePersistir(consulta([{ x: 1 }]))).toBe(false);
  });

  it("guarda o cache por sessão, com validade limitada", () => {
    const opcoes = opcoesPersistencia();
    expect(opcoes).not.toBeNull();
    expect(opcoes?.maxAge).toBe(IDADE_MAXIMA_MS);
    expect(opcoes?.persister).toBeTruthy();
  });

  it("descarta o cache quando a conta muda e mantém quando é a mesma", () => {
    window.sessionStorage.setItem(CHAVE_ARMAZENAMENTO, "{}");
    definirUsuarioCache("user-1");
    // primeira definição limpa o que existia sem dono conhecido
    expect(window.sessionStorage.getItem(CHAVE_ARMAZENAMENTO)).toBeNull();

    window.sessionStorage.setItem(CHAVE_ARMAZENAMENTO, "{}");
    definirUsuarioCache("user-1");
    expect(window.sessionStorage.getItem(CHAVE_ARMAZENAMENTO)).toBe("{}");

    definirUsuarioCache("user-2");
    expect(window.sessionStorage.getItem(CHAVE_ARMAZENAMENTO)).toBeNull();
  });

  it("limpa o cache persistido no logout", () => {
    window.sessionStorage.setItem(CHAVE_ARMAZENAMENTO, "{}");
    limparCachePersistido();
    expect(window.sessionStorage.getItem(CHAVE_ARMAZENAMENTO)).toBeNull();
  });
});
