# Dois modos de uso: acompanhado e autoguiado

Hoje todo cliente entra por convite da terapeuta e recebe conteúdo liberado por ela. Vamos abrir um segundo caminho: quem chega por conta própria adquire um pacote e percorre trilhas autoguiadas, sem acompanhamento — podendo pedir acompanhamento depois, dentro do app.

O ponto central é que **modo é uma propriedade da pessoa** (como ela usa o Raiz) e **não do conteúdo em si**; a trilha só diz em quais modos ela pode ser usada.

## Os dois modos

| | Acompanhado | Autoguiado |
| --- | --- | --- |
| Como entra | convite da terapeuta | cadastro aberto |
| Terapeuta responsável | sim | nenhuma |
| O que abre o conteúdo | plano atribuído pela terapeuta | pacote adquirido |
| Trilhas | as marcadas como acompanhadas ou ambas | só as marcadas como autoguiadas ou ambas |
| Mensagens, revisões, apoio | sim | sem canal de apoio individual; orientações fixas da trilha |
| Diário e progresso | iguais, com o compartilhamento sob controle da pessoa | iguais, e nada é compartilhado com ninguém |

Trilhas mais profundas continuam existindo só no modo acompanhado — segurança primeiro.

## Cadastro

A tela de entrada passa a ter duas portas claras:

- **Tenho um convite da minha terapeuta** — fluxo atual, com consentimento e vínculo.
- **Quero começar por conta própria** — cadastro simples, consentimento próprio (que deixa explícito que não há acompanhamento profissional e traz o aviso de não emergência), e queda direta na vitrine de pacotes.

Quem entra sozinho vê, antes de pagar, uma amostra: a apresentação das áreas, a primeira etapa de orientação de uma trilha de entrada e o diário liberado. O restante abre com o pacote.

## Painel do cliente nos dois modos

Mesma casa, ênfase diferente:

- **Acompanhado**: cartão da trilha atual com a mensagem da terapeuta, próxima revisão, “Preciso de apoio”.
- **Autoguiado**: cartão “Continuar minha prática” com escolha de trilha entre as adquiridas, meta semanal, sequência e um bloco discreto “Quero acompanhamento da terapeuta”.

Progresso, histórico, heatmap, diário, lembretes e acessibilidade continuam idênticos — nenhum retrabalho ali.

## Painel da terapeuta: organização dos cadastros

A aba **Clientes** ganha uma separação por modo, em vez de misturar tudo:

- **Acompanhados** — o fluxo de acompanhamento como é hoje.
- **Autoguiados** — quem usa sozinho: pacote, progresso, última atividade. Sem plano, sem revisão, sem diário (nada é compartilhado por padrão).
- **Pedidos de acompanhamento** — fila de quem pediu para ser acompanhado: aceitar (vira acompanhado, mantendo todo o histórico autoguiado), responder ou recusar com mensagem cuidadosa.

Filtro de modo, contagens por modo no cabeçalho e o perfil do cliente indicando o modo e desde quando.

## Pedir acompanhamento

No painel autoguiado: “Quero acompanhamento da terapeuta” → mensagem curta com o motivo → a terapeuta vê na fila. Ao aceitar, a pessoa passa a acompanhada, ganha terapeuta responsável e recebe aviso no app e por e-mail/push. O histórico autoguiado (práticas, check-ins, sequência) continua lá; o diário privado segue privado.

## Pagamento

O acervo autoguiado é pago por pacote. Em duas fases, para não travar o resto:

1. **Agora**: pacotes já existem no sistema; a liberação passa a ser dirigida por “pacote adquirido e pago”, com a terapeuta podendo registrar o pagamento manualmente (útil para PIX ou cobrança fora do app).
2. **Depois**: ligar o checkout integrado do Lovable para a pessoa adquirir sozinha, com o mesmo registro de pacote alimentado pelo retorno do pagamento.

## Detalhes técnicos

**Banco (uma migração)**
- Enum `modo_uso` (`acompanhado`, `autoguiado`) e `clientes_acesso.modo` (default `acompanhado`), `modo_desde timestamptz`.
- `handle_new_user` passa a criar `clientes_acesso` também para quem se cadastra sem convite, com `modo = 'autoguiado'` e `terapeuta_id = null`.
- `trilhas.modos ARRAY` (quais modos aceitam aquela trilha) — default `{acompanhado}`, para nada mudar de comportamento no acervo atual.
- `pacotes.trilhas_incluidas uuid[]` ao lado de `eixos_incluidos`.
- `solicitacoes_acompanhamento` (cliente, mensagem, status, resposta, quem respondeu) com GRANTs, RLS e trigger de `updated_at`.
- Nova função `trilha_liberada_autoguiada(_cliente, _trilha)`: pacote pago que inclui a trilha (ou o eixo dela) e trilha marcada como autoguiada. `conteudo_liberado` passa a aceitar esse caminho além do de atribuição, sem afrouxar nada do modo acompanhado.
- RLS: cliente autoguiado lê só o que o pacote dele abre; a equipe segue vendo o que já vê; diário privado continua fora do alcance da equipe.

**Servidor**
- `src/lib/raiz.functions.ts`: `getMeuContexto` passa a devolver `modo` — é a chave que a interface usa para decidir a ênfase.
- `src/lib/acompanhamento.functions.ts` (novo): `pedirAcompanhamento`, `adminListarPedidos`, `adminAceitarPedido`, `adminRecusarPedido` (com auditoria e aviso pelos canais permitidos, reaproveitando `src/lib/lembretes.ts`).
- `src/lib/pacotes.functions.ts` (novo): vitrine de pacotes para quem é autoguiado, registro de aquisição e `adminRegistrarPagamento`.
- Painel: `adminListarClientes` ganha `modo` e contagens por modo.

**Cliente**
- `src/lib/modo-uso.ts`: tipo, rótulos e as regras de “o que aparece em cada modo”, testadas isoladamente.
- `app.index.tsx` compõe os blocos conforme o modo; `admin.clientes.tsx` ganha as três seções; nova rota `admin.acompanhamento-pedidos` ou aba dentro de Clientes; `auth.tsx` ganha as duas portas.
- Chaves de cache novas em `src/lib/cache-chaves.ts`, com invalidação ao mudar de modo.

**Testes** — regras de modo e de liberação autoguiada em `src/lib/modo-uso.test.ts`; RLS do modo autoguiado (não ver trilha fora do pacote, não ver dados de outro cliente) somada à suíte de segurança; telas de cadastro, painel em cada modo e fila de pedidos.

## Ordem sugerida

1. Migração (modo, trilhas por modo, pedidos, função de liberação).
2. Cadastro autoguiado com consentimento próprio e amostra.
3. Painel do cliente sensível ao modo.
4. Organização de Clientes por modo + fila de pedidos.
5. Pacotes com registro manual de pagamento.
6. Checkout integrado.
