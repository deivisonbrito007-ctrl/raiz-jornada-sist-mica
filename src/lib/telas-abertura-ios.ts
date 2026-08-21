/**
 * Telas de abertura (apple-touch-startup-image) do app instalado no iOS.
 * As imagens são geradas por `scripts/gerar-splash-ios.py` e ficam em
 * `public/splash`. Sem essas entradas o iOS mostra uma tela branca ao abrir o
 * atalho instalado. As media queries precisam bater exatamente com o tamanho
 * lógico e a densidade do aparelho.
 */
type Tela = {
  larguraLogica: number;
  alturaLogica: number;
  escala: number;
};

const TELAS: Tela[] = [
  { larguraLogica: 430, alturaLogica: 932, escala: 3 }, // iPhone 15/16 Pro Max
  { larguraLogica: 393, alturaLogica: 852, escala: 3 }, // iPhone 14/15/16 Pro
  { larguraLogica: 428, alturaLogica: 926, escala: 3 }, // iPhone 12/13/14 Plus
  { larguraLogica: 390, alturaLogica: 844, escala: 3 }, // iPhone 12/13/14
  { larguraLogica: 375, alturaLogica: 812, escala: 3 }, // iPhone X/11 Pro/mini
  { larguraLogica: 414, alturaLogica: 896, escala: 3 }, // iPhone 11 Pro Max
  { larguraLogica: 414, alturaLogica: 896, escala: 2 }, // iPhone 11/XR
  { larguraLogica: 375, alturaLogica: 667, escala: 2 }, // iPhone SE
  { larguraLogica: 768, alturaLogica: 1024, escala: 2 }, // iPad
  { larguraLogica: 834, alturaLogica: 1194, escala: 2 }, // iPad Pro 11"
  { larguraLogica: 1024, alturaLogica: 1366, escala: 2 }, // iPad Pro 12,9"
];

export const TELAS_ABERTURA_IOS = TELAS.map(
  ({ larguraLogica, alturaLogica, escala }) => ({
    rel: "apple-touch-startup-image",
    href: `/splash/splash-${larguraLogica * escala}x${alturaLogica * escala}.png`,
    media: `(device-width: ${larguraLogica}px) and (device-height: ${alturaLogica}px) and (-webkit-device-pixel-ratio: ${escala}) and (orientation: portrait)`,
  }),
);
