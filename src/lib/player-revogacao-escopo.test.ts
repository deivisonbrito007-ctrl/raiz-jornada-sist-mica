import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { garantirConteudoLiberado } from "./liberacao-guard";

/**
 * Revogação durante o acesso: se o terapeuta bloquear (ou reagendar) o conteúdo
 * enquanto o cliente está com o player aberto, qualquer envio de progresso
 * seguinte precisa ser rejeitado antes de persistir — o player deixa de
 * progredir e nada novo é gravado.
 */

const CLIENTE = "11111111-1111-4111-8111-111111111111";
const EIXO = "e1111111-1111-4111-8111-111111111111";
const CONTEUDO = "c1111111-1111-4111-8111-111111111111";

type Liberacao = {
  cliente_id: string;
  conteudo_id: string;
  status: "liberado" | "bloqueado";
  liberar_em: string | null;
};

let liberacoes: Liberacao[] = [];
type Linha = Record<string, unknown>;
let progresso: Linha[] = [];

function estaLiberado(clienteId: string, conteudoId: string) {
  return liberacoes.some(
    (l) =>
      l.cliente_id === clienteId &&
      l.conteudo_id === conteudoId &&
      l.status === "liberado" &&
      (!l.liberar_em || new Date(l.liberar_em).getTime() <= Date.now()),
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakeSupabase(userId: string): any {
  return {
    from(tabela: string) {
      if (tabela === "conteudos") {
        return {
          select: () => ({
            eq: (_col: string, valor: string) => ({
              maybeSingle: async () => ({
                data: estaLiberado(userId, valor) ? { id: valor, eixo_id: EIXO } : null,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        async upsert(linha: Linha) {
          if (linha["cliente_id"] !== userId) {
            return { error: { message: "new row violates row-level security policy" } };
          }
          progresso = progresso.filter((p) => p["conteudo_id"] !== linha["conteudo_id"]);
          progresso.push(linha);
          return { error: null };
        },
      };
    },
    async rpc(_fn: string, args: { _cliente_id: string; _conteudo_id: string }) {
      return { data: estaLiberado(args._cliente_id, args._conteudo_id), error: null };
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

/** Terapeuta revoga o acesso (status = bloqueado). */
function revogar(clienteId: string, conteudoId: string) {
  liberacoes = liberacoes.map((l) =>
    l.cliente_id === clienteId && l.conteudo_id === conteudoId
      ? { ...l, status: "bloqueado" as const }
      : l,
  );
}

/** Terapeuta reagenda para o futuro (equivale a revogar agora). */
function reagendarParaOFuturo(clienteId: string, conteudoId: string) {
  const amanha = new Date(Date.now() + 86_400_000).toISOString();
  liberacoes = liberacoes.map((l) =>
    l.cliente_id === clienteId && l.conteudo_id === conteudoId
      ? { ...l, liberar_em: amanha }
      : l,
  );
}

/**
 * Simula o player: só continua progredindo enquanto o servidor aceitar o
 * envio de progresso (mesma regra do onTimeUpdate/onEnded chamando o servidor).
 */
async function tick(estado: { tocando: boolean; ticks: number }) {
  try {
    await marcarProgresso(CLIENTE, CONTEUDO, "em_andamento");
    estado.ticks += 1;
  } catch (e) {
    estado.tocando = false;
    throw e;
  }
}

describe("player: revogação durante o acesso", () => {
  beforeEach(() => {
    progresso = [];
    liberacoes = [
      { cliente_id: CLIENTE, conteudo_id: CONTEUDO, status: "liberado", liberar_em: null },
    ];
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("rejeita o envio de progresso feito após a revogação", async () => {
    await marcarProgresso(CLIENTE, CONTEUDO, "em_andamento");
    expect(progresso).toHaveLength(1);

    revogar(CLIENTE, CONTEUDO);

    await expect(marcarProgresso(CLIENTE, CONTEUDO, "em_andamento")).rejects.toThrow(
      "Acesso restrito",
    );
  });

  it("não grava conclusão de conteúdo revogado no meio da sessão", async () => {
    await marcarProgresso(CLIENTE, CONTEUDO, "em_andamento");
    revogar(CLIENTE, CONTEUDO);

    await expect(marcarProgresso(CLIENTE, CONTEUDO, "concluido")).rejects.toThrow(
      "Acesso restrito",
    );
    expect(progresso).toHaveLength(1);
    expect(progresso[0]!["status"]).toBe("em_andamento");
  });

  it("player para de progredir a partir da revogação", async () => {
    const estado = { tocando: true, ticks: 0 };
    await tick(estado);
    await tick(estado);
    expect(estado.ticks).toBe(2);

    revogar(CLIENTE, CONTEUDO);

    await expect(tick(estado)).rejects.toThrow("Acesso restrito");
    expect(estado.tocando).toBe(false);
    expect(estado.ticks).toBe(2);
  });

  it("ticks repetidos após a revogação continuam rejeitados e nada é gravado", async () => {
    revogar(CLIENTE, CONTEUDO);
    for (let i = 0; i < 3; i++) {
      await expect(marcarProgresso(CLIENTE, CONTEUDO, "em_andamento")).rejects.toThrow(
        "Acesso restrito",
      );
    }
    expect(progresso).toEqual([]);
  });

  it("reagendamento para o futuro no meio da sessão também bloqueia o progresso", async () => {
    await marcarProgresso(CLIENTE, CONTEUDO, "em_andamento");
    reagendarParaOFuturo(CLIENTE, CONTEUDO);

    await expect(marcarProgresso(CLIENTE, CONTEUDO, "concluido")).rejects.toThrow(
      "Acesso restrito",
    );
    expect(progresso[0]!["status"]).toBe("em_andamento");
  });

  it("registra auditoria de acesso negado na tentativa pós-revogação", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    revogar(CLIENTE, CONTEUDO);
    await expect(marcarProgresso(CLIENTE, CONTEUDO, "em_andamento")).rejects.toThrow();
    const log = warn.mock.calls.map((c) => String(c[1])).join(" ");
    expect(log).toContain("acesso-negado");
    expect(log).toContain("marcarProgresso");
  });

  it("volta a aceitar progresso se o terapeuta reliberar", async () => {
    revogar(CLIENTE, CONTEUDO);
    await expect(marcarProgresso(CLIENTE, CONTEUDO, "em_andamento")).rejects.toThrow();

    liberacoes = [
      { cliente_id: CLIENTE, conteudo_id: CONTEUDO, status: "liberado", liberar_em: null },
    ];
    await marcarProgresso(CLIENTE, CONTEUDO, "concluido");
    expect(progresso).toHaveLength(1);
    expect(progresso[0]!["status"]).toBe("concluido");
  });
});
