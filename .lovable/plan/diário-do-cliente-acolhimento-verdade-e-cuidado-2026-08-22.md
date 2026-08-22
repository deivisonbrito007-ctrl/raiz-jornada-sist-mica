# Diário do cliente: acolhimento, verdade e cuidado

A aba Diário hoje é um formulário só: um campo, um botão, uma lista de textos. Faltam três coisas importantes — e uma delas é uma incoerência de privacidade que precisa ser corrigida.

## Correções necessárias

1. **Texto de privacidade errado.** A tela diz "Ninguém além de vocês dois lê isto" e "entre você e quem acompanha o seu processo". Na prática, toda entrada nasce **privada** (visibilidade "somente eu") e a terapeuta não vê nada. A promessa exibida é falsa nos dois sentidos — assusta quem quer privacidade e ilude quem espera ser lido.
2. **Compartilhamento existe no banco mas não na tela.** Já há suporte a entrada privada, entrada compartilhada, data de compartilhamento e revogação — nada disso é acessível ao cliente. Ele não tem como mostrar uma reflexão à terapeuta nem como voltar atrás.
3. **Sem editar nem apagar.** As permissões de edição e exclusão já existem no banco, mas a tela não oferece nenhuma das duas. Um texto escrito com pressa fica para sempre.
4. **Sem vínculo visível com a jornada.** Reflexões nascidas de uma etapa de plano não mostram a qual plano pertencem.

## Melhorias de experiência

**Cabeçalho vivo (novo componente):** faixa em degradê floresta com halo suave, no mesmo idioma visual do Início e da Jornada. Mostra o nome, quantas reflexões existem, há quantos dias escreve e a última data.

**Convite para escrever, não formulário.** Cartão de escrita com:
- Convite do dia rotativo, com botão "outro convite" para trocar o prompt em vez de aceitar o único sorteado pelo dia da semana.
- Quando vem de uma prática, o convite cita a prática e mostra um selo do eixo.
- Contador suave de caracteres, autossalvamento de rascunho local (para não perder texto ao sair da tela) e atalho de teclado para salvar.
- Escolha explícita da privacidade antes de salvar: "guardar só para mim" ou "compartilhar com minha terapeuta". No modo autoguiado, a opção de compartilhar não aparece — só o registro privado.

**Marcação de sentimento (opcional).** Antes de salvar, a pessoa pode tocar uma palavra que nomeia o que sentiu (calma, saudade, raiva, alívio, medo, gratidão). Fica salvo no próprio texto como uma linha discreta, sem nova estrutura de banco.

**Entradas anteriores como um caminho, não uma lista.**
- Agrupamento por mês, com marcador de tempo relativo ("hoje", "ontem", "há 3 dias").
- Busca por palavra e filtros por privacidade e por prática vinculada.
- Cada entrada mostra o eixo e a prática de origem, com link para a prática.
- Ações por entrada: editar, compartilhar/recolher compartilhamento e apagar (com confirmação).
- Textos longos aparecem recortados com "ler tudo".

**Momento de silêncio.** Quando não há nada escrito, em vez de "Suas reflexões aparecerão aqui": um convite acolhedor com dois ou três primeiros passos possíveis (escrever livremente, responder ao convite do dia, registrar após uma prática).

**Fio de continuidade.** Um bloco discreto no fim lembra a última prática concluída sem reflexão registrada, com link direto para escrever sobre ela.

## Detalhes técnicos

- `src/lib/raiz.functions.ts`: `listarDiario` passa a devolver `visibilidade`, `compartilhado_em`, `atribuicao_id` e o eixo; `salvarDiario` aceita `visibilidade`; novas funções `editarDiario`, `apagarDiario` e `definirVisibilidadeDiario` (todas com `requireSupabaseAuth` e escopo do próprio cliente — as políticas de linha já cobrem update e delete).
- Sem migração de banco: colunas e permissões necessárias já existem.
- Novos componentes em `src/components/app-diario/`: `cabecalho-diario.tsx`, `convite-escrita.tsx`, `lista-reflexoes.tsx`, `cartao-reflexao.tsx`, `diario-vazio.tsx`, `fio-continuidade.tsx`. A rota `app.diario.tsx` fica de composição.
- Lógica pura em `src/lib/diario-cliente.ts` (convites, agrupamento por mês, tempo relativo, filtros, prática sem reflexão) com testes em `src/lib/diario-cliente.test.ts`.
- Rascunho local em `sessionStorage`, lido só depois da hidratação.
- Modo de uso via `useMeuContexto`/`blocosDoModo` para decidir se o compartilhamento aparece.
- Invalidação por evento `aoEscreverDiario` já existente, estendida para as novas escritas.
- `head()` da rota com título e descrição próprios; `aria-live` mantido para salvar, editar, apagar e compartilhar; o teste de acessibilidade existente é atualizado junto.
