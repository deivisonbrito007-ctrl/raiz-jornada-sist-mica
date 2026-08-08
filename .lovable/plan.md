# Aba "Conteúdos" — biblioteca redesenhada e componentizada

Transformar a tela de Conteúdos do painel do terapeuta em um ambiente organizado e acolhedor, com cards visuais, filtros com destaque de ativos, formulário rico, upload com progresso, capa manual, reordenação por arrastar e ações em lote.

## O que muda para você

- **Cards em vez de linhas**: cada prática vira um card com capa (ou ícone do tipo), título, tipo, duração, ordem e selo "mídia enviada", com "Editar" e "Excluir".
- **Filtros mais claros**: eixo, tipo, status e busca; filtro com valor ativo ganha fundo dourado suave e selo "Ativo"; "Limpar filtros" em terracota.
- **Formulário completo**: eixo, tipo, título, descrição, editor de texto formatado (negrito, itálico, listas, títulos) para práticas de texto/exercício/tarefa, upload de mídia com nome, tamanho e barra de progresso, imagem de capa própria, duração e ordem. "Salvar prática" só habilita com título preenchido.
- **Capa manual**: você escolhe a imagem de capa (JPG/PNG) e ela aparece no card. Sem capa, mostramos o ícone do tipo.
- **Arrastar para ordenar**: dentro de cada eixo, arraste os cards; a nova ordem é salva na hora, com aviso de confirmação.
- **Ações em lote**: marque vários cards e use a barra superior para "Excluir selecionados" ou "Mover para eixo".
- **Vazio acolhedor**: quando não há práticas, um card grande convida a criar a primeira.
- Tudo respeita as permissões atuais: quem não pode gerenciar conteúdos continua sem acesso e sem botões inúteis.

## Ajustes ao pedido original (motivos técnicos)

- **Paleta e fontes já existem**: floresta, papel, terracota, sálvia e ouro são tokens do tema, e Fraunces já está carregada com `font-display`. Este projeto usa Tailwind v4 (configuração em CSS), então **não existe `tailwind.config.ts`** — os tokens ficam/permanecem em `src/styles.css`. Vou apenas conferir contraste e completar o que faltar (ex.: token `ouro` se necessário).
- **Miniatura via FFmpeg não é possível**: o runtime das funções do backend não roda FFmpeg. Conforme sua escolha, a capa é uma **imagem enviada manualmente** e guardada em `thumbnail_path`.
- **Coluna nova**: `conteudos.thumbnail_path` não existe hoje; será criada por migração (sem alterar RLS existente), e `adminSalvarConteudo` passa a aceitar o campo — nome da função preservado.
- **Exclusão em lote**: `adminApagarConteudo` continua recebendo um id; o lote é feito em paralelo pelo hook (mantém as regras de permissão e auditoria intactas).

## Detalhes técnicos

**Novos arquivos**
- `src/components/AdminConteudos/FilterBar.tsx`, `ConteudoCard.tsx`, `ConteudoFormDialog.tsx`, `BatchActionsToolbar.tsx`, `UploadMidia.tsx`, `EditorTexto.tsx`
- `src/hooks/useConteudos.ts` — `useQuery(["admin-conteudos"])` + mutations: `salvar`, `apagar`, `batchDelete`, `moverParaEixo`, `reorder`; retorna `conteudos, eixos, isLoading, refetch`
- `src/lib/thumbnail.ts` — cache de URL assinada do bucket privado `midias` (`createSignedUrl`, 1h) para capas
- Testes: `src/components/AdminConteudos/__tests__/conteudo-card.test.tsx`, `conteudo-form-dialog.test.tsx`, `upload-midia.test.tsx`, `rls-conteudos.test.ts`

**Alterados**
- `src/routes/_authenticated/admin.conteudos.tsx` — mesma rota `/_authenticated/admin/conteudos`, agora só compõe os novos componentes e o hook
- `src/lib/raiz.functions.ts` — `adminSalvarConteudo` aceita `thumbnailPath` (opcional, nullable); permissões e `garantirPermissao` inalterados
- `src/styles.css` — token/uso de `ouro` e `focus-visible:ring-terracota` onde faltar
- `README.md` — seção "Como usar a nova aba Conteúdos" + `npm run dev`

**Dependências**: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm` (editor) e `@dnd-kit/core` + `@dnd-kit/sortable` (arrastar). `Progress` e `Checkbox` já existem.

**Migração**: `alter table public.conteudos add column thumbnail_path text;` — nenhuma política alterada.

**Acessibilidade**: `aria-label` em ícones (busca, upload, excluir, arrastar), alternativa por teclado para reordenar (botões subir/descer), foco visível com anel terracota, alvos de toque ≥44px, contraste ≥4.5:1, e `aria-live` no progresso do upload.
