# Deixar o encaminhamento do cadastro claro e à prova de erro

Hoje a escolha "sou cliente de uma terapeuta" x "quero começar por conta própria" só aparece no **passo 2** do cadastro, depois de nome/e-mail/senha, dentro de um bloco discreto. Quem chega direto em `/auth` (ou pelo Google) não vê a escolha em destaque e pode criar a conta no caminho errado — e hoje o sistema aceita "acompanhado" mesmo sem convite, criando um pedido silencioso.

## O que muda para quem usa

1. **A escolha vira o primeiro passo, em destaque**
   - Passo 1: "Como você vai usar o Raiz?" — dois cartões grandes, com ícone, título, descrição e o que acontece depois ("sua terapeuta libera as trilhas" / "você escolhe um pacote e caminha no seu ritmo").
   - Passo 2: nome, e-mail e senha, com um resumo fixo no topo ("Com acompanhamento · trocar") para nunca ficar dúvida de qual caminho está sendo criado.
   - Indicador "Passo 1 de 2" / "Passo 2 de 2" e botão "Voltar" em ambos.

2. **Quem vem da página inicial já chega com o caminho marcado**
   - O cartão escolhido aparece selecionado, com um selo "Sua escolha" e o passo 1 já validado — basta confirmar. Trocar continua a um toque.

3. **Conferência do convite antes de criar a conta**
   - Ao escolher "sou cliente de uma terapeuta", depois de digitar o e-mail o app confere se existe convite pendente para aquele endereço.
   - Sem convite: um aviso claro com duas saídas — "Usar outro e-mail" ou "Criar conta e pedir acompanhamento" (explica que o acesso começa autoguiado até a terapeuta responder). Nada de escolha descartada em silêncio.
   - Com convite: mensagem de confirmação ("Encontramos o convite de {primeiro nome da terapeuta}") antes de criar a conta.

4. **Google no lugar certo**
   - O botão "Continuar com Google" no cadastro só aparece no passo 2, depois do caminho escolhido, e leva essa escolha para o pós-login (fluxo já existente). Na aba "Entrar" continua no topo, como está.

5. **Opção de terapeuta mais honesta**
   - Quando ainda não existe terapeuta no espaço, ela deixa de ser um checkbox escondido e passa a ser um terceiro cartão no passo 1 ("Sou a terapeuta responsável"), com nota de que vale só para a primeira conta.

6. **Confirmação final coerente**
   - A tela "confirme seu e-mail" e a triagem pós-login passam a dizer, em uma linha, para onde a pessoa vai ("Seu espaço autoguiado está pronto" / "Assim que a terapeuta liberar, suas trilhas aparecem aqui").
   - Na aba Entrar, o link "Criar conta" preserva o caminho escolhido; no cadastro, "Já tenho conta" leva para Entrar sem perder o destino (`next`).

## Detalhes técnicos

- `src/components/auth/formulario-cadastro.tsx`: inverter as etapas (1 = caminho, 2 = dados), adicionar indicador de passo, resumo com "trocar", cartão de terapeuta e slot para o bloco de verificação de convite.
- `src/routes/auth.tsx`: `etapaCadastro` passa a começar no passo 1 = escolha; quando `?caminho=` vem preenchido, iniciar já no passo 2 com o resumo; mover `BotaoGoogle` do cadastro para o passo 2; manter `caminho` sincronizado com a URL (`navigate` com `search` funcional, `replace`) para que voltar no navegador restaure a escolha.
- Nova server fn pública em `src/lib/cadastro.functions.ts` (`convitePendente`): recebe e-mail, responde apenas `{ existe: boolean, terapeuta?: string }` (primeiro nome) usando o cliente admin; sem dados sensíveis, com limite de uso via `consumir_limite` para evitar sondagem de e-mails.
- `caminho_entrada` continua indo nos metadados do `signUp` (o trigger `handle_new_user` já honra `convite`/`propria`), e o caso "escolheu acompanhamento sem convite" segue registrando `solicitacoes_acompanhamento` — agora com o consentimento explícito na tela.
- Testes: atualizar `src/routes/auth.test.tsx` para a nova ordem de passos e cobrir três casos novos — escolha vinda da URL, convite não encontrado (aviso + seguir autoguiado), convite encontrado (metadados `convite`).
