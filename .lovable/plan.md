# Corrigir lentidão ao trocar de aba no Painel da Terapeuta

## O que está causando a demora

Verifiquei o código de navegação e as rotas do painel. A cada clique em um ícone da barra lateral, o app faz trabalho de rede **antes** de mostrar a nova tela — e como não há indicador de carregamento, a tela antiga "congela" por 1–3 segundos:

1. `src/routes/_authenticated/route.tsx` chama `supabase.auth.getUser()` (ida ao servidor de autenticação) em toda navegação.
2. `src/routes/_authenticated/admin.tsx` chama, também em toda navegação, o `rpc("pode_administrar")` (ida ao banco).
3. O código de cada aba só começa a ser baixado depois do clique — o router não está com pré-carregamento por intenção (`defaultPreload`).
4. Sem `defaultPendingComponent`, nada aparece durante essa espera: parece travado.
5. Só depois de tudo isso a aba dispara suas próprias consultas de dados.

## O que vou fazer

1. **Verificar sessão sem ida à rede repetida**: usar a sessão local já em cache para o guard e validar contra o servidor apenas quando ela estiver ausente/expirada. Redirecionamento para `/auth` continua igual.
2. **Cachear a checagem de permissão administrativa**: mover `pode_administrar` para o cache de consultas (com `staleTime` curto) e dar ao guard do `/admin` uma janela de reuso, para não repetir a chamada em cada troca de aba. O vigia de permissões em tempo real e o bloqueio imediato quando o acesso é removido continuam funcionando.
3. **Pré-carregar ao passar o mouse/foco**: ativar `defaultPreload: "intent"` no router, para o código da aba (e os dados possíveis) já vir antes do clique.
4. **Feedback imediato**: adicionar um `defaultPendingComponent`/skeleton no layout do painel, com atraso mínimo, para a troca de aba responder na hora.
5. **Pré-aquecer dados das abas mais usadas** (Clientes, Trilhas, Acompanhamento) ao passar o mouse no item da barra lateral, usando o pré-carregador já existente com limites de segurança.
6. **Reduzir refetches do layout**: o `refetchInterval: 15000` + `refetchOnMount: "always"` do contexto do painel será ajustado para não competir com cada navegação, mantendo a detecção de revogação de acesso.

## Sugestões extras (incluídas)

- `src/components/painel/navegacao.ts` importa ícones pelo barril do `lucide-react`; trocar por importações diretas, como já foi feito no resto do app, para diminuir o pacote inicial do painel.
- Medir antes/depois no painel **Utilidades → Diagnóstico** (já existe) para comprovar a melhora por rota.

## Detalhes técnicos

- Arquivos: `src/router.tsx`, `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/admin.tsx`, `src/components/painel/sidebar-terapeuta.tsx`, `src/components/painel/navegacao.ts`.
- Guards continuam server-side-safe: rotas administrativas seguem protegidas por RLS e pelas funções `SECURITY DEFINER`; o cache é apenas de UI, não é decisão de autorização final.
- Testes: ajustar/adicionar testes para o guard cacheado e para o pré-carregamento na barra lateral; rodar a suíte completa e a checagem de tipos.
