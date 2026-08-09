import { STATUS_ATRIBUICAO_LABEL, type Nivel, type StatusAtribuicao } from "@/lib/etapas";

/** Status que consideramos "vivos" — o plano está em curso para o cliente. */
export const STATUS_EM_CURSO: StatusAtribuicao[] = [
  "aguardando_inicio",
  "em_andamento",
  "aguardando_revisao",
];

/** Status que o cliente pode ver na jornada (rascunho nunca aparece). */
export const STATUS_VISIVEL_CLIENTE: StatusAtribuicao[] = [
  "aguardando_inicio",
  "em_andamento",
  "aguardando_revisao",
  "pausado",
  "concluido",
];

export type PlanoBase = {
  status: StatusAtribuicao;
  data_inicio: string;
  data_revisao: string | null;
  liberar_em?: string | null;
};

/** Data local (São Paulo) em formato YYYY-MM-DD. */
export function hojeLocal(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/**
 * Status mostrado na listagem. "Aguardando início" e "aguardando revisão" são
 * derivados das datas, para a lista ficar correta sem tarefa agendada.
 * A terapeuta continua no comando: rascunho, pausado, concluído e encerrado
 * são sempre respeitados como foram gravados.
 */
export function statusEfetivo(plano: PlanoBase, agora: Date = new Date()): StatusAtribuicao {
  if (plano.status === "rascunho" || plano.status === "pausado") return plano.status;
  if (plano.status === "concluido" || plano.status === "encerrado") return plano.status;

  const hoje = hojeLocal(agora);
  const agendadoNoFuturo = Boolean(plano.liberar_em && Date.parse(plano.liberar_em) > agora.getTime());
  if (agendadoNoFuturo || plano.data_inicio > hoje) return "aguardando_inicio";
  if (plano.data_revisao && plano.data_revisao <= hoje) return "aguardando_revisao";
  return "em_andamento";
}

export function statusLabel(plano: PlanoBase, agora: Date = new Date()): string {
  return STATUS_ATRIBUICAO_LABEL[statusEfetivo(plano, agora)];
}

/** Classe visual por status, sempre com tokens do tema. */
export function statusClasse(status: StatusAtribuicao): string {
  switch (status) {
    case "rascunho":
      return "bg-muted text-muted-foreground";
    case "aguardando_inicio":
      return "bg-secondary text-floresta";
    case "em_andamento":
      return "bg-floresta/10 text-floresta";
    case "aguardando_revisao":
      return "bg-terracota/15 text-terracota";
    case "pausado":
      return "bg-terracota/10 text-terracota";
    case "concluido":
      return "bg-secondary text-floresta";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Objetivo resumido para a listagem: primeira linha, sem estourar a coluna. */
export function objetivoResumido(objetivo: string, limite = 90): string {
  const primeira = (objetivo ?? "").split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  if (!primeira) return "Sem objetivo escrito";
  return primeira.length > limite ? `${primeira.slice(0, limite - 1)}…` : primeira;
}

/** Progresso do plano: etapas concluídas sobre etapas visíveis. */
export function progressoPlano(etapas: { visivel: boolean; concluida_em: string | null }[]) {
  const visiveis = etapas.filter((e) => e.visivel);
  const concluidas = visiveis.filter((e) => e.concluida_em).length;
  return {
    total: visiveis.length,
    concluidas,
    percentual: visiveis.length ? Math.round((concluidas / visiveis.length) * 100) : 0,
  };
}

/** Um plano principal em andamento por cliente é o combinado; avisamos, sem bloquear. */
export function planoPrincipalEmCurso<T extends PlanoBase & { cliente_id: string }>(
  planos: T[],
  clienteId: string,
  agora: Date = new Date(),
): T | undefined {
  return planos.find(
    (p) => p.cliente_id === clienteId && STATUS_EM_CURSO.includes(statusEfetivo(p, agora)),
  );
}

export type EtapaPlano = {
  conteudoId: string | null;
  titulo: string;
  descricao: string;
  ordem: number;
  obrigatoria: boolean;
  visivel: boolean;
  permiteRepetir: boolean;
  prazoDias: number | null;
  duracaoSegundos: number;
  personalizada: boolean;
};

export const NIVEL_MARCADORES: { chave: "podeSozinho" | "exigeAcompanhamento" | "somenteEmSessao"; label: string; ajuda: string }[] = [
  {
    chave: "podeSozinho",
    label: "Pode ser realizado sozinho",
    ajuda: "A pessoa pode praticar entre as sessões, no próprio ritmo.",
  },
  {
    chave: "exigeAcompanhamento",
    label: "Requer acompanhamento próximo",
    ajuda: "Convém revisar com frequência e manter contato disponível.",
  },
  {
    chave: "somenteEmSessao",
    label: "Deve ser realizado durante uma sessão",
    ajuda: "A prática só é indicada com a terapeuta presente.",
  },
];

export const NIVEL_ORDEM: Nivel[] = ["leve", "intermediario", "profundo"];
