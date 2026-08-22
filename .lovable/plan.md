# Auditoria e redesenho da aba "Jornada" do cliente

## O que encontrei hoje

A tela é uma lista de cartões brancos com barra de progresso e etapas em blocos cinza. Funciona, mas está muito abaixo do padrão que já criamos no Início (cabeçalho com gradiente floresta, halo, cartões orgânicos). Além do visual, há falhas reais:

- **Etapa personalizada quebra a navegação**: atividades escritas pela terapeuta (sem conteúdo vinculado) recebem um id inventado (`atribuicaoId-ordem`) e ainda são renderizadas como link para `/app/etapa/$conteudoId`. Ao tocar, o cliente cai em erro.
- **Carregamento sem identidade**: só um texto "Carregando sua jornada..." em vez de skeletons de marca.
- **Dados que o backend já entrega e a tela ignora**: resumo e objetivo da trilha, motivo da indicação, alertas, orientações de pausa, prazo por etapa, e os check-ins emocionais (50 registros carregados e não usados).
- **Sem noção de "onde eu estou"**: nenhuma indicação de próxima etapa dentro da lista, nenhum agrupamento entre planos ativos/concluídos, nenhuma leitura de ritmo.
- **Estado vazio pobre**: quem usa no modo autoguiado vê "aguarde sua terapeuta", sem caminho para começar sozinho.
- **Metadados incompletos**: falta `og:type` e `twitter:card` no head da rota.
- **Acolhimento ausente**: nada celebra a conclusão de uma trilha nem convida a respirar antes de começar.

## O que vou construir

### 1. Cabeçalho vivo da jornada
Cabeçalho em gradiente floresta com halo suave (mesma linguagem do Início): nome, quantos planos ativos, etapas concluídas no total, e uma frase de ritmo ("você tem caminhado devagar e isso é caminhar"). Botão "Pedir apoio" integrado com destaque suave, não solto no canto.

### 2. Cartão de plano redesenhado
- Anel de progresso circular em vez de barra fina, com o percentual ao centro e o nome do eixo.
- Faixa de "próximo passo" no topo do cartão: título da etapa, duração e botão "Continuar" — o passo mais importante deixa de estar no fim do cartão.
- Objetivo combinado, motivo da indicação e recado da terapeuta em um bloco "Palavra da terapeuta" com aspas e tipografia serif.
- Selos (somente em sessão, com acompanhamento, revisão, prazo) unificados num único componente de selo.
- Alertas e orientações de pausa da trilha em um aviso âmbar de cuidado, com ícone e linguagem gentil.

### 3. Trilha como caminho, não como lista
Etapas viram uma trilha vertical com marcadores conectados por linha: concluída (semente cheia), atual (halo pulsante), a fazer (contorno). Cada item mostra tipo, duração, obrigatória/opcional e prazo. Etapas personalizadas ficam expansíveis no lugar (descrição da terapeuta + "marcar como feita" quando aplicável) em vez de link quebrado. Cartão pode recolher etapas já concluídas para reduzir peso visual.

### 4. Estados e organização
- Filtros suaves: "Em andamento", "Concluídas", "Todas".
- Planos concluídos ganham cartão de celebração ("Você fechou este ciclo") em tom mais calmo.
- Estado vazio diferente por modo de uso: acompanhado ("sua terapeuta está montando seu caminho" + acesso à biblioteca livre) e autoguiado (CTA para escolher eixo e começar hoje).
- Skeletons de marca no carregamento.

### 5. Ritmo e sentimento
Bloco "Como você tem se sentido" usando os check-ins já carregados: últimas emoções com intensidade, em pílulas coloridas, e link para o diário. Sem gráfico pesado, só leitura acolhedora.

### 6. Apoio
Seção de pedidos de apoio redesenhada como conversa: sua mensagem e a resposta da terapeuta em bolhas distintas, com estado "aguardando retorno" e o prazo combinado visível.

## Detalhes técnicos

- Novos componentes em `src/components/app-jornada/`: `cabecalho-jornada.tsx`, `cartao-plano.tsx`, `caminho-etapas.tsx`, `selos-plano.tsx`, `aviso-cuidado.tsx`, `pulso-emocional.tsx`, `conversa-apoio.tsx`, `jornada-vazia.tsx`.
- `src/routes/_authenticated/app.jornada.tsx` passa a ser composição + filtro de status; head recebe `og:type` e `twitter:card`.
- Etapas personalizadas: não renderizar `Link`; usar `<details>`/estado local acessível. Correção de bug real.
- Modo de uso lido via `getMeuContexto` + `blocosDoModo`, como no Início, para o estado vazio.
- Apenas frontend: nenhuma migração, nenhuma mudança em `getMinhaJornada` (todos os campos usados já vêm no payload).
- Tokens semânticos existentes (floresta, salvia, ocre, terracota); zero cor hardcoded.
- Testes: `src/routes/_authenticated/app.jornada.test.tsx` cobrindo etapa personalizada sem link, filtro de status, estado vazio por modo e a11y do progresso/trilha.
