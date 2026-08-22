import { PERMISSOES, type Permissao } from "./permissoes";

export const FUNCOES_EQUIPE = [
  "administrador",
  "terapeuta",
  "editor",
  "assistente",
  "suporte",
] as const;

export type FuncaoEquipe = (typeof FUNCOES_EQUIPE)[number];

export const STATUS_EQUIPE = ["ativo", "suspenso"] as const;
export type StatusEquipe = (typeof STATUS_EQUIPE)[number];

export const ESCOPOS_EQUIPE = ["todos", "vinculados"] as const;
export type EscopoEquipe = (typeof ESCOPOS_EQUIPE)[number];

export const FUNCAO_LABEL: Record<FuncaoEquipe, string> = {
  administrador: "Administrador",
  terapeuta: "Terapeuta",
  editor: "Editor de conteúdo",
  assistente: "Assistente administrativo",
  suporte: "Suporte",
};

export const FUNCAO_DESCRICAO: Record<FuncaoEquipe, string> = {
  administrador: "Acesso completo, incluindo equipe e auditoria.",
  terapeuta: "Cuida dos clientes vinculados: planos, monitoramento e registros compartilhados.",
  editor: "Cria e publica materiais da biblioteca. Nenhum dado de cliente.",
  assistente: "Cadastro de clientes e pacotes. Sem diário e sem check-ins.",
  suporte: "Consulta cadastro de clientes e auditoria. Sem material sensível.",
};

/** Ponto de partida de cada função — depois pode ser ajustado item por item. */
export const FUNCAO_PERMISSOES: Record<FuncaoEquipe, Permissao[]> = {
  administrador: [...PERMISSOES],
  terapeuta: [
    "ver_clientes",
    "editar_clientes",
    "criar_planos",
    "monitorar_trilhas",
    "ver_registros",
  ],
  editor: ["criar_conteudos", "publicar_conteudos"],
  assistente: ["ver_clientes", "editar_clientes", "gerenciar_pacotes"],
  suporte: ["ver_clientes", "ver_auditoria"],
};

export const FUNCAO_ESCOPO_PADRAO: Record<FuncaoEquipe, EscopoEquipe> = {
  administrador: "todos",
  terapeuta: "vinculados",
  editor: "todos",
  assistente: "todos",
  suporte: "todos",
};

export const ESCOPO_LABEL: Record<EscopoEquipe, string> = {
  todos: "Todos os clientes",
  vinculados: "Somente clientes vinculados",
};

export const STATUS_LABEL: Record<StatusEquipe, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
};

export function ehFuncaoEquipe(valor: string): valor is FuncaoEquipe {
  return (FUNCOES_EQUIPE as readonly string[]).includes(valor);
}

/** Diz se as permissões atuais ainda batem com o padrão da função. */
export function funcaoPersonalizada(funcao: FuncaoEquipe, permissoes: readonly string[]) {
  const padrao = FUNCAO_PERMISSOES[funcao];
  if (padrao.length !== permissoes.length) return true;
  return !padrao.every((p) => permissoes.includes(p));
}

export function rotuloFuncao(funcao: FuncaoEquipe, permissoes: readonly string[]) {
  return funcaoPersonalizada(funcao, permissoes)
    ? `${FUNCAO_LABEL[funcao]} (personalizado)`
    : FUNCAO_LABEL[funcao];
}
