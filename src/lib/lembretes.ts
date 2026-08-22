/**
 * Regras dos lembretes de prática e reflexão.
 * Módulo puro (sem acesso a rede/banco) para poder ser testado e reusado
 * tanto pelo agendador no servidor quanto pela tela de preferências.
 */

/** Chave pública VAPID — pode ficar no código, é enviada ao navegador. */
export const VAPID_PUBLIC_KEY =
  "BH7x4P9NUCoudy-WIvQWTxDgm-c4nnf_oHw0y_hvEfCMSy6cK-pvDiDJgpARzjWA0WkCGmuYXunlEoTEIJ02fxk";

export const TIPOS_LEMBRETE = ["semanal", "inatividade", "reflexao"] as const;
export type TipoLembrete = (typeof TIPOS_LEMBRETE)[number];

export const DIAS_SEMANA_NOME = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export type PreferenciaLembretes = {
  ativo: boolean;
  canal_push: boolean;
  canal_email: boolean;
  /** 0 = domingo … 6 = sábado */
  dia_semana: number;
  /** hora local (0–23) */
  hora_local: number;
  fuso: string;
  dias_inatividade: number;
  definido_por: string;
  /** quando preenchido, nada é enviado até esta data (pausa temporária) */
  silenciado_ate?: string | null;
};

export const PREFERENCIA_PADRAO: PreferenciaLembretes = {
  ativo: false,
  canal_push: true,
  canal_email: true,
  dia_semana: 2,
  hora_local: 19,
  fuso: "America/Sao_Paulo",
  dias_inatividade: 3,
  definido_por: "cliente",
  silenciado_ate: null,
};

/** Opções de pausa oferecidas na central de lembretes. */
export const PAUSAS_LEMBRETE = [7, 14, 30] as const;

/** Pausa temporária ainda vigente? */
export function estaSilenciado(
  prefs: Pick<PreferenciaLembretes, "silenciado_ate">,
  agora = new Date(),
) {
  if (!prefs.silenciado_ate) return false;
  const ate = new Date(prefs.silenciado_ate).getTime();
  if (Number.isNaN(ate)) return false;
  return ate > agora.getTime();
}

/** Data-limite de uma pausa de N dias a partir de agora. */
export function fimDaPausa(dias: number, agora = new Date()) {
  return new Date(agora.getTime() + Math.max(1, Math.trunc(dias)) * 86_400_000).toISOString();
}

export type PartesLocais = {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  /** 0 = domingo … 6 = sábado */
  diaSemana: number;
  /** aaaa-mm-dd no fuso do cliente */
  data: string;
};

const NUMERO = (v: string | undefined) => Number(v ?? "0");

/** Converte um instante para as partes de data/hora no fuso do cliente. */
export function partesLocais(agora: Date, fuso: string): PartesLocais {
  let partes: Intl.DateTimeFormatPart[];
  try {
    partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: fuso,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      weekday: "short",
    }).formatToParts(agora);
  } catch {
    return partesLocais(agora, "UTC");
  }
  const mapa = new Map(partes.map((p) => [p.type, p.value]));
  const ano = NUMERO(mapa.get("year"));
  const mes = NUMERO(mapa.get("month"));
  const dia = NUMERO(mapa.get("day"));
  // "24" aparece em alguns runtimes para meia-noite.
  const hora = NUMERO(mapa.get("hour")) % 24;
  const semana = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    (mapa.get("weekday") ?? "Sun").slice(0, 3),
  );
  const data = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return { ano, mes, dia, hora, diaSemana: semana < 0 ? 0 : semana, data };
}

/** Identificador da semana local (domingo a sábado), usado para deduplicar. */
export function chaveSemanaLocal(partes: PartesLocais): string {
  const base = Date.UTC(partes.ano, partes.mes - 1, partes.dia);
  const inicio = new Date(base - partes.diaSemana * 86_400_000);
  return inicio.toISOString().slice(0, 10);
}

/** Dias completos sem nenhuma prática concluída (999 quando nunca praticou). */
export function diasSemPraticar(datas: string[], partes: PartesLocais): number {
  if (datas.length === 0) return 999;
  const hoje = Date.UTC(partes.ano, partes.mes - 1, partes.dia);
  const ultima = datas
    .map((d) => {
      const [a, m, dd] = d.slice(0, 10).split("-").map(Number);
      return Date.UTC(a ?? 1970, (m ?? 1) - 1, dd ?? 1);
    })
    .sort((a, b) => b - a)[0]!;
  return Math.max(0, Math.round((hoje - ultima) / 86_400_000));
}

export type ContextoLembrete = {
  nome: string;
  /** datas ISO das práticas concluídas */
  datasConclusao: string[];
  /** práticas concluídas na semana corrente */
  concluidasSemana: number;
  /** meta semanal do cliente */
  meta: number;
  /** existe prática concluída sem reflexão registrada */
  reflexaoPendente: boolean;
  /** tipos já enviados nesta semana local */
  tiposNaSemana: TipoLembrete[];
  /** já houve algum lembrete hoje (limite de 1 por dia) */
  enviadoHoje: boolean;
};

export type LembreteDecidido = {
  tipo: TipoLembrete;
  titulo: string;
  mensagem: string;
  /** caminho no app aberto ao clicar */
  destino: string;
  chaveDedupe: string;
};

const primeiroNome = (nome: string) => (nome.trim().split(/\s+/)[0] ?? "").trim();

/**
 * Decide se este cliente deve receber lembrete neste instante.
 * Retorna null quando não é hora, quando a meta já foi cumprida
 * ou quando o lembrete já foi enviado (dedupe diário/semanal).
 */
export function decidirLembrete(
  prefs: PreferenciaLembretes,
  ctx: ContextoLembrete,
  agora: Date,
  userId: string,
): LembreteDecidido | null {
  if (!prefs.ativo) return null;
  if (!prefs.canal_push && !prefs.canal_email) return null;
  if (estaSilenciado(prefs, agora)) return null;

  const partes = partesLocais(agora, prefs.fuso);
  // Só enviamos na hora escolhida pelo cliente — o agendador roda a cada 30 min.
  if (partes.hora !== prefs.hora_local) return null;
  if (ctx.enviadoHoje) return null;

  const semana = chaveSemanaLocal(partes);
  const chave = (tipo: TipoLembrete) => `${userId}:${tipo}:${semana}`;
  const jaNaSemana = (tipo: TipoLembrete) => ctx.tiposNaSemana.includes(tipo);

  const oi = primeiroNome(ctx.nome) ? `${primeiroNome(ctx.nome)}, ` : "";
  const faltam = Math.max(0, ctx.meta - ctx.concluidasSemana);
  const sem = diasSemPraticar(ctx.datasConclusao, partes);

  // 1) Retomada: prioridade máxima, o cliente parou de praticar.
  if (sem >= prefs.dias_inatividade && !jaNaSemana("inatividade")) {
    return {
      tipo: "inatividade",
      titulo: "Sua trilha está te esperando",
      mensagem:
        sem >= 999
          ? `${oi}que tal começar sua primeira prática hoje? Bastam alguns minutos.`
          : `${oi}já são ${sem} dia${sem > 1 ? "s" : ""} sem praticar. Retomar agora é mais simples do que parece — escolha uma prática curta.`,
      destino: "/app",
      chaveDedupe: chave("inatividade"),
    };
  }

  // 2) Lembrete semanal fixo, só se a meta ainda não foi cumprida.
  const diaCerto = partes.diaSemana === prefs.dia_semana;
  if (diaCerto && faltam > 0 && !jaNaSemana("semanal")) {
    return {
      tipo: "semanal",
      titulo: "Lembrete da sua prática",
      mensagem: `${oi}falta${faltam > 1 ? "m" : ""} ${faltam} prática${faltam > 1 ? "s" : ""} para fechar sua meta desta semana (${ctx.meta}).`,
      destino: "/app",
      chaveDedupe: chave("semanal"),
    };
  }

  // 3) Reflexão pendente: praticou, mas não registrou no diário.
  if (ctx.reflexaoPendente && !jaNaSemana("reflexao")) {
    return {
      tipo: "reflexao",
      titulo: "Registre sua reflexão",
      mensagem: `${oi}você concluiu uma prática e ainda não escreveu no diário. Duas linhas já ajudam a fixar o que sentiu.`,
      destino: "/app/diario",
      chaveDedupe: chave("reflexao"),
    };
  }

  return null;
}

/** Texto curto para o histórico e para a tela do terapeuta. */
export const TIPO_LEMBRETE_LABEL: Record<TipoLembrete, string> = {
  semanal: "Lembrete semanal",
  inatividade: "Retomada da prática",
  reflexao: "Reflexão no diário",
};
