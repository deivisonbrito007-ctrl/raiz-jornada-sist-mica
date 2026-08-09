# Aba "Início" do Painel da Terapeuta

Hoje a aba Início existe, mas é enxuta: mostra três métricas, pedidos de apoio, uma lista de atividade recente por cliente e atalhos. Vamos transformá-la na tela de abertura completa do painel, com todos os indicadores vindos de dados reais do banco (clientes, planos de acompanhamento, revisões, apoio, convites, etapas concluídas e registros compartilhados).

Observação sobre o estado atual: o banco ainda não tem clientes, planos nem revisões cadastrados. Então os estados vazios não são detalhe — são o que a terapeuta vai ver primeiro. Eles serão acolhedores e sempre com um próximo passo claro.

## O que a tela vai ter

### Cabeçalho
- "Olá, [nome da terapeuta]" (nome vindo do perfil já carregado no painel).
- Data atual escrita por extenso, no fuso de São Paulo.
- Frase: "Aqui está o que precisa da sua atenção hoje".
- Botões "Adicionar cliente" e "Criar plano de acompanhamento", levando às telas onde essas ações já existem. Eles só aparecem para quem tem a permissão correspondente.

### Resumo (seis cartões, todos com número real)
- Clientes ativos.
- Trilhas em andamento.
- Revisões previstas para esta semana.
- Solicitações de apoio pendentes.
- Planos aguardando início (data de início no futuro).
- Atividades concluídas recentemente (últimos 7 dias).

Cada cartão é clicável e leva à área correspondente. Zero não é erro: mostra "nenhum ainda" com um tom tranquilo.

### Prioridades do dia
Lista única, ordenada por urgência, reunindo:
1. Solicitações de contato (apoio aberto ou em atendimento).
2. Clientes com revisão próxima (até 7 dias) ou já vencida.
3. Trilhas aguardando devolutiva (revisão registrada pelo cliente sem devolutiva escrita).
4. Planos vencidos ou pausados.
5. Convites de cliente ainda não aceitos (inclusive expirados).

A linguagem é factual e não interpretativa: "solicitou contato", "precisa de acompanhamento", "revisão prevista para…", "plano pausado", "convite não aceito". Nenhum diagnóstico, nenhuma classificação de emoção, nenhuma intensidade transformada em rótulo de risco.

### Agenda de revisões
Tabela/lista responsiva com: cliente, trilha atual, objetivo resumido (uma linha), data da revisão, responsável (terapeuta do plano ou "não atribuído") e botão "Abrir acompanhamento" que vai para a ficha do cliente.

### Atividade recente
Linha do tempo com os eventos mais recentes: trilha iniciada, etapa concluída, registro compartilhado, solicitação de apoio, plano pausado ou finalizado. Cada item mostra cliente, tipo de evento e quando. O texto do diário nunca aparece — só "compartilhou um registro", com link para a ficha do cliente.

### Ações rápidas
Cadastrar cliente, Liberar trilha, Criar conteúdo, Criar trilha, Registrar revisão, Ver solicitações de apoio. Cada ação é escondida quando a pessoa não tem a permissão necessária, mantendo o padrão do painel.

### Estados
- Carregando: esqueletos com a mesma forma dos cartões e listas (sem salto de layout).
- Erro: cartão com explicação em linguagem simples e botão "Tentar de novo".
- Sem permissão para ver clientes: a tela mostra só o cabeçalho e as ações liberadas, com aviso de que os indicadores de clientes estão restritos.
- Vazio: mensagens acolhedoras por seção, cada uma com um caminho ("convide seu primeiro cliente", "crie sua primeira trilha").
- Responsivo de 390px até desktop: cartões em coluna única no celular, alvos de toque de 44px, tabela da agenda virando cartões no celular.

## Detalhes técnicos

**Nova função de servidor** `adminInicio` em `src/lib/inicio.functions.ts` (arquivo fino: só a declaração da server fn), com `requireSupabaseAuth` e `garantirPermissao(..., "ver_clientes", ...)` no mesmo padrão de `adminAcompanhamento`. Ela consulta em paralelo, com RLS do usuário: `clientes_acesso`, `atribuicoes` (com trilha e objetivo), `atribuicao_etapas`, `revisoes`, `solicitacoes_apoio`, `convites_clientes`, `diario` (apenas `id, cliente_id, compartilhado_em` — nunca o texto), `progresso` concluído recente, `trilhas` e `profiles`. Retorna DTOs planos, já enxutos e limitados (100 linhas por fonte, janelas de tempo aplicadas no servidor).

**Derivação pura** em `src/lib/inicio-painel.ts`: funções sem I/O que recebem o DTO e produzem `resumo`, `prioridades` (ordenadas), `agenda` e `linhaDoTempo`, com as regras de janela ("esta semana" pelo fuso America/Sao_Paulo, "recente" = 7 dias). Fica testável em unidade, no mesmo estilo de `src/lib/raiz-format.ts`.

**Componentes** novos em `src/components/painel/inicio/`: `cartao-resumo.tsx`, `lista-prioridades.tsx`, `agenda-revisoes.tsx`, `linha-do-tempo.tsx`, `acoes-rapidas.tsx`. A rota `src/routes/_authenticated/admin.inicio.tsx` só compõe, lê permissões com `useMinhasPermissoes()` e o perfil com `useMeuContexto()`.

**Cache**: nova chave `adminInicio` em `src/lib/cache-chaves.ts`, incluída nos grupos `aoMudarPermissoes` e `aoMudarDadosAdmin` para que responder apoio, atribuir trilha ou mudar permissão atualize a tela.

**Testes** (Vitest + Testing Library): unidade para as regras de derivação (semana/fuso, ordenação das prioridades, contagens) e de interface para os estados vazio, carregando, erro e sem permissão, além de garantir que nenhum texto de diário aparece na linha do tempo.

Sem mudanças de banco: todas as tabelas e colunas necessárias já existem.
