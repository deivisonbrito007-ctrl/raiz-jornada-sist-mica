/**
 * Regras de leitura da aba "Minha jornada" do cliente.
 *
 * Módulo puro (sem React, sem rede): recebe as trilhas já entregues por
 * `getMinhaJornada` e devolve o resumo, o filtro e as frases de acolhimento
 * usadas na tela.
 */

export type FiltroJornada = "andamento" | "concluidas" | "todas";

export const FILTRO_JORNADA_LABEL: Record<FiltroJornada, string> = {
  andamento: "Em andamento",
  concluidas: "Concluídas",
  todas: "Todas",
};

type PlanoMinimo = {
  status: string;
  total: number;
  concluidas: number;
  percentual: number;
};

/** Um plano só é "fechado" quando o status diz isso ou todas as etapas foram feitas. */
export function planoFechado(plano: PlanoMinimo): boolean {
  if (plano.status === "concluido" || plano.status === "encerrado") return true;
  return plano.total > 0 && plano.concluidas >= plano.total;
}

export function filtrarPlanos<T extends PlanoMinimo>(planos: T[], filtro: FiltroJornada): T[] {
  if (filtro === "todas") return planos;
  const fechados = filtro === "concluidas";
  return planos.filter((p) => planoFechado(p) === fechados);
}

export type ResumoJornada = {
  ativos: number;
  fechados: number;
  etapasFeitas: number;
  etapasTotais: number;
  percentual: number;
  frase: string;
};

/** Resumo geral mostrado no cabeçalho, com uma frase de ritmo sem cobrança. */
export function resumoDaJornada(planos: PlanoMinimo[]): ResumoJornada {
  const ativos = planos.filter((p) => !planoFechado(p)).length;
  const fechados = planos.length - ativos;
  const etapasFeitas = planos.reduce((soma, p) => soma + p.concluidas, 0);
  const etapasTotais = planos.reduce((soma, p) => soma + p.total, 0);
  const percentual = etapasTotais ? Math.round((etapasFeitas / etapasTotais) * 100) : 0;

  return { ativos, fechados, etapasFeitas, etapasTotais, percentual, frase: fraseDeRitmo({ planos: planos.length, etapasFeitas, percentual }) };
}

function fraseDeRitmo({
  planos,
  etapasFeitas,
  percentual,
}: {
  planos: number;
  etapasFeitas: number;
  percentual: number;
}): string {
  if (planos === 0) return "Seu caminho começa quando você estiver pronta. Nada aqui tem pressa.";
  if (etapasFeitas === 0) return "O primeiro passo é o mais silencioso. Ele já basta por hoje.";
  if (percentual >= 100) return "Você percorreu tudo o que foi combinado. Deixe assentar.";
  if (percentual >= 70) return "Você já está bem dentro do caminho. Continue devagar.";
  if (percentual >= 30) return "Você tem caminhado com constância, e isso é o que sustenta.";
  return "Cada etapa concluída é raiz que se firma. Uma por vez.";
}

/** Selo de acolhimento quando um plano chega ao fim. */
export function seloDeFechamento(plano: PlanoMinimo): string {
  if (plano.total >= 8) return "Ciclo profundo concluído";
  if (plano.total >= 4) return "Ciclo concluído";
  return "Caminho fechado";
}

type EtapaMinima = { status: string; personalizada: boolean; ordem: number; id: string };

/** A etapa em que a pessoa está agora — a primeira não concluída com conteúdo. */
export function etapaAtual<T extends EtapaMinima>(etapas: T[]): T | null {
  return etapas.find((e) => e.status !== "concluido" && !e.personalizada) ?? null;
}
