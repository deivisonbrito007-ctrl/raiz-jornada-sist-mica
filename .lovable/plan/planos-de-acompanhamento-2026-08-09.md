# Planos de acompanhamento

A aba hoje chamada internamente de "Clientes e atribuições" (`/admin/clientes`) passa a ser a página **Planos de acompanhamento**: a orientação personalizada da terapeuta para cada cliente, com criação em 7 etapas. Nenhuma escolha de trilha será sugerida automaticamente pelo sistema — a decisão é sempre da terapeuta.

## 1. Renomeação

- Título da página, `<h1>`, metadados (`head`) e textos passam de "Clientes e atribuições" / "Atribuir trilha" para "Planos de acompanhamento" / "Criar plano de acompanhamento".
- O rótulo do menu lateral já está como "Planos de acompanhamento"; ajusto apenas a trilha de navegação e o texto do cabeçalho interno.

## 2. Listagem

Tabela (cartões empilhados no celular) com uma linha por plano, filtros por status/cliente/nível e busca por nome:

| Coluna | Origem |
| --- | --- |
| Cliente | perfil do cliente |
| Trilha atribuída | trilha do plano |
| Objetivo resumido | primeira linha do objetivo, truncada |
| Nível de profundidade | leve / intermediário / profundo |
| Data de início | plano |
| Data da revisão | plano |
| Progresso | etapas concluídas ÷ etapas visíveis do plano |
| Status | novo conjunto (abaixo) |
| Terapeuta responsável | autor do plano |
| Ações | editar, duplicar, ver como cliente, pausar/retomar, marcar revisão, concluir, encerrar |

## 3. Status

Substituo os quatro status atuais (ativa, pausada, concluída, encerrada) por sete:

- Rascunho — criado e não liberado; invisível para o cliente.
- Aguardando início — liberado, data de início no futuro.
- Em andamento.
- Aguardando revisão — data de revisão alcançada.
- Pausado.
- Concluído.
- Encerrado.

Migração converte os registros existentes (ativa → em andamento ou aguardando início conforme a data; pausada/concluida/encerrada → equivalentes). "Aguardando início" e "aguardando revisão" também são derivados por data, para que a lista fique correta sem tarefa agendada.

## 4. Formulário em etapas ("Criar plano de acompanhamento")

Assistente de 7 passos, com barra de progresso, validação por etapa e rascunho salvável em qualquer ponto.

1. **Cliente** — seleção com busca; mostra a trilha atual do cliente e avisa quando já existe outro plano principal em andamento (sem bloquear).
2. **Trilha** — seleção entre trilhas publicadas, exibindo descrição, duração estimada, pré-requisitos, alertas e nível; botão para pré-visualizar a trilha e suas etapas antes de atribuir.
3. **Objetivo** — objetivo personalizado, motivo da indicação, orientação escrita e áudio opcional da terapeuta (gravação/upload no armazenamento privado, como já feito hoje).
4. **Personalização** — lista de etapas da trilha com: obrigatória/opcional, ocultar etapa, reordenar (arrastar), permitir repetir a prática e adicionar atividade personalizada só deste plano (título, orientação, duração).
5. **Cronograma** — data de início, data de revisão, frequência, lembretes opcionais e prazo por etapa (em dias após o início).
6. **Profundidade** — leve / intermediário / profundo, mais os marcadores: pode ser realizado sozinho, requer acompanhamento próximo, deve ser realizado durante uma sessão.
7. **Revisão** — resumo completo de tudo, pré-visualização "como o cliente vê", e três saídas: salvar rascunho, liberar agora, agendar liberação para data/hora.

## 5. Efeitos no cliente

- Rascunho e liberação agendada não aparecem na jornada do cliente; ao liberar (ou na data agendada) o cliente recebe notificação/push como hoje.
- A jornada respeita ordem, etapas ocultas, obrigatoriedade, prazos e atividades personalizadas do plano — não mais apenas a ordem original da trilha.

## Detalhes técnicos

- **Banco**: novos valores no enum `atribuicao_status` (`rascunho`, `aguardando_inicio`, `em_andamento`, `aguardando_revisao`, `pausado`, `concluido`, `encerrado`) com migração dos valores antigos; em `atribuicoes` adiciono `motivo_indicacao`, `liberar_em`, `lembretes_ativos`, `liberada_em`; em `atribuicao_etapas` adiciono `visivel`, `permite_repetir`, `prazo_dias`, `titulo_personalizado`, `descricao_personalizada` e torno `conteudo_id` anulável (atividade personalizada). GRANTs e políticas seguem o padrão atual (terapeuta/equipe com `gerenciar_liberacoes`; cliente só lê planos liberados).
- **Servidor**: `adminAtribuirTrilha` evolui para `adminSalvarPlano` (aceita etapas com ordem/visibilidade/prazo, rascunho vs. liberação vs. agendamento) e `adminDefinirStatusAtribuicao` passa a validar os sete status; nova `adminListarPlanos` devolve a listagem já agregada com progresso e nome do terapeuta. `getMinhaJornada`/`getMinhaEtapa` passam a filtrar por plano liberado e etapas visíveis.
- **UI**: novo `src/components/painel/planos/` com `lista-planos.tsx`, `assistente-plano.tsx` e um arquivo por etapa; reordenação com o `@dnd-kit` já usado em Conteúdos; status e rótulos centralizados em `src/lib/etapas.ts`.
- **Testes**: atualizo os testes que usam os status antigos e acrescento testes de status derivado por data, progresso, visibilidade de rascunho para o cliente e navegação do assistente.
