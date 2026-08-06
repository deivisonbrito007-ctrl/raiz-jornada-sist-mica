import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { garantirConteudoLiberado } from "./liberacao-guard";

/**
 * Player: play/pause e progressão nunca podem persistir eventos/progresso de
 * conteúdo não liberado no escopo do cliente.
 *
 * Cliente PostgREST falso com as mesmas regras do banco:
 * - `conteudos`: RLS "cliente ve conteudos liberados"
 * - `conteudo_liberado`: respeita status e `liberar_em` (agendamento futuro)
 * - `progresso`: escrita somente com cliente_id = auth.uid()
 */

const CLIENTE_A = "11111111-1111-4111-8111-111111111111";
const CLIENTE_B = "22222222-2222-4222-8222-222222222222";

const EIXO = "e1111111-1111-4111-8111-111111111111";
const LIBERADO = "c1111111-1111-4111-8111-111111111111";
const BLOQUEADO = "c2222222-2222-4222-8222-222222222222";
const AGENDADO = "c3333333-3333-4333-8333-333333333333";
const DO_OUTRO = "c4444444-4444-4444-8444-444444444444";

const CONTEUDOS = [
  { id: LIBERADO, eixo_id: EIXO },
  { id: BLOQUEADO, eixo_id: EIXO },
  { id: AGENDADO, eixo_id: EIXO },
  { id: DO_OUTRO, eixo_id: EIXO },
];

const AMANHA = new Date(Date.now() + 86_400_000).toISOString();

const LIBERACOES = [
  { cliente_id: CLIENTE_A, conteudo_id: LIBERADO, status: "liberado", liberar_em: null },
  { cliente_id: CLIENTE_A, conteudo_id: BLOQUEADO, status: "bloqueado", liberar_em: null },
  { cliente_id: CLIENTE_A, conteudo_id: AGENDADO, status: "liberado", liberar_em: AMANHA },
  { cliente_id: CLIENTE_B, conteudo_id: DO_OUTRO, status: "liberado", liberar_em: null },
];

type Linha = Record<string, unknown>;
let progresso: Linha[] = [];

function liberado(clienteId: string, conteudoId: string) {
  return LIBERACOES.some(
    (l) =>
      l.cliente_id === clienteId &&
      l.conteudo_id === conteudoId &&
      l.status === "liberado" &&
      (!l.liberar_em || new Date(l.liberar_em).getTime() <= Date.now()),
  );
}

function fakeSupabase(userId: string) {
  return {
    from(tabela: string) {
      if (tabela === "conteudos") {
        return {
          select: () => ({
            eq: (_col: string, valor: string) => ({
              maybeSingle: async () => {
                const row = CONTEUDOS.find((c) => c.id === valor);
                // RLS: só devolve conteúdo liberado para este cliente
                return { data: row && liberado(userId, valor) ? row : null, error: null };
              },
            }),
          }),
        };
      }
      return {
        async upsert(linha: Linha) {
          if (linha["cliente_id"] !== userId) {
            return { error: { message: "new row violates row-level security policy" } };
          }
          progresso = progresso.filter(
            (p) => p["conteudo_id"] !== linha["conteudo_id"] || p["cliente_id"] !== userId,
          );
          progresso.push(linha);
          return { error: null };
        },
      };
    },
    async rpc(_fn: string, args: { _cliente_id: string; _conteudo_id: string }) {
      return { data: liberado(args._cliente_id, args._conteudo_id), error: null };
    },
  };
}

/** Reproduz marcarProgresso (servidor) com o guard de liberação. */
async function marcarProgresso(
  userId: string,
  conteudoId: string,
  status: "em_andamento" | "concluido",
) {
  const supabase = fakeSupabase(userId);
  await garantirConteudoLiberado(supabase, userId, conteudoId, "marcarProgresso");
  const { error } = await supabase.from("progresso").upsert({
    cliente_id: userId,
    conteudo_id: conteudoId,
    status,
    concluido_em: status === "concluido" ? new Date().toISOString() : null,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

describe("player: progresso só para conteúdo liberado", () => {
  beforeEach(() => {
    progresso = [];
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("persiste progressão de conteúdo liberado", async () => {
    await marcarProgresso(CLIENTE_A, LIBERADO, "em_andamento");
    await marcarProgresso(CLIENTE_A, LIBERADO, "concluido");
    expect(progresso).toHaveLength(1);
    expect(progresso[0]).toMatchObject({ cliente_id: CLIENTE_A, status: "concluido" });
  });

  it("bloqueia play (em_andamento) de conteúdo bloqueado e não grava nada", async () => {
    await expect(marcarProgresso(CLIENTE_A, BLOQUEADO, "em_andamento")).rejects.toThrow(
      "Acesso restrito",
    );
    expect(progresso).toEqual([]);
  });

  it("bloqueia conclusão de conteúdo bloqueado", async () => {
    await expect(marcarProgresso(CLIENTE_A, BLOQUEADO, "concluido")).rejects.toThrow(
      "Acesso restrito",
    );
    expect(progresso).toEqual([]);
  });

  it("bloqueia conteúdo com liberação agendada para o futuro", async () => {
    await expect(marcarProgresso(CLIENTE_A, AGENDADO, "em_andamento")).rejects.toThrow(
      "Acesso restrito",
    );
    expect(progresso).toEqual([]);
  });

  it("bloqueia conteúdo liberado apenas para outro cliente", async () => {
    await expect(marcarProgresso(CLIENTE_A, DO_OUTRO, "concluido")).rejects.toThrow(
      "Acesso restrito",
    );
    expect(progresso).toEqual([]);
  });

  it("bloqueia id inexistente", async () => {
    await expect(
      marcarProgresso(CLIENTE_A, "c9999999-9999-4999-8999-999999999999", "em_andamento"),
    ).rejects.toThrow("Acesso restrito");
    expect(progresso).toEqual([]);
  });

  it("sequência play/pause/play repetida não cria linhas para bloqueado", async () => {
    for (const status of ["em_andamento", "em_andamento", "concluido"] as const) {
      await expect(marcarProgresso(CLIENTE_A, BLOQUEADO, status)).rejects.toThrow();
    }
    await marcarProgresso(CLIENTE_A, LIBERADO, "em_andamento");
    expect(progresso).toHaveLength(1);
    expect(progresso[0]!["conteudo_id"]).toBe(LIBERADO);
  });

  it("registra auditoria de acesso negado ao tentar gravar fora do escopo", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(marcarProgresso(CLIENTE_A, DO_OUTRO, "em_andamento")).rejects.toThrow();
    const log = warn.mock.calls.map((c) => String(c[1])).join(" ");
    expect(log).toContain("acesso-negado");
    expect(log).toContain("marcarProgresso");
  });

  it("RLS rejeita gravar progresso com cliente_id de outra pessoa", async () => {
    const supabase = fakeSupabase(CLIENTE_A);
    const { error } = await supabase
      .from("progresso")
      .upsert({ cliente_id: CLIENTE_B, conteudo_id: LIBERADO, status: "concluido" });
    expect(error?.message).toContain("row-level security");
    expect(progresso).toEqual([]);
  });
});
