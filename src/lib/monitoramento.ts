import { STATUS_EM_CURSO, hojeLocal, statusEfetivo, type PlanoBase } from "@/lib/planos";
import type { StatusAtribuicao } from "@/lib/etapas";

/** Uma linha da listagem de monitoramento, já normalizada pelo servidor. */
export type LinhaMonitoramento = PlanoBase & {
  atribuicaoId: string;
  clienteId: string;
  cliente: string;
  email: string;
  trilhaId: string;
  trilha: string;
  terapeutaId: string | null;
  terapeuta: string;
  status: StatusAtribuicao;
  objetivo: string;
  totalEtapas: number;
  concluidas: number;
  ultimaEtapa: string | null;
  ultimaAtividade: string | null;
  concluidoEm: string | null;
  apoioAberto: number;
  revisaoSemDevolutiva: boolean;
};

export type SituacaoRevisao = "sem_data" | "pendente" | "vencida" | "futura";

export type FiltrosMonitoramento = {
  terapeuta: string;
  trilha: string;
  status: "todos" | StatusAtribuicao;
  periodoDias: 7 | 30 | 90 | 0;
  revisao: "todas" | "pendente" | "vencida" | "sem_data";
  apoio: "todos" | "com_apoio";
  inatividade: boolean;
  termo: string;
};

export const FILTROS_PADRAO: FiltrosMonitoramento = {
  terapeuta: "todos",
  trilha: "todas",
  status: "todos",
  periodoDias: 30,
  revisao: "todas",
  apoio: "todos",
  inatividade: false,
  termo: "",
};

/** Dias inteiros desde a última atividade registrada pela pessoa. */
export function diasSemAtividade(
  ultimaAtividade: string | null,
  agora: Date = new Date(),
): number | null {
  if (!ultimaAtividade) return null;
  const dif = agora.getTime() - Date.parse(ultimaAtividade);
  if (Number.isNaN(dif)) return null;
  return Math.max(0, Math.floor(dif / 86_400_000));
}

/** Situação da próxima revisão, comparada com a data local de São Paulo. */
export function situacaoRevisao(
  dataRevisao: string | null,
  agora: Date = new Date(),
): SituacaoRevisao {
  if (!dataRevisao) return "sem_data";
  const hoje = hojeLocal(agora);
  if (dataRevisao < hoje) return "vencida";
  if (dataRevisao === hoje) return "pendente";
  return "futura";
}

/** Progresso percebido: etapas concluídas sobre etapas visíveis. */
export function percentualProgresso(concluidas: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((concluidas / total) * 100));
}

function dentroDoPeriodo(iso: string | null, dias: number, agora: Date): boolean {
  if (!dias) return true;
  if (!iso) return false;
  const marca = Date.parse(iso);
  if (Number.isNaN(marca)) return false;
  return agora.getTime() - marca <= dias * 86_400_000;
}

/** Quantos dias sem prática consideramos "sem atividade recente". */
export const DIAS_SEM_ATIVIDADE = 7;

export function semAtividadeRecente(linha: LinhaMonitoramento, agora: Date = new Date()): boolean {
  if (!STATUS_EM_CURSO.includes(statusEfetivo(linha, agora))) return false;
  const dias = diasSemAtividade(linha.ultimaAtividade, agora);
  return dias === null || dias >= DIAS_SEM_ATIVIDADE;
}

export function aplicarFiltros(
  linhas: LinhaMonitoramento[],
  filtros: FiltrosMonitoramento,
  agora: Date = new Date(),
): LinhaMonitoramento[] {
  const termo = filtros.termo.trim().toLowerCase();
  return linhas.filter((l) => {
    const status = statusEfetivo(l, agora);
    if (filtros.terapeuta !== "todos" && (l.terapeutaId ?? "") !== filtros.terapeuta) return false;
    if (filtros.trilha !== "todas" && l.trilhaId !== filtros.trilha) return false;
    if (filtros.status !== "todos" && status !== filtros.status) return false;
    if (filtros.apoio === "com_apoio" && l.apoioAberto === 0) return false;
    if (filtros.inatividade && !semAtividadeRecente(l, agora)) return false;

    if (filtros.revisao !== "todas") {
      const situacao = situacaoRevisao(l.data_revisao, agora);
      if (filtros.revisao === "sem_data" && situacao !== "sem_data") return false;
      if (filtros.revisao === "pendente" && situacao !== "pendente" && situacao !== "vencida")
        return false;
      if (filtros.revisao === "vencida" && situacao !== "vencida") return false;
    }

    if (filtros.periodoDias) {
      const referencia = l.ultimaAtividade ?? l.concluidoEm ?? null;
      const emCurso = STATUS_EM_CURSO.includes(status);
      if (!emCurso && !dentroDoPeriodo(referencia, filtros.periodoDias, agora)) return false;
    }

    if (termo) {
      const alvo = `${l.cliente} ${l.email} ${l.trilha} ${l.objetivo}`.toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });
}

/** Solicitações de apoio primeiro, depois revisões mais próximas de vencer. */
export function ordenarLinhas(
  linhas: LinhaMonitoramento[],
  agora: Date = new Date(),
): LinhaMonitoramento[] {
  const peso = (l: LinhaMonitoramento) => {
    if (l.apoioAberto > 0) return 0;
    const situacao = situacaoRevisao(l.data_revisao, agora);
    if (situacao === "vencida") return 1;
    if (situacao === "pendente") return 2;
    if (semAtividadeRecente(l, agora)) return 3;
    return 4;
  };
  return [...linhas].sort((a, b) => {
    const dif = peso(a) - peso(b);
    if (dif !== 0) return dif;
    const ta = a.ultimaAtividade ? Date.parse(a.ultimaAtividade) : 0;
    const tb = b.ultimaAtividade ? Date.parse(b.ultimaAtividade) : 0;
    return tb - ta;
  });
}

export type IndicadoresMonitoramento = {
  emAndamento: number;
  revisoesPendentes: number;
  apoio: number;
  semAtividade: number;
  aguardandoDevolutiva: number;
  concluidosNoPeriodo: number;
};

export function calcularIndicadores(
  linhas: LinhaMonitoramento[],
  periodoDias: number,
  agora: Date = new Date(),
): IndicadoresMonitoramento {
  let emAndamento = 0;
  let revisoesPendentes = 0;
  let apoio = 0;
  let semAtividade = 0;
  let aguardandoDevolutiva = 0;
  let concluidosNoPeriodo = 0;

  for (const l of linhas) {
    const status = statusEfetivo(l, agora);
    if (status === "em_andamento" || status === "aguardando_inicio") emAndamento += 1;
    const situacao = situacaoRevisao(l.data_revisao, agora);
    if (
      (situacao === "pendente" || situacao === "vencida") &&
      STATUS_EM_CURSO.includes(status)
    )
      revisoesPendentes += 1;
    apoio += l.apoioAberto;
    if (semAtividadeRecente(l, agora)) semAtividade += 1;
    if (l.revisaoSemDevolutiva) aguardandoDevolutiva += 1;
    if (status === "concluido" && dentroDoPeriodo(l.concluidoEm, periodoDias, agora))
      concluidosNoPeriodo += 1;
  }

  return {
    emAndamento,
    revisoesPendentes,
    apoio,
    semAtividade,
    aguardandoDevolutiva,
    concluidosNoPeriodo,
  };
}

/** Autorrelato do cliente, nunca uma leitura nossa do estado dele. */
export function textoAutorrelato(intensidade: number | null | undefined): string {
  if (intensidade === null || intensidade === undefined) return "sem intensidade registrada";
  return `o cliente relatou ${intensidade} de 10`;
}
