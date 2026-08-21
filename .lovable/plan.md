# Tela de carregamento em alta qualidade (mobile + web)

## O que está errado hoje

- A tela "Preparando o seu espaço..." (`src/routes/_authenticated/entrada.tsx`) usa a logo PNG em `h-20` com `animate-pulse`. O arquivo original tem 720x864 px e **muita área vazia na direita e embaixo**: o desenho ocupa só parte do quadro. Ao reduzir para 80 px de altura, o símbolo fica pequeno, desalinhado do centro e com bordas suavizadas — daí a impressão de imagem "borrada e feia".
- A logo é bitmap único (sem versão vetorial e sem `srcset`), então em telas Retina/2x-3x o navegador amplia pixels em vez de renderizar nítido.
- Ao abrir o app instalado (PWA), o iOS não tem imagem de abertura definida (nenhum `apple-touch-startup-image`), então mostra uma tela branca/ícone esticado antes do app aparecer.
- O carregamento entre rotas usa blocos cinza genéricos (`carregando-rota.tsx`), sem identidade da marca.

## O que vou fazer

1. **Logo nítida e centralizada**
   - Gerar uma versão vetorial (SVG) do símbolo Raiz, recortada exatamente no desenho (sem margem vazia), para uso em qualquer tamanho sem perda.
   - Passar `RaizLogo` a usar o SVG por padrão, mantendo o PNG como reserva. Assim a logo fica perfeitamente centrada e nítida no cabeçalho, na entrada, na landing e no painel.

2. **Splash de carregamento profissional**
   - Criar um componente único de abertura (`splash-raiz`) com: fundo em degradê "floresta" da marca, aura suave, símbolo centralizado com respiro correto, animação calma de respiração (não `pulse` piscando), wordmark "Raiz" e a frase de espera.
   - Respeitar `prefers-reduced-motion`, manter `role="status"` + `aria-live` e altura estável (sem salto de layout) no mobile (390 px) e no desktop.
   - Usar esse splash em `entrada.tsx` e como estado de espera inicial do app.

3. **Carregamento entre rotas com identidade**
   - Ajustar `carregando-rota.tsx` para skeletons com as cores/raios da marca e um selo discreto da logo, em vez de blocos cinza neutros.

4. **Abertura do app instalado (iOS/Android)**
   - Gerar imagens `apple-touch-startup-image` nos tamanhos dos iPhones/iPads atuais (retrato e paisagem) com o mesmo visual do splash e registrá-las em `__root.tsx` com as media queries corretas.
   - Conferir `background_color`/`theme_color` do manifest para o splash do Android combinar com o do app.

5. **Verificação**
   - Estender `scripts/verificar-icones.mjs` para validar também as imagens de abertura (dimensões e presença), mantendo a checagem no CI.
   - Conferir no navegador (mobile 390 px e desktop 1280 px) com capturas, e rodar os testes existentes.

## Detalhes técnicos

- Arquivos tocados: `src/components/raiz-logo.tsx`, novo `src/components/splash-raiz.tsx`, `src/components/carregando-rota.tsx`, `src/routes/_authenticated/entrada.tsx`, `src/routes/__root.tsx`, `public/` (novas imagens de abertura), `scripts/verificar-icones.mjs`, `public/manifest.webmanifest`.
- Sem mudanças de banco, autenticação ou regras de negócio: é trabalho de interface e assets.
- Cores vindas dos tokens já existentes em `src/styles.css` (floresta, terracota, creme) — nada de cor fixa em componente.
