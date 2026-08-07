# Retomada automática após renovar o acesso

Hoje, quando o link seguro expira e a pessoa clica em "Renovar acesso", o player volta com a mídia carregada no ponto anterior, **mas pausado** — é preciso apertar play de novo. A ideia é continuar sozinho, do mesmo segundo, sem registrar progresso duplicado.

## Comportamento desejado

1. Renovação bem-sucedida → a mídia recarrega, busca a posição guardada e **começa a tocar automaticamente**.
2. A retomada acontece só quando o bloqueio anterior foi de link expirado (`validade`) ou falha de rede — nunca quando o conteúdo foi revogado.
3. Se a pessoa estava pausada no momento em que o link expirou, a mídia volta pausada (respeita a intenção dela).
4. Se o navegador bloquear o autoplay (regra de mídia sem gesto do usuário), aparece um aviso curto pedindo para apertar play — nada trava.
5. O registro de progresso continua único: retomar não gera um novo "em andamento" para uma prática já iniciada, nem repete a conclusão.

## Consistência do progresso

- A intenção de reprodução (tocando/pausado no instante do bloqueio) passa a ser guardada junto com a posição.
- O registro de "em andamento" só é enviado uma vez por sessão de player, controlado por uma marca em memória; a retomada automática não dispara novo envio.
- O envio de progresso permanece bloqueado enquanto houver qualquer motivo de bloqueio ativo, como já é hoje.

## Detalhes técnicos

Arquivo principal: `src/routes/_authenticated/app.conteudo.$conteudoId.tsx`

- `expirarMidia()` passa a salvar também `tocandoAntesRef` (se `!el.paused`), além da posição.
- Novo `retomarAutoRef`: marcado como `true` no sucesso de `renovarMidia()` quando `tocandoAntesRef` era `true`; limpo depois de consumido.
- `retomarPosicao(el)`: após ajustar `currentTime`, se `retomarAutoRef` estiver ativo chama `el.play()` dentro de um `try/catch` (promise rejeitada = autoplay barrado) e, em caso de falha, mostra um toast "Toque em play para continuar de onde parou".
- Novo `progressoIniciadoRef` substitui a dependência de `data?.status === "nao_iniciado"` em `alternar()`, evitando `marcarProgresso("em_andamento")` repetido após renovação/seek.
- Ajuste do toast de sucesso de renovação para refletir que a reprodução volta sozinha.

## Testes

Em `src/routes/_authenticated/app.conteudo.expiracao.test.tsx` (mocks de `HTMLMediaElement.play`):

- Expira tocando → renova → `play()` é chamado e `currentTime` é a posição salva.
- Expira pausado → renova → `play()` **não** é chamado.
- Autoplay rejeitado → mensagem pedindo play, sem erro na tela.
- Renovação após retomada não envia um segundo `marcarProgresso("em_andamento")`.
