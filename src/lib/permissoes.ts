export const PERMISSOES = [
  "ver_clientes",
  "ver_diario",
  "gerenciar_liberacoes",
  "gerenciar_conteudos",
  "gerenciar_pacotes",
  "gerenciar_equipe",
] as const;

export type Permissao = (typeof PERMISSOES)[number];

export const PERMISSAO_LABEL: Record<Permissao, string> = {
  ver_clientes: "Ver clientes e progresso",
  ver_diario: "Ver diário dos clientes",
  gerenciar_liberacoes: "Liberar e agendar conteúdos",
  gerenciar_conteudos: "Gerenciar biblioteca e eixos",
  gerenciar_pacotes: "Gerenciar pacotes e valores",
  gerenciar_equipe: "Gerenciar equipe de admins",
};

export const PERMISSAO_DESCRICAO: Record<Permissao, string> = {
  ver_clientes: "Acessa a lista de clientes, streaks e progresso das trilhas.",
  ver_diario: "Lê as reflexões escritas pelos clientes. Conteúdo sensível.",
  gerenciar_liberacoes: "Libera, revoga e agenda conteúdos para cada cliente.",
  gerenciar_conteudos: "Cria e edita eixos, mídias, textos e exercícios.",
  gerenciar_pacotes: "Cria pacotes, define valores e vincula clientes.",
  gerenciar_equipe: "Convida, promove e remove outros administradores.",
};

export function ehPermissao(valor: string): valor is Permissao {
  return (PERMISSOES as readonly string[]).includes(valor);
}
