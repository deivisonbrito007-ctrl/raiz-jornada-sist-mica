/**
 * Contrato de segurança do banco (ver docs/seguranca-rls.md).
 *
 * Este módulo não faz I/O: recebe o SQL das migrations e devolve os desvios
 * encontrados. O teste `politicas-rls-contrato.test.ts` lê as migrations reais e
 * falha quando uma alteração futura reintroduz acesso indevido — especialmente a
 * exposição de funções internas e a flexibilização das tabelas de equipe.
 */

/** Funções auxiliares de RLS que só o service_role pode executar. */
export const FUNCOES_INTERNAS = ['has_role', 'tem_permissao', 'handle_new_user'] as const;

/** Única função intencionalmente pública: o cadastro precisa saber se já existe terapeuta. */
export const FUNCOES_PUBLICAS_PERMITIDAS = ['existe_terapeuta'] as const;

/** Tabelas de equipe: escrita apenas para quem tem `gerenciar_equipe`. */
export const TABELAS_EQUIPE = ['equipe_admins', 'equipe_permissoes', 'convites_equipe'] as const;

/** Tabela append-only: nunca pode receber policy de UPDATE/DELETE/ALL. */
export const TABELA_AUDITORIA = 'auditoria_equipe';

/** Tabela de papéis: sem policy de escrita, para evitar escalada de privilégio. */
export const TABELA_PAPEIS = 'user_roles';

export type Desvio = {
  regra:
    | 'funcao_interna_exposta'
    | 'execute_anon'
    | 'definer_sem_search_path'
    | 'policy_aberta'
    | 'policy_equipe_permissiva'
    | 'auditoria_mutavel'
    | 'papeis_gravavel';
  alvo: string;
  mensagem: string;
};

const RE_GRANT_FUNCAO =
  /grant\s+(?:execute|all)[\s\S]{0,160}?on\s+function\s+(?:public\.)?([a-z0-9_]+)\s*\([^)]*\)[\s\S]{0,120}?to\s+([a-z_,\s]+)/gi;

const RE_POLICY = /create\s+policy\s+"?([^"\n]+?)"?\s+on\s+public\.([a-z0-9_]+)([\s\S]{0,600}?);/gi;

/** Analisa o SQL agregado das migrations e retorna os desvios do contrato. */
export function auditarSql(sql: string): Desvio[] {
  const desvios: Desvio[] = [];
  const add = (regra: Desvio['regra'], alvo: string, mensagem: string) =>
    desvios.push({ regra, alvo, mensagem });

  for (const match of sql.matchAll(RE_GRANT_FUNCAO)) {
    const nome = match[1].toLowerCase();
    const papeis = match[2].toLowerCase();
    const paraApp = /\b(anon|authenticated|public)\b/.test(papeis);

    if ((FUNCOES_INTERNAS as readonly string[]).includes(nome) && paraApp) {
      add(
        'funcao_interna_exposta',
        nome,
        `Função interna ${nome}() recebeu EXECUTE para ${papeis.trim()}; deve ficar restrita ao service_role.`,
      );
    }
    if (/\banon\b/.test(papeis) && !(FUNCOES_PUBLICAS_PERMITIDAS as readonly string[]).includes(nome)) {
      add(
        'execute_anon',
        nome,
        `EXECUTE de ${nome}() concedido a anon; apenas existe_terapeuta() pode ser pública.`,
      );
    }
  }

  for (const bloco of sql.split(/create\s+(?:or\s+replace\s+)?function/i).slice(1)) {
    if (!/security\s+definer/i.test(bloco)) continue;
    const nome = bloco.match(/^\s*(?:public\.)?([a-z0-9_]+)/i)?.[1] ?? 'desconhecida';
    const cabecalho = bloco.split(/\$\$|\$function\$/)[0] ?? bloco;
    if (!/set\s+search_path/i.test(cabecalho)) {
      add('definer_sem_search_path', nome, `Função SECURITY DEFINER ${nome}() sem "set search_path".`);
    }
  }

  for (const match of sql.matchAll(RE_POLICY)) {
    const nome = match[1];
    const tabela = match[2].toLowerCase();
    const corpo = match[3];
    const alvo = `${tabela}:${nome}`;

    if (/\bto\s+(public|anon)\b/i.test(corpo)) {
      add('policy_aberta', alvo, `Policy "${nome}" em public.${tabela} concede acesso a public/anon.`);
    }

    const ehEquipe =
      (TABELAS_EQUIPE as readonly string[]).includes(tabela) || tabela === TABELA_AUDITORIA;

    if (ehEquipe && /using\s*\(\s*true\s*\)/i.test(corpo)) {
      add(
        'policy_equipe_permissiva',
        alvo,
        `Policy "${nome}" em public.${tabela} usa USING (true); tabelas de equipe exigem gerenciar_equipe.`,
      );
    }

    if (tabela === TABELA_AUDITORIA && /\bfor\s+(update|delete|all)\b/i.test(corpo)) {
      add(
        'auditoria_mutavel',
        alvo,
        `${TABELA_AUDITORIA} deve ser append-only: policy "${nome}" permite UPDATE/DELETE/ALL.`,
      );
    }

    if (tabela === TABELA_PAPEIS && /\bfor\s+(insert|update|delete|all)\b/i.test(corpo)) {
      add(
        'papeis_gravavel',
        alvo,
        `${TABELA_PAPEIS} não pode ter policy de escrita ("${nome}"): risco de escalada de privilégio.`,
      );
    }
  }

  return desvios;
}
