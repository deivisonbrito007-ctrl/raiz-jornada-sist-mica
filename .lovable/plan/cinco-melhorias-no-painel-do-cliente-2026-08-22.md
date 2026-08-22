# Cinco melhorias no painel do cliente

Um bloco de trabalho em cinco frentes, todas na experiência do cliente, mantendo o tom contemplativo já estabelecido (floresta profunda, Instrument Serif, ritmo editorial).

## 1. Diário de reflexão: prompts guiados, tags por eixo e linha do tempo

O que já existe: convites de escrita rotativos, sentimentos, agrupamento por mês, busca e filtros, painel de insights. O que falta de fato: escolher o prompt (hoje é só o do dia), marcar eixos sistêmicos na entrada (a tabela do diário guarda apenas o vínculo com a prática, não eixos) e ver o caminho como linha do tempo visual.

- **Prompts guiados**: no bloco de escrita, uma tira horizontal de convites por trilho temático (corpo, sistema familiar, despedidas, chão firme). Tocar aplica o prompt como cabeçalho da reflexão; "outro convite" troca. O convite do dia continua sendo o padrão.
- **Tags por eixo**: seletor de eixos sistêmicos (os mesmos do cliente) na hora de escrever e no cartão já salvo. Quando a reflexão nasce de uma prática, o eixo dela vem pré-marcado. Vira novo filtro na lista e alimenta os "temas recorrentes" dos insights com dado real em vez de só frequência de palavras.
- **Linha do tempo**: acima da lista, uma faixa por mês com um ponto por entrada (tamanho pelo tamanho do texto, cor pelo eixo, contorno quando compartilhada). Tocar num ponto rola até a reflexão. Mantém-se a lista completa embaixo.

## 2. Rituais curtos de abertura e fecho na prática guiada

Hoje a etapa da jornada já tem um check-in; ele passa a ser um ritual em três respiros.

- **Abertura (antes de tocar)**: respiração guiada de ~40s com animação suave, escolha da intenção do dia (sugestões curtas + campo livre, lembrado da última vez) e uma frase de ancoragem. Botão "pular ritual" sempre visível.
- **Fecho (após concluir)**: silêncio de 20s, uma pergunta única ("o que fica?"), gesto de gratidão e dois caminhos: guardar no Diário (já com a intenção e o eixo pré-preenchidos) ou apenas encerrar.
- A intenção fica salva junto do registro da etapa, aparece no Diário e na Jornada como fio do dia.

## 3. Widget de progresso na Home com marcos

Um cartão único, silencioso, entre "Para agora" e "Do seu processo".

- Sequência de semanas e ciclo atual como dois marcos lado a lado (dados já calculados hoje).
- Porcentagem por eixo em barras finas e orgânicas, ordenadas por afinidade.
- Conquistas suaves (primeira reflexão, primeira semana completa, um eixo inteiro, sete práticas, um mês de escuta) como pequenos selos: conquistados em terracota discreto, os demais apenas sugeridos — nunca cobrança, nunca gamificação estridente.

## 4. Central de notificações e lembretes

Nova tela no Perfil (o sino no cabeçalho ganha o atalho "ver tudo").

- **Histórico**: recados da terapeuta e lembretes enviados numa lista única por data, com estado lido/não lido.
- **Pausa temporária**: silenciar por 7, 14 ou 30 dias, com a data de retorno dita em palavras ("volta a lembrar em 3 de setembro").
- **Ajuste fino**: dia da semana e horário do lembrete semanal, canais (push/e-mail), dias de inatividade — tudo em controles grandes, mobile-first.
- O agendador respeita a pausa e não envia nada durante ela.

## 5. Onboarding acolhedor no Início

Só para quem ainda não concluiu nenhuma prática; desaparece sozinho e pode ser dispensado.

- Boas-vindas curtas com o primeiro nome e uma frase sobre o que é a Raiz.
- Checklist de quatro passos: conhecer seus eixos, fazer a primeira prática, escrever a primeira reflexão, escolher seu ritmo semanal. Cada item leva direto ao lugar e marca-se sozinho quando acontece.
- Dois cartões explicativos: como funciona a Jornada e onde/por que registrar o Diário (incluindo a diferença entre privado e compartilhado).
- Reabrível depois pelo Perfil ("como funciona a Raiz").

## Detalhes técnicos

- **Banco**: nova tabela de tags do diário (`diario_eixos`, entrada + eixo, RLS por dono, GRANTs); colunas de intenção e ritual no registro da etapa; colunas de pausa (`silenciado_ate`) em `preferencias_lembretes`; marcação de onboarding no perfil do cliente (`onboarding_em`, `onboarding_dispensado_em`).
- **Lógica pura e testada**: `src/lib/diario-cliente.ts` (trilhos de prompts, filtro por eixo, série da linha do tempo), novo `src/lib/rituais.ts` (respiros, intenções sugeridas), novo `src/lib/marcos-cliente.ts` (conquistas e porcentagem por eixo), `src/lib/lembretes.ts` (pausa) e novo `src/lib/onboarding-cliente.ts` (passos e conclusão). Cada um com suite em Vitest, seguindo o padrão dos módulos existentes.
- **Servidor**: novas server functions em `src/lib/raiz.functions.ts` (tags do diário, marcos, onboarding) e em `src/lib/lembretes.functions.ts` (pausa); todas com `requireSupabaseAuth`, nunca chamadas em loaders públicos.
- **Componentes**: `src/components/app-diario/` (trilhos de prompts, seletor de eixos, linha do tempo), `src/components/app-pratica/` (ritual de abertura e fecho), `src/components/app-inicio/` (widget de marcos, onboarding), nova rota `app.lembretes.tsx` para a central.
- **Acessibilidade**: rituais com `prefers-reduced-motion` respeitado, foco e `aria-live` nas transições de fase, alvos de toque ≥44px, cor nunca como única informação nas tags e na linha do tempo.
