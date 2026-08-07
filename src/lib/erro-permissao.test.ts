import { describe, expect, it } from "vitest";
import {
  MENSAGEM_ACESSO_RESTRITO,
  MENSAGEM_FALHA_GENERICA,
  ORIENTACAO_ACESSO_RESTRITO,
  ehErroPermissao,
  erroAcessoRestrito,
  erroSeguro,
  mensagemPainel,
} from "./erro-permissao";

describe("respostas padronizadas de bloqueio", () => {
  it("classifica RLS, GRANT, 401/403 e 'nada encontrado' como bloqueio", () => {
    for (const erro of [
      new Error("new row violates row-level security policy for table clientes"),
      { message: "permission denied for table profiles" },
      { status: 403, message: "Forbidden" },
      { code: "PGRST116", message: "JSON object requested, 0 rows returned" },
      erroAcessoRestrito(),
    ]) {
      expect(ehErroPermissao(erro)).toBe(true);
    }
  });

  it("usa sempre a mesma mensagem, sem revelar existência nem schema", () => {
    const vazamentos = [
      new Error('relation "public.convites_equipe" does not exist'),
      new Error("permission denied for table diario"),
      new Error("0 rows returned for cliente 8f2a-..."),
    ];
    const saidas = vazamentos.map((e) => mensagemPainel(e));
    expect(new Set(saidas).size).toBe(1);
    expect(saidas[0]).toBe(ORIENTACAO_ACESSO_RESTRITO);
    for (const s of saidas) {
      expect(s).not.toMatch(/table|relation|policy|rows|convites_equipe|diario/i);
    }
  });

  it("erroSeguro colapsa erro do banco em acesso restrito ou falha genérica", () => {
    expect(erroSeguro({ message: "permission denied for table pacotes" }).message).toBe(
      MENSAGEM_ACESSO_RESTRITO,
    );
    expect(erroSeguro({ message: "duplicate key value violates unique constraint" }).message).toBe(
      MENSAGEM_FALHA_GENERICA,
    );
  });

  it("preserva mensagens de regra de negócio escritas por nós", () => {
    expect(mensagemPainel(new Error("A terapeuta responsável não pode ser removida."))).toBe(
      "A terapeuta responsável não pode ser removida.",
    );
  });
});
