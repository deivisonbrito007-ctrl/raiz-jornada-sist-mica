# Um só login, terapeuta reconhecida pelo e-mail

## O que muda para quem usa

- A seção "Para terapeutas sistêmicos" sai da página inicial. Ela hoje só duplica um caminho
  que já existe ("Entrar") e sugere que qualquer pessoa pode criar conta de terapeuta.
- O cadastro passa a ter só duas escolhas: "Sou cliente de uma terapeuta" e "Quero começar por
  conta própria". O cartão "Sou a terapeuta responsável" desaparece da tela de cadastro.
- A terapeuta entra pela mesma tela de login das clientes (e-mail e senha ou Google). Como a
  conta dela já existe e está marcada como terapeuta, o app a leva direto ao painel
  administrativo depois de entrar — nada muda no que ela faz hoje.
- Cliente entra e cai no painel do cliente. Ninguém vê a tela do outro.

## Como o encaminhamento funciona depois da mudança

```text
/auth  (uma única tela: entrar | criar conta de cliente)
  |
  v
/entrada  (verifica o papel da conta pelo e-mail já cadastrado)
  |-- papel = terapeuta  ->  /admin
  '-- papel = cliente    ->  /app
```

Esse desvio já existe e continua sendo a única porta de decisão — ou seja, o acesso da
terapeuta deixa de depender de escolha na tela e passa a depender apenas do e-mail cadastrado.

## Segurança e o caso "conta de terapeuta única"

- Nenhum cadastro público poderá mais pedir o papel de terapeuta, o que fecha a porta de
  autoatribuição desse papel na interface.
- No banco, o gatilho de criação de conta deixa de aceitar o pedido de papel "terapeuta" vindo
  do formulário. A concessão do papel passa a ser exclusivamente administrativa (pela aba Equipe,
  já existente, com convite por e-mail).
- Se algum dia for preciso recriar a conta principal, isso é feito por convite/promoção na aba
  Equipe — não por um botão público.

## Sugestões incluídas

- Mensagem de erro mais clara no login quando o e-mail não tem conta ainda, com link para criar
  conta de cliente (evita a terapeuta e as clientes ficarem em dúvida na mesma tela).
- Na página inicial, o rodapé ganha um link discreto "Sou terapeuta — entrar no painel" que aponta
  para `/auth`, para a terapeuta não perder o atalho que a seção removida oferecia.
- Manter a aba Equipe como único lugar que concede papéis e permissões.

## Detalhes técnicos

- `src/components/landing/secoes-raiz.tsx`: remover o export `ParaTerapeutas`; remover seu uso em
  `src/routes/index.tsx`; adicionar o link discreto no rodapé da landing.
- `src/components/auth/formulario-cadastro.tsx`: remover `CARTAO_TERAPEUTA`, a prop
  `mostrarOpcaoTerapeuta`, o valor `"terapeuta"` de `CaminhoEntrada` e sua entrada em
  `ROTULO_CAMINHO`.
- `src/routes/auth.tsx`: remover `souTerapeuta`, o estado `existeTerapeuta` e a chamada
  `consultarExisteTerapeuta`; o `papel` gravado na intenção de login passa a ser sempre `"cliente"`
  e o `caminho_entrada` sempre `convite`/`propria`.
- `src/lib/intencao-login.ts` e `src/components/auth/botao-google.tsx`: simplificar `PapelEntrada`
  para `"cliente"` (mantendo leitura tolerante de valores antigos guardados no navegador).
- Migração: atualizar `public.handle_new_user` para ignorar
  `raw_user_meta_data->>'papel' = 'terapeuta'` (sempre criar como `cliente`). Sem mudança de
  tabelas, políticas ou grants. A função `public.existe_terapeuta()` deixa de ser chamada pela UI;
  pode permanecer no banco sem uso.
- Testes: ajustar `src/routes/auth.test.tsx` e
  `src/components/auth/botao-google.test.tsx` (casos com `papel: "terapeuta"`), e verificar
  `src/lib/intencao-login.test.ts`. Rodar a suíte após a mudança.

## Fora de escopo

- Nada muda no painel da terapeuta, nas permissões da equipe ou nos dados existentes.
- A conta de terapeuta atual continua funcionando com o mesmo e-mail e senha.
