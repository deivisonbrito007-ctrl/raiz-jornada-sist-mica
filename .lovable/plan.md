# Aba "Início" do cliente — acolhimento, ritmo e interação

## O que está ruim hoje
A tela abre com um título, um parágrafo e cai direto numa barra de busca com três selects e uma grade de cartões de eixo. Ou seja: parece um catálogo administrativo, não um espaço de cuidado. Problemas concretos:

- Os filtros (busca, eixo, tipo, status) ocupam o topo da tela mesmo quando a pessoa só quer saber "o que eu faço hoje".
- Não há prática do dia: a sugestão só aparece dentro do lembrete de retorno, e só quando o lembrete está ativo.
- Não há sinal de ritmo visível (sequência, semana, meta) — isso só existe na aba Progresso.
- Diário, apoio e revisão da terapeuta não têm nenhuma porta aqui.
- Visualmente é plano: fundo bege, cartões brancos iguais, nenhuma respiração, nenhuma textura, nada da linguagem de floresta/aura que a tela de entrada e a home pública já têm.

## Nova estrutura (ordem da rolagem, mobile primeiro)

1. **Saudação viva** — faixa em gradiente floresta com halo suave e a marca em filigrana. "Bom dia, Ana" conforme a hora, uma frase curta de acolhimento e a data. Dentro dela, dois indicadores discretos: sequência em semanas e práticas nesta semana (com o anel de meta semanal que já existe).
2. **Prática de hoje** — um único cartão grande, em destaque, com o próximo conteúdo (ou o de retomar): eixo, tipo, duração, e um botão largo "Começar agora" / "Continuar de onde parei". É o coração da tela. Quando tudo estiver concluído, vira um cartão de pausa: "Você fechou o ciclo desta semana."
3. **Lembrete de retorno** — mantido, mas só quando ativo, logo abaixo da prática (sem duplicar a sugestão de conteúdo já mostrada acima).
4. **Palavra da terapeuta** (modo acompanhado) — mensagem/objetivo do plano atual, próxima revisão e atalho "Preciso de apoio". No modo autoguiado, esse espaço vira a vitrine de pacotes já existente.
5. **Seus eixos** — carrossel horizontal com snap no mobile e grade no desktop, cada eixo com ícone, anel de progresso e estado bloqueado explicando quando abre. Botão "Ver todos os eixos" leva à Jornada.
6. **Momentos rápidos** — três atalhos aconchegantes: "Respirar 2 minutos" (prática curta), "Escrever no diário", "Ver meu caminho" (progresso).
7. **Busca e filtros** — deixam de morar no topo: passam a ficar em um bloco recolhível ("Buscar uma prática") no fim da tela, mantendo exatamente o comportamento atual quando aberto.

## Linguagem visual
- Reaproveita os tokens que já existem: `floresta`, `salvia`, `terracota`, `ocre`, `--gradiente-aura`, `--halo-entrada`, `--shadow-organico`, tipografia Fraunces nos títulos.
- Uma textura abstrata de raízes/luz, muito discreta, apenas atrás da saudação.
- Movimento suave: entrada em fade/subida das seções e respiração leve no halo, tudo respeitando `prefers-reduced-motion`.
- Nada de emoji nem de imagem genérica de espiritualidade.

## Cuidados
- Alvos de toque ≥ 44px, botões em largura cheia no mobile, sem quebra feia em 360px.
- Contraste AA em todas as combinações (ocre-forte sobre claro).
- Nenhuma mudança de regra de negócio: os mesmos dados de `getMinhaBiblioteca` e `getMeuContexto` já carregados, sem consulta nova.
- Estados de carregamento com os skeletons da marca, não blocos cinza.

## Notas técnicas
- Extrair a tela em componentes sob `src/components/app-inicio/`: `saudacao-inicio.tsx`, `pratica-de-hoje.tsx`, `palavra-da-terapeuta.tsx`, `carrossel-eixos.tsx`, `momentos-rapidos.tsx`, `buscar-praticas.tsx`. `src/routes/_authenticated/app.index.tsx` fica só com composição e estado de filtro.
- Escolha da prática de hoje e da saudação por hora entram como funções puras em `src/lib/raiz-format.ts` (ou um `inicio-cliente.ts`), com testes unitários.
- Reusar `LembreteRetorno`, `ContinuarDeOndeParei`, `VitrinePacotes` e o anel de meta semanal existentes; sem duplicar lógica.
- Adicionar testes de render/a11y para a nova tela e conferir em 390px e 1280px com capturas do navegador antes de encerrar.
