/**
 * Vocabulário das trilhas terapêuticas: tipos fixos de etapa, níveis de
 * profundidade e status. Módulo client-safe (usado na UI e nos formulários).
 */

export const TIPOS_ETAPA = [
  "orientacao",
  "preparacao",
  "checkin_inicial",
  "compreensao",
  "aterramento",
  "meditacao",
  "movimento",
  "integracao",
  "acao",
  "checkout",
] as const;

export type TipoEtapa = (typeof TIPOS_ETAPA)[number];

export const ETAPA_LABEL: Record<TipoEtapa, string> = {
  orientacao: "Orientação inicial",
  preparacao: "Preparação do ambiente",
  checkin_inicial: "Check-in emocional",
  compreensao: "Compreensão do tema",
  aterramento: "Aterramento e presença",
  meditacao: "Meditação guiada",
  movimento: "Movimento sistêmico",
  integracao: "Integração e escrita",
  acao: "Ação alinhada",
  checkout: "Check-out e encerramento",
};

export const ETAPA_DESCRICAO: Record<TipoEtapa, string> = {
  orientacao: "Explica o que será trabalhado e o que esperar da trilha.",
  preparacao: "Prepara o corpo, o tempo e o lugar antes de começar.",
  checkin_inicial: "Registra como a pessoa chega: emoção, intensidade e intenção.",
  compreensao: "Traz contexto e clareza sobre o tema da trilha.",
  aterramento: "Volta ao presente com respiração e percepção do corpo.",
  meditacao: "Prática guiada em áudio ou vídeo.",
  movimento: "Exercício sistêmico de percepção e reposicionamento.",
  integracao: "Espaço de escrita e reflexão sobre o que se moveu.",
  acao: "Um passo concreto e possível para a semana.",
  checkout: "Encerramento cuidadoso do encontro consigo.",
};

/** Etapas que exigem check-in estruturado em vez de conteúdo de mídia. */
export function ehEtapaDeCheckin(tipo: TipoEtapa | null | undefined): boolean {
  return tipo === "checkin_inicial" || tipo === "checkout";
}

export const NIVEIS = ["leve", "intermediario", "profundo"] as const;
export type Nivel = (typeof NIVEIS)[number];

export const NIVEL_LABEL: Record<Nivel, string> = {
  leve: "Leve",
  intermediario: "Intermediário",
  profundo: "Profundo",
};

export const NIVEL_DESCRICAO: Record<Nivel, string> = {
  leve: "Percepção e organização, com pouca mobilização emocional.",
  intermediario: "Reconhecimento de padrões e movimentos de reposicionamento.",
  profundo: "Temas sensíveis; recomendado acompanhamento próximo.",
};

export const STATUS_TRILHA = ["rascunho", "em_revisao", "publicado", "arquivado"] as const;
export type StatusTrilha = (typeof STATUS_TRILHA)[number];

export const STATUS_TRILHA_LABEL: Record<StatusTrilha, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  publicado: "Publicado",
  arquivado: "Arquivado",
};

export const STATUS_ATRIBUICAO = ["ativa", "pausada", "concluida", "encerrada"] as const;
export type StatusAtribuicao = (typeof STATUS_ATRIBUICAO)[number];

export const STATUS_ATRIBUICAO_LABEL: Record<StatusAtribuicao, string> = {
  ativa: "Ativa",
  pausada: "Pausada",
  concluida: "Concluída",
  encerrada: "Encerrada",
};

export const FREQUENCIAS = [
  "Livre, no seu ritmo",
  "Uma vez por semana",
  "Duas vezes por semana",
  "Dias alternados",
  "Diariamente",
] as const;

/** Emoções sugeridas no check-in — lista curta, sem linguagem de diagnóstico. */
export const EMOCOES = [
  "Calma",
  "Ansiedade",
  "Tristeza",
  "Raiva",
  "Medo",
  "Cansaço",
  "Alívio",
  "Gratidão",
  "Confusão",
  "Coragem",
] as const;

export const LOCAIS_CORPO = [
  "Cabeça",
  "Garganta",
  "Peito",
  "Estômago",
  "Barriga",
  "Costas",
  "Ombros",
  "Pernas",
  "Não percebi",
] as const;

export const CONSENTIMENTOS = ["termos", "privacidade", "acompanhamento"] as const;
export type TipoConsentimento = (typeof CONSENTIMENTOS)[number];

export const CONSENTIMENTO_LABEL: Record<TipoConsentimento, string> = {
  termos: "Li e aceito os termos de uso deste espaço.",
  privacidade:
    "Entendo como meus registros são guardados e que o diário marcado como “somente eu” não é lido pela terapeuta.",
  acompanhamento:
    "Entendo que este app é um apoio entre sessões e não substitui atendimento profissional nem serve para emergências.",
};

export const VERSAO_CONSENTIMENTO = "1";
