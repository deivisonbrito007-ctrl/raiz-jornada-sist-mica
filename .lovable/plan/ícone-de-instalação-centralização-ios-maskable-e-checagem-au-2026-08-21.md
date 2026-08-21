# Ícone de instalação: centralização, iOS, maskable e checagem automática

## O que está errado hoje

Medi os arquivos atuais em `public/`:

- Os ícones estão centralizados pela **caixa geométrica** do desenho (sobra igual à esquerda/direita). Como a raiz tem galhos finos que se esticam muito para os lados e uma massa densa embaixo, o resultado parece torto e "caído" — o eixo do tronco não coincide com o centro do quadrado.
- Não existe `icon-maskable-192.png`: o Android/Chrome pede maskable também em 192 para atalhos e telas menores.
- O `apple-touch-icon.png` (180) tem o mesmo desenho grande dos outros; no iOS a máscara arredondada come as bordas, então o símbolo precisa de folga maior e fundo 100% opaco (sem alfa).
- Não há nenhuma checagem que garanta que os arquivos do manifest existem nas dimensões declaradas.

## O que vou fazer

### 1. Recentralizar o símbolo (corrigir o "torto")

Regerar todos os ícones a partir da logo original, mas centralizando pelo **centro de massa da tinta** (centroide ponderado) e alinhando o eixo vertical do tronco ao centro do quadrado, em vez de usar a caixa do desenho. Efeito prático: o símbolo passa a parecer visualmente no meio, tanto no ícone quadrado quanto dentro do círculo/squircle dos launchers.

### 2. Conjunto de ícones correto

| Arquivo | Tamanho | Uso | Folga do símbolo |
| --- | --- | --- | --- |
| `favicon.png` | 64 | aba do navegador | maior (o desenho precisa "ler" em 16px) |
| `apple-touch-icon.png` | 180 | iOS (tela de início) | ~64% da área, fundo opaco creme |
| `icon-192.png` / `icon-512.png` | 192 / 512 | Android/desktop `any` | ~72% |
| `icon-maskable-192.png` / `icon-maskable-512.png` | 192 / 512 | Android `maskable` | ~56% (zona segura do círculo) |

### 3. Manifest e head

- Declarar os quatro ícones `any` + os dois `maskable` no `manifest.webmanifest`.
- Manter `theme_color: #1b2a1d` e `background_color: #f3ebd8` e garantir que o `theme-color` da `head` seja idêntico ao do manifest (o Lighthouse reclama de divergência).
- Confirmar `apple-touch-icon` na `head` e `id`/`start_url`/`scope` coerentes no manifest.

### 4. Checagem automática

Novo script `scripts/verificar-icones.mjs`, rodado no CI junto dos testes, que falha se:

- algum ícone do manifest não existir em `public/`;
- as dimensões reais do PNG não baterem com o `sizes` declarado;
- o `apple-touch-icon` tiver transparência;
- faltar `purpose: maskable` em 192 e 512, ou o desenho maskable invadir a zona insegura (>60% de ocupação);
- `theme_color` do manifest divergir do `theme-color` da `head`.

Também adiciono um teste de unidade que roda essa mesma verificação, para o erro aparecer localmente e no PR.

### 5. Validação iOS e Lighthouse

- Simular a instalação iOS no Safari/WebKit via Playwright: carregar a página, extrair o `apple-touch-icon` e renderizá-lo com a máscara squircle do iOS para conferir que nada é cortado; anexo os recortes.
- Rodar Lighthouse (categoria PWA/instalabilidade) contra o build e corrigir o que aparecer sobre manifest, theme-color e ícones.

## Detalhes técnicos

- Fonte do desenho: a logo hospedada em `src/assets/raiz-logo.png.asset.json` (baixada no build do ícone, nada de reamostragem borrada — todo redimensionamento parte do original em alta).
- Geração com Pillow (Lanczos), fundo chapado `#f3ebd8`, alfa removido nos ícones opacos.
- Lighthouse via `npx lighthouse` em modo headless contra o preview local.
- Nenhuma mudança em lógica de negócio, rotas ou banco.
