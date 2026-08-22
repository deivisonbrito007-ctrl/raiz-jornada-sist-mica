export const PERMISSOES = [
  "ver_clientes",
  "ver_registros",
  "criar_planos",
  "criar_conteudos",
  "gerenciar_pacotes",
  "gerenciar_equipe",
] as const;

export type Permissao = (typeof PERMISSOES)[number];

export const PERMISSAO_LABEL: Record<Permissao, string> = {
  ver_clientes: "Ver clientes e progresso",
  ver_registros: "Ver diário dos clientes",
  criar_planos: "Liberar e agendar conteúdos",
  criar_conteudos: "Gerenciar biblioteca e eixos",
  gerenciar_pacotes: "Gerenciar pacotes e valores",
  gerenciar_equipe: "Gerenciar equipe de admins",
};

export const PERMISSAO_DESCRICAO: Record<Permissao, string> = {
  ver_clientes: "Acessa a lista de clientes, streaks e progresso das trilhas.",
  ver_registros: "Lê as reflexões escritas pelos clientes. Conteúdo sensível.",
  criar_planos: "Libera, revoga e agenda conteúdos para cada cliente.",
  criar_conteudos: "Cria e edita eixos, mídias, textos e exercícios.",
  gerenciar_pacotes: "Cria pacotes, define valores e vincula clientes.",
  gerenciar_equipe: "Convida, promove e remove outros administradores.",
};

export function ehPermissao(valor: string): valor is Permissao {
  return (PERMISSOES as readonly string[]).includes(valor);
}

/** Perfis prontos para acelerar a escolha de permissões no convite. */
export const PERFIS_PERMISSAO: { id: string; nome: string; permissoes: Permissao[] }[] = [
  { id: "acompanhamento", nome: "Acompanhamento", permissoes: ["ver_clientes"] },
  {
    id: "curadoria",
    nome: "Curadoria de conteúdo",
    permissoes: ["ver_clientes", "criar_conteudos", "criar_planos"],
  },
  {
    id: "clinico",
    nome: "Apoio clínico",
    permissoes: ["ver_clientes", "ver_registros", "criar_planos"],
  },
  {
    id: "completo",
    nome: "Coadministração total",
    permissoes: [...PERMISSOES],
  },
];
