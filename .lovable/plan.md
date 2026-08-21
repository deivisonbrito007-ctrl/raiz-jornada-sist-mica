# Ícone de instalação do app: corrigir e profissionalizar

## O que está errado hoje (verificado)

- `public/` só tem `favicon.ico` (o ícone padrão da Lovable, 6,5 KB) — a marca da Raiz nunca foi aplicada ao ícone.
- O `head()` da rota raiz aponta apenas para `/favicon.ico`. Não existe `apple-touch-icon`, nem ícone 192/512, nem `manifest.webmanifest` em nenhum lugar do projeto.
- Por isso, ao "instalar o aplicativo", o sistema pega o `.ico` pequeno e o amplia — daí o resultado borrado e sem identidade.
- A logo disponível (`src/assets/raiz-logo.png`) é 720x864 com fundo transparente, ou seja, retangular: se for esticada para um quadrado, distorce; e num ícone de app o fundo transparente vira um quadrado branco/preto feio.

## O que vou fazer

1. **Gerar um ícone quadrado da marca** a partir da própria logo da Raiz: símbolo centralizado, sem esticar, sobre o fundo verde floresta da marca, com respiro nas bordas (área de segurança para o recorte circular do Android/iOS). Nada de logo transparente colada num quadrado.
2. **Exportar todos os tamanhos necessários**, em PNG nítido:
   - `favicon.png` (32/64) — aba do navegador
   - `apple-touch-icon.png` (180x180) — atalho no iPhone/iPad
   - `icon-192.png` e `icon-512.png` — instalação no Android/desktop
   - `icon-maskable-512.png` — versão com margem extra para o recorte adaptativo do Android
3. **Criar `public/manifest.webmanifest`** com nome ("Raiz"), nome curto, cor de tema/fundo na paleta floresta, `display: standalone`, `start_url: /` e a lista de ícones (incluindo `purpose: maskable`).
4. **Ligar tudo no `head()` da rota raiz**: substituir o `favicon.ico` pelo PNG da marca, adicionar `apple-touch-icon`, `link rel="manifest"`, `theme-color` e as metas de app em tela cheia no iOS.
5. **Remover o `public/favicon.ico` padrão**, para nenhum cliente ou robô continuar recebendo o ícone antigo da Lovable.
6. **Conferir o resultado** no navegador (ícone da aba) e inspecionando os arquivos gerados em 192/512 para garantir nitidez real, sem upscale.

## Detalhes técnicos

- Ícones gerados com ImageMagick a partir do PNG original em 720x864: `-resize` proporcional + `-gravity center -extent` no quadrado, com fundo sólido da marca; nunca `cp` direto do arquivo grande.
- Área de segurança do maskable: símbolo ocupando ~72% do canvas.
- O `manifest.webmanifest` é servido estático de `public/`; nenhuma alteração em lógica de negócio, rotas de dados ou banco.
- Já existe `public/push-sw.js` registrado para notificações; ele não conflita com o manifest e não será alterado.

## Sugestões extras (posso incluir, diga se quer)

- Um `favicon.svg` vetorial, que fica perfeito em qualquer tamanho e acompanha o modo escuro do navegador.
- Uma imagem de compartilhamento (og:image) na mesma identidade, para os links da Raiz aparecerem com capa no WhatsApp e nas redes.
