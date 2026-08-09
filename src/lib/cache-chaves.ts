import type { QueryClient } from "@tanstack/react-query";

/**
 * Catálogo único das chaves de cache do app.
 *
 * Antes, cada tela escrevia a chave "na mão" (`["biblioteca"]`, `["trilha"]`…),
 * o que fazia invalidações esquecerem telas irmãs (concluir uma prática mexia na
 * biblioteca mas deixava a Jornada e o Histórico velhos). Aqui as chaves ficam
 * num só lugar, junto dos GRUPOS por evento — quem escreve dado só precisa dizer
 * o que aconteceu.
 */
export const CHAVES = {
  /** contexto/permissões da pessoa autenticada (cliente e terapeuta) */
  contexto: ["contexto"] as const,
  biblioteca: ["biblioteca"] as const,
  trilha: ["trilha"] as const,
  conteudo: ["conteudo"] as const,
  jornada: ["minha-jornada"] as const,
  etapa: ["minha-etapa"] as const,
  progresso: ["progresso"] as const,
  historico: ["historico"] as const,
  diario: ["diario"] as const,
  notificacoes: ["notificacoes"] as const,
  preferenciasLembretes: ["preferencias-lembretes"] as const,
  adminResumo: ["admin-resumo"] as const,
  adminClientes: ["admin-clientes"] as const,
  adminTrilhas: ["admin-trilhas"] as const,
  adminConteudos: ["admin-conteudos"] as const,
  adminAcompanhamento: ["admin-acompanhamento"] as const,
  adminLembretes: ["admin-lembretes"] as const,
  equipe: ["equipe"] as const,
  equipeAuditoria: ["equipe-auditoria"] as const,
  auditoriaNegados: ["auditoria-acessos-negados"] as const,
} satisfies Record<string, readonly [string]>;

export type ChaveRaiz = (typeof CHAVES)[keyof typeof CHAVES][0];

/** chave de um item específico, ex.: `chaveDe(CHAVES.conteudo, id)` */
export function chaveDe(base: readonly [string], ...partes: Array<string | number>) {
  return [base[0], ...partes] as const;
}

/**
 * Grupos de invalidação por evento de escrita. Cada entrada lista as raízes que
 * ficam desatualizadas quando aquele evento acontece.
 */
export const GRUPOS = {
  aoConcluirPratica: [
    CHAVES.biblioteca,
    CHAVES.trilha,
    CHAVES.jornada,
    CHAVES.etapa,
    CHAVES.progresso,
    CHAVES.historico,
    CHAVES.contexto,
  ],
  aoEscreverDiario: [CHAVES.diario, CHAVES.historico, CHAVES.progresso],
  aoMudarLiberacoes: [
    CHAVES.biblioteca,
    CHAVES.trilha,
    CHAVES.conteudo,
    CHAVES.jornada,
    CHAVES.etapa,
    CHAVES.contexto,
    CHAVES.progresso,
    CHAVES.historico,
  ],
  aoMudarPermissoes: [
    CHAVES.contexto,
    CHAVES.adminResumo,
    CHAVES.adminClientes,
    CHAVES.adminTrilhas,
    CHAVES.adminConteudos,
    CHAVES.adminAcompanhamento,
    CHAVES.equipe,
    CHAVES.equipeAuditoria,
  ],
  aoMudarDadosAdmin: [
    CHAVES.adminResumo,
    CHAVES.adminClientes,
    CHAVES.adminTrilhas,
    CHAVES.adminConteudos,
    CHAVES.adminAcompanhamento,
    CHAVES.equipe,
  ],
} satisfies Record<string, ReadonlyArray<readonly [string]>>;

export type Evento = keyof typeof GRUPOS;

/** raízes afetadas por um evento (útil em testes e para depuração) */
export function raizesDoEvento(evento: Evento): string[] {
  return GRUPOS[evento].map((c) => c[0]);
}

/** Invalida no cache tudo o que o evento tornou obsoleto. */
export function invalidarPorEvento(queryClient: QueryClient, evento: Evento) {
  return Promise.all(
    GRUPOS[evento].map((chave) => queryClient.invalidateQueries({ queryKey: chave })),
  );
}
