/**
 * Boas-vindas do Início — módulo puro.
 *
 * Um checklist curto que explica o essencial (eixos, prática, diário, ritmo) e
 * desaparece sozinho quando a pessoa já caminhou. Nunca bloqueia a tela.
 */

export type EstadoOnboarding = {
  escolheuEixos: boolean;
  fezPratica: boolean;
  escreveuDiario: boolean;
  definiuRitmo: boolean;
  dispensadoEm?: string | null;
  concluidoEm?: string | null;
};

export type PassoOnboarding = {
  chave: "eixos" | "pratica" | "diario" | "ritmo";
  titulo: string;
  descricao: string;
  acao: string;
  para: string;
  feito: boolean;
};

export function passosOnboarding(estado: EstadoOnboarding): PassoOnboarding[] {
  return [
    {
      chave: "eixos",
      titulo: "Escolha seus eixos",
      descricao: "Os eixos são os temas do trabalho sistêmico. Diga quais falam com você.",
      acao: "Escolher eixos",
      para: "/app/eixos-preferidos",
      feito: estado.escolheuEixos,
    },
    {
      chave: "pratica",
      titulo: "Faça sua primeira prática",
      descricao: "Na Jornada, cada etapa se abre no seu tempo — com abertura, prática e fecho.",
      acao: "Abrir a Jornada",
      para: "/app/jornada",
      feito: estado.fezPratica,
    },
    {
      chave: "diario",
      titulo: "Registre no Diário",
      descricao: "O Diário é seu. Você decide o que fica só com você e o que compartilha.",
      acao: "Abrir o Diário",
      para: "/app/diario",
      feito: estado.escreveuDiario,
    },
    {
      chave: "ritmo",
      titulo: "Combine seu ritmo",
      descricao: "Um lembrete semanal, no dia e hora que você escolher. Pode pausar quando quiser.",
      acao: "Ajustar lembretes",
      para: "/app/lembretes",
      feito: estado.definiuRitmo,
    },
  ];
}

/** Mostra as boas-vindas só quando ainda há passo pendente e nada foi dispensado. */
export function deveMostrarOnboarding(estado: EstadoOnboarding) {
  if (estado.dispensadoEm || estado.concluidoEm) return false;
  return passosOnboarding(estado).some((p) => !p.feito);
}

export function progressoOnboarding(estado: EstadoOnboarding) {
  const passos = passosOnboarding(estado);
  const feitos = passos.filter((p) => p.feito).length;
  return {
    passos,
    feitos,
    total: passos.length,
    percentual: Math.round((feitos / passos.length) * 100),
    completo: feitos === passos.length,
  };
}
