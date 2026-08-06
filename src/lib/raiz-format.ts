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

export type DiaMapaCalor = {
  data: string;
  label: string;
  total: number;
  nivel: 0 | 1 | 2 | 3 | 4;
  futuro: boolean;
  hoje: boolean;
};

export type ColunaMapaCalor = {
  inicio: string;
  labelMes: string;
  dias: DiaMapaCalor[];
};

export const DIAS_SEMANA_CURTO = ["S", "T", "Q", "Q", "S", "S", "D"];

export function mapaCalorDiario(datas: string[], semanas = 12): ColunaMapaCalor[] {
  const umDia = 24 * 60 * 60 * 1000;
  const contagem = new Map<number, number>();
  for (const iso of datas) {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    contagem.set(d.getTime(), (contagem.get(d.getTime()) ?? 0) + 1);
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicioAtual = inicioDaSemana(hoje).getTime();

  return Array.from({ length: semanas }, (_, indice) => {
    const inicioSemana = inicioAtual - (semanas - 1 - indice) * 7 * umDia;
    const dias = Array.from({ length: 7 }, (_, dia) => {
      const chave = inicioSemana + dia * umDia;
      const data = new Date(chave);
      const total = contagem.get(chave) ?? 0;
      const nivel: DiaMapaCalor["nivel"] =
        total === 0 ? 0 : total === 1 ? 1 : total === 2 ? 2 : total <= 4 ? 3 : 4;
      return {
        data: data.toISOString(),
        label: data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        total,
        nivel,
        futuro: chave > hoje.getTime(),
        hoje: chave === hoje.getTime(),
      };
    });
    const primeiro = new Date(inicioSemana);
    return {
      inicio: primeiro.toISOString(),
      labelMes:
        primeiro.getDate() <= 7
          ? primeiro.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")
          : "",
      dias,
    };
  });
}

export type MetaSemanal = {
  meta: number;
  concluidasSemana: number;
  concluidasSemanaAnterior: number;
  percentual: number;
  restantes: number;
  alcancada: boolean;
  mensagem: string;
  tendencia: "acima" | "igual" | "abaixo";
};

export function avaliarMetaSemanal(datas: string[], meta: number): MetaSemanal {
  const umaSemana = 7 * 24 * 60 * 60 * 1000;
  const inicioAtual = inicioDaSemana(new Date()).getTime();
  const metaSegura = Math.max(1, meta);

  let concluidasSemana = 0;
  let concluidasSemanaAnterior = 0;
  for (const iso of datas) {
    const chave = inicioDaSemana(new Date(iso)).getTime();
    if (chave === inicioAtual) concluidasSemana += 1;
    else if (chave === inicioAtual - umaSemana) concluidasSemanaAnterior += 1;
  }

  const percentual = Math.min(100, Math.round((concluidasSemana / metaSegura) * 100));
  const restantes = Math.max(0, metaSegura - concluidasSemana);
  const alcancada = concluidasSemana >= metaSegura;

  const tendencia: MetaSemanal["tendencia"] =
    concluidasSemana > concluidasSemanaAnterior
      ? "acima"
      : concluidasSemana === concluidasSemanaAnterior
        ? "igual"
        : "abaixo";

  let mensagem: string;
  if (concluidasSemana === 0) {
    mensagem = `Sua semana está em aberto. Uma prática já move o processo — faltam ${metaSegura} para a sua meta.`;
  } else if (alcancada) {
    const extra = concluidasSemana - metaSegura;
    mensagem =
      extra > 0
        ? `Meta alcançada e ${extra} prática${extra === 1 ? "" : "s"} além. Cuidado com a pressa: descansar também é parte.`
        : "Meta da semana alcançada. Deixe o que foi olhado assentar antes de seguir.";
  } else if (percentual >= 60) {
    mensagem = `Você está quase lá — falta${restantes === 1 ? "" : "m"} ${restantes} prática${restantes === 1 ? "" : "s"} para fechar a semana.`;
  } else {
    mensagem = `Bom começo. Falta${restantes === 1 ? "" : "m"} ${restantes} prática${restantes === 1 ? "" : "s"} para a sua meta desta semana.`;
  }

  return {
    meta: metaSegura,
    concluidasSemana,
    concluidasSemanaAnterior,
    percentual,
    restantes,
    alcancada,
    mensagem,
    tendencia,
  };
}
