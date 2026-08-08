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

/**
 * Categorias de falha que rendem orientação específica na interface.
 * Nenhuma delas expõe nome de tabela, coluna, política ou id — só o que a
 * pessoa precisa fazer agora.
 */
export type CategoriaErro =
  | "acesso_restrito"
  | "sessao_expirada"
  | "sem_conexao"
  | "muitos_pedidos"
  | "recurso_indisponivel"
  | "conflito"
  | "dado_invalido"
  | "servidor"
  | "desconhecido";

export const ORIENTACAO_POR_CATEGORIA: Record<CategoriaErro, string> = {
  acesso_restrito: ORIENTACAO_ACESSO_RESTRITO,
  sessao_expirada:
    "Sua sessão expirou por inatividade. Entre novamente para continuar de onde parou.",
  sem_conexao:
    "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo em instantes.",
  muitos_pedidos:
    "Você fez muitos pedidos em pouco tempo. Aguarde alguns instantes antes de tentar novamente.",
  recurso_indisponivel:
    "Esta função do sistema está temporariamente indisponível. Recarregue a página; se continuar, avise a terapeuta responsável.",
  conflito: "Esse registro já existe ou foi alterado por outra pessoa. Recarregue e tente de novo.",
  dado_invalido: "Confira os campos preenchidos: algum dado está incompleto ou fora do formato.",
  servidor: "Tivemos uma falha no servidor. Tente novamente em alguns instantes.",
  desconhecido: MENSAGEM_FALHA_GENERICA,
};

/** Marcadores por categoria — código do Postgres/PostgREST ou trecho da mensagem. */
const REGRAS: { categoria: CategoriaErro; codigos: string[]; trechos: string[] }[] = [
  {
    // Sessão/token: vem antes de permissão porque a saída é "entrar de novo".
    categoria: "sessao_expirada",
    codigos: ["pgrst301", "pgrst303", "401", "refresh_token_not_found", "invalid_grant"],
    trechos: [
      "jwt expired",
      "jwt is expired",
      "token is expired",
      "invalid jwt",
      "invalid claim",
      "missing sub claim",
      "session not found",
      "auth session missing",
      "no api key found",
      "bad_jwt",
      "sessão expirada",
    ],
  },
  {
    categoria: "sem_conexao",
    codigos: ["econnrefused", "enotfound", "etimedout", "504", "522"],
    trechos: [
      "failed to fetch",
      "network error",
      "networkerror",
      "load failed",
      "fetch failed",
      "timeout",
      "aborted",
      "offline",
    ],
  },
  {
    categoria: "muitos_pedidos",
    codigos: ["429", "over_request_rate_limit", "over_email_send_rate_limit"],
    trechos: ["too many requests", "rate limit", "muitos pedidos", "limite de tentativas"],
  },
  {
    // Função/RPC ausente ou schema desatualizado no cache do PostgREST.
    categoria: "recurso_indisponivel",
    codigos: ["pgrst202", "pgrst203", "pgrst204", "42883", "42723"],
    trechos: [
      "could not find the function",
      "could not find the schema",
      "function does not exist",
      "no function matches",
      "schema cache",
    ],
  },
  {
    categoria: "conflito",
    codigos: ["23505", "409"],
    trechos: ["duplicate key value", "already exists", "conflict", "on conflict"],
  },
  {
    categoria: "dado_invalido",
    codigos: ["22p02", "23502", "23503", "23514", "400", "422"],
    trechos: [
      "invalid input syntax",
      "violates not-null constraint",
      "violates foreign key constraint",
      "violates check constraint",
      "invalid input value for enum",
    ],
  },
  {
    categoria: "servidor",
    codigos: ["500", "502", "503", "57014", "53300", "xx000"],
    trechos: ["internal server error", "bad gateway", "service unavailable", "canceling statement"],
  },
];

function pistas(erro: unknown): { msg: string; codigos: string[] } {
  const msg = texto(erro).toLowerCase();
  const codigos: string[] = [];
  if (erro && typeof erro === "object") {
    const e = erro as { code?: unknown; status?: unknown; statusCode?: unknown; hint?: unknown; details?: unknown; error_code?: unknown };
    for (const v of [e.code, e.status, e.statusCode, e.error_code]) {
      if (typeof v === "string" || typeof v === "number") codigos.push(String(v).toLowerCase());
    }
  }
  return { msg, codigos };
}

/**
 * Classifica a falha em uma categoria com orientação própria. Sessão, rede,
 * limite de uso e função ausente têm prioridade sobre o bloqueio genérico,
 * porque a ação da pessoa é diferente em cada caso; qualquer outro sinal de
 * RLS/GRANT/404 continua colapsando em "acesso restrito".
 */
export function classificarErro(erro: unknown): CategoriaErro {
  if (erro && typeof erro === "object" && (erro as { codigo?: unknown }).codigo === CODIGO_ACESSO_RESTRITO) {
    return "acesso_restrito";
  }
  const { msg, codigos } = pistas(erro);
  if (!msg && codigos.length === 0) return "desconhecido";

  for (const regra of REGRAS) {
    const porCodigo = regra.codigos.some((c) => codigos.includes(c));
    const porTexto = regra.trechos.some((t) => msg.includes(t));
    if (porCodigo || porTexto) return regra.categoria;
  }

  if (ehErroPermissao(erro)) return "acesso_restrito";
  return "desconhecido";
}

/** Orientação pronta para a categoria da falha. */
export function orientacaoErro(erro: unknown, fallback = MENSAGEM_FALHA_GENERICA): string {
  const categoria = classificarErro(erro);
  return categoria === "desconhecido" ? fallback : ORIENTACAO_POR_CATEGORIA[categoria];
}

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
  const categoria = classificarErro(erro);
  if (categoria !== "desconhecido") return ORIENTACAO_POR_CATEGORIA[categoria];
  const msg = texto(erro);
  // Mensagens de regra de negócio nossas (curtas, sem SQL) podem passar.
  const suspeita = /select |insert |update |relation |column |policy |constraint |supabase|postgres|uuid|=/i;
  if (msg && msg.length <= 140 && !suspeita.test(msg)) return msg;
  return fallback;
}
