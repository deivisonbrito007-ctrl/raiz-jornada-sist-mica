# Cache por sessão para barra lateral e painéis (cliente e terapeuta)

## Situação atual (verificada no código)

- O cache do TanStack Query vive só na memória: qualquer recarregamento de página descarta tudo e a barra lateral, o contexto do usuário e as listas do painel são buscados de novo. Não há nenhum persistidor instalado.
- O mesmo dado (contexto/permissões do usuário, via `getMeuContexto`) é buscado com duas chaves diferentes: `["contexto"]` no app do cliente e `["meu-contexto"]` no painel do terapeuta. Isso dobra requisições e faz uma tela ficar desatualizada quando a outra atualiza.
- As chaves de cache estão espalhadas como strings literais em ~25 arquivos, então invalidações são feitas "de memória" e é fácil esquecer uma (ex.: concluir prática invalida `biblioteca`/`trilha`, mas não `minha-jornada`, `progresso` nem `historico` em todos os caminhos).
- Permissões já têm invalidação em tempo real (`useVigiaPermissoes` + cache de 30s de `pode_administrar`), o que precisa continuar funcionando e agora também limpar o cache persistido.

## O que vamos fazer

### 1. Catálogo único de chaves de cache
Criar `src/lib/cache-chaves.ts` com todas as chaves (contexto, biblioteca, trilha, conteúdo, jornada, etapa, progresso, histórico, diário, notificações, admin-*, equipe, auditoria) e grupos de invalidação nomeados:
- `aoConcluirPratica` → biblioteca, trilha, jornada, etapa, progresso, histórico, contexto
- `aoEscreverDiario` → diário, histórico, progresso
- `aoMudarLiberacoes` → biblioteca, trilha, conteúdo, jornada
- `aoMudarPermissoes` → contexto + tudo do painel
- `aoMudarDadosAdmin` → admin-clientes, admin-trilhas, admin-acompanhamento, admin-resumo, equipe

Substituir as strings literais por essas chaves nas telas e hooks existentes, sem mudar o comportamento de nenhuma consulta.

### 2. Uma só fonte para o contexto/permissões
Unificar `["contexto"]` e `["meu-contexto"]` na mesma chave e criar um `useMeuContexto()` compartilhado por `app.tsx`, `admin.tsx`, `use-minhas-permissoes.ts`, perfis e entrada. Uma requisição serve cliente e terapeuta; uma invalidação atualiza os dois.

### 3. Persistência por sessão
Instalar `@tanstack/react-query-persist-client` e persistir o cache em `sessionStorage` (dura enquanto a aba/sessão existe; some ao fechar o navegador):
- Chave do armazenamento inclui o ID do usuário e uma versão do cache (`buster`), então trocar de conta ou publicar uma versão nova nunca reaproveita dado antigo.
- Lista de permissão: só consultas de navegação/listagem são persistidas. **Nunca** persistir URLs assinadas de mídia (`conteudo`), diário, dados de check-in ou qualquer coisa sensível/expirável.
- Máximo de idade de 12 horas; dados persistidos entram como "stale", então a tela aparece na hora e revalida em segundo plano.

### 4. Invalidação correta
- No `__root.tsx`: em `SIGNED_OUT` e em troca de usuário, limpar o cache em memória **e** o persistido (hoje só o de memória é tratado).
- Em `useVigiaPermissoes`: além de limpar o cache de `pode_administrar` e invalidar as consultas, apagar o cache persistido antes de redirecionar quando o acesso é removido — para que a barra lateral nunca reapareça com itens antigos após recarregar.
- Realtime de liberações/conteúdos (`use-sincronizar-liberacoes`) passa a usar os grupos do catálogo, garantindo que jornada e histórico também caiam.
- Barra lateral: os itens visíveis continuam derivados do contexto; com persistência eles aparecem imediatamente ao recarregar e se corrigem assim que a revalidação responde.

### 5. Testes
- Novos testes para o catálogo de grupos (cada evento invalida exatamente o conjunto esperado).
- Teste de persistência: cache restaurado do `sessionStorage` na mesma sessão; ignorado quando o usuário muda; consultas sensíveis não persistidas; limpo no logout e na remoção de acesso admin.
- Rodar a suíte inteira (427 testes) e o typecheck.

## Detalhes técnicos

- Novo: `src/lib/cache-chaves.ts`, `src/lib/cache-persistente.ts` (persister com `sessionStorage`, `dehydrateOptions` com lista de permissão, `limparCachePersistido()`), `src/hooks/use-meu-contexto.ts`.
- Alterados: `src/router.tsx` (envolver com `PersistQueryClientProvider` no cliente; SSR segue sem persistência), `src/routes/__root.tsx`, `src/routes/_authenticated/{app,admin}.tsx`, `use-minhas-permissoes.ts`, `use-vigia-permissoes.ts`, `use-sincronizar-liberacoes.ts`, `use-pre-aquecer-painel.ts` e as telas que usam chaves literais.
- `staleTime`/`gcTime` globais (60s/10min) permanecem; o `refetchInterval` de 5min do painel também.
- Sem mudanças de banco, RLS ou regras de permissão: segurança continua no servidor, o cache é só de navegação.
