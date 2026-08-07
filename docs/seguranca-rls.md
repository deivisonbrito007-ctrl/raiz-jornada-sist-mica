# Segurança de dados do Raiz — RLS, funções internas e tabelas de equipe

Documento de referência para revisões e para qualquer migration futura.
Regra geral: **nenhuma alteração pode ampliar o alcance de funções internas nem
expor tabelas de equipe além dos papéis descritos aqui.**

## 1. Papéis e camadas

| Camada | Quem executa | O que protege |
| --- | --- | --- |
| `GRANT` de tabela | `anon`, `authenticated`, `service_role` | alcance bruto da Data API |
| Policies RLS | sempre `TO authenticated` | quais linhas cada pessoa vê/escreve |
| Funções `SECURITY DEFINER` | ver seção 3 | decisões de papel/permissão |
| Guards no servidor (`src/lib/permissao-guard.ts`) | server functions | valida permissão antes de devolver dado sensível |

Todas as policies do projeto são declaradas `TO authenticated`. Por isso, mesmo
que o papel `anon` tenha GRANT de tabela (padrão do template), ele não passa por
nenhuma policy e não lê nada. **Não criar policy com `TO public`, `TO anon` ou
`USING (true)` em tabela com dado de cliente.**

## 2. Matriz de acesso por tabela

| Tabela | Cliente | Terapeuta / admin com permissão | Observação |
| --- | --- | --- | --- |
| `profiles` | vê/edita o próprio | lê com `ver_clientes`; edita se `is_terapeuta()` | sem DELETE |
| `user_roles` | vê o próprio papel | lê com `ver_clientes` ou `gerenciar_equipe` | **sem INSERT/UPDATE/DELETE por policy**: papéis só mudam por trigger/RPC |
| `eixos`, `pacotes` | leitura | escrita com `gerenciar_conteudos` / `gerenciar_pacotes` | catálogo |
| `conteudos` | só o que `conteudo_liberado()` aprova | escrita com `gerenciar_conteudos` | nunca afrouxar o SELECT |
| `liberacoes`, `notificacoes`, `clientes_pacotes` | só as próprias linhas | com `gerenciar_liberacoes` / `ver_clientes` / `gerenciar_pacotes` | |
| `progresso` | escreve/lê o próprio (`cliente_id = auth.uid()`) | lê com `ver_clientes` | sem DELETE |
| `diario` | CRUD do próprio | lê com `ver_diario` | conteúdo sensível: nunca dar escrita a admin |
| `equipe_admins` | vê a própria linha | gestão com `gerenciar_equipe` | |
| `equipe_permissoes` | vê as próprias | gestão com `gerenciar_equipe` | fonte da matriz de permissões |
| `convites_equipe` | nenhum acesso | gestão com `gerenciar_equipe` | token só circula pelo link; aceite via RPC |
| `auditoria_equipe` | nenhum acesso | leitura com `gerenciar_equipe`; INSERT exige `pode_administrar()` e `ator_id = auth.uid()` | **append-only**: sem UPDATE/DELETE |

Invariantes das tabelas de equipe:

1. `equipe_admins` / `equipe_permissoes` / `convites_equipe` só são graváveis por
   quem tem `gerenciar_equipe`. Não adicionar policy de auto-promoção
   (`user_id = auth.uid()` em INSERT/UPDATE) — isso é escalada de privilégio.
2. `auditoria_equipe` nunca ganha UPDATE ou DELETE, e o INSERT continua amarrado
   a `ator_id = auth.uid()` para o log não poder ser falsificado.
3. `user_roles` continua sem policies de escrita. Promoções passam por
   `handle_new_user()` / `aceitar_convite_equipe()`.

## 3. Funções internas vs. RPCs do app

`EXECUTE` é revogado de `PUBLIC` em todas as funções. O estado esperado:

| Função | anon | authenticated | Motivo |
| --- | --- | --- | --- |
| `has_role` | ✗ | ✗ | helper interno de RLS; chamada direta permitiria sondar papéis |
| `tem_permissao` | ✗ | ✗ | helper interno; a versão pública é `pode()` (usa `auth.uid()`) |
| `handle_new_user` | ✗ | ✗ | trigger; nunca exposta |
| `is_terapeuta` | ✗ | ✓ | usa só a sessão atual |
| `pode` | ✗ | ✓ | usa só a sessão atual |
| `pode_administrar` | ✗ | ✓ | usa só a sessão atual |
| `conteudo_liberado` | ✗ | ✓ | usada nas policies de conteúdo |
| `aceitar_convite_equipe` | ✗ | ✓ | precisa de sessão para casar e-mail do convite |
| `existe_terapeuta` | ✓ | ✓ | exceção consciente: o cadastro precisa saber se já há terapeuta. Retorna só um booleano, sem dado pessoal |

Regras para migrations futuras:

- Toda função nova é `SECURITY DEFINER` **com `SET search_path = public`** ou
  então `SECURITY INVOKER`.
- Funções que recebem `_user_id` como argumento são internas: `REVOKE EXECUTE ...
  FROM PUBLIC, anon, authenticated;`. Se o app precisa do dado, criar um wrapper
  sem argumento que derive de `auth.uid()`.
- Nunca conceder `EXECUTE ... TO anon` (exceto `existe_terapeuta`).
- `CREATE OR REPLACE FUNCTION` **preserva** os grants; `DROP` + `CREATE`
  **reintroduz `EXECUTE TO PUBLIC`**. Ao recriar uma função interna, repetir o
  bloco de revoke na mesma migration.

Modelo para função interna:

```sql
CREATE OR REPLACE FUNCTION public.minha_funcao(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ ... $$;

REVOKE ALL ON FUNCTION public.minha_funcao(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minha_funcao(uuid) TO service_role;
```

## 4. Checklist antes de aprovar uma migration

- [ ] Tabela nova tem `GRANT`, `ENABLE ROW LEVEL SECURITY` e ao menos uma policy.
- [ ] Nenhuma policy nova com `TO public` / `TO anon` / `USING (true)` em dado de cliente.
- [ ] Nenhum `GRANT EXECUTE` de função interna para `anon`/`authenticated`.
- [ ] Função `SECURITY DEFINER` com `SET search_path`.
- [ ] Tabelas de equipe mantêm as três invariantes da seção 2.
- [ ] `bunx vitest run src/lib/politicas-rls-contrato.test.ts` verde (o teste lê
      as migrations e reprova violações do contrato).

## 5. Onde isso é verificado automaticamente

- `src/lib/politicas-rls-contrato.ts` — codifica as regras deste documento
  (funções internas, policies abertas, tabelas de equipe, auditoria append-only,
  `user_roles` sem escrita).
- `src/lib/politicas-rls-contrato.test.ts` — lê todas as migrations e falha se
  alguma alteração violar o contrato. Roda no CI junto do restante da suíte.
- `src/lib/permissao-guard.test.ts` e `src/lib/admin-permissoes-servidor.test.ts`
  — guards de permissão no servidor antes de devolver dado sensível.
- `src/lib/auditoria-acesso.test.ts` — registro de acessos negados.
