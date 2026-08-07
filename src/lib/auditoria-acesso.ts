/**
 * Auditoria de acessos negados (RLS, GRANT, Storage e checagem de papel).
 *
 * Objetivo: quando uma leitura/gravação fora do escopo é bloqueada, deixar um
 * registro estruturado nos logs do servidor para identificar rapidamente a
 * tentativa (quem, o quê, qual recurso e qual camada bloqueou).
 * Nunca registramos conteúdo sensível — apenas identificadores e a causa.
 */

import { MENSAGEM_ACESSO_RESTRITO, erroAcessoRestrito } from "./erro-permissao";

export type TipoNegacao = "rls" | "grant" | "storage" | "papel" | "desconhecido";

export type ContextoNegacao = {
  acao: string;
  userId?: string | null;
  /** cliente cujos dados foram solicitados (quando diferente do userId) */
  clienteAlvo?: string | null;
  tabela?: string | null;
  recurso?: string | null;
};

export type EventoNegacao = ContextoNegacao & {
  evento: "acesso-negado";
  tipo: TipoNegacao;
  motivo: string;
  foraDoEscopo: boolean;
  em: string;
};

const PREFIXO = "[auditoria:acesso-negado]";

/** Reduz um id a um prefixo curto para não despejar dados pessoais no log. */
function curto(id?: string | null) {
  if (!id) return null;
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function mensagemDe(erro: unknown): string {
  if (!erro) return "";
  if (typeof erro === "string") return erro;
  if (typeof erro === "object") {
    const e = erro as { message?: unknown; error?: unknown };
    if (typeof e.message === "string") return e.message;
    if (typeof e.error === "string") return e.error;
  }
  return String(erro);
}

/** Classifica a camada que bloqueou o acesso a partir da mensagem do erro. */
export function classificarNegacao(erro: unknown): TipoNegacao {
  const msg = mensagemDe(erro).toLowerCase();
  if (!msg) return "desconhecido";
  if (msg.includes("row-level security") || msg.includes("row level security")) return "rls";
  if (msg.includes("permission denied")) return "grant";
  if (
    msg.includes("object not found") ||
    msg.includes("bucket") ||
    msg.includes("signed url") ||
    msg.includes("storage")
  ) {
    return "storage";
  }
  if (msg.includes("acesso restrito") || msg.includes("forbidden") || msg.includes("unauthorized")) {
    return "papel";
  }
  return "desconhecido";
}

/** Indica se o pedido apontava para dados de outro cliente. */
export function pedidoForaDoEscopo(ctx: ContextoNegacao): boolean {
  return Boolean(ctx.clienteAlvo && ctx.userId && ctx.clienteAlvo !== ctx.userId);
}

/** Registra o evento e devolve o objeto registrado (útil em testes). */
export function registrarAcessoNegado(ctx: ContextoNegacao, erro?: unknown): EventoNegacao {
  const evento: EventoNegacao = {
    evento: "acesso-negado",
    tipo: classificarNegacao(erro),
    motivo: mensagemDe(erro) || "acesso negado",
    acao: ctx.acao,
    userId: curto(ctx.userId),
    clienteAlvo: curto(ctx.clienteAlvo),
    tabela: ctx.tabela ?? null,
    recurso: ctx.recurso ?? null,
    foraDoEscopo: pedidoForaDoEscopo(ctx),
    em: new Date().toISOString(),
  };
  console.warn(PREFIXO, JSON.stringify(evento));
  return evento;
}

/** Registra e lança o erro padrão de acesso restrito. */
export function negarAcesso(ctx: ContextoNegacao, motivo = MENSAGEM_ACESSO_RESTRITO): never {
  registrarAcessoNegado(ctx, motivo);
  throw erroAcessoRestrito();
}

/**
 * Audita o retorno `{ data, error }` do Supabase: registra quando o erro é de
 * permissão (RLS/GRANT/Storage) e devolve o próprio resultado.
 */
export function auditarResultado<T extends { error?: unknown }>(
  resultado: T,
  ctx: ContextoNegacao,
): T {
  if (resultado?.error) {
    const tipo = classificarNegacao(resultado.error);
    if (tipo !== "desconhecido") registrarAcessoNegado(ctx, resultado.error);
  }
  return resultado;
}
