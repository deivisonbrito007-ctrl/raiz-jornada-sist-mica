# Raiz: Jornada Sistêmica

![Coverage](./.github/badges/coverage.svg)
[![codecov](https://codecov.io/gh/OWNER/REPO/branch/main/graph/badge.svg)](https://codecov.io/gh/OWNER/REPO)


Prompt para o Lovable — App "Raiz" (acompanhamento terapêutico sistêmico)

Prompt para o Lovable — App "Raiz" (acompanhamento terapêutico sistêmico)

Cole este texto direto no chat do Lovable para iniciar o projeto. Ele já descreve propósito, telas, modelo de dados, regras de acesso e direção visual. Depois da primeira geração, você pode ir refinando tela por tela com novos prompts.

Prompt

Quero criar um aplicativo web (mobile-first, responsivo) chamado Raiz, voltado para acompanhamento terapêutico contínuo entre sessões, com foco em constelação familiar e trabalhos sistêmicos. O app conecta um(a) terapeuta a seus clientes, oferecendo trilhas de conteúdo em vídeo e áudio organizadas por temas sistêmicos, com liberação personalizada de conteúdo, progresso, diário de reflexão e um painel de gestão para o terapeuta.

Propósito do produto

O app resolve o problema de o trabalho terapêutico "esfriar" entre uma sessão e outra. Ele funciona como uma extensão digital do processo: o(a) terapeuta libera práticas guiadas (vídeo/áudio) alinhadas ao momento de cada cliente, e o cliente pratica no próprio ritmo, registrando reflexões e acompanhando seu progresso.

Papéis de usuário

Preciso de dois tipos de usuário com autenticação (e-mail/senha, via Supabase Auth):

Terapeuta (admin) — gerencia clientes, conteúdos, pacotes e acompanha progresso.

Cliente — acessa apenas o conteúdo liberado para ele, pratica e registra reflexões.

Modelo de dados (backend em Supabase)

Crie as seguintes entidades:

usuarios: id, nome, email, papel (terapeuta/cliente), data de criação

eixos: id, nome (Pai, Mãe, Filhos, Ancestralidade, Dinheiro, Saúde, Relacionamentos, Propósito), descrição curta, ícone, ordem de exibição

conteudos: id, eixo_id, tipo (vídeo guiado / áudio-meditação / exercício prático / texto de apoio / tarefa da semana), título, descrição, url_midia, duração, ordem dentro do eixo

pacotes: id, nome (ex: "Pacote individual", "Jornada completa de alinhamento", "Acesso avulso"), descrição, eixos_incluidos, tipo_cobranca (pagamento único / assinatura)

liberacoes: relação entre cliente, eixo (ou conteúdo específico) e status (bloqueado/liberado), data de liberação — controlada manualmente pelo terapeuta

progresso: cliente_id, conteudo_id, status (não iniciado/em andamento/concluído), data de conclusão

diario: cliente_id, conteudo_id (opcional, se a reflexão for vinculada a uma prática), texto, data

clientes_pacotes: qual pacote cada cliente comprou/possui e status do pagamento

Regras de acesso (importante)

Um cliente só pode ver e reproduzir conteúdos dos eixos/itens explicitamente liberados para ele pelo terapeuta.

Use Row Level Security no Supabase para garantir isso no nível do banco, não só na interface.

Os arquivos de vídeo e áudio devem ficar em buckets do Supabase Storage, com acesso via signed URLs — nunca públicos.

O terapeuta tem acesso total a todos os dados de todos os seus clientes. Um cliente nunca vê dados de outro cliente.

Área do cliente (telas)

Login/Boas-vindas — tela simples de entrada, com acolhimento visual (não clínico/frio).

Início (Biblioteca por eixos) — saudação personalizada, grade com os eixos liberados para aquele cliente, cada card mostrando nome do eixo, ícone e progresso (ex: "2/4 concluídos"). Eixos ainda não liberados aparecem visualmente bloqueados (cadeado), sem sumir da tela — isso ajuda a mostrar o caminho futuro da jornada.

Trilha do eixo — ao abrir um eixo, lista os conteúdos daquele eixo em ordem (vídeo guiado, meditação, exercício prático, texto de apoio, tarefa da semana), com ícone de status (concluído/disponível/bloqueado) e duração estimada.

Player — reproduz vídeo ou áudio dentro do próprio app (sem redirecionar para serviço externo), com barra de progresso, controles de play/pause/avançar 15s/voltar 15s, e ao final sugere marcar como concluído e ir para o diário.

Diário de reflexão — após cada prática, um prompt reflexivo relacionado ao eixo/conteúdo, campo de texto livre para o cliente escrever, botão salvar, e histórico de entradas anteriores daquele cliente (privado, só ele e o terapeuta veem).

Progresso — visão geral da jornada: % de conclusão geral, sequência de semanas ativas (streak), quantidade de eixos em andamento, e uma lista/linha do tempo mostrando cada eixo com seu status.

Perfil — dados básicos, pacote atual, opção de trocar senha.

Área do terapeuta / Painel administrativo (desktop-first, mas responsivo)

Menu lateral com: Clientes, Conteúdos, Pacotes, Progresso, Financeiro.

Clientes — lista de todos os clientes com: nome, pacote atual, eixo em que estão trabalhando, barra de progresso, e um botão de ação rápida "Liberar conteúdo". Cards no topo com métricas gerais: clientes ativos, trilhas em andamento, % de conclusão média.

Detalhe do cliente — ao clicar em um cliente: visão completa de quais eixos/conteúdos estão liberados ou bloqueados, com toggles para liberar/bloquear individualmente por eixo ou por conteúdo específico; histórico de progresso; entradas do diário daquele cliente (leitura, para apoiar o acompanhamento clínico).

Conteúdos — biblioteca central de todos os vídeos, áudios, exercícios e textos, organizados por eixo. Interface para fazer upload de novos arquivos de mídia (vídeo/áudio), editar título, descrição e ordem, e criar novos eixos se necessário.

Pacotes — criação e edição dos pacotes de venda (quais eixos cada pacote inclui, tipo de cobrança), vinculação de pacotes a clientes.

Progresso — visão agregada de todos os clientes, útil para identificar quem está travado ou inativo há muito tempo.

Financeiro — status de pagamento de cada cliente/pacote (mesmo que a cobrança em si seja processada por fora inicialmente, precisa de um lugar para marcar manualmente "pago/pendente").

Funcionalidades transversais

Notificações (in-app, e por e-mail se possível): avisar o cliente quando um novo conteúdo for liberado.

Upload de mídia: vídeos e áudios armazenados em bucket do Supabase Storage, com player nativo dentro do app.

Autenticação: Supabase Auth, com dois papéis (terapeuta/cliente) e rotas protegidas — cliente nunca acessa telas do painel administrativo.

Design responsivo: área do cliente pensada mobile-first (a maioria vai acessar pelo celular); painel do terapeuta pensado desktop-first, mas utilizável em tablet.

Direção visual

Nome do produto: Raiz.

Paleta: verde-floresta profundo (#1F2E23) como cor de base/navegação, papel/pergaminho quente (#F1E9D8) como fundo de conteúdo, terracota (#A8503A) como cor de destaque/ação principal, verde-sálvia (#6E7F5C) para indicar progresso/conclusão, dourado-ocre (#C79A2E) como cor de apoio para conquistas/marcações.

Tipografia: um serifado com personalidade e acolhimento (ex: Fraunces) para títulos, e uma sans-serif limpa (ex: Public Sans ou Inter) para textos e interface.

Tom visual: acolhedor, orgânico, ligado a natureza/raízes/ancestralidade — evitar clichês genéricos de app de bem-estar (nada de ícones de borboleta ou lótus estampados). Cantos arredondados, bastante respiro, sem parecer "clínico" ou frio.

Evite a estética genérica de dashboard SaaS (azul/roxo, cards brancos flutuantes sem contexto) — a identidade deve remeter a terapia, sistema familiar e continuidade.

Escopo da primeira versão (MVP)

Priorize primeiro: login com dois papéis, biblioteca por eixos, player de vídeo/áudio, liberação manual de conteúdo por cliente (painel simples), progresso básico. Diário de reflexão, notificações e financeiro podem ser a segunda camada, mas deixe a estrutura de dados já preparada para isso desde o início.

VERIFICAR PARA ORGANIZAR O PROJETO TODO NO GITHUB BEM ORGANIZADO E ESTRUTURADO, A LOGO CRIADA PARA O APP SEGUE EM ANEXO PARA PERSONALIZAÇÃO DE TODO O APP, SE TIVER SUGESTOES

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/417c067a-6ad2-407d-b646-dae138e8a925).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
