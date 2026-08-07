import { toast } from "sonner";
import { PERMISSAO_LABEL, type Permissao } from "./permissoes";

export type TipoErroPermissao =
  | "permissao" // falta a permissão granular / papel
  | "sessao" // sessão expirada ou ausente
  | "escopo" // pediu dado de outro cliente
  | "rls" // bloqueado por política do banco
  | "nenhum"; // não é erro de permissão

export type ErroPermissaoUI = {
  tipo: TipoErroPermissao;
  titulo: string;
  mensagem: string;
  orientacao: string;
  ehPermissao: boolean;
};

function texto(erro: unknown): string {
  if (!erro) return "";
  if (typeof erro === "string") return erro;
  if (erro instanceof Error) return erro.message;
  if (typeof erro === "object") {
    const e = erro as { message?: unknown; error?: unknown; statusText?: unknown };
    for (const v of [e.message, e.error, e.statusText]) {
      if (typeof v === "string") return v;
    }
  }
  return String(erro);
}

function status(erro: unknown): number | null {
  if (erro && typeof erro === "object") {
    const e = erro as { status?: unknown; statusCode?: unknown; code?: unknown };
    for (const v of [e.status, e.statusCode]) {
      if (typeof v === "number") return v;
    }
    if (e.code === "42501") return 403;
    if (e.code === "PGRST301") return 401;
  }
  return null;
}

/** Traduz qualquer erro de bloqueio em algo legível, com o próximo passo. */
export function classificarErroPermissao(erro: unknown): ErroPermissaoUI {
  const msg = texto(erro).toLowerCase();
  const st = status(erro);

  if (st === 401 || msg.includes("unauthorized") || msg.includes("jwt expired") || msg.includes("sessão")) {
    return {
      tipo: "sessao",
      titulo: "Sua sessão expirou",
      mensagem: "Não conseguimos confirmar quem está usando o painel agora.",
      orientacao: "Entre novamente para continuar de onde parou.",
      ehPermissao: true,
    };
  }

  if (msg.includes("fora do escopo") || msg.includes("outro cliente")) {
    return {
      tipo: "escopo",
      titulo: "Esses dados não são do seu escopo",
      mensagem: "Você só pode ver informações dos clientes vinculados ao seu acesso.",
      orientacao: "Volte à lista de clientes e escolha alguém do seu acompanhamento.",
      ehPermissao: true,
    };
  }

  if (msg.includes("row-level security") || msg.includes("row level security")) {
    return {
      tipo: "rls",
      titulo: "Ação bloqueada por segurança",
      mensagem: "As regras de proteção de dados impediram essa operação.",
      orientacao: "Confirme com a terapeuta responsável se você deveria ter esse acesso.",
      ehPermissao: true,
    };
  }

  if (
    st === 403 ||
    msg.includes("acesso restrito") ||
    msg.includes("permission denied") ||
    msg.includes("forbidden") ||
    msg.includes("sem permissão")
  ) {
    return {
      tipo: "permissao",
      titulo: "Você não tem permissão para isso",
      mensagem: "Essa área ou ação exige uma permissão que a sua conta não possui.",
      orientacao: "Peça à terapeuta responsável para liberar essa permissão na aba Equipe.",
      ehPermissao: true,
    };
  }

  return {
    tipo: "nenhum",
    titulo: "Não foi possível concluir",
    mensagem: texto(erro) || "Algo deu errado ao processar sua solicitação.",
    orientacao: "Tente novamente em alguns instantes.",
    ehPermissao: false,
  };
}

/** Mensagem de bloqueio quando sabemos exatamente qual permissão falta. */
export function bloqueioDePermissao(permissao: Permissao): ErroPermissaoUI {
  return {
    tipo: "permissao",
    titulo: "Área sem permissão",
    mensagem: `Esta área exige a permissão “${PERMISSAO_LABEL[permissao]}”, que não está ativa na sua conta.`,
    orientacao: "Peça à terapeuta responsável para ativar essa permissão na aba Equipe.",
    ehPermissao: true,
  };
}

/**
 * Exibe um aviso claro (nunca silencioso) para qualquer falha de ação.
 * Erros de permissão ganham título + orientação; outros erros usam o texto original.
 */
export function notificarErro(erro: unknown, contexto?: string) {
  const info = classificarErroPermissao(erro);
  const descricao = contexto
    ? `${contexto}. ${info.mensagem} ${info.orientacao}`
    : `${info.mensagem} ${info.orientacao}`;
  toast.error(info.titulo, { description: descricao.trim() });
  return info;
}
