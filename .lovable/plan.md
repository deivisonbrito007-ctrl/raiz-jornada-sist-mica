# Detectar instalação antiga e oferecer “Reinstalar”

Hoje o app é instalável (manifest + ícones), mas quem instalou antes das últimas correções continua com o ícone/manifesto antigo salvo na tela inicial — iOS e Android congelam esses dados no momento da instalação. Vamos detectar isso e guiar a reinstalação.

## Como a detecção vai funcionar

1. Cada build passa a carregar uma “assinatura de app” (versão do app + versão dos ícones/manifesto).
2. Na primeira vez que o app abre **em modo instalado** (janela standalone), a assinatura atual é guardada no dispositivo como “assinatura de instalação”.
3. Em aberturas seguintes, se a assinatura de ícones/manifesto do build atual for diferente da guardada na instalação, o app conclui que a instalação é antiga.
4. Só nesse caso aparece um aviso discreto com o botão **Reinstalar**.

Regras de comportamento:
- Nada aparece no navegador comum, no preview do editor, nem dentro de iframe.
- O aviso é dispensável (“Agora não”) e não volta a incomodar por 14 dias.
- Depois de reinstalar, a nova assinatura é registrada e o aviso desaparece sozinho.

## O que o usuário vê

Cartão/diálogo acolhedor, no tom do Raiz:
- Título: “Seu app está com uma versão antiga”
- Texto curto explicando que o ícone e a tela inicial foram atualizados e que reinstalar leva menos de um minuto.
- Botão primário **Reinstalar**, secundário “Agora não”.

Instruções contextuais por plataforma (detectadas por user agent, com opção de ver as duas):

- **iPhone/iPad (Safari)**: manter pressionado o ícone do Raiz na tela inicial → “Remover app” → “Excluir da tela de Início”; abrir o site no Safari → botão Compartilhar → “Adicionar à Tela de Início” → Adicionar.
- **Android (Chrome)**: manter pressionado o ícone → “Desinstalar” / arrastar para Desinstalar; abrir o site no Chrome → menu ⋮ → “Instalar app” / “Adicionar à tela inicial”.
- **Desktop**: instruções de remover pelo ícone da barra de endereço e instalar novamente.
- Link “Abrir no navegador” quando possível, para facilitar o passo da reinstalação.

Acessibilidade: diálogo com foco preso, fechável por Esc, títulos e passos em lista numerada, e status anunciado por leitor de tela.

## Detalhes técnicos

- `src/lib/versao-app.ts`: constantes `VERSAO_APP` e `VERSAO_ICONES` (bumpadas manualmente quando ícones/manifesto mudam), helpers `assinaturaAtual()`, `assinaturaInstalada()`, `registrarInstalacao()`, `instalacaoDesatualizada()` e `adiarAviso()` usando `localStorage` (chaves `raiz.instalacao.assinatura`, `raiz.instalacao.adiado`).
- `src/hooks/use-instalacao-desatualizada.ts`: detecta modo standalone (`matchMedia('(display-mode: standalone)')` + `navigator.standalone` no iOS), roda só após hidratação, ignora preview/iframe, e retorna `{ desatualizada, plataforma, dispensar }`.
- `src/components/aviso-reinstalar-app.tsx`: diálogo acessível com as instruções por plataforma; montado uma vez no shell autenticado e na landing (renderiza `null` fora do app instalado).
- `scripts/verificar-icones.mjs`: passa a checar que `VERSAO_ICONES` foi atualizada quando o conteúdo dos ícones/manifesto muda (hash gravado em um arquivo de referência), mantendo o CI como guarda.
- Testes com Vitest: assinatura antiga/nova, standalone vs navegador, adiamento de 14 dias, instruções corretas por user agent iOS/Android e a11y do diálogo.
- Sem service worker de app-shell e sem mudar `start_url`/`id` do manifesto (mudar isso quebraria instalações existentes).
