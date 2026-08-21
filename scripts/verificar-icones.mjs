#!/usr/bin/env node
// Valida o conjunto de ícones de instalação (manifest + head) sem depender de libs externas.
// Falha (exit 1) se algo puder quebrar a instalação no Android, iOS ou nas abas do navegador.
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CREME = [243, 235, 216];
const OBRIGATORIOS = [
  { src: "/favicon.png", sizes: "64x64", purpose: "any" },
  { src: "/apple-touch-icon.png", sizes: "180x180", purpose: "any" },
  { src: "/icon-192.png", sizes: "192x192", purpose: "any" },
  { src: "/icon-512.png", sizes: "512x512", purpose: "any" },
  { src: "/icon-maskable-192.png", sizes: "192x192", purpose: "maskable" },
  { src: "/icon-maskable-512.png", sizes: "512x512", purpose: "maskable" },
];

function pedacos(buffer) {
  const lista = [];
  let i = 8;
  while (i < buffer.length) {
    const tamanho = buffer.readUInt32BE(i);
    const tipo = buffer.toString("ascii", i + 4, i + 8);
    lista.push({ tipo, dados: buffer.subarray(i + 8, i + 8 + tamanho) });
    i += tamanho + 12;
  }
  return lista;
}

/** Lê um PNG 8 bits não entrelaçado (RGB ou RGBA) e devolve dimensões e pixels. */
export function lerPng(buffer) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") throw new Error("não é um PNG");
  const partes = pedacos(buffer);
  const ihdr = partes.find((p) => p.tipo === "IHDR").dados;
  const largura = ihdr.readUInt32BE(0);
  const altura = ihdr.readUInt32BE(4);
  const profundidade = ihdr[8];
  const tipoCor = ihdr[9];
  const entrelacado = ihdr[12] === 1;
  const canais = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[tipoCor];
  const temAlfa = tipoCor === 4 || tipoCor === 6;
  const meta = { largura, altura, profundidade, tipoCor, temAlfa, entrelacado };
  if (profundidade !== 8 || entrelacado || (tipoCor !== 2 && tipoCor !== 6)) return meta;

  const idat = Buffer.concat(partes.filter((p) => p.tipo === "IDAT").map((p) => p.dados));
  const cru = inflateSync(idat);
  const bpp = canais;
  const passo = largura * bpp;
  const pixels = Buffer.alloc(altura * passo);
  let pos = 0;
  for (let y = 0; y < altura; y += 1) {
    const filtro = cru[pos];
    pos += 1;
    const linha = cru.subarray(pos, pos + passo);
    pos += passo;
    const destino = y * passo;
    const anterior = destino - passo;
    for (let x = 0; x < passo; x += 1) {
      const bruto = linha[x];
      const a = x >= bpp ? pixels[destino + x - bpp] : 0;
      const b = y > 0 ? pixels[anterior + x] : 0;
      const c = x >= bpp && y > 0 ? pixels[anterior + x - bpp] : 0;
      let valor = bruto;
      if (filtro === 1) valor = bruto + a;
      else if (filtro === 2) valor = bruto + b;
      else if (filtro === 3) valor = bruto + ((a + b) >> 1);
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        valor = bruto + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      pixels[destino + x] = valor & 0xff;
    }
  }
  return { ...meta, canais, pixels };
}

/** Caixa do desenho (pixels diferentes do fundo creme) e ocupação relativa ao lado. */
export function medirMarca(png) {
  const { largura, altura, canais, pixels } = png;
  let minX = largura;
  let minY = altura;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const i = (y * largura + x) * canais;
      const alfa = canais === 4 ? pixels[i + 3] : 255;
      const distancia =
        Math.abs(pixels[i] - CREME[0]) +
        Math.abs(pixels[i + 1] - CREME[1]) +
        Math.abs(pixels[i + 2] - CREME[2]);
      if (alfa > 8 && distancia > 30) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const larguraMarca = maxX - minX + 1;
  const alturaMarca = maxY - minY + 1;
  return {
    minX,
    minY,
    maxX,
    maxY,
    ocupacao: Math.max(larguraMarca / largura, alturaMarca / altura),
    desvioX: (minX + maxX + 1) / 2 - largura / 2,
    desvioY: (minY + maxY + 1) / 2 - altura / 2,
  };
}

export function verificarIcones() {
  const problemas = [];
  const manifest = JSON.parse(readFileSync(path.join(raiz, "public/manifest.webmanifest"), "utf8"));
  const head = readFileSync(path.join(raiz, "src/routes/__root.tsx"), "utf8");

  const corHead = head.match(/name: "theme-color", content: "(#[0-9a-fA-F]{3,8})"/)?.[1];
  if (!corHead) problemas.push("head sem meta theme-color");
  else if (corHead.toLowerCase() !== String(manifest.theme_color).toLowerCase()) {
    problemas.push(`theme-color divergente: head ${corHead} vs manifest ${manifest.theme_color}`);
  }
  if (!/rel: "manifest", href: "\/manifest\.webmanifest"/.test(head)) {
    problemas.push("head sem link para /manifest.webmanifest");
  }
  if (!/rel: "apple-touch-icon"[^}]*href: "\/apple-touch-icon\.png"/.test(head)) {
    problemas.push("head sem apple-touch-icon (iOS usa esse arquivo na tela de início)");
  }
  if (manifest.display !== "standalone") problemas.push('manifest display deve ser "standalone"');
  for (const campo of ["name", "short_name", "start_url", "scope", "background_color"]) {
    if (!manifest[campo]) problemas.push(`manifest sem ${campo}`);
  }

  for (const esperado of OBRIGATORIOS) {
    const entrada = (manifest.icons ?? []).find(
      (i) =>
        i.src === esperado.src &&
        i.sizes === esperado.sizes &&
        String(i.purpose ?? "any")
          .split(/\s+/)
          .includes(esperado.purpose),
    );
    if (!entrada) {
      problemas.push(
        `manifest sem ${esperado.src} (${esperado.sizes}, purpose ${esperado.purpose})`,
      );
      continue;
    }

    let arquivo;
    try {
      arquivo = readFileSync(path.join(raiz, "public", esperado.src.replace(/^\//, "")));
    } catch {
      problemas.push(`arquivo ausente em public${esperado.src}`);
      continue;
    }

    const png = lerPng(arquivo);
    const [w, h] = esperado.sizes.split("x").map(Number);
    if (png.largura !== w || png.altura !== h) {
      problemas.push(
        `${esperado.src}: ${png.largura}x${png.altura} não bate com sizes ${esperado.sizes}`,
      );
    }
    if (esperado.src === "/apple-touch-icon.png" && png.temAlfa) {
      problemas.push("/apple-touch-icon.png tem transparência; o iOS exige fundo opaco");
    }
    if (!png.pixels) {
      problemas.push(`${esperado.src}: formato PNG não suportado na checagem`);
      continue;
    }

    const marca = medirMarca(png);
    if (!marca) {
      problemas.push(`${esperado.src}: nenhum desenho encontrado sobre o fundo`);
      continue;
    }
    const limite = esperado.purpose === "maskable" ? 0.6 : 0.86;
    if (marca.ocupacao > limite) {
      problemas.push(
        `${esperado.src}: desenho ocupa ${(marca.ocupacao * 100).toFixed(0)}% do lado (máximo ${(limite * 100).toFixed(0)}%)`,
      );
    }
    const tolerancia = Math.max(2, png.largura * 0.03);
    if (Math.abs(marca.desvioX) > tolerancia || Math.abs(marca.desvioY) > tolerancia) {
      problemas.push(
        `${esperado.src}: desenho fora do centro (x ${marca.desvioX.toFixed(1)}px, y ${marca.desvioY.toFixed(1)}px; tolerância ${tolerancia.toFixed(1)}px)`,
      );
    }
  }

  return problemas;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const problemas = verificarIcones();
  if (problemas.length === 0) {
    console.log("✓ ícones e manifest válidos (64/180/192/512 + maskable 192/512)");
    process.exit(0);
  }
  console.error("✗ problemas nos ícones de instalação:");
  for (const p of problemas) console.error(`  - ${p}`);
  process.exit(1);
}
