#!/usr/bin/env node
/**
 * Gera as telas de abertura (apple-touch-startup-image) do PWA no iOS.
 * Reaproveita o símbolo Raiz em alta resolução e o fundo floresta da marca,
 * garantindo que a abertura do app instalado apareça nítida em vez de uma
 * tela branca ou de um ícone esticado.
 *
 * Uso: bun run splash:gerar
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destino = path.join(raiz, "public", "splash");
const FUNDO = "#1b2a1d";
const BRILHO = "rgba(178, 76, 46, 0.30)";

export const TELAS = [
  { largura: 1290, altura: 2796, dispositivo: 430, escala: 3 },
  { largura: 1179, altura: 2556, dispositivo: 393, escala: 3 },
  { largura: 1284, altura: 2778, dispositivo: 428, escala: 3 },
  { largura: 1170, altura: 2532, dispositivo: 390, escala: 3 },
  { largura: 1125, altura: 2436, dispositivo: 375, escala: 3 },
  { largura: 1242, altura: 2688, dispositivo: 414, escala: 3 },
  { largura: 828, altura: 1792, dispositivo: 414, escala: 2 },
  { largura: 750, altura: 1334, dispositivo: 375, escala: 2 },
  { largura: 1536, altura: 2048, dispositivo: 768, escala: 2 },
  { largura: 1668, altura: 2388, dispositivo: 834, escala: 2 },
  { largura: 2048, altura: 2732, dispositivo: 1024, escala: 2 },
];

async function principal() {
  const ponteiro = JSON.parse(
    readFileSync(path.join(raiz, "src/assets/raiz-marca.png.asset.json"), "utf8"),
  );
  const marca = await loadImage(
    `https://id-preview--417c067a-6ad2-407d-b646-dae138e8a925.lovable.app${ponteiro.url}`,
  );
  mkdirSync(destino, { recursive: true });

  for (const tela of TELAS) {
    const { largura, altura } = tela;
    const canvas = createCanvas(largura, altura);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = FUNDO;
    ctx.fillRect(0, 0, largura, altura);

    // aura suave atrás do símbolo
    const raioBrilho = Math.max(largura, altura) * 0.55;
    const gradiente = ctx.createRadialGradient(
      largura / 2,
      altura * 0.44,
      0,
      largura / 2,
      altura * 0.44,
      raioBrilho,
    );
    gradiente.addColorStop(0, BRILHO);
    gradiente.addColorStop(1, "rgba(27, 42, 29, 0)");
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, largura, altura);

    // símbolo centralizado ocupando ~34% da menor dimensão
    const alvo = Math.min(largura, altura) * 0.34;
    const proporcao = marca.width / marca.height;
    const alturaMarca = alvo;
    const larguraMarca = alvo * proporcao;
    ctx.drawImage(
      marca,
      (largura - larguraMarca) / 2,
      altura * 0.44 - alturaMarca / 2,
      larguraMarca,
      alturaMarca,
    );

    const arquivo = path.join(destino, `splash-${largura}x${altura}.png`);
    writeFileSync(arquivo, canvas.toBuffer("image/png"));
    console.log("gerado", path.relative(raiz, arquivo));
  }
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
