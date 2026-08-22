# Aba Perfil do cliente — redesenho acolhedor e interativo

Hoje a tela é uma lista fria: quatro linhas de dados (nome, e-mail, desde, papel), dois links, o bloco de lembretes, um texto de privacidade e o botão de sair. Ela não mostra quem a pessoa é no processo, não deixa editar nada e não conversa com o restante do app.

## O que a nova tela mostra

1. **Cabeçalho de identidade** — iniciais em avatar orgânico, nome grande em serifa, e-mail discreto, e uma faixa com "no Raiz desde …", ciclo atual e sequência de semanas. Fundo em degradê floresta, no mesmo tom do Início e da Jornada.

2. **Meu retrato do caminho** — três medidas curtas lado a lado: práticas concluídas, sequência de semanas e reflexões escritas. Cada uma leva para a tela correspondente (Progresso, Jornada, Diário).

3. **Meu modo de uso** — cartão explicando em linguagem simples se a pessoa caminha *acompanhada* pela terapeuta ou *por conta própria*, desde quando, e o que isso muda. No modo por conta própria, atalho para pedir acompanhamento; no acompanhado, atalho para o canal de apoio.

4. **Editar meus dados** — o nome passa a ser editável ali mesmo (campo com salvar/cancelar e aviso de sucesso). E-mail segue somente leitura, com explicação de por que.

5. **Meu ritmo** — meta semanal ajustável com controle simples (2 a 7 práticas) e frase de acolhimento conforme a escolha, junto do bloco de lembretes que já existe.

6. **Meus caminhos** — os atalhos atuais (Histórico, Eixos preferidos) reagrupados como cartões com ícone e descrição, mais Progresso e Diário.

7. **Cuidado e privacidade** — o texto de privacidade reescrito em itens claros (o que só é seu, o que a terapeuta vê, como as mídias funcionam), com link para revogar compartilhamentos do diário.

8. **Meu relatório** — botão para baixar o PDF de progresso e reflexões (já existe a geração), com uma frase explicando para que serve levar isso à sessão.

9. **Instalação e app** — bloco discreto com versão instalada e o aviso de reinstalar quando o build está velho (componente já existente).

10. **Sair da conta** — no fim, em tom neutro, com confirmação para evitar toque acidental.

Tudo mobile-first: cartões arredondados, respiro vertical generoso, toques de no mínimo 44px, uma coluna no celular e duas colunas nos blocos de medidas no desktop.

## Detalhes técnicos

- Nova pasta `src/components/app-perfil/` com: `cabecalho-perfil.tsx`, `retrato-caminho.tsx`, `cartao-modo-uso.tsx`, `editar-nome.tsx`, `meta-semanal.tsx`, `meus-caminhos.tsx`, `bloco-privacidade.tsx`, `bloco-relatorio.tsx`. `src/routes/_authenticated/app.perfil.tsx` passa a compor esses blocos.
- A rota troca `useQuery(["contexto"])` solto por `useMeuContexto()`, que já é a fonte única de contexto/permissões — evita a segunda requisição e mantém cache alinhado.
- Lógica pura de apresentação (frases do modo, rótulo da meta, resumo do retrato) em `src/lib/perfil-cliente.ts`, com testes em `src/lib/perfil-cliente.test.ts`.
- Salvar nome e meta semanal: server functions novas em `src/lib/raiz.functions.ts` (`atualizarMeuPerfil`) escrevendo em `profiles` com as políticas RLS já existentes; invalidação de `CHAVES.contexto` no sucesso.
- Métricas do retrato reaproveitam `calcularStreak` / `avaliarMetaSemanal` de `src/lib/raiz-format.ts` e as contagens já servidas ao painel do cliente.
- Reuso sem duplicar: `PreferenciasLembretes`, `AvisoReinstalarApp`, geração de PDF de `src/lib/raiz-relatorio.ts`.
- Cores e sombras só por tokens (`floresta`, `salvia`, `terracota`, `--shadow-organico`); nada de cor fixa.
- `head()` da rota com título e descrição próprios.
- Acessibilidade: cada bloco é `section` com `aria-labelledby`, campos com rótulo visível, confirmação de saída com foco preso, e feedback de salvamento anunciado por `aria-live`.
