/**
 * Regras do Diário do cliente — módulo puro (sem React, sem rede).
 *
 * Guarda os convites de escrita, as palavras de sentimento, o agrupamento das
 * entradas por mês e os filtros de busca. Isolar isto aqui deixa a tela só com
 * a composição e permite testar o comportamento sem montar componentes.
 */

export type Visibilidade = "somente_eu" | "compartilhado";

export type EntradaDiario = {
  id: string;
  texto: string;
  created_at: string;
  conteudo_id: string | null;
  atribuicao_id?: string | null;
  visibilidade?: string | null;
  compartilhado_em?: string | null;
  compartilhamento_revogado_em?: string | null;
  conteudos?: { titulo?: string | null; eixos?: { nome?: string | null } | null } | null;
};

/** Convites de escrita: perguntas que abrem, sem dirigir a resposta. */
export const CONVITES = [
  "O que se moveu no seu corpo durante a prática?",
  "Que imagem ou lembrança apareceu com mais força hoje?",
  "O que você reconhece hoje que ontem ainda não conseguia?",
  "Se pudesse dizer uma frase a alguém do seu sistema, qual seria?",
  "Do que você quer se despedir com gratidão?",
  "Qual foi o gesto de cuidado que você fez por você nesta semana?",
  "O que pede espaço em você e ainda não teve vez de ser dito?",
  "Onde, no seu dia, você sentiu chão firme?",
] as const;

/** Escolhe um convite de forma estável a partir de um índice qualquer. */
export function convitePorIndice(indice: number) {
  const total = CONVITES.length;
  const posicao = ((Math.trunc(indice) % total) + total) % total;
  return CONVITES[posicao];
}

/** Convite do dia: muda ao virar o dia, mas se mantém enquanto o dia é o mesmo. */
export function conviteDoDia(data = new Date()) {
  const dias = Math.floor(
    Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) / 86_400_000,
  );
  return convitePorIndice(dias);
}

/** Palavras para nomear o que ficou; opcionais e sempre em primeira pessoa. */
export const SENTIMENTOS = [
  { chave: "calma", rotulo: "Calma", emoji: "🌿" },
  { chave: "gratidao", rotulo: "Gratidão", emoji: "🤲" },
  { chave: "alivio", rotulo: "Alívio", emoji: "💧" },
  { chave: "saudade", rotulo: "Saudade", emoji: "🕯️" },
  { chave: "medo", rotulo: "Medo", emoji: "🌑" },
  { chave: "raiva", rotulo: "Raiva", emoji: "🔥" },
  { chave: "tristeza", rotulo: "Tristeza", emoji: "🌧️" },
  { chave: "coragem", rotulo: "Coragem", emoji: "🌱" },
] as const;

export type ChaveSentimento = (typeof SENTIMENTOS)[number]["chave"];

/** Monta o texto final acrescentando, se houver, a linha do sentimento. */
export function comporTexto(texto: string, sentimentos: string[]) {
  const limpo = texto.trim();
  if (sentimentos.length === 0) return limpo;
  const rotulos = SENTIMENTOS.filter((s) => sentimentos.includes(s.chave)).map((s) => s.rotulo);
  if (rotulos.length === 0) return limpo;
  return `${limpo}\n\nSenti: ${rotulos.join(", ")}.`;
}

/** "hoje", "ontem", "há 3 dias", ou a data quando já ficou distante. */
export function tempoRelativo(iso: string | null | undefined, agora = new Date()) {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.round((dia(agora) - dia(data)) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 14) return "há uma semana";
  if (dias < 31) return `há ${Math.floor(dias / 7)} semanas`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function ehCompartilhada(entrada: EntradaDiario) {
  return entrada.visibilidade === "compartilhado";
}

export const FILTROS_DIARIO = ["todas", "privadas", "compartilhadas", "praticas"] as const;
export type FiltroDiario = (typeof FILTROS_DIARIO)[number];

export const FILTRO_DIARIO_LABEL: Record<FiltroDiario, string> = {
  todas: "Todas",
  privadas: "Só minhas",
  compartilhadas: "Compartilhadas",
  praticas: "De práticas",
};

/** Aplica busca por palavra, filtro escolhido e (opcional) recorte por eixo. */
export function filtrarEntradas(
  entradas: EntradaDiario[],
  { busca = "", filtro = "todas" as FiltroDiario, eixoId = null as string | null } = {},
) {
  const termo = busca.trim().toLowerCase();
  return entradas.filter((entrada) => {
    if (filtro === "privadas" && ehCompartilhada(entrada)) return false;
    if (filtro === "compartilhadas" && !ehCompartilhada(entrada)) return false;
    if (filtro === "praticas" && !entrada.conteudo_id) return false;
    if (eixoId && !eixosDaEntrada(entrada).some((e) => e.id === eixoId)) return false;
    if (!termo) return true;
    const tags = eixosDaEntrada(entrada)
      .map((e) => e.nome)
      .join(" ");
    const alvo = `${entrada.texto} ${entrada.conteudos?.titulo ?? ""} ${
      entrada.conteudos?.eixos?.nome ?? ""
    } ${tags}`.toLowerCase();
    return alvo.includes(termo);
  });
}


export type GrupoMes = { chave: string; rotulo: string; entradas: EntradaDiario[] };

/** Agrupa por mês, mantendo a ordem (mais recente primeiro) que já vem do banco. */
export function agruparPorMes(entradas: EntradaDiario[]): GrupoMes[] {
  const grupos: GrupoMes[] = [];
  for (const entrada of entradas) {
    const data = new Date(entrada.created_at);
    if (Number.isNaN(data.getTime())) continue;
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    const existente = grupos.find((g) => g.chave === chave);
    if (existente) {
      existente.entradas.push(entrada);
      continue;
    }
    const rotulo = data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    grupos.push({ chave, rotulo: rotulo.charAt(0).toUpperCase() + rotulo.slice(1), entradas: [entrada] });
  }
  return grupos;
}

export type ResumoDiario = {
  total: number;
  compartilhadas: number;
  ultimaEm: string | null;
  diasEscrevendo: number;
  frase: string;
};

/** Números de acolhimento do cabeçalho — nunca cobrança, só reconhecimento. */
export function resumoDoDiario(entradas: EntradaDiario[], agora = new Date()): ResumoDiario {
  const total = entradas.length;
  const compartilhadas = entradas.filter(ehCompartilhada).length;
  const datas = entradas
    .map((e) => e.created_at)
    .filter(Boolean)
    .sort();
  const ultimaEm = datas.at(-1) ?? null;
  const dias = new Set(
    datas.map((iso) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  ).size;

  const relativo = tempoRelativo(ultimaEm, agora);
  const frase =
    total === 0
      ? "Este é um lugar só seu. Nada aqui precisa ficar bonito — só verdadeiro."
      : relativo === "hoje"
        ? "Você já se escutou hoje. Fica com isso o tempo que precisar."
        : `Sua última escuta foi ${relativo}. Quando quiser, o espaço continua aberto.`;

  return { total, compartilhadas, ultimaEm, diasEscrevendo: dias, frase };
}

/** Recorta textos longos para o cartão, sem cortar palavra no meio. */
export function recortar(texto: string, limite = 320) {
  if (texto.length <= limite) return { trecho: texto, cortado: false };
  const bruto = texto.slice(0, limite);
  const corte = bruto.lastIndexOf(" ");
  return { trecho: `${bruto.slice(0, corte > 120 ? corte : limite)}…`, cortado: true };
}

/** Chave do rascunho local, separada por prática de origem. */
export function chaveRascunho(conteudoId?: string | null) {
  return `raiz-diario-rascunho-${conteudoId ?? "livre"}`;
}
