# Painel do cliente: auditoria e redesenho contemplativo

Direção escolhida: paleta **Floresta profunda** (mais rica: #1B3A2F, #5F7F6A, #C97B5A, #F4F1EA), tipografia **Instrument Serif + Work Sans**, layout **revista contemplativa** — capa forte, seções com títulos e muito ar. Prioridades: interatividade e feedback, player de prática, casca do app, linguagem.

## O que hoje enfraquece a experiência

- A casca (`/app`) é um cabeçalho utilitário com marca, sino e um botão "Sair" cru ao lado da navegação — nada ritualístico, e "Sair" tem peso igual ao conteúdo.
- Todas as telas vivem numa coluna única de largura fixa, com cartões arredondados de mesmo peso empilhados; nada distingue "a prática de agora" de "informação de apoio".
- A tipografia atual (Fraunces + Public Sans) não é a direção escolhida; títulos e corpo têm pouca variação de escala, então a leitura fica plana.
- Transições entre abas e estados são secas: sem animação de entrada, sem resposta tátil ao concluir, sem transição no player.
- Textos ainda são funcionais ("Perfil", "Jornada", "Lembretes") em vez de convites.

## O redesenho, tela por tela

**Casca do app** — cabeçalho com marca centrada e ação secundária discreta; "Sair" sai do cabeçalho e vive apenas no Perfil. Abas inferiores em floresta com indicador que desliza, ícone preenchido no ativo e resposta tátil leve. Transição suave de conteúdo entre rotas (fade + subida curta), respeitando `prefers-reduced-motion`.

**Início (capa da revista)** — capa de abertura em degradê floresta com saudação por horário em serifada grande, o ciclo atual e a sequência como legenda; a prática de agora ganha um cartão largo de destaque com tempo e eixo. Abaixo, seções com títulos editoriais: "Palavra da terapeuta", "Seus eixos", "Momentos curtos", "Convites". Ritmo vertical maior entre seções.

**Jornada** — trilha como sumário de revista: etapas numeradas, linha viva ligando os passos, etapa atual expandida com a próxima ação, concluídas recolhidas com um selo. Filtros como pílulas suaves. Uma frase de ancoragem no topo.

**Diário** — folha de escrita mais quieta: convite de escrita como epígrafe serifada, campo sem moldura pesada, salvamento discreto, escolha de privacidade em duas opções claras. Linha do tempo mensal com marcas de sentimento.

**Perfil** — mantém os blocos atuais, com a capa "retrato do seu caminho" em degradê e as seções reagrupadas em ritmo editorial; "Sair da conta" no fim, com confirmação.

**Player de prática e etapa** — modo imersivo: fundo escuro floresta, controles grandes e centrados, título em serifada, barra de progresso fina, respiração visual (círculo pulsando lentamente no áudio), botão de conclusão com celebração. Textos de apoio (materiais, critérios de interrupção) recolhidos até serem pedidos.

**Feedback e interatividade** — celebração ao concluir (usa o componente existente) com selo do eixo e frase de acolhimento; contadores que sobem animando; estados vazios com convite em vez de "nada aqui"; skeletons no mesmo ritmo do layout final.

**Linguagem** — revisão de rótulos e microcópia em todas as telas do cliente: abertura ("Respire, você chegou"), fechamento ("Fica bem, até a próxima"), convites em primeira pessoa, sem jargão clínico. Rótulos de acessibilidade continuam descritivos.

## Detalhes técnicos

- Tokens: enriquecer `src/styles.css` com a paleta escolhida (floresta profunda, sálvia, terracota, pergaminho), degradês (`--gradient-capa`, `--gradient-imersao`) e sombras orgânicas; nenhuma cor fixa nos componentes.
- Fontes: trocar o `<link>` do Google Fonts em `src/routes/__root.tsx` para Instrument Serif + Work Sans e apontar `--font-display` / `--font-sans` no `@theme`.
- Movimento: `motion` (Motion for React) para entradas de seção, indicador das abas e celebração; tudo condicionado a `prefers-reduced-motion`.
- Componentes novos em `src/components/app-casca/` (cabeçalho, abas, transição) e `src/components/app-player/` (invólucro imersivo, respiração, controles); reaproveitar `celebracao-pratica`, `mapa-calor`, blocos de `app-inicio`, `app-diario` e `app-perfil`.
- Rotas tocadas: `app.tsx`, `app.index.tsx`, `app.jornada.tsx`, `app.diario.tsx`, `app.perfil.tsx`, `app.progresso.tsx`, `app.historico.tsx`, `app.conteudo.$conteudoId.tsx`, `app.etapa.$conteudoId.tsx` — apenas apresentação; nenhuma regra de negócio, consulta ou política de acesso muda.
- Acessibilidade: contraste AA nos novos degradês, alvos de toque ≥44px, foco visível, uma única `h1` por tela, testes existentes (a11y do diário, contraste do player, heatmap) devem seguir verdes.

## Fora de escopo

Painel da terapeuta, banco de dados, permissões e conteúdo pedagógico das trilhas.
