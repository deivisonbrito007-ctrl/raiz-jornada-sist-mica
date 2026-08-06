export const TIPO_LABEL: Record<string, string> = {
  video: "Vídeo guiado",
  audio: "Áudio · meditação",
  exercicio: "Exercício prático",
  texto: "Texto de apoio",
  tarefa: "Tarefa da semana",
};

export const PAGAMENTO_LABEL: Record<string, string> = {
  pendente: "Pagamento pendente",
  pago: "Pago",
  cancelado: "Cancelado",
};

export const COBRANCA_LABEL: Record<string, string> = {
  pagamento_unico: "Pagamento único",
  assinatura: "Assinatura",
};

export function formatarDuracao(segundos: number) {
  if (!segundos) return "—";
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  if (min === 0) return `${seg}s`;
  return seg === 0 ? `${min} min` : `${min} min ${seg}s`;
}

export function formatarData(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatarPreco(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function calcularStreak(datas: string[]) {
  if (datas.length === 0) return 0;
  const semanas = new Set(
    datas.map((d) => {
      const data = new Date(d);
      const inicio = new Date(data);
      inicio.setDate(data.getDate() - ((data.getDay() + 6) % 7));
      inicio.setHours(0, 0, 0, 0);
      return inicio.getTime();
    }),
  );
  const umaSemana = 7 * 24 * 60 * 60 * 1000;
  const hoje = new Date();
  hoje.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
  hoje.setHours(0, 0, 0, 0);
  let streak = 0;
  let cursor = hoje.getTime();
  if (!semanas.has(cursor)) cursor -= umaSemana;
  while (semanas.has(cursor)) {
    streak += 1;
    cursor -= umaSemana;
  }
  return streak;
}


function inicioDaSemana(data: Date) {
  const inicio = new Date(data);
  inicio.setDate(data.getDate() - ((data.getDay() + 6) % 7));
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

export type SemanaLinhaDoTempo = {
  inicio: string;
  label: string;
  total: number;
  ativa: boolean;
  atual: boolean;
};

export function linhaDoTempoSemanal(datas: string[], semanas = 8): SemanaLinhaDoTempo[] {
  const contagem = new Map<number, number>();
  for (const iso of datas) {
    const chave = inicioDaSemana(new Date(iso)).getTime();
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }

  const umaSemana = 7 * 24 * 60 * 60 * 1000;
  const semanaAtual = inicioDaSemana(new Date()).getTime();

  return Array.from({ length: semanas }, (_, indice) => {
    const chave = semanaAtual - (semanas - 1 - indice) * umaSemana;
    const inicio = new Date(chave);
    const total = contagem.get(chave) ?? 0;
    return {
      inicio: inicio.toISOString(),
      label: inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total,
      ativa: total > 0,
      atual: chave === semanaAtual,
    };
  });
}
