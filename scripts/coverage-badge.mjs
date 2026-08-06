#!/usr/bin/env node
// Gera .github/badges/coverage.svg a partir de coverage/coverage-summary.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SUMMARY = "coverage/coverage-summary.json";
const OUT = ".github/badges/coverage.svg";

let pct = 0;
try {
  const summary = JSON.parse(readFileSync(SUMMARY, "utf8"));
  pct = Math.round((summary.total?.lines?.pct ?? 0) * 10) / 10;
} catch {
  console.error(`Não foi possível ler ${SUMMARY}. Rode "bun run test:coverage" antes.`);
  process.exit(1);
}

const color = pct >= 90 ? "#2f6f4e" : pct >= 75 ? "#5c8a5c" : pct >= 50 ? "#c9922b" : "#a8503a";

const label = "coverage";
const value = `${pct}%`;
const labelWidth = 62;
const valueWidth = 12 + value.length * 7;
const total = labelWidth + valueWidth;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#1f2e23"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(`Badge gerado em ${OUT} (${value})`);
