import { jsPDF } from "jspdf";
import { calcularStreak, formatarData } from "@/lib/raiz-format";

type EixoRelatorio = {
  nome: string;
  liberado: boolean;
  total: number;
  concluidos: number;
  datasConclusao?: string[];
};

type EntradaDiario = {
  texto: string;
  created_at: string;
  conteudos?: { titulo: string | null; eixos?: { nome: string | null } | null } | null;
};

export type DadosRelatorio = {
  nome: string;
  email: string;
  metaSemanal: number;
  eixos: EixoRelatorio[];
  datasConclusao: string[];
  diario: EntradaDiario[];
};

const FLORESTA: [number, number, number] = [31, 46, 35];
const TERRACOTA: [number, number, number] = [168, 80, 58];
const PERGAMINHO: [number, number, number] = [241, 233, 216];
const CINZA: [number, number, number] = [110, 110, 100];

const MARGEM = 48;
const LARGURA = 595;
const ALTURA = 842;
const CONTEUDO = LARGURA - MARGEM * 2;

export function gerarRelatorioPdf(dados: DadosRelatorio) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 0;

  const novaPagina = () => {
    doc.addPage();
    y = MARGEM;
  };

  const garantirEspaco = (altura: number) => {
    if (y + altura > ALTURA - MARGEM) novaPagina();
  };

  // Capa / cabeçalho
  doc.setFillColor(...FLORESTA);
  doc.rect(0, 0, LARGURA, 150, "F");
  doc.setTextColor(...PERGAMINHO);
  doc.setFont("times", "normal");
  doc.setFontSize(30);
  doc.text("Raiz", MARGEM, 66);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Relatório de acompanhamento terapêutico", MARGEM, 90);
  doc.setFontSize(9);
  doc.text(`Emitido em ${formatarData(new Date().toISOString())}`, MARGEM, 110);

  y = 190;
  doc.setTextColor(...FLORESTA);
  doc.setFontSize(16);
  doc.setFont("times", "normal");
  doc.text(dados.nome || "Cliente", MARGEM, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...CINZA);
  doc.text(dados.email, MARGEM, y);
  y += 34;

  // Resumo
  const liberados = dados.eixos.filter((e) => e.liberado);
  const total = liberados.reduce((s, e) => s + e.total, 0);
  const feitos = liberados.reduce((s, e) => s + e.concluidos, 0);
  const percentual = total ? Math.round((feitos / total) * 100) : 0;
  const streak = calcularStreak(dados.datasConclusao);

  const cartoes: Array<[string, string]> = [
    ["Práticas concluídas", `${feitos} de ${total}`],
    ["Progresso", `${percentual}%`],
    ["Sequência", `${streak} semana${streak === 1 ? "" : "s"}`],
    ["Meta semanal", `${dados.metaSemanal} por semana`],
  ];

  const largura = (CONTEUDO - 12 * 3) / 4;
  cartoes.forEach(([rotulo, valor], i) => {
    const x = MARGEM + i * (largura + 12);
    doc.setFillColor(...PERGAMINHO);
    doc.roundedRect(x, y, largura, 62, 8, 8, "F");
    doc.setTextColor(...CINZA);
    doc.setFontSize(7.5);
    doc.text(rotulo.toUpperCase(), x + 10, y + 20);
    doc.setTextColor(...FLORESTA);
    doc.setFont("times", "normal");
    doc.setFontSize(16);
    doc.text(valor, x + 10, y + 45);
    doc.setFont("helvetica", "normal");
  });
  y += 96;

  // Eixos
  doc.setTextColor(...FLORESTA);
  doc.setFont("times", "normal");
  doc.setFontSize(14);
  doc.text("Progresso por eixo", MARGEM, y);
  doc.setFont("helvetica", "normal");
  y += 22;

  if (liberados.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...CINZA);
    doc.text("Nenhum eixo liberado até o momento.", MARGEM, y);
    y += 20;
  }

  for (const eixo of liberados) {
    garantirEspaco(44);
    const pct = eixo.total ? Math.round((eixo.concluidos / eixo.total) * 100) : 0;
    doc.setTextColor(...FLORESTA);
    doc.setFontSize(10.5);
    doc.text(eixo.nome, MARGEM, y);
    doc.setTextColor(...CINZA);
    doc.setFontSize(9);
    const info = `${eixo.concluidos}/${eixo.total} · ${calcularStreak(eixo.datasConclusao ?? [])} sem.`;
    doc.text(info, LARGURA - MARGEM - doc.getTextWidth(info), y);
    y += 8;
    doc.setFillColor(...PERGAMINHO);
    doc.roundedRect(MARGEM, y, CONTEUDO, 7, 3.5, 3.5, "F");
    if (pct > 0) {
      doc.setFillColor(...TERRACOTA);
      doc.roundedRect(MARGEM, y, (CONTEUDO * pct) / 100, 7, 3.5, 3.5, "F");
    }
    y += 26;
  }

  // Diário
  y += 14;
  garantirEspaco(60);
  doc.setTextColor(...FLORESTA);
  doc.setFont("times", "normal");
  doc.setFontSize(14);
  doc.text(`Entradas do diário (${dados.diario.length})`, MARGEM, y);
  doc.setFont("helvetica", "normal");
  y += 22;

  if (dados.diario.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...CINZA);
    doc.text("Nenhuma entrada registrada.", MARGEM, y);
  }

  for (const entrada of dados.diario) {
    const linhas = doc.splitTextToSize(entrada.texto, CONTEUDO - 24) as string[];
    garantirEspaco(38 + linhas.length * 13);
    const contexto = entrada.conteudos?.titulo
      ? `${entrada.conteudos.eixos?.nome ? `${entrada.conteudos.eixos.nome} · ` : ""}${entrada.conteudos.titulo}`
      : "Reflexão livre";
    doc.setTextColor(...TERRACOTA);
    doc.setFontSize(8);
    doc.text(`${formatarData(entrada.created_at)} · ${contexto}`, MARGEM, y);
    y += 14;
    doc.setTextColor(...FLORESTA);
    doc.setFontSize(10);
    for (const linha of linhas) {
      garantirEspaco(14);
      doc.text(linha, MARGEM, y);
      y += 13;
    }
    y += 16;
  }

  // Numeração
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text(`Raiz · página ${i} de ${paginas}`, MARGEM, ALTURA - 24);
  }

  const slug = (dados.nome || "cliente").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  doc.save(`raiz-relatorio-${slug || "cliente"}.pdf`);
}
