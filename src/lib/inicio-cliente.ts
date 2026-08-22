/**
 * Regras puras da aba "Início" do cliente: como saudar, o que convidar a fazer
 * hoje e como escrever a data. Nada de rede aqui — só decisões de conteúdo,
 * para poderem ser testadas isoladamente.
 */

export type Saudacao = { titulo: string; frase: string };

/** Saudação pela hora local, com uma frase curta de acolhimento. */
export function saudacaoDoDia(agora: Date = new Date(), primeiroNome = ""): Saudacao {
  const h = agora.getHours();
  const nome = primeiroNome.trim();
  const base = h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const frase =
    h < 5
      ? "A noite também acolhe. Vá com calma."
      : h < 12
        ? "Comece devagar. Um passo já é caminho."
        : h < 18
          ? "Respire. O que precisa ser cuidado espera por você."
          : "Hora de recolher o dia com gentileza.";
  return { titulo: nome ? `${base}, ${nome}` : base, frase };
}

/** Data em texto longo e humano: "sexta-feira, 21 de agosto". */
export function dataLonga(agora: Date = new Date()) {
  return agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export type PraticaBase = {
  id: string;
  eixoId: string;
  eixoNome: string;
  tipo: string;
  titulo: string;
  duracaoSegundos: number;
  status: string;
};

export type Retomada = {
  id: string;
  eixoNome: string;
  tipo: string;
  titulo: string;
  duracaoSegundos: number;
  posicaoSegundos: number;
};

export type ConviteDeHoje =
  | { estado: "retomar"; pratica: Retomada }
  | { estado: "comecar"; pratica: PraticaBase }
  | { estado: "nada" }
  | { estado: "ciclo_fechado" };

/**
 * O convite do dia: retomar o que ficou no meio, começar a próxima prática
 * pendente, celebrar o ciclo fechado ou avisar que ainda não há nada liberado.
 */
export function conviteDeHoje({
  praticas = [],
  retomar = null,
}: {
  praticas?: readonly PraticaBase[];
  retomar?: Retomada | null;
}): ConviteDeHoje {
  if (retomar && retomar.posicaoSegundos > 0) return { estado: "retomar", pratica: retomar };
  const proxima = praticas.find((p) => p.status !== "concluido");
  if (proxima) return { estado: "comecar", pratica: proxima };
  if (praticas.length > 0) return { estado: "ciclo_fechado" };
  return { estado: "nada" };
}

/** Quantas práticas foram concluídas nos últimos 7 dias (inclusive hoje). */
export function praticasNaSemana(datas: readonly string[], agora: Date = new Date()) {
  const limite = agora.getTime() - 6 * 86_400_000;
  const inicioDoDia = new Date(limite);
  inicioDoDia.setHours(0, 0, 0, 0);
  return datas.filter((d) => {
    const t = new Date(d).getTime();
    return Number.isFinite(t) && t >= inicioDoDia.getTime();
  }).length;
}

export type EixoAfinidade = {
  id: string;
  nome: string;
  liberado: boolean;
  concluidos: number;
  total: number;
  datasConclusao?: readonly string[];
};

export type Ciclo = {
  /** semana do processo, começando em 1 */
  semana: number;
  rotulo: string;
  frase: string;
};

/**
 * Em que ponto do processo a pessoa está: semana desde o início do
 * acompanhamento e uma frase que muda conforme o quanto já caminhou.
 */
export function cicloAtual({
  inicioEm,
  concluidos = 0,
  total = 0,
  agora = new Date(),
}: {
  inicioEm?: string | null;
  concluidos?: number;
  total?: number;
  agora?: Date;
}): Ciclo {
  const inicio = inicioEm ? new Date(inicioEm).getTime() : NaN;
  const dias = Number.isFinite(inicio)
    ? Math.max(0, Math.floor((agora.getTime() - inicio) / 86_400_000))
    : 0;
  const semana = Math.floor(dias / 7) + 1;
  const proporcao = total > 0 ? concluidos / total : 0;
  const frase =
    total === 0
      ? "Seu ciclo está sendo preparado."
      : proporcao === 0
        ? "Começo de ciclo: o primeiro passo é o mais importante."
        : proporcao < 0.5
          ? "Você está no meio do caminho deste ciclo."
          : proporcao < 1
            ? "Reta final deste ciclo — siga no seu tempo."
            : "Ciclo completo. Descanse no que foi movido.";
  return { semana, rotulo: `Semana ${semana} do seu ciclo`, frase };
}

/**
 * Preferência de eixos: aquele em que a pessoa mais concluiu práticas
 * (empate desfeito pela conclusão mais recente). Serve para dar destaque
 * ao tema que ela vem sustentando.
 */
export function eixoPreferido(eixos: readonly EixoAfinidade[]): EixoAfinidade | null {
  const candidatos = eixos.filter((e) => e.liberado && e.concluidos > 0);
  if (candidatos.length === 0) return null;
  const recencia = (e: EixoAfinidade) =>
    (e.datasConclusao ?? []).reduce((maior, d) => {
      const t = new Date(d).getTime();
      return Number.isFinite(t) && t > maior ? t : maior;
    }, 0);
  return [...candidatos].sort(
    (a, b) => b.concluidos - a.concluidos || recencia(b) - recencia(a),
  )[0]!;
}

/**
 * Ordena os eixos pela afinidade: o escolhido para destaque primeiro, depois os
 * marcados como preferidos, então o de maior histórico e, no fim, os fechados.
 */
export function ordenarPorAfinidade<T extends EixoAfinidade>(
  eixos: readonly T[],
  escolhas: Escolhas = {},
): T[] {
  const preferido = eixoEmDestaque(eixos, escolhas);
  const marcados = new Set(escolhas.preferidos ?? []);
  const peso = (e: T) => {
    if (preferido && e.id === preferido.id) return 0;
    if (marcados.has(e.id)) return 1;
    return 2;
  };
  return [...eixos].sort((a, b) => {
    if (a.liberado !== b.liberado) return a.liberado ? -1 : 1;
    return peso(a) - peso(b);
  });
}

export type Escolhas = {
  /** eixo que a pessoa escolheu ver em destaque no Início */
  destaqueId?: string | null;
  /** eixos marcados como preferidos na tela de preferências */
  preferidos?: readonly string[];
};

/**
 * O eixo em destaque: a escolha explícita da pessoa vence; depois um preferido
 * marcado; por último a afinidade calculada pelo histórico.
 */
export function eixoEmDestaque<T extends EixoAfinidade>(
  eixos: readonly T[],
  { destaqueId = null, preferidos = [] }: Escolhas = {},
): T | null {
  const escolhido = destaqueId ? eixos.find((e) => e.id === destaqueId && e.liberado) : null;
  if (escolhido) return escolhido;
  const marcado = eixos.find((e) => e.liberado && preferidos.includes(e.id));
  if (marcado) return marcado;
  return (eixoPreferido(eixos) as T | undefined) ?? null;
}

export type Recompensa = {
  /** palavra curta do selo ganho */
  selo: string;
  titulo: string;
  frase: string;
  marcos: Array<{ rotulo: string; valor: string }>;
  /** true quando a meta da semana foi alcançada agora */
  metaAlcancada: boolean;
};

/**
 * O que dizer quando a pessoa acaba de concluir uma prática: um selo simples,
 * uma frase de acolhimento e as marcações do ritmo (semana, meta, sequência).
 */
export function recompensaDaConclusao({
  totalConcluidos = 0,
  feitasNaSemana = 0,
  metaSemanal = 3,
  streakSemanas = 0,
  primeiroNome = "",
}: {
  totalConcluidos?: number;
  feitasNaSemana?: number;
  metaSemanal?: number;
  streakSemanas?: number;
  primeiroNome?: string;
}): Recompensa {
  const nome = primeiroNome.trim();
  const meta = Math.max(1, metaSemanal);
  const metaAlcancada = feitasNaSemana >= meta;
  const selo =
    totalConcluidos <= 1
      ? "Primeira semente"
      : metaAlcancada
        ? "Semana cuidada"
        : streakSemanas >= 4
          ? "Raiz firme"
          : "Passo dado";
  const titulo =
    totalConcluidos <= 1
      ? nome
        ? `Você começou, ${nome}`
        : "Você começou"
      : metaAlcancada
        ? "Sua meta da semana está cumprida"
        : "Mais um passo no seu caminho";
  const frase = metaAlcancada
    ? "Você sustentou o combinado desta semana. O que vier agora é acréscimo, não obrigação."
    : totalConcluidos <= 1
      ? "Toda mudança começa por um gesto pequeno como este. Guarde o que sentiu."
      : "O corpo aprende pela repetição gentil. Volte quando fizer sentido para você.";
  return {
    selo,
    titulo,
    frase,
    metaAlcancada,
    marcos: [
      { rotulo: "Nesta semana", valor: `${feitasNaSemana} de ${meta}` },
      {
        rotulo: "Sequência",
        valor: `${streakSemanas} ${streakSemanas === 1 ? "semana" : "semanas"}`,
      },
      { rotulo: "No total", valor: `${totalConcluidos}` },
    ],
  };
}
