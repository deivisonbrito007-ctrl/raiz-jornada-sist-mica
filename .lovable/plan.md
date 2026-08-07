# Renovar acesso: pedir nova URL assinada e retomar o player

O botão "Renovar acesso" já existe na faixa de "Acesso à mídia expirou" e chama o backend, mas hoje ele para no meio do caminho:

- ao renovar, o player recomeça do zero — o ponto onde a pessoa estava é perdido;
- se a mídia estiver revogada na hora do clique, o botão fica travado para sempre, mesmo depois que o terapeuta liberar de novo;
- a biblioteca/trilha continuam com o estado antigo em cache depois da renovação.

## O que vai mudar

1. **Guardar onde a pessoa parou.** No momento em que o acesso expira (fim de validade ou erro de reprodução), o player registra o segundo atual. Depois da renovação, ele volta exatamente para esse ponto e fica pausado, pronto para continuar.

2. **Renovação de verdade a cada clique.** O botão sempre busca uma nova URL assinada no backend (sem reaproveitar cache), mostra "Renovando..." enquanto espera e:
   - mídia liberada: a faixa de expiração desaparece, o player volta com o novo link e a posição salva, com aviso "Mídia liberada novamente";
   - mídia não liberada/revogada: mensagem clara de que a prática não está mais liberada.

3. **Botão nunca trava.** Quando a mídia está revogada, o texto passa a "Tentar novamente" e continua clicável (com uma pequena espera entre tentativas), para funcionar assim que o terapeuta liberar de novo — sem precisar recarregar a página.

4. **Estado atual em todas as telas.** Depois de uma renovação bem-sucedida ou de uma recusa, a biblioteca e a trilha são atualizadas, para não mostrarem uma prática que já não está liberada (ou esconderem uma que voltou).

5. **Progresso protegido.** Play, avanço e "Marcar como concluída" seguem bloqueados enquanto o acesso estiver expirado; só voltam a funcionar depois de uma renovação aceita.

## Detalhes técnicos

- Arquivo: `src/routes/_authenticated/app.conteudo.$conteudoId.tsx`.
- Novo `useRef` com o `currentTime` capturado em `expirarMidia()`; após renovar, aplicar em `onLoadedMetadata` (`el.currentTime = posicaoRef.current`) e manter pausado.
- `renovarMidia()` passa a usar `queryClient.fetchQuery({ queryKey: ["conteudo", conteudoId], queryFn, staleTime: 0 })` (ou `refetch({ cancelRefetch: true })`) para garantir chamada nova ao `getConteudo`, que já devolve `url` + `urlExpiraEm`.
- Substituir o bloqueio permanente `semLiberacao` por um estado que só desabilita o botão durante a chamada e por ~5s após uma recusa (`bloqueadoAte`), mantendo a mensagem de revogação.
- Após a resposta, invalidar `["biblioteca"]` e `["trilha"]`; o efeito existente de `urlExpiraEm` reagenda o timer da nova validade.
- Sem mudanças de backend: `getConteudo` já revalida a liberação por RLS/`conteudo_liberado` e assina a URL apenas quando permitido.
- Teste: novo caso em `src/lib/liberacao-cache-invalidacao.test.ts` (ou arquivo irmão) cobrindo expira → revogado → liberado → renovação devolve URL nova e posição preservada.
