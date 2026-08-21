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
  const base =
    h < 5
      ? "Boa madrugada"
      : h < 12
        ? "Bom dia"
        : h < 18
          ? "Boa tarde"
          : "Boa noite";
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
