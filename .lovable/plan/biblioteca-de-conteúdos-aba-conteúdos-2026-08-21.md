# Biblioteca de Conteúdos (aba "Conteúdos")

Hoje a aba é uma lista de práticas por eixo, com 5 tipos, formulário curto (título, descrição, corpo, mídia, duração, ordem) e exclusão definitiva. Vou transformá-la numa biblioteca de materiais reutilizáveis, com ciclo de vida (rascunho → revisão → publicado → arquivado), versão, autoria e visão das trilhas que usam cada item.

## 1. Tipos de conteúdo

Os 14 tipos passam a existir como opções reais: vídeo guiado, áudio, meditação, aterramento, movimento sistêmico, exercício prático, texto educativo, diário de integração, pergunta reflexiva, check-in, check-out, ação alinhada, prática semanal e material em PDF.

Os tipos atuais (video, audio, exercicio, texto, tarefa) continuam válidos e são exibidos com os novos rótulos, para não quebrar conteúdos e trilhas já criados.

## 2. Campos novos no conteúdo

Além do que já existe (descrição, corpo de texto, mídia, transcrição, legendas, materiais, sensibilidades, orientações de interrupção, duração), o conteúdo passa a ter:

- Objetivo
- Instruções de condução
- Perguntas de integração
- Nível de profundidade (leve / intermediário / profundo)
- Autor e revisor
- Versão e status
- Data de revisão
- Última atualização (automática)

## 3. Listagem

- Alternância entre **grade** e **lista**, com preferência lembrada.
- Colunas/etiquetas: título, tipo, área (eixo), duração, profundidade, nº de trilhas que usam, autor, revisor, versão, status e última atualização.
- Busca por título, descrição, objetivo e transcrição.
- Filtros: área, tipo, profundidade, status, com/sem mídia, com/sem transcrição, e "usado em trilha" / "não usado".
- Ordenação por título, duração, atualização ou status.
- Agrupamento por eixo continua disponível (com reordenação por arraste) apenas na visão em lista.

## 4. Formulário

Diálogo em seções: Identificação (título, descrição, objetivo, tipo, área, profundidade) · Conteúdo (corpo principal, arquivo/mídia com progresso, transcrição, legenda) · Condução (instruções, materiais necessários, perguntas de integração, orientações de pausa, sensibilidades, duração) · Curadoria (autor, revisor, versão, data de revisão, status).

Upload já mostra progresso; adiciono **pré-visualização** dentro do formulário e no card: player de áudio, player de vídeo, leitor de PDF e prévia de texto formatado, sempre com URL assinada temporária.

## 5. Ações

- Criar, editar, **duplicar** (cópia em rascunho, versão 1), **visualizar** (prévia como o cliente vê).
- **Enviar para revisão**, **publicar**, **arquivar** e reativar.
- **Ver trilhas relacionadas**: painel lateral listando cada trilha que usa o conteúdo, com link direto.
- Exclusão definitiva bloqueada quando o conteúdo está em trilha ativa ou em plano de cliente: nesse caso apenas arquivar. Ao publicar uma alteração de conteúdo já em uso, a versão anterior é preservada como registro arquivado, para que planos em andamento não mudem sem aviso.
- Ações em lote existentes (mover para eixo) ganham "enviar para revisão", "publicar" e "arquivar"; o lote de exclusão passa a respeitar a mesma proteção.

## 6. Permissões e histórico

Tudo continua atrás de `gerenciar_conteudos`, com botões escondidos/desabilitados para quem não tem permissão. Mudanças de status, publicação, duplicação e arquivamento entram na auditoria da equipe.

## Detalhes técnicos

- **Migração**: expandir o enum `conteudo_tipo` com os novos valores; adicionar em `public.conteudos` as colunas `objetivo`, `instrucoes`, `perguntas_integracao`, `nivel nivel_profundidade`, `autor_id`, `revisor_id`, `versao int`, `status conteudo_status` (novo enum: rascunho/em_revisao/publicado/arquivado), `data_revisao`, `updated_at` + trigger `update_updated_at_column`, e `conteudo_origem_id` para rastrear duplicações/versões. Defaults preenchem os registros existentes como `publicado`, versão 1. Políticas de leitura do cliente passam a exigir `status = 'publicado'` (via `conteudo_liberado`), preservando o comportamento atual dos itens já existentes.
- **Servidor** (`src/lib/raiz.functions.ts`): ampliar `adminListarConteudos` (retornando também o vínculo conteúdo→trilhas e nomes de autor/revisor via `profiles`) e `adminSalvarConteudo`; novas server fns `adminDuplicarConteudo`, `adminMudarStatusConteudo`, `adminTrilhasDoConteudo` e `adminPreviaConteudo` (URL assinada). `adminApagarConteudo` passa a recusar exclusão quando há etapa de trilha/plano vinculado, retornando orientação para arquivar.
- **Cliente**: `src/hooks/useConteudos.ts` recebe os novos campos e mutações; `src/components/AdminConteudos/` ganha `VisaoGrade.tsx`, `VisaoLista.tsx`, `PainelTrilhasRelacionadas.tsx`, `PreviaConteudo.tsx` e `BadgeStatus.tsx`; `FilterBar`, `ConteudoCard`, `ConteudoFormDialog` e `BatchActionsToolbar` são estendidos; `admin.conteudos.tsx` orquestra grade/lista e os painéis.
- **Rótulos** de tipo/profundidade/status centralizados em `src/lib/raiz-format.ts` para reuso na trilha e no app do cliente.
- Testes existentes em `src/components/AdminConteudos/__tests__` são atualizados e ganham casos para bloqueio de exclusão, mudança de status e filtros novos.
