/**
 * Lógica pura de apresentação da aba Perfil do cliente.
 *
 * A tela só compõe blocos; as frases, rótulos e recortes ficam aqui para
 * poderem ser testados sem renderizar nada.
 */
import { MODO_LABEL, type ModoUso } from "@/lib/modo-uso";

export type TextoModo = {
  titulo: string;
  descricao: string;
  /** o que a pessoa pode fazer a partir desse cartão */
  acao: "pedir-acompanhamento" | "pedir-apoio" | null;
  rotuloAcao: string | null;
};

/** Como explicamos o modo de uso para a própria pessoa, sem jargão. */
export function textoDoModo(modo: ModoUso, temTerapeuta: boolean): TextoModo {
  if (modo === "acompanhado") {
    return {
      titulo: MODO_LABEL.acompanhado,
      descricao: temTerapeuta
        ? "Você caminha com a terapeuta: as trilhas chegam pelo plano combinado, e existe um canal para pedir apoio entre as sessões."
        : "Seu acesso está preparado para o acompanhamento. Assim que a terapeuta vincular seu processo, o plano aparece aqui.",
      acao: temTerapeuta ? "pedir-apoio" : null,
      rotuloAcao: temTerapeuta ? "Preciso de apoio" : null,
    };
  }
  return {
    titulo: MODO_LABEL.autoguiado,
    descricao:
      "Você percorre as trilhas no seu tempo, sem acompanhamento individual. Quando quiser caminhar junto de alguém, pode pedir acompanhamento.",
    acao: "pedir-acompanhamento",
    rotuloAcao: "Quero acompanhamento",
  };
}

/** Frase de acolhimento conforme o ritmo semanal escolhido. */
export function rotuloMeta(meta: number): string {
  if (meta <= 2) return "Um ritmo leve, de quem prefere pouco e bem cuidado.";
  if (meta <= 4) return "Um ritmo constante, que cabe numa semana comum.";
  if (meta <= 6) return "Um ritmo dedicado — cuide para não virar cobrança.";
  return "Ritmo intenso: só sustente se estiver bem acompanhada.";
}

export const META_MINIMA = 1;
export const META_MAXIMA = 7;

export function limitarMeta(meta: number): number {
  if (!Number.isFinite(meta)) return 3;
  return Math.min(META_MAXIMA, Math.max(META_MINIMA, Math.round(meta)));
}

export type Medida = {
  chave: "praticas" | "sequencia" | "reflexoes";
  rotulo: string;
  valor: number;
  detalhe: string;
};

/** As três medidas curtas do "retrato do caminho". */
export function retratoDoCaminho(dados: {
  praticasConcluidas: number;
  streakSemanas: number;
  reflexoes: number;
}): Medida[] {
  return [
    {
      chave: "praticas",
      rotulo: "Práticas concluídas",
      valor: dados.praticasConcluidas,
      detalhe: dados.praticasConcluidas === 0 ? "A primeira ainda vem" : "no seu caminho até aqui",
    },
    {
      chave: "sequencia",
      rotulo: dados.streakSemanas === 1 ? "Semana seguida" : "Semanas seguidas",
      valor: dados.streakSemanas,
      detalhe:
        dados.streakSemanas === 0 ? "Começa na próxima prática" : "com pelo menos uma prática",
    },
    {
      chave: "reflexoes",
      rotulo: "Reflexões escritas",
      valor: dados.reflexoes,
      detalhe: dados.reflexoes === 0 ? "Seu diário está em branco" : "no seu diário",
    },
  ];
}

/** Validação do nome antes de mandar ao servidor. */
export function validarNome(valor: string): { ok: boolean; nome: string; erro: string | null } {
  const nome = valor.trim().replace(/\s+/g, " ");
  if (nome.length < 2) return { ok: false, nome, erro: "Escreva pelo menos duas letras." };
  if (nome.length > 80) return { ok: false, nome, erro: "Use no máximo 80 caracteres." };
  return { ok: true, nome, erro: null };
}

export type ItemPrivacidade = { titulo: string; texto: string };

/** O que é só da pessoa e o que a terapeuta enxerga, conforme o modo. */
export function itensPrivacidade(modo: ModoUso): ItemPrivacidade[] {
  const itens: ItemPrivacidade[] = [
    {
      titulo: "Só com você",
      texto:
        "Suas anotações de etapa, o painel de insights do diário e todas as reflexões marcadas como “só para mim”.",
    },
    {
      titulo: "Mídias protegidas",
      texto:
        "Áudios e vídeos abrem por links temporários, ligados à sua conta. Ninguém acessa por fora.",
    },
  ];
  if (modo === "acompanhado") {
    itens.splice(1, 0, {
      titulo: "A terapeuta enxerga",
      texto:
        "Seu progresso nas práticas, seus check-ins e apenas as reflexões que você escolheu compartilhar.",
    });
  } else {
    itens.splice(1, 0, {
      titulo: "Ninguém acompanha",
      texto:
        "Como você caminha por conta própria, nenhuma terapeuta lê o seu diário nem vê o seu progresso.",
    });
  }
  return itens;
}
