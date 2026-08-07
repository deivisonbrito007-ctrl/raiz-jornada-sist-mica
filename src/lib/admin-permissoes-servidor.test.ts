/**
 * Garante, por leitura do código-fonte, que toda função de servidor do painel do
 * terapeuta (`admin*` e `equipe*`) valide a permissão no servidor antes de
 * retornar ou gravar dados sensíveis.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const raiz = readFileSync(resolve("src/lib/raiz.functions.ts"), "utf8");
const equipe = readFileSync(resolve("src/lib/equipe.functions.ts"), "utf8");

function blocos(fonte: string) {
  const partes = fonte.split(/export const /).slice(1);
  return partes.map((p) => ({ nome: p.slice(0, p.indexOf(" ")), corpo: p }));
}

const funcoesAdmin = [...blocos(raiz), ...blocos(equipe)].filter((f) =>
  /^(admin|equipe)/.test(f.nome),
);

describe("painel do terapeuta valida permissões no servidor", () => {
  it("encontra todas as funções administrativas", () => {
    expect(funcoesAdmin.length).toBeGreaterThanOrEqual(11);
  });

  it.each(funcoesAdmin.map((f) => f.nome))("%s exige autenticação no servidor", (nome) => {
    const fn = funcoesAdmin.find((f) => f.nome === nome)!;
    expect(fn.corpo).toContain("requireSupabaseAuth");
  });

  it.each(funcoesAdmin.map((f) => f.nome))("%s checa permissão antes de tocar dados", (nome) => {
    const fn = funcoesAdmin.find((f) => f.nome === nome)!;
    const guarda = Math.max(
      fn.corpo.indexOf("garantirPermissao("),
      fn.corpo.indexOf("garantirGerenciarEquipe("),
    );
    expect(guarda).toBeGreaterThan(-1);

    const primeiroAcesso = [...fn.corpo.matchAll(/\.from\(|\.storage\b/g)].map((m) => m.index ?? -1);
    for (const pos of primeiroAcesso) expect(pos).toBeGreaterThan(guarda);
  });
});
