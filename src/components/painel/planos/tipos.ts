import type { Nivel } from "@/lib/etapas";

/** Uma etapa do plano, já com os ajustes desta pessoa. */
export type EtapaEditavel = {
  chave: string;
  conteudoId: string | null;
  titulo: string;
  descricao: string;
  duracaoSegundos: number;
  obrigatoria: boolean;
  visivel: boolean;
  permiteRepetir: boolean;
  prazoDias: number | null;
  personalizada: boolean;
};

export type EstadoPlano = {
  id?: string;
  clienteId: string;
  trilhaId: string;
  objetivo: string;
  motivoIndicacao: string;
  mensagem: string;
  audioPath: string | null;
  orientacoesEspeciais: string;
  frequencia: string;
  dataInicio: string;
  dataRevisao: string;
  lembretesAtivos: boolean;
  nivel: Nivel;
  podeSozinho: boolean;
  exigeAcompanhamento: boolean;
  somenteEmSessao: boolean;
  permiteRepetir: boolean;
  observacoes: string;
  etapas: EtapaEditavel[];
};

export type ConteudoTrilha = {
  id: string;
  trilha_id: string | null;
  titulo: string;
  descricao: string;
  duracao_segundos: number;
  ordem: number;
  obrigatoria: boolean;
  permite_repetir: boolean;
};

export function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function planoVazio(clienteId = ""): EstadoPlano {
  return {
    clienteId,
    trilhaId: "",
    objetivo: "",
    motivoIndicacao: "",
    mensagem: "",
    audioPath: null,
    orientacoesEspeciais: "",
    frequencia: "Livre, no seu ritmo",
    dataInicio: hojeISO(),
    dataRevisao: "",
    lembretesAtivos: false,
    nivel: "leve",
    podeSozinho: true,
    exigeAcompanhamento: false,
    somenteEmSessao: false,
    permiteRepetir: true,
    observacoes: "",
    etapas: [],
  };
}

/** Etapas da trilha escolhida, na ordem original, prontas para personalizar. */
export function etapasDaTrilha(conteudos: ConteudoTrilha[], trilhaId: string): EtapaEditavel[] {
  return conteudos
    .filter((c) => c.trilha_id === trilhaId)
    .sort((a, b) => a.ordem - b.ordem)
    .map((c) => ({
      chave: c.id,
      conteudoId: c.id,
      titulo: c.titulo,
      descricao: c.descricao,
      duracaoSegundos: c.duracao_segundos,
      obrigatoria: c.obrigatoria,
      visivel: true,
      permiteRepetir: c.permite_repetir,
      prazoDias: null,
      personalizada: false,
    }));
}

/** Converte o estado do assistente no formato aceito pelo servidor. */
export function montarEnvio(
  plano: EstadoPlano,
  acao: "rascunho" | "liberar" | "agendar",
  liberarEm?: string | null,
) {
  return {
    ...(plano.id ? { id: plano.id } : {}),
    clienteId: plano.clienteId,
    trilhaId: plano.trilhaId,
    objetivo: plano.objetivo,
    motivoIndicacao: plano.motivoIndicacao,
    mensagem: plano.mensagem,
    audioPath: plano.audioPath,
    orientacoesEspeciais: plano.orientacoesEspeciais,
    frequencia: plano.frequencia,
    dataInicio: plano.dataInicio,
    dataRevisao: plano.dataRevisao || null,
    lembretesAtivos: plano.lembretesAtivos,
    nivel: plano.nivel,
    podeSozinho: plano.podeSozinho,
    exigeAcompanhamento: plano.exigeAcompanhamento,
    somenteEmSessao: plano.somenteEmSessao,
    permiteRepetir: plano.permiteRepetir,
    observacoes: plano.observacoes,
    acao,
    liberarEm: acao === "agendar" && liberarEm ? new Date(liberarEm).toISOString() : null,
    etapas: plano.etapas.map((e, indice) => ({
      conteudoId: e.conteudoId,
      ordem: indice,
      obrigatoria: e.obrigatoria,
      visivel: e.visivel,
      permiteRepetir: e.permiteRepetir,
      prazoDias: e.prazoDias,
      tituloPersonalizado: e.personalizada ? e.titulo : "",
      descricaoPersonalizada: e.personalizada ? e.descricao : "",
    })),
  };
}
