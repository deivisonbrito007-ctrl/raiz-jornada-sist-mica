/**
 * Assinatura do build para detectar instalações antigas na tela inicial.
 *
 * iOS e Android congelam ícones e campos do manifest no momento da instalação.
 * Quando trocamos os ícones ou o manifest, quem instalou antes continua com a
 * versão velha — só uma reinstalação resolve. Para saber disso, guardamos a
 * assinatura do build no primeiro acesso em modo instalado e comparamos depois.
 *
 * Ao mexer em public/manifest.webmanifest ou nos PNGs de ícone, incremente
 * VERSAO_ICONES (o script scripts/verificar-icones.mjs cobra isso no CI).
 */
export const VERSAO_APP = "1.1.0";
export const VERSAO_ICONES = 2;

export const CHAVE_ASSINATURA = "raiz.instalacao.assinatura";
export const CHAVE_ADIADO = "raiz.instalacao.adiado";
/** Quanto tempo o aviso fica quieto depois de "Agora não". */
export const DIAS_ADIAMENTO = 14;
const MS_DIA = 24 * 60 * 60 * 1000;

export interface AssinaturaInstalacao {
  app: string;
  icones: number;
}

export function assinaturaAtual(): AssinaturaInstalacao {
  return { app: VERSAO_APP, icones: VERSAO_ICONES };
}

function armazenamento(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // modo privado / storage bloqueado
  }
}

export function assinaturaInstalada(): AssinaturaInstalacao | null {
  const bruto = armazenamento()?.getItem(CHAVE_ASSINATURA);
  if (!bruto) return null;
  try {
    const dado = JSON.parse(bruto) as Partial<AssinaturaInstalacao>;
    if (typeof dado?.icones !== "number") return null;
    return { app: typeof dado.app === "string" ? dado.app : "", icones: dado.icones };
  } catch {
    return null;
  }
}

/** Marca a instalação atual como sendo deste build (e limpa o adiamento). */
export function registrarInstalacao(): void {
  const guarda = armazenamento();
  if (!guarda) return;
  try {
    guarda.setItem(CHAVE_ASSINATURA, JSON.stringify(assinaturaAtual()));
    guarda.removeItem(CHAVE_ADIADO);
  } catch {
    /* sem storage: seguimos sem avisar */
  }
}

/** O aviso está adiado? */
export function avisoAdiado(agora = Date.now()): boolean {
  const bruto = armazenamento()?.getItem(CHAVE_ADIADO);
  if (!bruto) return false;
  const quando = Number(bruto);
  if (!Number.isFinite(quando)) return false;
  return agora - quando < DIAS_ADIAMENTO * MS_DIA;
}

export function adiarAviso(agora = Date.now()): void {
  try {
    armazenamento()?.setItem(CHAVE_ADIADO, String(agora));
  } catch {
    /* ignora */
  }
}

/**
 * Só é "desatualizada" quando já existe uma assinatura registrada (ou seja, o
 * app foi aberto instalado em algum build anterior) e a versão de ícones do
 * build atual é mais nova.
 */
export function instalacaoDesatualizada(): boolean {
  const registrada = assinaturaInstalada();
  if (!registrada) return false;
  return registrada.icones < VERSAO_ICONES;
}
