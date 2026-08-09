/**
 * Regras da aba "Início" do painel — sem I/O, para poder testar em unidade.
 *
 * Tudo aqui recebe os dados crus que `adminInicio` traz do banco e devolve o
 * que a tela mostra: resumo, prioridades do dia, agenda de revisões e linha do
 * tempo. Nenhuma função interpreta o estado emocional de ninguém: a linguagem é
 * factual ("solicitou contato", "precisa de acompanhamento").
 */

export const FUSO_PADRAO = "America/Sao_Paulo";

/* --------------------------------------------------------------- datas */

/** Data local (YYYY-MM-DD) de um instante, no fuso informado. */
export function dataLocal(instante: string | Date, fuso = FUSO_PADRAO): string {
  const d = typeof instante === "string" ? new Date(instante) : instante;
  if (Number.isNaN(d.getTime())) return "";
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return partes;
}

/** Soma dias a uma data local YYYY-MM-DD (comparável por texto). */
export function somarDias(data: string, dias: number): string {
  const base = new Date(`${data}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Semana corrente (segunda a domingo) da data local informada. */
export function semanaDe(hoje: string): { inicio: string; fim: string } {
  const d = new Date(`${hoje}T12:00:00Z`);
  const diaSemana = d.getUTCDay(); // 0 = domingo
  const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana;
  const inicio = somarDias(hoje, deslocamento);
  return { inicio, fim: somarDias(inicio, 6) };
}

/** Data por extenso para o cabeçalho: "sábado, 9 de agosto de 2026". */
export function dataExtensa(instante: Date = new Date(), fuso = FUSO_PADRAO): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(instante);
}

/** "há 2 dias", "hoje" — sem precisão falsa de horário. */
export function quandoRelativo(instante: string | null | undefined, agora = new Date()): string {
  if (!instante) return "";
  const dias = Math.round(
    (Date.parse(`${dataLocal(agora)}T12:00:00Z`) - Date.parse(`${dataLocal(instante)}T12:00:00Z`)) /
      86_400_000,
  );
  if (Number.isNaN(dias)) return "";
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias > 1) return `há ${dias} dias`;
  if (dias === -1) return "amanhã";
  return `em ${Math.abs(dias)} dias`;
}

/** Data curta pt-BR de um YYYY-MM-DD, sem escorregar de fuso. */
export function dataCurta(data: string | null | undefined): string {
  if (!data) return "";
  const [ano, mes, dia] = data.split("-");
  if (!ano || !mes || !dia) return "";
  return `${dia}/${mes}/${ano}`;
}

/* --------------------------------------------------------------- dados */

export type ClienteInicio = {
  id: string;
  nome: string;
  email: string;
  status: string;
};

export type AtribuicaoInicio = {
  id: string;
  cliente_id: string;
  terapeuta_id: string | null;
  trilha_id: string;
  objetivo: string;
  status: string;
  data_inicio: string;
  data_revisao: string | null;
  created_at: string;
  updated_at: string;
};

export type RevisaoInicio = {
  id: string;
  cliente_id: string;
  atribuicao_id: string;
  devolutiva: string;
  created_at: string;
};

export type ApoioInicio = {
  id: string;
  cliente_id: string;
  status: string;
  origem: string;
  created_at: string;
};

export type ConviteInicio = {
  id: string;
  email: string;
  nome: string;
  status: string;
  expira_em: string;
  created_at: string;
};

const EM_CURSO: string[] = ["aguardando_inicio", "em_andamento", "aguardando_revisao"];

export type EtapaInicio = { atribuicao_id: string; concluida_em: string | null };
export type PraticaInicio = { cliente_id: string; concluido_em: string | null };
export type CompartilhadoInicio = { id: string; cliente_id: string; compartilhado_em: string | null };

export type DadosInicio = {
  clientes: ClienteInicio[];
  atribuicoes: AtribuicaoInicio[];
  trilhas: { id: string; nome: string }[];
  revisoes: RevisaoInicio[];
  apoio: ApoioInicio[];
  convites: ConviteInicio[];
  etapas: EtapaInicio[];
  praticas: PraticaInicio[];
  compartilhados: CompartilhadoInicio[];
  perfis: { id: string; nome: string | null; email: string | null }[];
};

const STATUS_APOIO_PENDENTE = ["aberta", "em_atendimento"];

export function nomeDe(
  perfis: DadosInicio["perfis"],
  id: string | null | undefined,
): string {
  if (!id) return "Não atribuído";
  const p = perfis.find((x) => x.id === id);
  return p?.nome?.trim() || p?.email?.trim() || "Cliente";
}

/* --------------------------------------------------------------- resumo */

export type CartaoResumo = {
  id: string;
  label: string;
  valor: number;
  vazio: string;
  para: string;
};

export function montarResumo(dados: DadosInicio, agora = new Date()): CartaoResumo[] {
  const hoje = dataLocal(agora);
  const { inicio, fim } = semanaDe(hoje);
  const limiteRecente = somarDias(hoje, -7);

  const emAndamento = dados.atribuicoes.filter(
    (a) => EM_CURSO.includes(a.status) && a.data_inicio <= hoje,
  ).length;
  const revisoesSemana = dados.atribuicoes.filter(
    (a) => a.data_revisao && a.data_revisao >= inicio && a.data_revisao <= fim,
  ).length;
  const aguardandoInicio = dados.atribuicoes.filter(
    (a) => EM_CURSO.includes(a.status) && a.data_inicio > hoje,
  ).length;
  const recentes =
    dados.praticas.filter((p) => p.concluido_em && dataLocal(p.concluido_em) >= limiteRecente)
      .length +
    dados.etapas.filter((e) => e.concluida_em && dataLocal(e.concluida_em) >= limiteRecente).length;

  return [
    {
      id: "clientes",
      label: "Clientes ativos",
      valor: dados.clientes.filter((c) => c.status === "ativo").length,
      vazio: "Nenhum cliente ativo ainda",
      para: "/admin",
    },
    {
      id: "trilhas",
      label: "Trilhas em andamento",
      valor: emAndamento,
      vazio: "Nenhuma trilha em curso",
      para: "/admin/clientes",
    },
    {
      id: "revisoes",
      label: "Revisões desta semana",
      valor: revisoesSemana,
      vazio: "Nenhuma revisão marcada",
      para: "/admin/acompanhamento",
    },
    {
      id: "apoio",
      label: "Solicitações de apoio",
      valor: dados.apoio.filter((a) => STATUS_APOIO_PENDENTE.includes(a.status)).length,
      vazio: "Nenhuma pendente",
      para: "/admin/acompanhamento",
    },
    {
      id: "aguardando",
      label: "Planos aguardando início",
      valor: aguardandoInicio,
      vazio: "Nenhum plano agendado",
      para: "/admin/clientes",
    },
    {
      id: "atividades",
      label: "Atividades concluídas (7 dias)",
      valor: recentes,
      vazio: "Nenhuma atividade recente",
      para: "/admin/acompanhamento",
    },
  ];
}

/* ---------------------------------------------------------- prioridades */

export type TipoPrioridade = "apoio" | "revisao" | "devolutiva" | "plano" | "convite";

export type Prioridade = {
  id: string;
  tipo: TipoPrioridade;
  titulo: string;
  detalhe: string;
  quando: string;
  clienteId: string | null;
  para: string;
};

const PESO: Record<TipoPrioridade, number> = {
  apoio: 0,
  revisao: 1,
  devolutiva: 2,
  plano: 3,
  convite: 4,
};

export const ROTULO_PRIORIDADE: Record<TipoPrioridade, string> = {
  apoio: "Solicitou contato",
  revisao: "Revisão prevista",
  devolutiva: "Aguardando devolutiva",
  plano: "Plano precisa de atenção",
  convite: "Convite não aceito",
};

export function montarPrioridades(dados: DadosInicio, agora = new Date()): Prioridade[] {
  const hoje = dataLocal(agora);
  const limiteRevisao = somarDias(hoje, 7);
  const trilhaPorId = new Map(dados.trilhas.map((t) => [t.id, t.nome]));
  const atribuicaoPorId = new Map(dados.atribuicoes.map((a) => [a.id, a]));
  const itens: Prioridade[] = [];

  for (const a of dados.apoio.filter((x) => STATUS_APOIO_PENDENTE.includes(x.status))) {
    itens.push({
      id: `apoio-${a.id}`,
      tipo: "apoio",
      titulo: nomeDe(dados.perfis, a.cliente_id),
      detalhe:
        a.status === "em_atendimento"
          ? "Solicitou contato — em atendimento"
          : "Solicitou contato e aguarda resposta",
      quando: quandoRelativo(a.created_at, agora),
      clienteId: a.cliente_id,
      para: "/admin/acompanhamento",
    });
  }

  for (const a of dados.atribuicoes) {
    if (!a.data_revisao) continue;
    if (!EM_CURSO.includes(a.status)) continue;
    if (a.data_revisao > limiteRevisao) continue;
    const vencida = a.data_revisao < hoje;
    itens.push({
      id: `revisao-${a.id}`,
      tipo: "revisao",
      titulo: nomeDe(dados.perfis, a.cliente_id),
      detalhe: vencida
        ? `Precisa de acompanhamento — revisão era ${dataCurta(a.data_revisao)}`
        : `Revisão prevista para ${dataCurta(a.data_revisao)} · ${trilhaPorId.get(a.trilha_id) ?? "trilha"}`,
      quando: quandoRelativo(`${a.data_revisao}T12:00:00Z`, agora),
      clienteId: a.cliente_id,
      para: "/admin/acompanhamento",
    });
  }

  for (const r of dados.revisoes.filter((x) => !x.devolutiva.trim())) {
    const atr = atribuicaoPorId.get(r.atribuicao_id);
    itens.push({
      id: `devolutiva-${r.id}`,
      tipo: "devolutiva",
      titulo: nomeDe(dados.perfis, r.cliente_id),
      detalhe: `Registrou uma revisão de ${atr ? (trilhaPorId.get(atr.trilha_id) ?? "trilha") : "trilha"} e aguarda devolutiva`,
      quando: quandoRelativo(r.created_at, agora),
      clienteId: r.cliente_id,
      para: "/admin/acompanhamento",
    });
  }

  for (const a of dados.atribuicoes) {
    const vencido = EM_CURSO.includes(a.status) && a.data_revisao !== null && a.data_revisao < hoje;
    if (a.status !== "pausado" && !vencido) continue;
    itens.push({
      id: `plano-${a.id}`,
      tipo: "plano",
      titulo: nomeDe(dados.perfis, a.cliente_id),
      detalhe:
        a.status === "pausado"
          ? `Plano pausado · ${trilhaPorId.get(a.trilha_id) ?? "trilha"}`
          : `Plano com revisão vencida em ${dataCurta(a.data_revisao)}`,
      quando: quandoRelativo(a.updated_at, agora),
      clienteId: a.cliente_id,
      para: "/admin/clientes",
    });
  }

  for (const c of dados.convites.filter((x) => x.status === "pendente")) {
    const expirado = Date.parse(c.expira_em) < agora.getTime();
    itens.push({
      id: `convite-${c.id}`,
      tipo: "convite",
      titulo: c.nome?.trim() || c.email,
      detalhe: expirado ? "Convite expirou sem ser aceito" : "Convite enviado e ainda não aceito",
      quando: quandoRelativo(c.created_at, agora),
      clienteId: null,
      para: "/admin/clientes",
    });
  }

  return itens.sort((a, b) => PESO[a.tipo] - PESO[b.tipo] || a.titulo.localeCompare(b.titulo));
}

/* -------------------------------------------------------------- agenda */

export type ItemAgenda = {
  id: string;
  clienteId: string;
  cliente: string;
  trilha: string;
  objetivo: string;
  data: string;
  responsavel: string;
  atrasada: boolean;
};

export function montarAgenda(dados: DadosInicio, agora = new Date(), limite = 8): ItemAgenda[] {
  const hoje = dataLocal(agora);
  const trilhaPorId = new Map(dados.trilhas.map((t) => [t.id, t.nome]));

  return dados.atribuicoes
    .filter((a) => a.data_revisao && a.status !== "encerrado" && a.status !== "concluido" && a.status !== "rascunho")
    .sort((a, b) => String(a.data_revisao).localeCompare(String(b.data_revisao)))
    .slice(0, limite)
    .map((a) => ({
      id: a.id,
      clienteId: a.cliente_id,
      cliente: nomeDe(dados.perfis, a.cliente_id),
      trilha: trilhaPorId.get(a.trilha_id) ?? "Trilha",
      objetivo: resumirObjetivo(a.objetivo),
      data: dataCurta(a.data_revisao),
      responsavel: a.terapeuta_id ? nomeDe(dados.perfis, a.terapeuta_id) : "Não atribuído",
      atrasada: Boolean(a.data_revisao && a.data_revisao < hoje),
    }));
}

/** Objetivo em uma linha, sem cortar palavra no meio. */
export function resumirObjetivo(texto: string, maximo = 90): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (!limpo) return "Objetivo não descrito";
  if (limpo.length <= maximo) return limpo;
  const corte = limpo.slice(0, maximo);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > 40 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
}

/* -------------------------------------------------------- linha do tempo */

export type TipoEvento =
  | "trilha_iniciada"
  | "etapa_concluida"
  | "registro_compartilhado"
  | "apoio"
  | "plano_pausado"
  | "plano_finalizado";

export type Evento = {
  id: string;
  tipo: TipoEvento;
  cliente: string;
  clienteId: string | null;
  descricao: string;
  em: string;
  quando: string;
};

export const ROTULO_EVENTO: Record<TipoEvento, string> = {
  trilha_iniciada: "Trilha iniciada",
  etapa_concluida: "Etapa concluída",
  registro_compartilhado: "Registro compartilhado",
  apoio: "Solicitação de apoio",
  plano_pausado: "Plano pausado",
  plano_finalizado: "Plano finalizado",
};

export function montarLinhaDoTempo(dados: DadosInicio, agora = new Date(), limite = 12): Evento[] {
  const trilhaPorId = new Map(dados.trilhas.map((t) => [t.id, t.nome]));
  const atribuicaoPorId = new Map(dados.atribuicoes.map((a) => [a.id, a]));
  const eventos: Evento[] = [];

  const push = (
    id: string,
    tipo: TipoEvento,
    clienteId: string | null,
    descricao: string,
    em: string | null,
  ) => {
    if (!em) return;
    eventos.push({
      id,
      tipo,
      clienteId,
      cliente: clienteId ? nomeDe(dados.perfis, clienteId) : "—",
      descricao,
      em,
      quando: quandoRelativo(em, agora),
    });
  };

  for (const a of dados.atribuicoes) {
    const trilha = trilhaPorId.get(a.trilha_id) ?? "trilha";
    push(`ini-${a.id}`, "trilha_iniciada", a.cliente_id, `Começou a trilha ${trilha}`, a.created_at);
    if (a.status === "pausado") {
      push(`pau-${a.id}`, "plano_pausado", a.cliente_id, `Plano de ${trilha} pausado`, a.updated_at);
    }
    if (a.status === "concluido" || a.status === "encerrado") {
      push(
        `fim-${a.id}`,
        "plano_finalizado",
        a.cliente_id,
        `Plano de ${trilha} finalizado`,
        a.updated_at,
      );
    }
  }

  for (const e of dados.etapas) {
    const atr = e.atribuicao_id ? atribuicaoPorId.get(e.atribuicao_id) : undefined;
    push(
      `etp-${e.atribuicao_id}-${e.concluida_em}`,
      "etapa_concluida",
      atr?.cliente_id ?? null,
      `Concluiu uma etapa de ${atr ? (trilhaPorId.get(atr.trilha_id) ?? "trilha") : "trilha"}`,
      e.concluida_em,
    );
  }

  for (const d of dados.compartilhados) {
    // Nunca o texto do registro: só o fato de ter sido compartilhado.
    push(
      `dia-${d.id}`,
      "registro_compartilhado",
      d.cliente_id,
      "Compartilhou um registro do diário",
      d.compartilhado_em,
    );
  }

  for (const a of dados.apoio) {
    push(`apo-${a.id}`, "apoio", a.cliente_id, "Solicitou contato", a.created_at);
  }

  return eventos.sort((a, b) => b.em.localeCompare(a.em)).slice(0, limite);
}
