# Nova estrutura e navegação do Painel da Terapeuta

Refatoração apenas de estrutura, navegação e apresentação. Nenhuma página, dado, integração ou regra de negócio existente é alterada ou removida.

## O que muda

### Barra lateral (desktop) e drawer (celular)
Substituir a barra horizontal por uma barra lateral recolhível, com grupos:

```text
ATENDIMENTO      Início · Clientes · Planos de acompanhamento · Monitoramento
BIBLIOTECA       Trilhas · Conteúdos
GESTÃO           Pacotes · Equipe · Auditoria
UTILIDADES       Ver como cliente · Ajuda · Perfil
```

Mapeamento para as páginas que já existem (só o rótulo muda):
- Clientes → página atual "Clientes" (/admin)
- Planos de acompanhamento → página atual "Atribuições" (/admin/clientes)
- Monitoramento → página atual "Acompanhamento" (/admin/acompanhamento)
- Trilhas, Conteúdos, Pacotes, Equipe, Auditoria → inalterados

No celular a barra vira drawer, aberto por um botão de menu no cabeçalho; sem rolagem horizontal. Recolhida no desktop, a barra mantém os ícones visíveis e o botão de recolher continua acessível.

### Cabeçalho interno
Botão de menu (celular), título da página atual, breadcrumb quando houver hierarquia (ex.: Clientes › nome da cliente), campo de pesquisa contextual quando a página tem lista, ícone de notificações e avatar com iniciais abrindo o menu de perfil (Perfil, Ver como cliente, Sair).

"Sair" sai do menu principal e passa a viver só no menu de perfil. O selo "Painel do terapeuta" sai do cabeçalho e vira o rodapé/identificação da barra lateral, com a logomarca em tamanho maior e mais destaque.

### Páginas novas (mínimas, sem dados simulados)
- **Início**: visão geral com as métricas que a função `adminResumo` já retorna (clientes ativos, trilhas em andamento, conclusão média), últimos clientes ativos e pedidos de apoio pendentes já existentes, mais atalhos para as áreas liberadas. Respeita permissões: sem `ver_clientes`, mostra apenas os atalhos permitidos.
- **Ajuda**: página estática explicando o que cada área do painel faz e o significado das permissões (texto, sem backend).
- **Perfil**: dados da própria conta já disponíveis no contexto (nome, e-mail, papel, permissões) e o botão Sair.

### Permissões
Cada item da barra continua filtrado pela permissão que a página já exige hoje (`ver_clientes`, `gerenciar_conteudos`, `gerenciar_pacotes`, `gerenciar_equipe`). Grupos sem nenhum item liberado não aparecem. Terapeuta vê tudo. Início, Ajuda e Perfil ficam sempre visíveis, e o estado "nenhuma área liberada" continua funcionando.

### Visual e acessibilidade
Mantém verde-escuro, fundo marfim e dourado nos detalhes, títulos serifados e corpo sem serifa, cantos arredondados e sombras discretas. Ajustes: mais respiro entre grupos, contraste dos estados inativo/ativo, anel de foco visível, alvos de toque de 44px, `aria-current` no item ativo, rótulos nos botões de ícone e navegação por teclado no drawer.

## Detalhes técnicos

- Novo `src/components/painel/sidebar-terapeuta.tsx` usando o `@/components/ui/sidebar` já presente (`collapsible="icon"`, `SidebarProvider` + `SidebarTrigger`), com larguras via `w-[var(--sidebar-width)]`.
- Novo `src/components/painel/cabecalho-painel.tsx` (título, breadcrumb, pesquisa, notificações, menu de perfil com `dropdown-menu`), com layout em grid `grid-cols-[minmax(0,1fr)_auto]` para não quebrar em telas estreitas.
- `src/routes/_authenticated/admin.tsx` passa a montar `SidebarProvider` + sidebar + cabeçalho ao redor do `<Outlet />`; `beforeLoad`, `useVigiaPermissoes` e a saída automática ao perder acesso administrativo permanecem iguais.
- Metadados de rota (título, grupo, breadcrumb, permissão, se tem pesquisa) em um mapa único em `src/components/painel/navegacao.ts`, consumido pela sidebar e pelo cabeçalho.
- Novas rotas `admin.inicio.tsx`, `admin.ajuda.tsx`, `admin.perfil.tsx` reutilizando `adminResumo` / `getMeuContexto` e as funções de apoio existentes; nenhuma migração de banco.
- Filtragem por permissão via `useMinhasPermissoes` (já existente), sem duplicar lógica.
- Verificação final: percorrer cada link, conferir estado ativo (incluindo `exact` em /admin), abrir/fechar drawer no celular, recolher/expandir no desktop, e checar a barra com um perfil sem permissões de gestão.
