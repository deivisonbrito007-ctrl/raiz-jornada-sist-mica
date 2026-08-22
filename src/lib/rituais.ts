/**
 * Rituais curtos de abertura e fecho da prática guiada — módulo puro.
 *
 * A ideia é simples: antes de tocar, três respiros e uma intenção; depois de
 * concluir, um silêncio e uma pergunta só. Nada aqui acessa rede ou React,
 * para que o comportamento possa ser testado sem montar componentes.
 */

export const RESPIRO_SEGUNDOS = 12;
export const RESPIROS = 3;
export const SILENCIO_FECHO_SEGUNDOS = 20;

export type FaseRespiro = "inspire" | "segure" | "solte";

/** Duração de cada movimento do respiro (soma = RESPIRO_SEGUNDOS). */
export const RESPIRO_PARTES: Array<{ fase: FaseRespiro; rotulo: string; segundos: number }> = [
  { fase: "inspire", rotulo: "Inspire", segundos: 4 },
  { fase: "segure", rotulo: "Segure", segundos: 3 },
  { fase: "solte", rotulo: "Solte devagar", segundos: 5 },
];

/** Qual movimento do respiro cabe neste segundo do ritual. */
export function faseDoRespiro(segundo: number) {
  const total = RESPIRO_PARTES.reduce((acc, p) => acc + p.segundos, 0);
  const dentro = ((Math.max(0, Math.trunc(segundo)) % total) + total) % total;
  let acumulado = 0;
  for (const parte of RESPIRO_PARTES) {
    acumulado += parte.segundos;
    if (dentro < acumulado) return parte;
  }
  return RESPIRO_PARTES[RESPIRO_PARTES.length - 1]!;
}

/** Quantos respiros completos já se passaram. */
export function respirosFeitos(segundo: number) {
  const total = RESPIRO_PARTES.reduce((acc, p) => acc + p.segundos, 0);
  return Math.min(RESPIROS, Math.floor(Math.max(0, segundo) / total));
}

export const DURACAO_ABERTURA_SEGUNDOS =
  RESPIROS * RESPIRO_PARTES.reduce((acc, p) => acc + p.segundos, 0);

/** Intenções sugeridas: curtas, em primeira pessoa, nunca performáticas. */
export const INTENCOES_SUGERIDAS = [
  "Ficar presente, mesmo que incomode",
  "Ir devagar",
  "Escutar meu corpo",
  "Deixar o que não é meu",
  "Acolher o que vier",
  "Agradecer o que já passou",
] as const;

/** Frases de ancoragem para a abertura, escolhidas de forma estável pelo dia. */
export const ANCORAGENS = [
  "Você não precisa resolver nada agora. Basta chegar.",
  "O corpo sabe o ritmo. Siga por ele.",
  "Tudo o que aparecer é bem-vindo — inclusive o silêncio.",
  "Você está seguro para sentir e seguro para parar.",
] as const;

export function ancoragemDoDia(data = new Date()) {
  const dias = Math.floor(
    Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) / 86_400_000,
  );
  const total = ANCORAGENS.length;
  return ANCORAGENS[((dias % total) + total) % total]!;
}

export const PERGUNTA_FECHO = "O que fica?";

/** Chave local da última intenção, para oferecer de novo sem impor. */
export const CHAVE_ULTIMA_INTENCAO = "raiz-ultima-intencao";

export function lerUltimaIntencao(): string {
  try {
    return window.localStorage.getItem(CHAVE_ULTIMA_INTENCAO) ?? "";
  } catch {
    return "";
  }
}

export function guardarUltimaIntencao(intencao: string) {
  try {
    const limpa = intencao.trim();
    if (limpa) window.localStorage.setItem(CHAVE_ULTIMA_INTENCAO, limpa);
  } catch {
    // sem armazenamento: apenas segue
  }
}

/** Texto inicial do registro de diário no fecho, já com a intenção do dia. */
export function sementeDoFecho(intencao: string) {
  const limpa = intencao.trim();
  return limpa ? `Minha intenção era ${limpa.toLowerCase()}.\n\n` : "";
}
