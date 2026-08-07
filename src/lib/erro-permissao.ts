/**
 * Respostas padronizadas para ações do painel bloqueadas por permissão.
 *
 * Regras (valem para servidor e interface):
 * 1. Uma única mensagem para qualquer bloqueio de permissão — não distinguimos
 *    "não existe" de "existe mas você não pode ver", para não revelar a
 *    existência de clientes, conteúdos, convites ou admins.
 * 2. Nunca repassamos o texto cru do banco (RLS, nome de tabela, coluna,
 *    política, id) para o usuário; isso fica só nos logs de auditoria.
 * 3. Toda mensagem orienta o próximo passo: pedir a permissão à terapeuta.
 */

export const CODIGO_ACESSO_RESTRITO = "ACESSO_RESTRITO";

/** Mensagem única de bloqueio por permissão. */
export const MENSAGEM_ACESSO_RESTRITO = "Acesso restrito";

/** Orientação exibida junto da mensagem na interface. */
export const ORIENTACAO_ACESSO_RESTRITO =
  "Você não tem permissão para esta ação. Peça à terapeuta responsável para liberar essa permissão na aba Equipe.";

/** Mensagem genérica para falhas que não são de permissão. */
export const MENSAGEM_FALHA_GENERICA = "Não foi possível concluir a ação. Tente novamente.";

export type ErroPermissao = Error & { codigo: typeof CODIGO_ACESSO_RESTRITO };

/** Cria o erro canônico de acesso restrito. */
export function erroAcessoRestrito(): ErroPermissao {
  const erro = new Error(MENSAGEM_ACESSO_RESTRITO) as ErroPermissao;
  erro.codigo = CODIGO_ACESSO_RESTRITO;
  return erro;
}

function texto(erro: unknown): string {
  if (!erro) return "";
  if (typeof erro === "string") return erro;
  if (typeof erro === "object") {
    const e = erro as { message?: unknown; error?: unknown; codigo?: unknown; code?: unknown };
    if (e.codigo === CODIGO_ACESSO_RESTRITO) return MENSAGEM_ACESSO_RESTRITO;
    if (typeof e.message === "string") return e.message;
    if (typeof e.error === "string") return e.error;
  }
  return String(erro);
}

const MARCADORES_PERMISSAO = [
  "acesso restrito",
  "row-level security",
  "row level security",
  "permission denied",
  "insufficient_privilege",
  "not authorized",
  "unauthorized",
  "forbidden",
  "jwt",
  // "nada encontrado" também é tratado como bloqueio: pode ser RLS filtrando.
  "pgrst116",
  "no rows",
  "not found",
  "does not exist",
  "0 rows",
];

/** Diz se um erro (do servidor ou do banco) representa bloqueio de permissão. */
export function ehErroPermissao(erro: unknown): boolean {
  if (erro && typeof erro === "object" && (erro as { codigo?: unknown }).codigo === CODIGO_ACESSO_RESTRITO) {
    return true;
  }
  const msg = texto(erro).toLowerCase();
  if (!msg) return false;
  const status = (erro as { status?: unknown } | null)?.status;
  if (status === 401 || status === 403 || status === 404) return true;
  return MARCADORES_PERMISSAO.some((m) => msg.includes(m));
}

/**
 * Converte qualquer erro de Supabase/servidor no erro que pode sair do
 * servidor: bloqueio vira "Acesso restrito"; o resto vira falha genérica.
 * Assim nenhum detalhe de schema, política ou id chega ao cliente.
 */
export function erroSeguro(erro: unknown, fallback = MENSAGEM_FALHA_GENERICA): Error {
  if (ehErroPermissao(erro)) return erroAcessoRestrito();
  return new Error(fallback);
}

/**
 * Mensagem final para a interface (toast, banner). Sempre clara, nunca
 * expondo dados nem confirmando que o registro existe.
 */
export function mensagemPainel(erro: unknown, fallback = MENSAGEM_FALHA_GENERICA): string {
  if (ehErroPermissao(erro)) return ORIENTACAO_ACESSO_RESTRITO;
  const msg = texto(erro);
  // Mensagens de regra de negócio nossas (curtas, sem SQL) podem passar.
  const suspeita = /select |insert |update |relation |column |policy |constraint |supabase|postgres|uuid|=/i;
  if (msg && msg.length <= 140 && !suspeita.test(msg)) return msg;
  return fallback;
}
