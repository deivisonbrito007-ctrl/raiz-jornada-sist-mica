# Entrada no desktop com a mesma composição do mobile

Hoje o mobile tem a experiência imersiva (topo verde com halo, curva orgânica e o formulário em pergaminho) e o desktop usa uma divisão em duas colunas, com estética diferente. O ajuste unifica: no desktop a mesma composição vertical do mobile, apenas maior, centralizada e com respiro.

## Como fica

- Fundo da página inteira: gradiente da marca + textura de aura, sem coluna dividida.
- No centro, um cartão em pergaminho (largura confortável, cantos bem arredondados, sombra orgânica) contendo, na mesma ordem do mobile: logo com halo, "Raiz", frase de acolhimento, abas Entrar/Criar conta, formulário, "Esqueci minha senha", divisor OU, botão Google e a linha de selos (Privado · No seu ritmo · Com acompanhamento).
- A lista de três benefícios que só aparecia no desktop passa a viver abaixo do cartão, em linha, discreta sobre o fundo verde — o conteúdo não se perde, mas deixa de criar um layout diferente do mobile.
- Escalas maiores no desktop (logo, títulos, altura dos campos), mantendo os mesmos tokens de cor, tipografia e sombra.
- Em telas altas o cartão é centralizado verticalmente; em telas baixas ele rola normalmente, sem corte.
- Mesma unificação aplicada à página de nova senha (`/reset-password`), para as duas telas de acesso combinarem.

## Sugestões incluídas

- Manter a curva orgânica também no desktop, como topo do cartão, preservando a assinatura visual da marca.
- Limitar a largura do cartão (~26rem de conteúdo) para o formulário não esticar em monitores largos.
- Reduzir levemente a opacidade da textura no desktop, onde a imagem aparece muito maior, evitando ruído atrás do cartão.

## Detalhes técnicos

- `src/components/auth/painel-marca.tsx`: remove o modo "coluna esquerda" (`md:min-h-screen`, `md:justify-between`, alinhamento à esquerda) e passa a ser o topo do cartão em todas as larguras; o fundo aura/gradiente sobe para um wrapper de página. A lista de benefícios sai daqui e vira um componente/bloco abaixo do cartão.
- `src/routes/auth.tsx` e `src/routes/reset-password.tsx`: troca do `md:grid md:grid-cols-[1fr_minmax(0,30rem)]` por um wrapper `min-h-screen` com o gradiente, `flex` centralizado e o cartão `max-w-md md:max-w-lg` com `rounded-[2.5rem]` e `shadow-organico`.
- Nenhuma mudança em lógica de autenticação, estados, textos de erro ou testes de comportamento — `src/routes/auth.test.tsx` continua válido, e a verificação será visual em 390px e 1280px.
