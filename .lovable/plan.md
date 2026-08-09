# Aba “Trilhas”: jornada, versões e construtor completo

Hoje a aba lista trilhas com etapas embutidas, reordenação por setas e edição em dois diálogos. Vamos transformá-la na página de **jornadas** — clara na diferença com “Conteúdos” (unidades individuais) — com pesquisa, filtros, grade/lista, cartão rico e um construtor completo em página própria, além de versionamento seguro para trilhas já em uso.

## Diferença explícita entre as abas

- No topo de “Trilhas”: “Uma trilha é uma jornada organizada: reúne vários conteúdos em uma ordem terapêutica.” com link para Conteúdos.
- No topo de “Conteúdos”: “Um conteúdo é uma unidade individual (vídeo, áudio, meditação, texto, exercício ou pergunta).” com link para Trilhas.

## Cabeçalho e filtros

Título “Trilhas”, campo de pesquisa (nome, resumo, objetivo), botão “Criar trilha” e alternância grade/lista (preferência guardada no navegador).

Filtros: área da vida (eixo), nível de profundidade, status, autoria, duração (curta até 20 min, média 20–45, longa acima de 45), clientes utilizando (nenhum / 1 a 3 / 4 ou mais) e data de atualização (7, 30, 90 dias). Ordenação por atualização, nome, etapas ou clientes.

## Cartão da trilha

Capa (ou padrão da área), nome, área, descrição breve, número de etapas, duração estimada, nível, pré-requisitos, clientes utilizando, status e última atualização. Versão visível quando maior que 1.

Menu de ações: Editar, Duplicar, Criar nova versão, Enviar para revisão, Publicar, Arquivar, Ver clientes vinculados.

## Construtor de trilha (página própria)

Rota nova `/admin/trilhas/$trilhaId` com três blocos:

1. **Identidade** — nome, descrição breve, objetivo geral, público indicado, situações que exigem cuidado, pré-requisitos, nível, área, duração estimada (calculada pelas etapas, com possibilidade de ajustar à mão) e imagem de capa.
2. **Etapas** — lista arrastável (mesmo padrão já usado nos planos), com: adicionar conteúdo da biblioteca (o conteúdo original permanece intacto; entra na trilha como cópia editável), criar conteúdo sem sair da página, inserir check-in inicial e check-out, marcar obrigatória/opcional, ativar bloqueio sequencial da trilha e escrever orientação de pausa.
3. **Publicação** — “Visualizar como cliente” (mostra a jornada como ela aparece no app), status atual, clientes vinculados e as ações de revisão/publicação.

## Versões: nunca mudar em silêncio o que o cliente já recebeu

- Ao editar uma trilha **publicada e em uso**, um aviso oferece “Criar nova versão” em vez de alterar a atual.
- “Criar nova versão” copia a trilha e as etapas como rascunho versão N+1, ligada à trilha de origem.
- Ao publicar a nova versão, um diálogo pergunta o que fazer com os planos existentes: **manter cada pessoa na versão atual** (padrão) ou **migrar os planos escolhidos** para a nova versão, com a lista de clientes e o progresso de cada um. Etapas já concluídas que existem na nova versão continuam concluídas.
- Toda migração e mudança de status fica registrada na auditoria.

## Detalhes técnicos

**Banco (uma migração):**
- `trilhas`: `publico_indicado text`, `capa_path text`, `duracao_estimada_minutos integer` (nulo = calcular pelas etapas), `bloqueio_sequencial boolean default false`, `trilha_origem_id uuid references public.trilhas(id)`.
- Índice em `atribuicoes(trilha_id)` para contar clientes por trilha.
- Sem mudança de RLS: as políticas atuais de `trilhas`/`conteudos` já cobrem as colunas novas.

**Servidor (`src/lib/trilhas.functions.ts`):**
- `adminListarTrilhas`: passa a devolver também as colunas novas, contagem de clientes por trilha (a partir de `atribuicoes` com status vivo), nome do autor e soma de duração das etapas.
- `adminSalvarTrilha`: aceita os campos novos.
- `adminDefinirStatusTrilha` (nova): rascunho / em revisão / publicado / arquivado, com auditoria.
- `adminCriarVersaoTrilha` (nova): copia trilha + etapas como rascunho N+1 com `trilha_origem_id`.
- `adminMigrarPlanosParaVersao` (nova): move as atribuições escolhidas para a nova trilha, recriando `atribuicao_etapas` e preservando conclusões equivalentes.
- `adminClientesDaTrilha` (nova): lista quem está usando a trilha, para o cartão e o diálogo de migração.
- `adminAdicionarConteudoNaTrilha` (nova): clona um conteúdo da biblioteca como etapa da trilha.

**Frontend:**
- `src/routes/_authenticated/admin.trilhas.tsx` → cabeçalho, filtros, grade/lista e cartões.
- `src/routes/_authenticated/admin.trilhas.$trilhaId.tsx` → construtor.
- `src/components/painel/trilhas/`: `cartao-trilha.tsx`, `filtros-trilhas.tsx`, `editor-etapas.tsx` (dnd-kit), `dialogo-biblioteca.tsx`, `dialogo-nova-versao.tsx`, `previa-cliente.tsx`.
- `src/lib/trilhas-visao.ts`: duração estimada, faixas de duração, filtros e ordenação — com testes unitários.
- Capa enviada pelo `UploadMidia` existente (bucket privado, URL assinada como já é feito nas thumbnails de conteúdos).

Tudo com tokens do tema (floresta/salvia/terracota), alvos de toque de 44 px, rótulos acessíveis e textos em português do Brasil.
