# “Monitoramento”: acompanhar o que acontece depois da liberação

A aba passa a se chamar **Monitoramento** em toda a interface (hoje o menu já usa esse nome, mas a página ainda se apresenta como “Acompanhamento e apoio”) e deixa de ser uma lista solta de check-ins e pedidos de apoio. Ela responde a uma única pergunta: *como está indo cada plano que já foi liberado?*

Divisão de papéis, sem sobreposição:
- **Planos de acompanhamento** — criar, personalizar e liberar.
- **Monitoramento** — observar o andamento, responder e ajustar o que já está em curso. Planos em rascunho não aparecem aqui.

## Indicadores do topo

Seis números reais, cada um clicando para filtrar a lista abaixo:
Trilhas em andamento · Revisões pendentes · Solicitações de apoio em aberto · Clientes sem atividade recente (7 dias ou mais) · Trilhas aguardando devolutiva · Planos concluídos no período.

## Filtros

Terapeuta responsável, trilha, status do plano, período (7, 30, 90 dias), revisão (pendente / vencida / sem data) e solicitação de apoio (com pedido em aberto). Mais busca por nome ou e-mail do cliente, usando a pesquisa do cabeçalho.

## Listagem

Uma linha por plano liberado: cliente, trilha atual, progresso (etapas concluídas sobre visíveis, com barra), última etapa concluída, última atividade, próxima revisão, status, marca discreta de solicitação de apoio e a ação **Abrir monitoramento**.

## Detalhe do monitoramento

Página própria por plano, em blocos:
- Objetivo definido e orientação da terapeuta (com o áudio, quando existir).
- Linha do tempo do que aconteceu: conclusões, check-ins, revisões e pedidos.
- Etapas concluídas e etapas pendentes, na ordem do plano.
- Check-in inicial e final de cada etapa, com a intensidade sempre apresentada como autorrelato (“o cliente relatou 6 de 10”).
- Evolução percebida e ações realizadas, vindas das revisões.
- Registros que o cliente escolheu compartilhar.
- Solicitações de contato e o que já foi respondido.
- Próxima revisão.

## Ações da terapeuta (no detalhe)

Enviar orientação · Adicionar áudio · Alterar prazo da revisão · Pausar prática · Liberar próxima etapa · Marcar revisão feita (com devolutiva) · Encerrar plano · Criar novo plano a partir do atual (abre o assistente já preenchido).

Cada ação pede confirmação quando muda o que o cliente vê, e fica registrada na auditoria.

## Cuidados de linguagem e privacidade

- Só aparecem registros do diário marcados como compartilhados e não revogados; nada privado é exibido, nem em contagens.
- Nenhuma leitura automática de estado emocional, nenhum diagnóstico, nenhum escore de risco.
- Vocabulário: clareza, autonomia, presença, integração, progresso percebido. Nunca “cura”, “desbloqueio” ou “trauma resolvido”.
- Solicitações de apoio recebem destaque sóbrio (marcador terracota e ordenação no topo), sem cor de alarme, sem sirene, sem “urgente”.

## Detalhes técnicos

**Sem migração de banco** — todos os dados necessários já existem em `atribuicoes`, `atribuicao_etapas`, `progresso`, `checkins`, `revisoes`, `solicitacoes_apoio` e `diario`.

**Rotas:**
- `src/routes/_authenticated/admin.monitoramento.tsx` — indicadores, filtros e listagem.
- `src/routes/_authenticated/admin.monitoramento.$atribuicaoId.tsx` — detalhe e ações.
- `admin.acompanhamento.tsx` passa a redirecionar para `/admin/monitoramento` (links antigos continuam funcionando).
- `navegacao.ts`: item aponta para `/admin/monitoramento`; entrada de trilha para o detalhe em `cabecalhoDoCaminho`.

**Novo `src/lib/monitoramento.functions.ts`** (permissão `ver_clientes` para leitura, `gerenciar_liberacoes` para ações, via `garantirPermissao`):
- `adminMonitoramentoResumo` — indicadores + linhas da listagem em uma consulta agregada (planos com status vivo, etapas visíveis, última conclusão em `progresso`, revisão futura, apoio em aberto).
- `adminMonitoramentoPlano` — detalhe completo de um plano, já filtrando diário por `visibilidade = 'compartilhado'` e `compartilhamento_revogado_em is null`.
- `adminEnviarOrientacao` — atualiza `mensagem` e/ou `audio_path` da atribuição.
- `adminAlterarPrazoRevisao` — atualiza `data_revisao`.
- `adminLiberarProximaEtapa` — marca a próxima etapa oculta como visível em `atribuicao_etapas`.
- `adminMarcarRevisao` — grava em `revisoes` a devolutiva e move o status.
- Pausar/encerrar reutilizam `adminDefinirStatusAtribuicao`; “criar novo plano a partir do atual” reutiliza o assistente existente com estado inicial pré-carregado.

**Componentes** em `src/components/painel/monitoramento/`: `cartoes-indicadores.tsx`, `filtros-monitoramento.tsx`, `linha-plano.tsx`, `linha-do-tempo-plano.tsx`, `bloco-checkins.tsx`, `bloco-registros-compartilhados.tsx`, `acoes-terapeuta.tsx`.

**`src/lib/monitoramento.ts`** (puro, com testes unitários): cálculo de progresso, dias sem atividade, situação da revisão, aplicação de filtros e ordenação — para não misturar regra com UI.

O bloco “Prazo de resposta” continua na página, agora como uma seção recolhida de configurações de apoio ao final. Tokens do tema (floresta, salvia, terracota), alvos de toque de 44 px, `aria-live` nos estados de carregamento e textos em português do Brasil.
