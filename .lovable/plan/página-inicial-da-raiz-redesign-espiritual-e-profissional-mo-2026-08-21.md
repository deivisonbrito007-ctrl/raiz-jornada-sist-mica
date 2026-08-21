# Página inicial da Raiz — redesign espiritual e profissional (mobile-first)

## O que está ruim hoje
A home atual é um texto grande sobre fundo bege liso, com a logo isolada num retângulo cinza-esverdeado. No mobile ela vira quase só um bloco de parágrafo: nenhuma imagem, nenhuma profundidade, nenhum ritmo visual, e a marca não transmite o cuidado do trabalho sistêmico. Ela também não conversa com a nova tela de entrada (`/auth`), que já tem fundo imersivo em floresta, aura de luz e cartão em pergaminho.

## Direção
Mesma linguagem da tela de entrada, aplicada em toda a página: verde floresta profundo, luz de aura atrás da marca, curva orgânica separando as seções, terracota como único acento de ação, tipografia serif (Fraunces) para as frases e sans (Public Sans) para o corpo. Nenhum token novo de cor inventado — só os que já existem.

## Estrutura nova (na ordem da rolagem)
1. **Cabeçalho translúcido fixo** — marca à esquerda, "Entrar" como pílula discreta; ganha fundo desfocado ao rolar.
2. **Hero imersivo** (não mais bege liso): fundo em gradiente floresta com halo de luz atrás da logo Raiz, textura suave de raízes/luz gerada como imagem de fundo. Selo "Constelação familiar", título serif em duas linhas, subtítulo mais curto e respirado, e dois botões em largura cheia no mobile (terracota + contorno claro). Fecha com uma curva orgânica para a seção seguinte.
3. **Faixa de confiança** — três micro-provas curtas (processo acompanhado por terapeuta · práticas em vídeo e áudio · diário privado), em linha no desktop e em carrossel/pilha compacta no mobile.
4. **"Como funciona"** — três passos numerados (a terapeuta libera a trilha → você pratica no seu ritmo → registra o que se moveu), com linha vertical ligando os passos no mobile, como uma raiz descendo.
5. **Eixos sistêmicos** — os 8 eixos (Pai, Mãe, Filhos, Ancestralidade, Dinheiro, Saúde, Relacionamentos, Propósito) como chips/cartões pequenos, mostrando concretamente o escopo do trabalho.
6. **Pilares** — os três blocos atuais reescritos como cartões em pergaminho sobre o fundo floresta, com ícone em ocre e borda suave.
7. **Dois caminhos** — dois cartões lado a lado: "Sou cliente de uma terapeuta" e "Quero começar por conta própria" (autoguiado), cada um com seu CTA para `/auth`. Isso reflete os dois modos de uso que o app já tem.
8. **Bloco para terapeutas** — mantido, mas como faixa clara com CTA "Entrar no painel".
9. **Fechamento** — frase curta de acolhimento, CTA principal repetido e rodapé com marca, cuidado com dados e aviso de que a Raiz não substitui atendimento clínico.

## Cuidados
- Mobile primeiro: alvos de toque ≥ 44px, botões em largura cheia, títulos que não quebram feio em 360px.
- Contraste AA em todas as combinações (usar `ocre-forte` sobre fundo claro).
- Movimento discreto: fade/subida suave na entrada das seções, respeitando `prefers-reduced-motion`.
- Nada de imagem genérica de "espiritualidade" com pessoas; a textura de fundo será abstrata (luz, raízes, folha) para não datar a marca.

## Notas técnicas
- Reescrever `src/routes/index.tsx`, extraindo as seções em componentes em `src/components/landing/`.
- Reaproveitar `--gradiente-aura`, `--halo-entrada` e `--shadow-organico` já definidos em `src/styles.css`; adicionar no máximo uma curva orgânica reutilizável como utilitário.
- Gerar 1–2 texturas de fundo abstratas em `src/assets` e importá-las como ES module.
- Ampliar o `head()` da rota com `og:type`, `twitter:card` e `og:image`/`twitter:image` apontando para a textura hero quando ela tiver URL absoluta.
- Conferir o resultado em 390px e 1280px com capturas do navegador antes de encerrar.
