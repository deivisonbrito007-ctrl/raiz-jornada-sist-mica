# Botão “Instalar o app” para a cliente

## Situação atual (verificada)

- O manifesto (`public/manifest.webmanifest`) já está completo: nome, `display: standalone`,
  cores, ícones 192/512 comuns e maskable. As tags de cabeçalho (`manifest`, `theme-color`,
  `apple-touch-icon`, telas de abertura do iOS) já existem.
- Já existe detecção de app instalado e um aviso de “Reinstalar” para builds antigos.
- O que **não** existe: nenhum botão ou convite para instalar. Hoje a cliente só instala se
  souber usar o menu do navegador. É isso que vamos criar.
- O worker de notificações (`public/push-sw.js`) fica intocado — nada de modo offline.

## O que a cliente vai ver

1. **Botão “Instalar o Raiz no celular”** no Perfil, dentro de um cartão acolhedor que explica o
   ganho em uma frase (“abre direto da tela inicial, sem navegador, com lembretes”).
2. **Convite discreto no Início**, aparecendo só uma vez (dispensável, com “agora não” que
   silencia por 14 dias) e nunca para quem já instalou.
3. **No Android/Chrome**: o toque abre o convite nativo de instalação do próprio sistema — um
   toque e pronto.
4. **No iPhone (Safari)**: como a Apple não permite instalação automática, o botão abre uma folha
   com os passos ilustrados (Compartilhar → Adicionar à Tela de Início), com o ícone do app
   mostrado para reconhecimento.
5. **No computador**: instruções curtas do ícone de instalar na barra de endereço.
6. **Quando já está instalado**: em vez do botão, o cartão mostra “Você já está com o Raiz
   instalado” — sem convite repetido.
7. **Depois de instalar**: uma mensagem de boas-vindas curta confirmando que deu certo.

## Compatibilidade e casos de falha cobertos

- Safari no iOS não expõe instalação automática → sempre passos manuais, nunca um botão que
  “não faz nada”.
- Chrome no iOS e navegadores in-app (Instagram, Facebook, WhatsApp) não instalam → mostramos
  o aviso “abra no Safari/Chrome para instalar”, com o endereço para copiar.
- Firefox Android usa “Adicionar à tela inicial” em vez de “Instalar” → texto adequado.
- Dentro do preview do editor (iframe) o convite não aparece, porque a instalação só funciona
  no app publicado.
- Se o convite nativo do sistema não estiver disponível no momento do toque, cai
  automaticamente nas instruções manuais em vez de dar erro.
- Nada de laço de recarregamento, nada de service worker de cache novo.

## Sugestões incluídas no escopo

- Adicionar `screenshots` ao manifesto: o Android passa a mostrar um convite de instalação mais
  rico (com imagem do app) em vez da barra simples.
- Adicionar `shortcuts` no manifesto para atalhos ao segurar o ícone: “Prática de hoje”,
  “Diário”, “Minha jornada”.
- Adicionar `categories` e `display_override: ["standalone", "minimal-ui"]` para melhor
  comportamento em navegadores diferentes.

## Detalhes técnicos

- Novo `src/hooks/use-instalar-app.ts`: captura `beforeinstallprompt` (guardando o evento),
  expõe `podeInstalarNativo`, `plataforma`, `navegadorSemSuporte` (WebView/in-app, Chrome iOS),
  `jaInstalado` (reaproveitando `emModoInstalado`/`contextoDeEdicao` de
  `use-instalacao-desatualizada.ts`), `instalar()` (chama `prompt()` e lê `userChoice`) e
  escuta `appinstalled`. Registro do listener em `useEffect`, nada em SSR.
- Novo `src/components/instalar-app/cartao-instalar.tsx` (cartão do Perfil, na escala tipográfica
  `perfil-titulo`/`perfil-texto`/`perfil-nota` já padronizada) e
  `src/components/instalar-app/passos-instalacao.tsx` (folha/dialog acessível com `Sheet` do
  shadcn, foco preso, passos por plataforma reaproveitando o texto de `aviso-reinstalar-app.tsx`).
- Novo `src/components/instalar-app/convite-instalar.tsx`: faixa dispensável no Início, com
  persistência do “agora não” em `localStorage` (chave `raiz:convite-instalar-adiado`), mesmo
  padrão de `adiarAviso` em `src/lib/versao-app.ts`.
- `src/routes/_authenticated/app.perfil.tsx`: inserir o cartão na seção do dispositivo, acima de
  `AvisoReinstalarApp`.
- `src/routes/_authenticated/app.index.tsx`: renderizar o convite no topo da Home do cliente.
- `public/manifest.webmanifest`: acrescentar `screenshots`, `shortcuts`, `categories` e
  `display_override`. Gerar 2 imagens de screenshot (mobile 1080x1920) em `public/screenshots/`.
- Testes (Vitest + RTL): iOS mostra passos e não botão nativo; Android com evento disponível
  chama `prompt()`; navegador in-app mostra aviso de abrir no navegador; já instalado esconde o
  convite; “agora não” persiste. Arquivo `src/components/instalar-app/cartao-instalar.test.tsx`.

## Fora de escopo

- Modo offline / cache de conteúdo (não foi pedido e mudaria o comportamento do app).
- Publicação em App Store / Play Store.
