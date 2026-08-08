# Lembretes de prática e reflexão (e-mail + push)

Objetivo: o cliente recebe lembretes entre sessões para praticar e escrever a reflexão — por notificação no celular/navegador (push) e por e-mail, com um lembrete semanal fixo e um alerta quando ficar dias sem praticar.

## Como vai funcionar

**Preferências (Perfil do cliente → nova seção "Lembretes")**
- Ligar/desligar lembretes.
- Escolher canal: push, e-mail ou os dois.
- Dia da semana + horário do lembrete semanal (ex.: terça, 19h).
- Quantos dias de inatividade disparam o alerta de retomada (padrão 3).
- Botão "Ativar notificações neste dispositivo" (pede permissão do navegador).

**Painel do terapeuta (tela do cliente)**
- Bloco "Lembretes": ver se estão ativos, sugerir/ativar lembretes para o cliente e ajustar dia/horário padrão.
- O cliente sempre pode desativar depois — a preferência dele vence.
- Cada ativação/alteração feita pelo terapeuta entra na auditoria da equipe.

**Quando o lembrete é enviado**
- Semanal fixo: no dia/hora escolhidos, só se a meta semanal ainda não foi cumprida.
- Inatividade: quando passam N dias sem prática concluída (usa a sequência/heatmap já existentes).
- Reflexão: se houve prática concluída sem entrada no diário, o texto do lembrete convida a registrar a reflexão.
- Anti-spam: no máximo 1 lembrete por cliente por dia e nunca o mesmo tipo repetido na mesma semana.

**Conteúdo**
- E-mail com a identidade do Raiz: saudação, sequência atual, meta da semana, prática sugerida e botão para abrir o app (ou o diário).
- Push curto com o mesmo destino ao clicar.
- Todo lembrete também cria uma notificação no sininho do app, então o cliente vê mesmo sem push/e-mail.

## Pré-requisito

O envio de e-mail precisa do domínio de envio configurado (useraiz.online). Se ainda não estiver, abro o assistente de configuração antes de ligar a parte de e-mail — o push e as notificações no app funcionam sem isso.

<presentation-actions>
<presentation-open-email-setup>Configurar domínio de e-mail</presentation-open-email-setup>
</presentation-actions>

## Detalhes técnicos

Banco (migração + GRANTs + RLS):
- `preferencias_lembretes` (user_id PK, ativo, canal_push, canal_email, dia_semana, hora_local, fuso, dias_inatividade, definido_por, updated_at) — cliente lê/escreve a própria; equipe com `ver_clientes`/`gerenciar_liberacoes` lê e escreve conforme permissão.
- `dispositivos_push` (id, user_id, endpoint único, p256dh, auth, user_agent, created_at) — só o dono e service_role.
- `lembretes_enviados` (id, user_id, tipo, chave_dedupe única, canal, status, created_at) — dedupe e histórico; escrita só por service_role.

Push: Web Push padrão (VAPID) com `web-push`; chaves via `generate_secret` (`VAPID_PUBLIC_KEY` exposta como VITE, `VAPID_PRIVATE_KEY` server-only). Service worker dedicado em `public/push-sw.js` (só `push`/`notificationclick`, sem cache de app-shell, sem registro no preview/iframe). Hook `src/hooks/use-push-lembretes.ts` para permissão, subscribe/unsubscribe e sincronia com `dispositivos_push`.

E-mail: `email_domain--scaffold_transactional_email_templates` + template `lembrete-pratica.tsx` no estilo do app; envio via `sendTemplateEmail` com `idempotencyKey` = chave de dedupe.

Agendador: rota `src/routes/api/public/hooks/lembretes.ts` (POST, autenticada por `apikey`) que seleciona clientes elegíveis, monta o texto com as funções de `src/lib/raiz-format.ts`, grava em `notificacoes` + `lembretes_enviados` e dispara push/e-mail. Agendada com pg_cron a cada 30 min (respeitando fuso e hora local de cada cliente).

Servidor: `src/lib/lembretes.functions.ts` (ler/salvar preferências do cliente, salvar/remover dispositivo, terapeuta configurar por cliente com checagem de permissão e registro em `auditoria_equipe`).

UI: nova seção em `app.perfil.tsx`, bloco em `admin.cliente.$clienteId.tsx` (gated por `permissao-ui`), a11y seguindo os padrões já usados (rótulos, `aria-live` via `use-anuncio`, alvos de 44px).

Testes: Vitest para elegibilidade/dedupe/fuso do agendador, preferências e gating de permissão; teste do hook de push com mocks de `Notification`/`serviceWorker`.
