# Aba “Clientes” — central de organização

Hoje a página é um formulário de convite seguido de uma lista de cartões com um seletor de status. Vamos transformá-la numa central: cabeçalho com contagens e busca, filtros, tabela com as informações de acompanhamento, menu de ações e um perfil do cliente organizado em abas.

## Cabeçalho

- Título “Clientes”, com total e quantos estão ativos.
- Busca por nome, e-mail ou telefone (estado na URL, então o filtro sobrevive ao recarregar e pode ser compartilhado).
- **Adicionar cliente** — abre um formulário de ficha prévia (nome, e-mail, telefone, observações). A ficha aparece na lista como “Cadastro sem convite”.
- **Enviar convite** — dispara o convite (para uma ficha existente ou direto para um e-mail novo) e mostra o link para copiar.

## Filtros e ordenação

Filtros combináveis: Ativo, Aguardando convite, Com trilha em andamento, Sem trilha ativa, Aguardando revisão, Pausado, Encerrado, Arquivado, Terapeuta responsável e Última atividade (7 / 30 / mais de 30 dias).

Ordenação por nome, última atividade ou próxima revisão. Paginação de 20 por página. Arquivados ficam fora da lista padrão.

## Listagem

Cada linha traz: iniciais (ou foto quando houver), nome e e-mail, status, terapeuta responsável, trilha atual, progresso da trilha, última atividade, próxima revisão e um marcador quando há solicitação de apoio pendente. No celular cada cliente vira um cartão, sem rolagem horizontal.

## Menu de ações

Abrir perfil · Criar plano de acompanhamento · Enviar mensagem ou orientação · Reenviar convite · Pausar acesso · Encerrar acompanhamento · Arquivar cliente.

- **Enviar mensagem**: chega como aviso dentro do app e também por e-mail/push, respeitando os canais que o cliente permitiu nas preferências dele.
- **Arquivar**: encerra o acompanhamento e retira o acesso ao app. Pede confirmação explícita, explicando o efeito, e é reversível por “Reativar”.
- Cada ação só aparece para quem tem a permissão correspondente, e toda mudança de acesso vai para a auditoria.

## Perfil do cliente em abas

`/admin/cliente/<id>` passa a ter oito abas, mantendo o que já existe hoje (pacote, liberações, registros) redistribuído:

1. **Visão geral** — só o necessário para acompanhar: status, terapeuta, trilha atual com progresso, próxima revisão, última atividade, pendências e observações internas.
2. **Plano atual** — a atribuição ativa, etapas e mensagem enviada.
3. **Trilhas anteriores** — planos concluídos ou encerrados.
4. **Registros compartilhados** — apenas o que o cliente escolheu compartilhar.
5. **Check-ins** — antes e depois das práticas.
6. **Solicitações de apoio** — com resposta.
7. **Consentimentos e privacidade** — termos aceitos e o que a terapeuta pode ver.
8. **Histórico de acesso** — convite, primeiro acesso, pausas, encerramentos, arquivamento.

## Privacidade

- O diário privado continua invisível para a equipe — isso já é garantido no banco, e a tela vai deixar explícito que só o compartilhado aparece, com data do compartilhamento.
- Ficha sem prontuário: nenhuma anotação diagnóstica, nenhum campo clínico novo; observações internas seguem sendo texto livre para organização.
- Estados vazios acolhedores em toda tela, inclusive “nenhum resultado para esta busca”.

## Detalhes técnicos

**Banco (uma migração)**
- `convites_clientes`: `observacoes text not null default ''` e `enviado_em timestamptz` para a ficha prévia; o status ganha o valor `cadastro` (ficha criada, convite ainda não enviado).
- `clientes_acesso`: `arquivado_em timestamptz`.
- Sem novas tabelas e sem coluna clínica.

**Servidor** — `src/lib/clientes.functions.ts` (novo), tudo com `requireSupabaseAuth` + `garantirPermissao`:
- `adminClientesPainel` — uma busca agregada devolvendo DTOs já com trilha atual, progresso, última atividade, próxima revisão, apoio pendente e terapeuta responsável.
- `adminCriarFicha`, `adminEnviarConvite` (também reenvio, gerando token novo), `adminMensagemCliente` (notificação + canais permitidos, reutilizando `src/lib/lembretes.ts`), `adminArquivarCliente` / `adminReativarCliente`.
- `adminGetCliente` passa a trazer check-ins, solicitações de apoio, consentimentos e histórico de acesso, e a filtrar o diário por `visibilidade = 'compartilhado'` no próprio SELECT.
- Auditoria em toda ação de acesso: `cliente_arquivado`, `cliente_reativado`, `cliente_pausado`, `acompanhamento_encerrado`, `convite_reenviado`, `mensagem_enviada`.

**Cliente** — busca, filtros, ordenação e página em search params validados (`zodValidator` + `fallback`); derivações puras em `src/lib/clientes-painel.ts`; componentes em `src/components/painel/clientes/`; chave `adminClientes` registrada em `src/lib/cache-chaves.ts` com invalidação nas ações.

**Testes** — regras de filtro/ordenação/paginação e derivações em `src/lib/clientes-painel.test.ts`; tela (estados vazio, carregando, erro, permissões, confirmação de arquivar, ausência do diário privado) em `src/routes/_authenticated/admin.clientes.test.tsx`; abas do perfil em `admin.cliente.perfil.test.tsx`.
