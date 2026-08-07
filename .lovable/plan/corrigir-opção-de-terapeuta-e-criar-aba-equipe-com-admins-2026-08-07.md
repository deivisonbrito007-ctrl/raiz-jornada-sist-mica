# Corrigir opção de terapeuta e criar aba Equipe com admins

## O problema confirmado

Já existe 1 conta com papel de terapeuta no banco, e o cadastro **já recusa** novos terapeutas (quem marca a caixa entra como cliente, em silêncio). O erro é só visual: a caixa "Sou a terapeuta responsável por este espaço" é fixa na tela e nunca consulta o banco.

## Parte 1 — Esconder a opção quando já existe terapeuta

- Nova função de banco `existe_terapeuta()` (leitura segura, sem expor a lista de papéis) que responde apenas sim/não, consultável na tela de cadastro.
- Na tela de criar conta, a caixa aparece somente quando ainda não existe terapeuta. Quando existir, ela desaparece por completo.
- Se alguém tentar forçar o papel de terapeuta no cadastro com um terapeuta já existente, o banco continua ignorando (comportamento atual, mantido).

## Parte 2 — Aba "Equipe" no painel do terapeuta

Nova página `/admin/equipe`, visível só para você (dona), com três blocos:

1. **Membros** — lista de admins ativos com nome, e-mail, permissões atuais, botão para editar permissões e para remover o acesso.
2. **Convidar por e-mail** — você cadastra o e-mail e marca as permissões; ao criar a conta com aquele e-mail, a pessoa já entra como admin com exatamente essas permissões. Convites pendentes podem ser reenviados/cancelados.
3. **Promover conta existente** — busca por e-mail entre as contas já criadas e promove a admin, escolhendo as permissões.

### Permissões escolhidas por você (por admin)

Cada admin recebe só o que você marcar:

- Ver clientes e progresso
- Ver diário dos clientes (separado, por ser conteúdo sensível)
- Liberar e agendar conteúdos
- Gerenciar biblioteca (mídias, textos, eixos)
- Gerenciar pacotes e valores
- Gerenciar equipe (adicionar/remover outros admins)

O papel "terapeuta" (você) continua com acesso total e é o único que nunca pode ser removido. O menu do painel e as páginas passam a se adaptar: um admin sem "ver diário", por exemplo, não vê essa seção nem consegue carregar esses dados.

## Sugestões incluídas

- Registro de auditoria de quem alterou permissões e liberações, reaproveitando a auditoria de acesso que já existe.
- Nunca deixar o sistema sem dona: bloquear a remoção do último terapeuta.
- Aviso no cadastro quando o e-mail tem convite pendente ("você foi convidada para administrar este espaço").

## Detalhes técnicos

- Migração: valor `admin` no enum `app_role`; tabela `equipe_permissoes (user_id, permissao, created_at)` e `convites_equipe (email, permissoes text[], status, criado_por, created_at)`, ambas com GRANTs e RLS restritas a terapeuta/admin com permissão `gerenciar_equipe`.
- Funções security definer: `existe_terapeuta()` (EXECUTE para anon), `tem_permissao(_user_id, _perm)` e `pode_administrar()`; `handle_new_user()` passa a consumir convite pendente pelo e-mail e aplicar as permissões.
- RLS existentes de `conteudos`, `liberacoes`, `pacotes`, `progresso`, `diario` e `profiles` trocam `is_terapeuta()` por `is_terapeuta() OR tem_permissao(auth.uid(), '<permissão>')`.
- Server functions novas em `src/lib/equipe.functions.ts` (listar equipe, convidar, promover, atualizar permissões, revogar), todas verificando papel/permissão antes de qualquer escrita e usando `supabaseAdmin` só onde necessário.
- `src/routes/auth.tsx` consulta `existe_terapeuta()` para renderizar a caixa; `src/routes/_authenticated/admin.tsx` ganha o item de menu Equipe filtrado por permissão.
- Testes: `equipe-escopo.test.ts` (admin sem permissão não lê/escreve fora do escopo, último terapeuta não pode ser removido) e teste da tela de cadastro com e sem terapeuta existente.
