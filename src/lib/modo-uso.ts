/**
 * Modos de uso do Raiz.
 *
 * `acompanhado` — a pessoa entrou por convite e é acompanhada pela terapeuta:
 * o conteúdo abre por plano atribuído, existe canal de apoio e revisões.
 * `autoguiado` — a pessoa entrou por conta própria: o conteúdo abre por pacote
 * pago, não há acompanhamento individual, e ela pode pedir acompanhamento.
 *
 * Módulo puro: só tipos, rótulos e regras de "o que aparece em cada modo".
 * A liberação real é decidida no banco (RLS + `conteudo_liberado`).
 */
export const MODOS_USO = ["acompanhado", "autoguiado"] as const;

export type ModoUso = (typeof MODOS_USO)[number];

export const MODO_LABEL: Record<ModoUso, string> = {
  acompanhado: "Acompanhado",
  autoguiado: "Por conta própria",
};

export const MODO_DESCRICAO: Record<ModoUso, string> = {
  acompanhado: "Segue um plano atribuído pela terapeuta, com revisões e canal de apoio.",
  autoguiado: "Percorre sozinha as trilhas autoguiadas incluídas no pacote adquirido.",
};

export function ehModoUso(valor: string | null | undefined): valor is ModoUso {
  return (MODOS_USO as readonly string[]).includes(valor ?? "");
}

/** Modo padrão quando o registro de acesso ainda não existe (conta recém-criada). */
export const MODO_PADRAO: ModoUso = "acompanhado";

export function normalizarModo(valor: string | null | undefined): ModoUso {
  return ehModoUso(valor) ? valor : MODO_PADRAO;
}

/** O que a interface do cliente mostra em cada modo. */
export type BlocosCliente = {
  /** cartão da trilha atribuída, com mensagem da terapeuta e próxima revisão */
  planoDaTerapeuta: boolean;
  /** botão "Preciso de apoio" (canal individual com a terapeuta) */
  pedirApoio: boolean;
  /** vitrine de pacotes e trilhas autoguiadas */
  vitrinePacotes: boolean;
  /** bloco "Quero acompanhamento da terapeuta" */
  pedirAcompanhamento: boolean;
  /** escolha livre entre as trilhas autoguiadas liberadas */
  escolherTrilha: boolean;
  /** o compartilhamento de diário só faz sentido havendo terapeuta */
  compartilharDiario: boolean;
};

export function blocosDoModo(modo: ModoUso): BlocosCliente {
  const acompanhado = modo === "acompanhado";
  return {
    planoDaTerapeuta: acompanhado,
    pedirApoio: acompanhado,
    vitrinePacotes: !acompanhado,
    pedirAcompanhamento: !acompanhado,
    escolherTrilha: !acompanhado,
    compartilharDiario: acompanhado,
  };
}

/** Uma trilha só aparece para quem usa o app naquele modo. */
export function trilhaServeAoModo(modos: readonly string[] | null | undefined, modo: ModoUso) {
  return (modos ?? [MODO_PADRAO]).includes(modo);
}

export const STATUS_PEDIDO = ["aberta", "aceita", "recusada"] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export const STATUS_PEDIDO_LABEL: Record<StatusPedido, string> = {
  aberta: "Aguardando resposta",
  aceita: "Aceito",
  recusada: "Recusado",
};

/**
 * Só faz sentido pedir acompanhamento quem usa por conta própria e ainda não
 * tem um pedido esperando resposta.
 */
export function podePedirAcompanhamento(
  modo: ModoUso,
  pedidos: readonly { status: string }[] = [],
) {
  if (modo !== "autoguiado") return false;
  return !pedidos.some((p) => p.status === "aberta");
}

/** Mensagem honesta sobre o acesso de quem usa por conta própria. */
export function mensagemAcessoAutoguiado(temPacotePago: boolean) {
  return temPacotePago
    ? "Seu pacote está ativo. As trilhas autoguiadas incluídas estão abertas para você."
    : "Escolha um pacote para abrir as trilhas autoguiadas. Enquanto isso, o diário e a apresentação das áreas seguem disponíveis.";
}
