# Auditoria de desempenho e otimização (foco: Painel do Cliente e celular)

## Diagnóstico medido (antes de mudar código)

O que verifiquei no projeto e no banco:

1. **Cache desligado por padrão.** O `QueryClient` (`src/router.tsx`) é criado sem `staleTime`/`gcTime`. Com `staleTime: 0`, toda montagem de componente e toda volta para a aba refaz a requisição. Nos registros de rede aparecem chamadas idênticas repetidas em segundos (ex.: `adminAcompanhamento` duas vezes em 4s).
2. **Consultas duplicadas entre layout e página.** `contexto` é buscado no layout (`app.tsx`) e novamente em `app.index.tsx`, `app.progresso.tsx`, `app.perfil.tsx`. Sem cache, cada tela reabre a mesma chamada.
3. **Nenhuma rota usa `loader`.** Todo dado começa a carregar só depois da hidratação do JavaScript, o que gera a sensação de tela vazia no início.
4. **Importação de biblioteca de ícones inteira no Painel do Cliente.** `src/routes/_authenticated/app.index.tsx` faz `import * as icones from "lucide-react"`, o que arrasta o pacote completo de ícones para a primeira tela do cliente.
5. **Bibliotecas grandes no caminho comum.** Editor de texto (TipTap), arrastar-e-soltar (dnd-kit), gráficos (recharts) e geração de PDF (jspdf) estão importados de forma estática nas telas que os usam; sem carregamento sob demanda eles competem com o conteúdo inicial.
6. **Banco não é o gargalo hoje.** As tabelas têm volume mínimo (maior: 560 registros em auditoria) e as consultas principais já selecionam campos específicos e rodam em paralelo. Porém faltam índices para o crescimento: `atribuicoes`, `atribuicao_etapas`, `checkins`, `diario`, `notificacoes`, `solicitacoes_apoio`, `revisoes` e `conteudos` só têm chave primária/únicas — nada em `cliente_id`, `terapeuta_id`, `trilha_id`, `status`, `created_at`.
7. **Listas sem paginação** em clientes, conteúdos, trilhas, auditoria e monitoramento; buscas filtram em memória no cliente.
8. **Console e rede sem erros** no estado atual (verificado no navegador).

Conclusão: a lentidão percebida vem principalmente de (a) ausência de cache/dedupe, (b) tamanho do JavaScript inicial, (c) dados que só começam a carregar após a hidratação — não de consultas lentas.

## O que será feito

### 1. Cache e requisições
- Definir padrões no `QueryClient`: `staleTime` moderado, `gcTime`, `refetchOnWindowFocus: false`, `retry` com recuo.
- `staleTime` maior para dados estáveis (eixos, conteúdos publicados, configurações) e curto para progresso/notificações.
- Remover buscas duplicadas de `contexto` reaproveitando o cache compartilhado.
- Invalidação apenas nos pontos de alteração real (concluir prática, check-in, diário, liberação).
- Cancelamento de consultas antigas na troca de tela/busca; `placeholderData` para manter a lista anterior durante paginação.
- Nenhum cache persistente no navegador para diário, check-ins ou dados pessoais — apenas dados não sensíveis.

### 2. JavaScript inicial e carregamento
- Trocar a importação total de ícones por importações nomeadas com um mapa explícito dos ícones usados.
- Carregar sob demanda: editor de texto, arrastar-e-soltar, gráficos, geração de PDF e componentes de gráfico do progresso.
- Manter cabeçalho, menu e estrutura visíveis com esqueleto de conteúdo enquanto os dados chegam; nunca tela branca.
- Remover importações e componentes sem uso encontrados na varredura.

### 3. Painel do Cliente (prioridade)
- Tela inicial em coluna única no celular, na ordem pedida: saudação, trilha atual, orientação, próxima atividade, progresso, data de revisão, "Continuar minha prática", "Preciso de apoio", histórico resumido.
- Histórico na tela inicial limitado a um resumo; itens completos apenas na página de histórico, com paginação.
- Filtros da biblioteca com atraso de digitação (debounce) e sem recarregar tudo a cada tecla.
- Preservar a posição da atividade ao voltar; confirmar antes de abandonar resposta não salva.
- Botões de envio (check-in, diário, apoio, concluir) com estado local de progresso, bloqueio contra envio duplo, confirmação só após o banco responder e texto preservado em caso de falha.

### 4. Mídia
- `preload="metadata"` nos players, capa antes do arquivo, sem início automático múltiplo.
- Imagens com `loading="lazy"`, dimensões definidas para evitar deslocamento de layout, e reaproveitamento da URL assinada já obtida em vez de gerá-la novamente.
- Progresso de carregamento e opção de tentar de novo em falha de mídia.

### 5. Banco de dados (migração aditiva)
Somente `CREATE INDEX` — sem alterar tabelas, dados ou políticas de acesso:
- `atribuicoes(cliente_id)`, `atribuicoes(trilha_id)`, `atribuicoes(status)`
- `atribuicao_etapas(atribuicao_id)`
- `checkins(cliente_id, created_at DESC)`
- `diario(cliente_id, created_at DESC)`
- `notificacoes(user_id, lida)`
- `solicitacoes_apoio(cliente_id, status)`, `revisoes(cliente_id, agendada_para)`
- `conteudos(eixo_id)`, `conteudos(trilha_id)`, `liberacoes(cliente_id, status)`, `progresso(cliente_id, status)`
As regras de privacidade (RLS) permanecem exatamente como estão; os índices só aceleram as verificações existentes.

### 6. Listas e paginação
- Paginação por página em clientes, conteúdos, trilhas e monitoramento; por cursor em auditoria (lista que cresce sem limite).
- Filtros aplicados no servidor quando a lista passar do limite de página.

### 7. Responsividade e mobile
- Revisão em 320, 360, 375, 390, 412, 768 e 1024+ px: sem rolagem horizontal, tabelas viram cartões no celular, modais caem na tela, campos com fonte ≥16px (evita zoom do Safari), áreas de toque confortáveis, respeito às áreas seguras de aparelhos com recorte.
- Identidade visual preservada; ajustes apenas onde há quebra ou dificuldade de uso.

### 8. Verificação
- Medição antes/depois com o navegador (tempo até conteúdo principal, número de requisições por tela, tamanho do JavaScript inicial) no painel do cliente e no da terapeuta.
- Suíte de testes atual (416) mantida verde, mais testes novos para: sem envio duplicado, debounce da busca, paginação e ausência de rolagem horizontal no celular.
- Conferência de regressão dos fluxos: login/logout, sessão, convite e cadastro de cliente, criação de trilha e conteúdo, atribuição, painel do cliente, mídia, check-in/out, diário, apoio, monitoramento, permissões de equipe, "ver como cliente" e auditoria.

## Detalhes técnicos

- `src/router.tsx`: padrões do `QueryClient` (`staleTime`, `gcTime`, `refetchOnWindowFocus: false`, `retry`), mantendo `defaultPreloadStaleTime: 0`.
- `React.lazy` + `ClientOnly` para TipTap, dnd-kit, recharts e jspdf; `import()` dinâmico no gerador de relatório.
- Substituição de `import * as icones` por um mapa `Record<string, LucideIcon>` com importações nomeadas.
- Consultas de lista passam a receber `range()` e ordenação estável; auditoria usa cursor por `created_at`.
- `AbortSignal` das consultas do TanStack Query repassado às chamadas de função de servidor onde aplicável.
- Migração única, aditiva, com `CREATE INDEX IF NOT EXISTS` — reversível por `DROP INDEX`.

## Fora do escopo

- Nenhuma remoção de recurso, nenhuma alteração de identidade visual além de correções de responsividade, nenhum dado simulado, nenhuma mudança em políticas de acesso.
