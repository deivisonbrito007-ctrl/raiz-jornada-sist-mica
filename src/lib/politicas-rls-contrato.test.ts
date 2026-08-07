import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  auditarSql,
  FUNCOES_INTERNAS,
  FUNCOES_PUBLICAS_PERMITIDAS,
  TABELA_AUDITORIA,
  TABELA_PAPEIS,
  TABELAS_EQUIPE,
} from './politicas-rls-contrato';

const DIR = join(process.cwd(), 'supabase/migrations');

function sqlDasMigrations(): string {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(DIR, f), 'utf8'))
    .join('\n');
}

describe('contrato de RLS e funções internas (docs/seguranca-rls.md)', () => {
  const sql = sqlDasMigrations();

  it('as migrations atuais não violam o contrato de segurança', () => {
    const desvios = auditarSql(sql);
    expect(
      desvios.map((d) => `${d.regra} :: ${d.alvo} :: ${d.mensagem}`),
      'Consulte docs/seguranca-rls.md antes de alterar policies ou grants de função.',
    ).toEqual([]);
  });

  it('mantém o EXECUTE das funções internas revogado do app', () => {
    for (const fn of FUNCOES_INTERNAS) {
      const revogado = new RegExp(`revoke[\\s\\S]{0,80}?on\\s+function\\s+public\\.${fn}`, 'i').test(sql);
      expect(revogado, `${fn}() precisa de REVOKE explícito nas migrations`).toBe(true);
    }
  });

  it('detecta EXECUTE de função interna concedido ao app', () => {
    const desvios = auditarSql(
      'GRANT EXECUTE ON FUNCTION public.tem_permissao(uuid, text) TO authenticated;',
    );
    expect(desvios.map((d) => d.regra)).toContain('funcao_interna_exposta');
  });

  it('detecta EXECUTE concedido a anon, exceto existe_terapeuta', () => {
    expect(
      auditarSql('GRANT EXECUTE ON FUNCTION public.pode(text) TO anon;').map((d) => d.regra),
    ).toContain('execute_anon');

    expect(
      auditarSql(
        `GRANT EXECUTE ON FUNCTION public.${FUNCOES_PUBLICAS_PERMITIDAS[0]}() TO anon, authenticated;`,
      ),
    ).toEqual([]);
  });

  it('detecta SECURITY DEFINER sem search_path', () => {
    const desvios = auditarSql(
      'CREATE OR REPLACE FUNCTION public.nova() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$;',
    );
    expect(desvios.map((d) => d.regra)).toContain('definer_sem_search_path');
  });

  it('detecta policy aberta a public/anon', () => {
    const desvios = auditarSql(
      'CREATE POLICY "tudo" ON public.diario FOR SELECT TO anon USING (true);',
    );
    expect(desvios.map((d) => d.regra)).toContain('policy_aberta');
  });

  it('detecta policy permissiva nas tabelas de equipe', () => {
    for (const tabela of TABELAS_EQUIPE) {
      const desvios = auditarSql(
        `CREATE POLICY "aberta" ON public.${tabela} FOR SELECT TO authenticated USING (true);`,
      );
      expect(desvios.map((d) => d.regra), tabela).toContain('policy_equipe_permissiva');
    }
  });

  it('exige auditoria append-only e user_roles sem escrita', () => {
    expect(
      auditarSql(
        `CREATE POLICY "edita" ON public.${TABELA_AUDITORIA} FOR UPDATE TO authenticated USING (pode('gerenciar_equipe'));`,
      ).map((d) => d.regra),
    ).toContain('auditoria_mutavel');

    expect(
      auditarSql(
        `CREATE POLICY "promove" ON public.${TABELA_PAPEIS} FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());`,
      ).map((d) => d.regra),
    ).toContain('papeis_gravavel');
  });
});
