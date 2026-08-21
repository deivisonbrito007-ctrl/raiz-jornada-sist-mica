# Tela de entrada do Raiz — redesenho mobile-first

## Auditoria do que existe hoje

A tela `/auth` é um formulário genérico centrado: logo, título, card branco com campos e um botão. Verificado no código:

- Sem link "Esqueci minha senha" e **sem rota `/reset-password`** — quem esquece a senha não tem caminho nenhum.
- Sem botão para mostrar/ocultar a senha e sem indicação de força mínima (só `minLength=6` silencioso).
- Sem login social (nenhum `signInWithOAuth` no projeto).
- Erros do backend aparecem crus em toast, em inglês (ex.: "Invalid login credentials").
- No mobile: card sem respiro real, sem safe-area, campos com risco de zoom no iOS (fonte < 16px), teclado cobre o botão.
- Visualmente não comunica "cuidado espiritual/terapêutico": fundo plano, nenhuma textura, hierarquia fraca, tudo do mesmo peso.
- O seletor "Como você vai usar o Raiz?" aparece no meio do cadastro, deixando a primeira tela longa e confusa.

## Redesenho proposto (mobile primeiro)

Estrutura em tela cheia, sem card flutuando no vazio:

```text
+---------------------------+
|  (topo floresta profundo) |
|   halo suave + logo Raiz  |
|   "Respire. Você chegou."  |
|                           |
+-- borda superior curva ---+
|  pergaminho               |
|  [ Entrar | Criar conta ]  |  <- abas segmentadas
|  E-mail                   |
|  Senha            (olho)  |
|  Esqueci minha senha      |
|  [   Entrar   ]  (largo)  |
|  ---- ou ----             |
|  [ Continuar com Google ] |
|  frase de acolhimento     |
+---------------------------+
```

- **Topo imersivo**: faixa em verde-floresta com gradiente e halo radial em ocre atrás da logo, criando sensação de luz/aura. Curva orgânica separando do corpo em pergaminho.
- **Abas segmentadas** Entrar / Criar conta no lugar do link de texto — deixa o duplo caminho óbvio de imediato.
- **Campos maiores** (altura 3.25rem, fonte 16px para não dar zoom no iOS), rótulos flutuantes discretos, ícones de e-mail/cadeado, foco em terracota.
- **Botão principal** largo, arredondado, com sombra orgânica e estado de carregamento com texto ("Abrindo seu espaço...").
- **Mensagem de acolhimento** curta no rodapé, mais 3 selos de confiança minimalistas (privado, no seu ritmo, com acompanhamento) — dá cara de produto, não de formulário.
- **Cadastro**: passo 1 pede nome, e-mail e senha; a escolha "convidada pela terapeuta / por conta própria" vira o passo 2, com cartões ilustrados. Menos parede de texto na primeira impressão.
- **Confirme seu e-mail**: estado dedicado com ilustração/ícone, e-mail em destaque e botão "reenviar o link".
- **Desktop**: mesma composição em duas colunas — lado esquerdo com a arte imersiva e frase da marca, direito com o formulário.

## Correções funcionais incluídas

1. **Fluxo de senha completo**: link "Esqueci minha senha" → `resetPasswordForEmail` com `redirectTo` para uma **nova rota pública `/reset-password`** que valida o link de recuperação e chama `updateUser({ password })`.
2. **Mostrar/ocultar senha** e dica mínima de senha no cadastro.
3. **Erros em português**: mapear os códigos do backend (credencial inválida, e-mail já cadastrado, e-mail não confirmado, muitas tentativas) para mensagens humanas, reaproveitando o mapeamento já existente em `src/lib/erro-permissao.ts`.
4. **Entrar com Google** (configurado no mesmo passo para não dar "Unsupported provider"), com `redirectTo` na própria origem.
5. **Mobile real**: `env(safe-area-inset-*)`, `autocapitalize/autocorrect` desligados no e-mail, `inputMode="email"`, botão sempre alcançável com o teclado aberto, alvos de toque ≥ 44px.
6. **Acessibilidade**: erros ligados aos campos via `aria-describedby`, `aria-live` nos avisos, foco visível, contraste AA sobre o topo escuro.

## Detalhes técnicos

- Arquivos: reescrita de `src/routes/auth.tsx` quebrada em componentes em `src/components/auth/` (`painel-marca.tsx`, `formulario-entrar.tsx`, `formulario-cadastro.tsx`, `estado-confirme-email.tsx`, `campo-senha.tsx`); nova rota `src/routes/reset-password.tsx`.
- Zero cor fixa: apenas tokens já existentes (`floresta`, `pergaminho`, `terracota`, `salvia`, `ocre`) mais 1–2 tokens novos em `src/styles.css` para o gradiente/halo da marca.
- Uma imagem ambiente gerada (textura suave de luz/folhagem) como asset opcional no topo, com fallback em gradiente puro.
- `existeTerapeuta` e a caixa "Sou a terapeuta responsável" continuam, movidas para o passo 2 do cadastro.
- Sem mudança de regra de negócio: `signUp`/`signInWithPassword`, `next` seguro e redirecionamento para `/entrada` seguem idênticos.
- Testes: atualizar `src/routes/auth.test.tsx` para as abas e cobrir o novo fluxo de recuperação de senha.
