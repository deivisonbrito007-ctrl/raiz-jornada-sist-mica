/**
 * Marcos do caminho — módulo puro para o widget de progresso do Início.
 *
 * Traduz números já existentes (sequência, ciclo, práticas por eixo, reflexões)
 * em porcentagens e conquistas suaves. Nunca cobrança: quando algo ainda não
 * aconteceu, o texto convida em vez de exigir.
 */

export type EixoProgresso = {
  id: string;
  nome: string;
  liberado: boolean;
  concluidos: number;
  total: number;
};

export type FatiaEixo = {
  id: string;
  nome: string;
  concluidos: number;
  total: number;
  percentual: number;
};

/** Porcentagem por eixo, só dos eixos liberados e com práticas. */
export function percentuaisPorEixo(eixos: readonly EixoProgresso[]): FatiaEixo[] {
  return eixos
    .filter((e) => e.liberado && e.total > 0)
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      concluidos: e.concluidos,
      total: e.total,
      percentual: Math.min(100, Math.round((e.concluidos / e.total) * 100)),
    }))
    .sort((a, b) => b.percentual - a.percentual || a.nome.localeCompare(b.nome));
}

export type DadosMarcos = {
  streakSemanas: number;
  cicloSemana: number;
  totalConcluidos: number;
  reflexoes: number;
  diasEscrevendo: number;
  eixos: readonly EixoProgresso[];
};

export type Conquista = {
  chave: string;
  titulo: string;
  descricao: string;
  conquistada: boolean;
};

/** Conquistas visuais: pequenas, humanas, sem pontuação nem competição. */
export function conquistas(dados: DadosMarcos): Conquista[] {
  const fatias = percentuaisPorEixo(dados.eixos);
  const eixoInteiro = fatias.find((f) => f.percentual >= 100) ?? null;
  return [
    {
      chave: "primeira-pratica",
      titulo: "Primeiro passo",
      descricao: "Você concluiu sua primeira prática.",
      conquistada: dados.totalConcluidos >= 1,
    },
    {
      chave: "primeira-reflexao",
      titulo: "Primeira palavra",
      descricao: "Você escreveu sua primeira reflexão.",
      conquistada: dados.reflexoes >= 1,
    },
    {
      chave: "semana-de-ritmo",
      titulo: "Uma semana de ritmo",
      descricao: "Você manteve práticas por uma semana seguida.",
      conquistada: dados.streakSemanas >= 1,
    },
    {
      chave: "sete-praticas",
      titulo: "Sete práticas",
      descricao: "Sete encontros com você mesmo.",
      conquistada: dados.totalConcluidos >= 7,
    },
    {
      chave: "eixo-inteiro",
      titulo: "Um eixo inteiro",
      descricao: eixoInteiro
        ? `Você completou o eixo ${eixoInteiro.nome}.`
        : "Um eixo completo, do começo ao fim.",
      conquistada: Boolean(eixoInteiro),
    },
    {
      chave: "mes-de-escuta",
      titulo: "Um mês de escuta",
      descricao: "Você escreveu no diário em 20 dias diferentes.",
      conquistada: dados.diasEscrevendo >= 20,
    },
  ];
}

export type ResumoMarcos = {
  fatias: FatiaEixo[];
  conquistas: Conquista[];
  conquistadas: number;
  frase: string;
};

/** Frase de acolhimento do widget, conforme o momento da pessoa. */
export function resumoMarcos(dados: DadosMarcos): ResumoMarcos {
  const lista = conquistas(dados);
  const conquistadas = lista.filter((c) => c.conquistada).length;
  const frase =
    dados.totalConcluidos === 0
      ? "Seu caminho começa quando você quiser. Nada aqui expira."
      : dados.streakSemanas >= 2
        ? `Você vem sustentando o ritmo por ${dados.streakSemanas} semanas. Isso já é cuidado.`
        : `Semana ${dados.cicloSemana} do seu ciclo, ${dados.totalConcluidos} prática${
            dados.totalConcluidos > 1 ? "s" : ""
          } no corpo.`;
  return { fatias: percentuaisPorEixo(dados.eixos), conquistas: lista, conquistadas, frase };
}
