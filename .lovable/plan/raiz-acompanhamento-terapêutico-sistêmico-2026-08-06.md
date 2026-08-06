# Raiz — acompanhamento terapêutico sistêmico

App web mobile-first para clientes e painel desktop-first para o(a) terapeuta, com trilhas de vídeo/áudio por eixos sistêmicos, liberação manual de conteúdo, progresso e diário.

## Identidade visual

- Logo enviada usada como asset (header, login, favicon).
- Paleta: verde-floresta #1F2E23 (base/navegação), pergaminho #F1E9D8 (fundo), terracota #A8503A (ação), sálvia #6E7F5C (progresso), ocre #C79A2E (conquistas).
- Tipografia: Fraunces (títulos) + Public Sans (interface), via `<link>` no root.
- Tokens semânticos em `src/styles.css` (oklch), cantos arredondados generosos, muito respiro, nada de estética SaaS azul/roxo.

## Backend (Lovable Cloud)

Ativar Cloud e criar o schema completo já preparado para as camadas futuras:

- `profiles` (id → auth.users, nome, email, criado_em)
- `user_roles` + enum `app_role` (terapeuta | cliente) em tabela separada, com função `has_role` security definer
- `eixos` (nome, descricao, icone, ordem) — seed com os 8 eixos
- `conteudos` (eixo_id, tipo, titulo, descricao, storage_path, duracao, ordem)
- `pacotes` (nome, descricao, eixos_incluidos, tipo_cobranca) e `clientes_pacotes` (status_pagamento)
- `liberacoes` (cliente_id, eixo_id | conteudo_id, status, liberado_em)
- `progresso` (cliente_id, conteudo_id, status, concluido_em)
- `diario` (cliente_id, conteudo_id opcional, texto, criado_em)

RLS + GRANTs em todas as tabelas: cliente lê apenas o que é dele e apenas conteúdos de eixos/itens liberados; terapeuta tem acesso total via `has_role`. Mídia em bucket **privado** do Storage, servida por signed URL gerada em server function após checar a liberação.

## Área do cliente (mobile-first)

- `/auth` — login/cadastro acolhedor com a logo.
- `/` — landing curta com CTA de entrada (rota pública).
- `/app` — Início: saudação, grade de eixos com progresso (`2/4 concluídos`); eixos não liberados aparecem com cadeado.
- `/app/eixo/$id` — trilha ordenada com tipo, duração e status.
- `/app/conteudo/$id` — player nativo de vídeo/áudio com play/pause, ±15s, barra de progresso; ao final sugere concluir e ir ao diário.
- `/app/diario` — prompt reflexivo, texto livre, salvar, histórico.
- `/app/progresso` — % geral, streak de semanas ativas, eixos em andamento, linha do tempo.
- `/app/perfil` — dados, pacote atual, trocar senha.

## Painel do terapeuta (desktop-first)

Sidebar colapsável: Clientes, Conteúdos, Pacotes, Progresso, Financeiro.

- Clientes: métricas no topo + lista com pacote, eixo atual, barra de progresso, ação "Liberar conteúdo".
- Detalhe do cliente: toggles de liberação por eixo e por conteúdo, histórico de progresso, leitura do diário.
- Conteúdos: biblioteca por eixo, upload de mídia, editar título/descrição/ordem, criar eixos.
- Pacotes: CRUD e vinculação a clientes.
- Progresso: visão agregada com destaque para inativos/travados.
- Financeiro: marcar pago/pendente manualmente.

## Ordem de execução

1. Cloud + schema + RLS + seed dos eixos e conteúdos de exemplo; bucket privado.
2. Design system, logo, layouts e gate `_authenticated` por papel.
3. Cliente: biblioteca → trilha → player → progresso.
4. Painel: clientes, detalhe com liberação, conteúdos/upload.
5. Segunda camada: diário, pacotes, financeiro, notificação in-app de novo conteúdo liberado.

## Notas técnicas

- TanStack Start: rotas protegidas sob `src/routes/_authenticated/`, dados via server functions com `requireSupabaseAuth`; signed URLs nunca no cliente.
- Papel do usuário lido de `user_roles` (nunca do perfil) e usado para separar `/app` de `/admin`.
- E-mail de notificação fica como gancho na segunda camada (in-app primeiro).
- GitHub: a organização do repositório vem do sync do Lovable; a estrutura será limpa por domínio (`src/routes`, `src/components/{cliente,admin,ui}`, `src/lib/*.functions.ts`). Conectar o GitHub pelo menu + → GitHub quando quiser versionar.
