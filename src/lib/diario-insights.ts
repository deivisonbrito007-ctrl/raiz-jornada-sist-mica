/**
 * Insights do Diário — módulo puro (sem React, sem rede).
 *
 * Lê as entradas já carregadas e devolve leituras de acolhimento: como os
 * sentimentos se movem, que palavras voltam com mais força e como foi cada mês.
 * Nada aqui julga a pessoa: os textos são sempre descritivos.
 */

import { SENTIMENTOS, ehCompartilhada, type EntradaDiario } from "./diario-cliente";

/** Sentimentos são gravados pelo convite de escrita na linha "Senti: ...". */
export function sentimentosDaEntrada(entrada: EntradaDiario): string[] {
  const linha = /Senti:\s*([^\n.]+)\.?/i.exec(entrada.texto);
  if (!linha?.[1]) return [];
  const rotulos = linha[1]
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  return SENTIMENTOS.filter((s) => rotulos.includes(s.rotulo.toLowerCase())).map((s) => s.chave);
}

export type Tendencia = "subindo" | "descendo" | "estavel" | "nova";

export type TendenciaSentimento = {
  chave: string;
  rotulo: string;
  total: number;
  recentes: number;
  anteriores: number;
  proporcao: number;
  tendencia: Tendencia;
};

function dentroDaJanela(iso: string, agora: Date, inicioDias: number, fimDias: number) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return false;
  const dias = (agora.getTime() - data.getTime()) / 86_400_000;
  return dias >= fimDias && dias < inicioDias;
}

/**
 * Tendência por sentimento: compara os últimos 30 dias com os 30 anteriores.
 * A proporção é sobre o total de marcações, para dar peso relativo na barra.
 */
export function tendenciasSentimentos(
  entradas: EntradaDiario[],
  agora = new Date(),
  janelaDias = 30,
): TendenciaSentimento[] {
  const contagem = new Map<string, { total: number; recentes: number; anteriores: number }>();

  for (const entrada of entradas) {
    for (const chave of sentimentosDaEntrada(entrada)) {
      const atual = contagem.get(chave) ?? { total: 0, recentes: 0, anteriores: 0 };
      atual.total += 1;
      if (dentroDaJanela(entrada.created_at, agora, janelaDias, 0)) atual.recentes += 1;
      else if (dentroDaJanela(entrada.created_at, agora, janelaDias * 2, janelaDias))
        atual.anteriores += 1;
      contagem.set(chave, atual);
    }
  }

  const marcacoes = [...contagem.values()].reduce((soma, c) => soma + c.total, 0);

  return [...contagem.entries()]
    .map(([chave, c]) => {
      const rotulo = SENTIMENTOS.find((s) => s.chave === chave)?.rotulo ?? chave;
      const tendencia: Tendencia =
        c.anteriores === 0 && c.recentes > 0
          ? "nova"
          : c.recentes > c.anteriores
            ? "subindo"
            : c.recentes < c.anteriores
              ? "descendo"
              : "estavel";
      return {
        chave,
        rotulo,
        total: c.total,
        recentes: c.recentes,
        anteriores: c.anteriores,
        proporcao: marcacoes === 0 ? 0 : c.total / marcacoes,
        tendencia,
      };
    })
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo));
}

export const TENDENCIA_LABEL: Record<Tendencia, string> = {
  subindo: "aparecendo mais",
  descendo: "aparecendo menos",
  estavel: "no mesmo ritmo",
  nova: "nova neste mês",
};

/** Palavras sem carga própria: entram em toda frase e não dizem nada do processo. */
const PALAVRAS_VAZIAS = new Set([
  "a","à","às","ao","aos","agora","ainda","algo","alguém","alguma","algumas","algum","alguns","ali","antes","aqui","as","até","bem","cada","com","como","da","das","de","dela","dele","deles","demais","dentro","depois","des","desde","dessa","desse","deste","desta","dia","disso","do","dos","e","é","ela","elas","ele","eles","em","entre","era","essa","essas","esse","esses","esta","está","estar","estas","este","estes","estou","eu","fez","fica","ficar","foi","for","foram","fosse","há","isso","isto","já","lá","lhe","logo","mais","mas","me","mesmo","meu","meus","minha","minhas","muito","muita","na","não","nas","nem","nesse","neste","no","nos","nós","nossa","nosso","num","numa","o","os","ou","para","pela","pelo","por","porque","pouco","pra","que","quando","quase","se","sem","ser","será","seu","seus","só","sobre","sou","sua","suas","também","tem","tenho","ter","teve","tinha","tive","toda","todas","todo","todos","tudo","um","uma","umas","uns","vai","vem","ver","vez","você","vou","senti",
]);

export type Tema = { palavra: string; total: number; entradas: number };

/** Palavras que voltam: frequência simples, ignorando palavras vazias e a linha de sentimentos. */
export function temasRecorrentes(entradas: EntradaDiario[], limite = 8): Tema[] {
  const contagem = new Map<string, { total: number; entradas: number }>();

  for (const entrada of entradas) {
    const corpo = entrada.texto.replace(/Senti:\s*[^\n]*/gi, " ");
    const palavras = corpo
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, " ")
      .split(/\s+/)
      .filter((p) => p.length > 2 && !PALAVRAS_VAZIAS.has(p));
    const vistas = new Set<string>();
    for (const palavra of palavras) {
      const atual = contagem.get(palavra) ?? { total: 0, entradas: 0 };
      atual.total += 1;
      if (!vistas.has(palavra)) {
        atual.entradas += 1;
        vistas.add(palavra);
      }
      contagem.set(palavra, atual);
    }
  }

  return [...contagem.entries()]
    .map(([palavra, c]) => ({ palavra, total: c.total, entradas: c.entradas }))
    .filter((t) => t.total > 1)
    .sort((a, b) => b.total - a.total || a.palavra.localeCompare(b.palavra))
    .slice(0, limite);
}

export type ResumoMes = {
  chave: string;
  rotulo: string;
  total: number;
  dias: number;
  compartilhadas: number;
  dePraticas: number;
  sentimentoDominante: string | null;
  eixoMaisPresente: string | null;
  frase: string;
};

/** Resumo mês a mês, do mais recente para o mais antigo. */
export function resumosMensais(entradas: EntradaDiario[], limite = 6): ResumoMes[] {
  const meses = new Map<string, EntradaDiario[]>();
  for (const entrada of entradas) {
    const data = new Date(entrada.created_at);
    if (Number.isNaN(data.getTime())) continue;
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    meses.set(chave, [...(meses.get(chave) ?? []), entrada]);
  }

  return [...meses.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, limite)
    .map(([chave, lista]) => {
      const primeira = new Date(lista[0]!.created_at);
      const rotuloBruto = primeira.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      const rotulo = rotuloBruto.charAt(0).toUpperCase() + rotuloBruto.slice(1);

      const dias = new Set(
        lista.map((e) => {
          const d = new Date(e.created_at);
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        }),
      ).size;

      const sentimentos = tendenciasSentimentos(lista, primeira, 10_000);
      const eixos = new Map<string, number>();
      for (const e of lista) {
        const nome = e.conteudos?.eixos?.nome;
        if (nome) eixos.set(nome, (eixos.get(nome) ?? 0) + 1);
      }
      const eixoMaisPresente =
        [...eixos.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;

      const compartilhadas = lista.filter(ehCompartilhada).length;
      const dePraticas = lista.filter((e) => Boolean(e.conteudo_id)).length;
      const dominante = sentimentos[0]?.rotulo ?? null;

      const partes = [
        `${lista.length} ${lista.length === 1 ? "reflexão" : "reflexões"} em ${dias} ${dias === 1 ? "dia" : "dias"}`,
      ];
      if (dominante) partes.push(`com ${dominante.toLowerCase()} mais presente`);
      if (eixoMaisPresente) partes.push(`atravessando ${eixoMaisPresente}`);

      return {
        chave,
        rotulo,
        total: lista.length,
        dias,
        compartilhadas,
        dePraticas,
        sentimentoDominante: dominante,
        eixoMaisPresente,
        frase: `${partes.join(", ")}.`,
      };
    });
}

export type Insights = {
  vazio: boolean;
  sentimentos: TendenciaSentimento[];
  temas: Tema[];
  meses: ResumoMes[];
};

export function insightsDoDiario(entradas: EntradaDiario[], agora = new Date()): Insights {
  return {
    vazio: entradas.length === 0,
    sentimentos: tendenciasSentimentos(entradas, agora),
    temas: temasRecorrentes(entradas),
    meses: resumosMensais(entradas),
  };
}
