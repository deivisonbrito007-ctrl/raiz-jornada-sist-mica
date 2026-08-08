# E2E: aviso de remoção aberto várias vezes em sequência

Novo teste automatizado que abre o aviso de remoção (`role="alert"`) várias vezes seguidas e confere, em cada ciclo, que o foco volta para o elemento correto **antes** da próxima dispensa — cobrindo o risco de o foco "vazar" ao repetir a operação (foco preso no aviso anterior, foco no `<body>`, ou foco travado no primeiro controle da página em vez do controle de origem daquele ciclo).

O teste existente (`e2e/aviso_alerta_foco_e2e.py`) cobre um ciclo por vez e continua como está.

## O que o novo teste faz

Para cada ciclo (5 repetições), com o cliente na biblioteca:

1. Coloca o foco em um controle **diferente** da tela (1º, 2º, 3º... controle focável), registrando qual é a origem daquele ciclo.
2. O terapeuta remove a liberação pela API — o aviso aparece em tempo real.
3. Verifica que o aviso recebeu o foco e que existe apenas **um** aviso na tela (nenhum aviso residual do ciclo anterior).
4. Dispensa alternando o modo: clique em "Entendi, dispensar aviso" nos ciclos ímpares e tecla Escape nos pares.
5. Verifica que, depois da dispensa, o foco está exatamente no controle de origem registrado no passo 1 — nunca no `<body>`, nunca dentro do aviso já fechado, e com indicador de foco visível.
6. Só então inicia o ciclo seguinte, garantindo que a ordem "abrir → dispensar → foco restaurado" nunca se sobreponha.

Ao final: confere que nenhum aviso permaneceu na tela, que a página segue navegável por teclado (Tab avança normalmente) e imprime um resumo por ciclo. Qualquer divergência acumula uma falha e o teste encerra com erro; screenshots de cada ciclo ficam em `e2e/screenshots/`.

Também cobre um caso de sobreposição: um ciclo em que a remoção acontece **enquanto** o aviso anterior ainda está aberto, para garantir que a origem guardada não seja substituída pelo próprio aviso.

## Detalhes técnicos

- Arquivo novo: `e2e/aviso_alerta_foco_repetido_e2e.py`, Playwright assíncrono, mesmo padrão dos E2E atuais (restauração da sessão Supabase por cookies + `localStorage`, helper `Api` REST com RLS, `SKIP` limpo quando a sessão não pode gerenciar liberações ou não há eixos).
- Reaproveita a estratégia já validada: liberar/remover linhas de `liberacoes` para o próprio usuário via REST, disparando o Realtime que monta `AvisoRemocaoRealtime`.
- Snippet de inspeção de foco (`document.activeElement`: tag, nome acessível, `:focus-visible`, se está dentro de `[role="alert"]`) igual ao do teste atual, mais uma checagem de identidade do elemento (comparação por referência guardada em `window`) para não depender só do texto do rótulo.
- Nenhuma alteração de código de aplicação está prevista. Se o teste revelar um defeito real de restauração de foco em ciclos repetidos, o ajuste sairia em `src/hooks/use-foco-origem.ts` / `src/components/aviso-remocao-realtime.tsx` e eu reporto antes de mexer.
- Execução: `python3 e2e/aviso_alerta_foco_repetido_e2e.py` (precisa de sessão com permissão de gerenciar liberações; roda contra `http://localhost:8080`).
