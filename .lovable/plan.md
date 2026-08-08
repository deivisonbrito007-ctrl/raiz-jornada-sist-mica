# Histórico do cliente por trilha

Nova página onde a pessoa vê, trilha por trilha, tudo o que já foi liberado para ela, o que concluiu (com data) e as reflexões que escreveu.

## O que a pessoa vê

- Rota nova `/app/historico`, com título "Meu histórico".
- Resumo no topo: total de práticas liberadas, quantas concluídas, percentual e data da última conclusão.
- Uma seção por trilha (eixo), em ordem, cada uma mostrando:
  - contador "X de Y concluídas" e barra de progresso da trilha;
  - lista das práticas liberadas com tipo, duração, selo de estado (Concluída / Em andamento / Não iniciada) e a data de conclusão quando houver;
  - as reflexões do diário ligadas àquela prática (data + texto), recolhidas por padrão e abertas por um botão "Ver reflexões (N)";
  - link para abrir a prática no player.
- Reflexões sem prática vinculada aparecem em um bloco final "Reflexões gerais".
- Filtros simples: busca por texto (título da prática ou conteúdo da reflexão) e filtro de estado (todas / concluídas / pendentes), no mesmo padrão visual já usado na biblioteca.
- Estado vazio acolhedor quando nada foi liberado ainda, com link para a biblioteca.

## Como se chega até lá

- Botão "Ver histórico completo" na tela de Progresso e um item em Perfil. As abas inferiores continuam quatro (Início, Progresso, Diário, Perfil) para não apertar a barra no celular.

## Acessibilidade

- Um único `h1`, seções com `h2` por trilha e listas semânticas.
- Botões de expandir reflexões com `aria-expanded` / `aria-controls` e alvos de toque de 44px.
- Anúncio em live region (usando a preferência de avisos falados já existente) quando o filtro muda o número de resultados.
- Teste axe da nova tela junto aos testes de acessibilidade existentes.

## Detalhes técnicos

- Nova função de servidor `getMeuHistorico` em `src/lib/raiz.functions.ts`, com `requireSupabaseAuth`, lendo como o próprio usuário (RLS aplicada): `eixos`, `conteudos`, `liberacoes`, `progresso` e `diario` (com `conteudos(titulo, eixos(nome))`), filtrando por `cliente_id = userId`.
- Reaproveita a mesma regra de liberação já usada em `getMinhaBiblioteca` (status `liberado` e `liberar_em` nulo ou no passado), inclusive liberação por eixo inteiro; nada de conteúdo não liberado é retornado.
- Rota `src/routes/_authenticated/app.historico.tsx` com `createFileRoute("/_authenticated/app/historico")`, `head()` próprio (título/description/og), loader usando `queryClient.ensureQueryData` e componente com `useSuspenseQuery`, além de `errorComponent` e `notFoundComponent`, seguindo o padrão das outras telas.
- Chave de cache `["historico"]`, invalidada junto com biblioteca/progresso ao concluir prática, salvar reflexão e nos eventos de liberação/remoção em tempo real (`use-sincronizar-liberacoes`).
- Sem mudanças de banco de dados.
- Testes novos: `app.historico.test.tsx` (agrupamento por trilha, filtros, estado vazio, reflexões vinculadas) e um caso axe de acessibilidade.
