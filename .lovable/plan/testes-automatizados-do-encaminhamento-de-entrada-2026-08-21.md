# Testes automatizados do encaminhamento de entrada

Objetivo: cobrir com testes os quatro cenários que hoje podem levar alguém ao fluxo errado — convite pendente, convite inexistente, troca de passo/escolha e falha no login com Google — garantindo que cada caminho termine no lugar certo, sem erro silencioso.

## Cenários a cobrir

### 1. Convite pendente encontrado
- Escolher "Sou cliente de uma terapeuta", avançar, preencher dados.
- Primeiro clique dispara a conferência: aparece "Conferindo..." e depois a mensagem de convite encontrado com o primeiro nome de quem convidou.
- Nenhuma conta é criada nesse primeiro clique.
- Segundo clique cria a conta com `caminho_entrada: "convite"`.
- A conferência é chamada com o e-mail digitado.

### 2. Convite inexistente e limite de uso
- Sem convite: mostra o aviso explicando que a conta começa autoguiada e o pedido vai para a terapeuta; o botão volta a "Criar conta" e o segundo clique cria a conta.
- Quando a conferência falha (erro de rede) ou responde `limitado`, o cadastro não travar: cai no mesmo aviso e permite criar a conta.

### 3. Troca de passo e troca de escolha
- Voltar do passo 2 para o passo 1 pelo resumo ("trocar") e pelo botão "Voltar para a escolha" mostra novamente os cartões, preservando os dados digitados.
- Trocar de escolha depois de já ter conferido o convite reseta a conferência (o botão deixa de ser "Conferir convite e continuar" quando muda para autoguiado, e volta a exigir nova conferência ao voltar para acompanhamento).
- Trocar a aba "Entrar"/"Criar conta" volta ao passo 1 e atualiza a URL (`modo`) sem perder o estado da tela.
- Chegando com `?caminho=acompanhado|autoguiado` a tela já abre no passo 2 com o cartão certo marcado e o selo "Sua escolha".
- O Google não aparece no passo 1 do cadastro e aparece no passo 2 (a intenção só viaja depois da escolha).

### 4. Falha no Google
- Quando `signInWithOAuth` rejeita (ou responde `{ error }`), aparece a mensagem em português via toast, a intenção guardada é apagada (nada de intenção órfã aplicada no próximo login) e não há navegação.
- Sucesso grava a intenção com destino/caminho/papel corretos, e escolha "terapeuta" grava `caminho: null`.
- Entrar por e-mail/senha limpa qualquer intenção pendente do Google.

## Detalhes técnicos

- Arquivos de teste: estender `src/routes/auth.test.tsx` (fluxos de convite e troca de passo, com os mocks já existentes de `@tanstack/react-router`, `@/integrations/supabase/client`, `@/lib/cadastro.functions` e `sonner`) e criar `src/components/auth/botao-google.test.tsx` para os cenários de sucesso/falha do Google isoladamente.
- O mock de `convitePendente` passa a ser um `vi.fn()` controlável, para simular pendente / ausente / erro / limitado e verificar o argumento `{ data: { email } }`.
- No teste do Google, `@/integrations/lovable` e `sonner` são mockados; a gravação/limpeza da intenção é verificada lendo o `sessionStorage` através das funções de `@/lib/intencao-login` (sem duplicar o formato do registro).
- Consultas por papel/rótulo acessível (`getByRole`, `getByLabelText`, `role="status"`), como no restante da suíte; sem asserções por classe CSS.
- Nenhuma mudança em código de produção está prevista. Se um teste revelar um comportamento errado (por exemplo conferência não resetada ao trocar escolha), o ajuste mínimo será feito no componente correspondente e apontado na resposta.
- Fechamento: rodar `bunx vitest run src/routes/auth.test.tsx src/components/auth src/lib/intencao-login.test.ts` e depois a suíte inteira para confirmar que segue verde.
