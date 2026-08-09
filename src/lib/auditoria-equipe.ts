/** Registro de auditoria das ações administrativas (equipe, permissões e liberações). */

export const ACOES_AUDITORIA = [
  "convite_criado",
  "convite_cancelado",
  "convite_permissoes_atualizadas",
  "permissoes_definidas",
  "permissoes_revogadas",
  "admin_removido",
  "conteudo_liberado",
  "liberacao_agendada",
  "liberacao_revogada",
  "lembretes_configurados",
  "trilha_criada",
  "trilha_atualizada",
  "trilha_atribuida",
  "atribuicao_atualizada",
  "cliente_convidado",
  "cliente_atualizado",
  "acompanhamento_aceito",
  "acompanhamento_recusado",
  "modo_alterado",
  "pacote_pagamento_registrado",
  "orientacao_enviada",
  "prazo_revisao_alterado",
  "etapa_liberada",
  "revisao_marcada",
] as const;

export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[number];

export const ACAO_LABEL: Record<AcaoAuditoria, string> = {
  convite_criado: "Convite enviado",
  convite_cancelado: "Convite cancelado",
  convite_permissoes_atualizadas: "Permissões do convite atualizadas",
  permissoes_definidas: "Permissões definidas",
  permissoes_revogadas: "Permissões revogadas",
  admin_removido: "Acesso de admin removido",
  conteudo_liberado: "Conteúdo liberado",
  liberacao_agendada: "Liberação agendada",
  liberacao_revogada: "Liberação revogada",
  lembretes_configurados: "Lembretes configurados",
  trilha_criada: "Trilha criada",
  trilha_atualizada: "Trilha atualizada",
  trilha_atribuida: "Trilha atribuída a um cliente",
  atribuicao_atualizada: "Atribuição atualizada",
  cliente_convidado: "Cliente convidado",
  cliente_atualizado: "Cadastro de cliente atualizado",
  acompanhamento_aceito: "Pedido de acompanhamento aceito",
  acompanhamento_recusado: "Pedido de acompanhamento recusado",
  modo_alterado: "Modo de uso alterado",
  pacote_pagamento_registrado: "Pagamento de pacote registrado",
};


/** Ações que representam perda de acesso — destacadas em cor de alerta na tela. */
export const ACOES_SENSIVEIS: AcaoAuditoria[] = [
  "permissoes_revogadas",
  "admin_removido",
  "liberacao_revogada",
  "convite_cancelado",
];

export type RegistroAuditoria = {
  acao: AcaoAuditoria;
  alvoTipo:
    | "equipe"
    | "convite"
    | "liberacao"
    | "lembretes"
    | "trilha"
    | "atribuicao"
    | "cliente"
    | "pacote";
  alvoId?: string | null;
  alvoEmail?: string | null;
  detalhes?: Record<string, unknown>;
};

type ClienteInsert = {
  from: (tabela: "auditoria_equipe") => {
    insert: (linha: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
  };
};

/**
 * Grava a ação no histórico. Nunca interrompe a operação principal:
 * falha de auditoria é apenas logada no servidor.
 */
export async function registrarAuditoria(
  supabase: ClienteInsert,
  ator: { userId: string; email?: string | null },
  registro: RegistroAuditoria,
): Promise<void> {
  try {
    const { error } = await supabase.from("auditoria_equipe").insert({
      acao: registro.acao,
      alvo_tipo: registro.alvoTipo,
      alvo_id: registro.alvoId ?? null,
      alvo_email: registro.alvoEmail ?? null,
      detalhes: registro.detalhes ?? {},
      ator_id: ator.userId,
      ator_email: ator.email ?? "",
    });
    if (error) console.error("[auditoria] falha ao registrar", registro.acao, error.message);
  } catch (e) {
    console.error("[auditoria] erro inesperado", registro.acao, e);
  }
}

/** Extrai o responsável da ação a partir do contexto autenticado do servidor. */
export function atorAuditoria(context: { userId: string; claims?: unknown }) {
  const claims = (context.claims ?? {}) as { email?: string };
  return { userId: context.userId, email: claims.email ?? "" };
}
