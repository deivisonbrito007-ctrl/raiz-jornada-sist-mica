/**
 * Auditoria: toda rota/ação do painel do terapeuta precisa validar a permissão
 * no servidor (RPC `pode`) ANTES de ler ou gravar qualquer dado sensível.
 */
import { describe, expect, it } from "vitest";
import { garantirPermissao, temPermissao } from "./permissao-guard";
import { PERMISSOES, type Permissao } from "./permissoes";

type Chamada = { tipo: "rpc" | "tabela"; nome: string };

function clienteFalso(permissoesConcedidas: Permissao[]) {
  const chamadas: Chamada[] = [];
  return {
    chamadas,
    rpc: async (_fn: "pode", args: { _permissao: string }) => {
      chamadas.push({ tipo: "rpc", nome: args._permissao });
      return { data: permissoesConcedidas.includes(args._permissao as Permissao) };
    },
  };
}

describe("validação de permissões no servidor", () => {
  it("libera quando o usuário tem a permissão exigida", async () => {
    const supabase = clienteFalso(["ver_clientes"]);
    await expect(
      garantirPermissao(supabase, "u1", "ver_clientes", "adminResumo"),
    ).resolves.toBeUndefined();
    expect(supabase.chamadas).toEqual([{ tipo: "rpc", nome: "ver_clientes" }]);
  });

  it("bloqueia antes de qualquer leitura quando a permissão falta", async () => {
    const supabase = clienteFalso([]);
    await expect(garantirPermissao(supabase, "u1", "ver_clientes", "adminResumo")).rejects.toThrow();
    expect(supabase.chamadas.filter((c) => c.tipo === "tabela")).toEqual([]);
  });

  it("bloqueia quando a RPC devolve algo que não é true", async () => {
    const supabase = {
      rpc: async () => ({ data: "true" as unknown }),
    };
    await expect(
      garantirPermissao(supabase as never, "u1", "gerenciar_conteudos", "adminSalvarConteudo"),
    ).rejects.toThrow();
  });

  it("temPermissao só devolve true com confirmação do servidor", async () => {
    expect(await temPermissao(clienteFalso(["ver_diario"]), "ver_diario")).toBe(true);
    expect(await temPermissao(clienteFalso([]), "ver_diario")).toBe(false);
  });

  it("cada permissão do catálogo é verificável isoladamente", async () => {
    for (const permissao of PERMISSOES) {
      const outras = PERMISSOES.filter((p) => p !== permissao);
      expect(await temPermissao(clienteFalso([permissao]), permissao)).toBe(true);
      for (const outra of outras) {
        expect(await temPermissao(clienteFalso([permissao]), outra)).toBe(false);
      }
    }
  });
});
