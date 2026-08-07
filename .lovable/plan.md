# Mensagens distintas: acesso expirado vs conteúdo revogado

Hoje os dois casos aparecem no mesmo bloco, com o mesmo título ("Acesso à mídia expirou") e só o parágrafo muda. A tela passa a tratar cada situação como um estado próprio, com título, ícone, orientação e ações diferentes.

## Caso 1 — Link expirou, prática segue liberada

- Título: "O link seguro expirou"
- Ícone de tempo (TimerOff), tom neutro/ocre.
- Texto: explica que o link de reprodução vale por um tempo limitado por segurança e que nada foi perdido — o ponto onde parou está guardado.
- Ação principal: "Renovar acesso" (comportamento atual).
- Nota curta: "Seu progresso continua salvo."

## Caso 2 — Conteúdo revogado pelo terapeuta

- Título: "Prática não está mais liberada"
- Ícone de bloqueio (Lock), tom terracota de alerta.
- Texto: orienta que o terapeuta recolheu esta prática, que isso costuma ser parte do ritmo do acompanhamento, e que a reprodução fica indisponível e nada novo é registrado.
- Ações: "Tentar novamente" (com a espera curta atual) e "Voltar à trilha" (link para o eixo), além de sugerir falar com o terapeuta e, se quiser, registrar no diário.
- Deixa claro que o progresso já registrado permanece.

## Caso 3 — Falha ao renovar (rede/servidor)

Distinguido dos dois acima: título "Não conseguimos renovar agora", texto pedindo para tentar de novo em instantes, botão "Tentar novamente". Evita dizer que foi revogado quando na verdade a chamada falhou.

## Detalhes técnicos

- `src/routes/_authenticated/app.conteudo.$conteudoId.tsx`: substituir o par de estados `midiaExpirada`/`semLiberacao` por um estado único de motivo (`"validade" | "revogado" | "falha" | null`), mantendo os guards de progresso (`registrar`, `alternar`, `concluir`) para qualquer motivo diferente de `null`.
- Extrair o bloco em um componente de apresentação `src/components/aviso-midia-bloqueada.tsx` que recebe motivo, estado de carregamento/espera, `onRenovar` e o `eixoId` para o link de volta.
- Ajustar `src/routes/_authenticated/app.conteudo.expiracao.test.tsx` aos novos títulos/textos e adicionar caso cobrindo a mensagem de falha de rede separada da de revogação.
