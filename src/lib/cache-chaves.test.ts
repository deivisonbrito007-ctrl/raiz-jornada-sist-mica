import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import { CHAVES, GRUPOS, chaveDe, invalidarPorEvento, raizesDoEvento } from "./cache-chaves";

describe("catálogo de chaves de cache", () => {
  it("não repete raízes entre chaves diferentes", () => {
    const raizes = Object.values(CHAVES).map((c) => c[0]);
    expect(new Set(raizes).size).toBe(raizes.length);
  });

  it("monta chave de item a partir da raiz", () => {
    expect(chaveDe(CHAVES.conteudo, "c-1")).toEqual(["conteudo", "c-1"]);
    expect(chaveDe(CHAVES.adminLembretes, "cli-1")).toEqual(["admin-lembretes", "cli-1"]);
  });

  it("concluir prática derruba jornada, histórico e progresso (não só a biblioteca)", () => {
    const raizes = raizesDoEvento("aoConcluirPratica");
    for (const esperada of [
      "biblioteca",
      "trilha",
      "minha-jornada",
      "minha-etapa",
      "progresso",
      "historico",
      "contexto",
    ]) {
      expect(raizes).toContain(esperada);
    }
  });

  it("escrever no diário atualiza diário, histórico e progresso", () => {
    expect(raizesDoEvento("aoEscreverDiario").sort()).toEqual(
      ["diario", "historico", "progresso"].sort(),
    );
  });

  it("mudança de permissões derruba o contexto e todas as listas do painel", () => {
    const raizes = raizesDoEvento("aoMudarPermissoes");
    expect(raizes).toContain("contexto");
    for (const admin of ["admin-clientes", "admin-trilhas", "admin-acompanhamento", "equipe"]) {
      expect(raizes).toContain(admin);
    }
  });

  it("mudança de liberação alcança conteúdo, jornada e etapa", () => {
    const raizes = raizesDoEvento("aoMudarLiberacoes");
    for (const esperada of ["conteudo", "minha-jornada", "minha-etapa"]) {
      expect(raizes).toContain(esperada);
    }
  });

  it("invalida exatamente as chaves do evento", async () => {
    const qc = new QueryClient();
    const espia = vi.spyOn(qc, "invalidateQueries").mockResolvedValue(undefined);

    await invalidarPorEvento(qc, "aoEscreverDiario");

    expect(espia).toHaveBeenCalledTimes(GRUPOS.aoEscreverDiario.length);
    const chamadas = espia.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0]);
    expect(chamadas.sort()).toEqual(["diario", "historico", "progresso"].sort());
  });
});
