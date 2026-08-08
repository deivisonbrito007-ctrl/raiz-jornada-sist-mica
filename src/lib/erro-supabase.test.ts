import { describe, expect, it } from "vitest";
import {
  MENSAGEM_FALHA_GENERICA,
  ORIENTACAO_ACESSO_RESTRITO,
  ORIENTACAO_POR_CATEGORIA,
  classificarErro,
  mensagemPainel,
  orientacaoErro,
} from "./erro-permissao";

describe("mapeamento de códigos de erro do Supabase", () => {
  it("reconhece sessão expirada por código e por mensagem", () => {
    for (const erro of [
      { code: "PGRST301", message: "JWT expired" },
      { message: "Auth session missing!" },
      { status: 401, message: "invalid claim: missing sub claim" },
      { code: "refresh_token_not_found", message: "Refresh Token Not Found" },
    ]) {
      expect(classificarErro(erro)).toBe("sessao_expirada");
      expect(mensagemPainel(erro)).toBe(ORIENTACAO_POR_CATEGORIA.sessao_expirada);
    }
  });

  it("reconhece função/RPC inexistente ou cache de schema desatualizado", () => {
    for (const erro of [
      { code: "PGRST202", message: "Could not find the function public.pode(text)" },
      { code: "42883", message: "function public.tem_permissao(uuid) does not exist" },
      { message: "Could not find the 'x' column of 'y' in the schema cache" },
    ]) {
      expect(classificarErro(erro)).toBe("recurso_indisponivel");
      const saida = mensagemPainel(erro);
      expect(saida).toBe(ORIENTACAO_POR_CATEGORIA.recurso_indisponivel);
      expect(saida).not.toMatch(/public\.|function|column|schema/i);
    }
  });

  it("mantém RLS, GRANT e 'nada encontrado' como acesso restrito", () => {
    for (const erro of [
      { code: "42501", message: "new row violates row-level security policy for table diario" },
      { message: "permission denied for table profiles" },
      { code: "PGRST116", message: "JSON object requested, 0 rows returned" },
      { status: 403, message: "Forbidden" },
    ]) {
      expect(classificarErro(erro)).toBe("acesso_restrito");
      expect(mensagemPainel(erro)).toBe(ORIENTACAO_ACESSO_RESTRITO);
    }
  });

  it("separa rede, limite de uso, conflito, dado inválido e falha de servidor", () => {
    const casos = [
      [{ message: "Failed to fetch" }, "sem_conexao"],
      [{ code: "ETIMEDOUT", message: "connect ETIMEDOUT" }, "sem_conexao"],
      [{ status: 429, message: "Too Many Requests" }, "muitos_pedidos"],
      [{ code: "23505", message: "duplicate key value violates unique constraint" }, "conflito"],
      [{ code: "22P02", message: "invalid input syntax for type uuid" }, "dado_invalido"],
      [{ code: "23502", message: "null value violates not-null constraint" }, "dado_invalido"],
      [{ status: 503, message: "Service Unavailable" }, "servidor"],
    ] as const;

    for (const [erro, categoria] of casos) {
      expect(classificarErro(erro)).toBe(categoria);
      expect(mensagemPainel(erro)).toBe(ORIENTACAO_POR_CATEGORIA[categoria]);
    }
  });

  it("cada orientação é uma frase clara, acionável e sem jargão técnico", () => {
    const orientacoes = Object.entries(ORIENTACAO_POR_CATEGORIA).filter(
      ([categoria]) => categoria !== "desconhecido",
    );
    for (const [, texto] of orientacoes) {
      expect(texto.length).toBeGreaterThan(30);
      expect(texto).not.toMatch(/jwt|rls|pgrst|policy|table|constraint|null|http|\d{3}\b/i);
      expect(texto.trim()).toMatch(/[.!]$/);
    }
    const unicas = new Set(orientacoes.map(([, t]) => t));
    expect(unicas.size).toBe(orientacoes.length);
  });

  it("cai no texto genérico quando não há pista alguma", () => {
    expect(classificarErro(null)).toBe("desconhecido");
    expect(orientacaoErro(undefined)).toBe(MENSAGEM_FALHA_GENERICA);
    expect(mensagemPainel({})).toBe(MENSAGEM_FALHA_GENERICA);
  });

  it("não deixa passar mensagem crua do banco na interface", () => {
    const cru = 'relation "public.equipe_permissoes" does not exist';
    expect(mensagemPainel(new Error(cru))).not.toContain("equipe_permissoes");
  });
});
