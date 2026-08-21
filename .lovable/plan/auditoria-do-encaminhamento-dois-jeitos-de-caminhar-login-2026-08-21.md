# Auditoria do encaminhamento "Dois jeitos de caminhar" → login

## O que verifiquei

Li a seção `DoisCaminhos` da página inicial, a rota `/auth`, o formulário de cadastro em dois passos, o botão de Google e o gatilho de criação de perfil no banco. Os pontos abaixo estão confirmados no código.

## Falhas encontradas

1. **A escolha do caminho é perdida.** Os dois botões ("Entrar com acompanhamento" e "Começar autoguiado") levam exatamente para o mesmo endereço (`/auth?modo=cadastro`). Quem clica em "acompanhamento" cai no cadastro com a opção "Quero usar por conta própria" já marcada e precisa escolher de novo — e, se não perceber, entra no modo errado.

2. **O modo escolhido não chega ao banco.** O cadastro envia o caminho escolhido junto com a conta, mas o gatilho do banco ignora esse dado: ele decide o modo só pela existência de um convite pendente. Quem escolhe "Fui convidada pela terapeuta" e ainda não tem convite é gravado silenciosamente como autoguiado, sem nenhum pedido de acompanhamento registrado.

3. **Entrar com Google perde tudo.** Pelo Google não vai nome nem caminho escolhido, então toda conta nova por Google vira autoguiada. Além disso o destino pretendido é gravado em `sessionStorage` ("raiz:destino-pos-login") e **nunca é lido em nenhum lugar** — depois do Google o usuário sempre volta para o início em vez do destino (ex.: página de convite).

4. **Recarregamento desnecessário e risco de rota travada.** Após entrar com destino, o código usa `window.location.replace`, recarregando o app inteiro em vez de navegar internamente.

5. **Detalhes de robustez no login:** a checagem de sessão usa `getSession()` (não revalida) e o redirecionamento automático pode disparar antes do formulário ficar pronto; a aba (Entrar/Criar conta) não reflete na URL, então voltar no navegador não restaura o estado.

## O que será corrigido

- **Encaminhamento com intenção:** cada botão passa o caminho na URL (`/auth?modo=cadastro&caminho=acompanhado|autoguiado`), validado na rota. O cadastro já abre com a opção correta marcada e um texto de contexto ("Você escolheu seguir com acompanhamento"), permitindo trocar.
- **Modo persistido de verdade:** o gatilho de criação de perfil passa a respeitar o caminho escolhido: com convite pendente → vinculado à terapeuta; sem convite mas escolhendo acompanhamento → conta criada em modo acompanhado com um pedido registrado em `solicitacoes_acompanhamento` (aparece no painel da terapeuta); escolhendo por conta própria → autoguiado.
- **Google alinhado:** o caminho e o destino escolhidos são guardados antes do redirecionamento e aplicados após a sessão existir — o destino salvo passa a ser realmente lido e usado, e o modo do novo usuário é ajustado por uma função no servidor logo após o primeiro login.
- **Navegação limpa:** troca de `window.location.replace` por navegação do roteador, checagem de sessão via `getUser()`, e a aba ativa sincronizada com a URL.
- **Mensagens de erro:** revisão do mapeamento para cobrir e-mail não confirmado, credenciais inválidas, e-mail já cadastrado e limite de tentativas, com texto acolhedor em português.

## Sugestões incluídas

- Na aba "Entrar", link discreto "Não tem conta? Escolha seu jeito de caminhar" que volta à seção da página inicial.
- Depois do cadastro autoguiado, mostrar no painel do cliente um convite leve para pedir acompanhamento a qualquer momento (usando o pedido já existente).

## Detalhes técnicos

- `src/components/landing/secoes-raiz.tsx`: `search={{ modo: "cadastro", caminho: ... }}`.
- `src/routes/auth.tsx`: `validateSearch` ganha `caminho`, estado inicial derivado, `getUser()`, navegação por `navigate`, leitura do destino salvo pós-OAuth.
- `src/components/auth/formulario-cadastro.tsx`: destaque da opção pré-selecionada.
- `src/components/auth/botao-google.tsx`: grava caminho + destino; nova server fn (`src/lib/cadastro.functions.ts`) aplica o modo após o primeiro login.
- Nova migração: atualiza a função de criação de perfil para ler `caminho_entrada` e inserir em `solicitacoes_acompanhamento` quando aplicável.
