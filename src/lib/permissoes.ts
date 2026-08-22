export const PERMISSOES = [
  "ver_clientes",
  "editar_clientes",
  "criar_planos",
  "monitorar_trilhas",
  "ver_registros",
  "criar_conteudos",
  "publicar_conteudos",
  "gerenciar_pacotes",
  "gerenciar_equipe",
  "ver_auditoria",
] as const;

export type Permissao = (typeof PERMISSOES)[number];

export const PERMISSAO_LABEL: Record<Permissao, string> = {
  ver_clientes: "Visualizar clientes",
  editar_clientes: "Editar clientes",
  criar_planos: "Criar planos de acompanhamento",
  monitorar_trilhas: "Monitorar trilhas",
  ver_registros: "Ver registros compartilhados",
  criar_conteudos: "Criar conteúdos",
  publicar_conteudos: "Publicar conteúdos",
  gerenciar_pacotes: "Gerenciar pacotes",
  gerenciar_equipe: "Gerenciar equipe",
  ver_auditoria: "Ver auditoria",
};

export const PERMISSAO_DESCRICAO: Record<Permissao, string> = {
  ver_clientes: "Abre a lista de clientes, cadastro e progresso das trilhas.",
  editar_clientes: "Altera cadastro, modo de uso e situação do acesso do cliente.",
  criar_planos: "Monta e libera planos, trilhas e conteúdos para cada cliente.",
  monitorar_trilhas: "Acompanha o andamento, envia orientações e ajusta prazos.",
  ver_registros: "Lê diário compartilhado, check-ins e revisões. Conteúdo sensível.",
  criar_conteudos: "Cria e edita eixos, trilhas, mídias, textos e exercícios.",
  publicar_conteudos: "Publica ou arquiva materiais na biblioteca.",
  gerenciar_pacotes: "Cria pacotes, define valores e registra pagamentos.",
  gerenciar_equipe: "Convida, define funções, suspende e remove integrantes.",
  ver_auditoria: "Consulta o histórico de ações e as tentativas de acesso negadas.",
};

/** Permissões que expõem material sensível do cliente. */
export const PERMISSOES_SENSIVEIS: Permissao[] = ["ver_registros", "gerenciar_equipe"];

export function ehPermissao(valor: string): valor is Permissao {
  return (PERMISSOES as readonly string[]).includes(valor);
}

export function filtrarPermissoes(valores: readonly string[]): Permissao[] {
  return valores.filter((v): v is Permissao => ehPermissao(v));
}
