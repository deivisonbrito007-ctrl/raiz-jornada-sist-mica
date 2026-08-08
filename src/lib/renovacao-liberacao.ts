/**
 * Renovação de acesso: decide como registrar e comunicar uma liberação.
 *
 * Liberar algo que estava bloqueado é diferente de liberar pela primeira vez —
 * para o cliente é uma renovação (ele volta de onde parou) e, para a equipe,
 * é um evento próprio na auditoria. Esta função concentra essa decisão para
 * que a tela do terapeuta, o registro de auditoria e a notificação do cliente
 * nunca contem histórias diferentes.
 */

export type StatusLiberacaoAtual = "liberado" | "bloqueado" | null;

export type AcaoLiberacao = "conteudo_liberado" | "liberacao_renovada" | "liberacao_agendada";

export type PlanoLiberacao = {
  /** ação registrada na auditoria da equipe */
  acao: AcaoLiberacao;
  /** é uma volta de acesso que estava bloqueado */
  renovacao: boolean;
  /** liberação marcada para uma data futura: nada é comunicado agora */
  agendada: boolean;
  /** aviso enviado ao cliente (null quando a liberação é futura) */
  notificacao: { titulo: string; mensagem: string } | null;
};

export function planejarLiberacao(entrada: {
  statusAtual: StatusLiberacaoAtual;
  liberarEm?: string | null;
  titulo?: string | null;
  agora?: Date;
}): PlanoLiberacao {
  const renovacao = entrada.statusAtual === "bloqueado";
  const agora = entrada.agora ?? new Date();
  const agendada = Boolean(entrada.liberarEm && new Date(entrada.liberarEm) > agora);
  const titulo = entrada.titulo?.trim() || "";

  if (agendada) {
    return { acao: "liberacao_agendada", renovacao, agendada: true, notificacao: null };
  }

  if (renovacao) {
    return {
      acao: "liberacao_renovada",
      renovacao: true,
      agendada: false,
      notificacao: {
        titulo: "Acesso renovado",
        mensagem: titulo
          ? `"${titulo}" está liberada novamente: você pode retomar de onde parou.`
          : "Seu acesso foi renovado: você pode retomar de onde parou.",
      },
    };
  }

  return {
    acao: "conteudo_liberado",
    renovacao: false,
    agendada: false,
    notificacao: {
      titulo: "Novo conteúdo liberado",
      mensagem: titulo
        ? `"${titulo}" já está disponível na sua biblioteca.`
        : "Há algo novo esperando por você na sua biblioteca.",
    },
  };
}
