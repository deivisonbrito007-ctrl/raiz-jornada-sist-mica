# Testes de interface para a expiração da URL assinada no player

Novo arquivo de testes cobrindo a tela do player (`/app/conteudo/$conteudoId`) com a mídia expirando de verdade durante a simulação, no mesmo estilo dos testes de UI já existentes (`src/routes/auth.test.tsx`).

## Cenários cobertos

1. **Expiração pelo tempo de validade** — a mídia chega com validade curta; ao vencer, o player pausa sozinho, o bloco de reprodução sai da tela e aparece a mensagem "Acesso à mídia expirou" com o botão "Renovar acesso".
2. **Expiração por link morto** — quando o elemento de vídeo/áudio dispara erro de carregamento, o mesmo estado de expiração aparece (pausa + mensagem).
3. **Progresso bloqueado** — com o acesso expirado, "Marcar como concluída" não grava nada no backend e mostra o aviso de que é preciso renovar antes de concluir; o play também não volta a tocar.
4. **Renovação bem-sucedida** — clicando em "Renovar acesso", o backend é chamado de novo, a mensagem desaparece, o player volta com o link novo, pausado, no ponto onde estava.
5. **Mídia revogada na renovação** — quando o backend responde sem URL, aparece a mensagem de prática não liberada, o botão passa a "Tentar novamente" e nenhum progresso é gravado.
6. **Sem gravação de progresso durante todo o período expirado** — verificação de que a função de progresso do servidor não recebeu nenhuma chamada nesses fluxos.

## Detalhes técnicos

- Arquivo: `src/routes/_authenticated/app.conteudo.expiracao.test.tsx`.
- Mocks: `@tanstack/react-router` (`createFileRoute`, `useParams`, `Link`, `useNavigate`), `@tanstack/react-start` (`useServerFn` devolvendo os mocks de `getConteudo`/`marcarProgresso`), `sonner` para capturar os avisos, e `@/lib/raiz.functions` para não puxar código de servidor.
- Render com `QueryClientProvider` (retry desligado) e o componente extraído de `Route.component`.
- Tempo controlado com `vi.useFakeTimers()` + `userEvent.setup({ advanceTimers })`, avançando até passar de `urlExpiraEm` para acionar o timer de expiração.
- jsdom não implementa `play`/`pause`: stub em `HTMLMediaElement.prototype` (`play`, `pause`) e `duration`/`currentTime` configuráveis, para checar pausa e posição retomada.
- Asserções por texto/rótulo acessível ("Acesso à mídia expirou", "Renovar acesso", "Tentar novamente", `aria-label` "Reproduzir"), sem depender de classes.
- Sem mudanças em código de produção; apenas testes.
