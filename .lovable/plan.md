# Perfil do cliente: formatação, organização e correções

A foto mostra a tela de Perfil com o conteúdo deslocado para a esquerda e os interruptores de "push" e "E-mail" cortados na borda direita — ou seja, algo está mais largo que a tela nessa rota. Além disso, o bloco de Lembretes está solto no meio da página, com duas entradas concorrentes para o mesmo assunto (o cartão de preferências e o link "Central de lembretes e histórico").

## 1. Corrigir o corte lateral (prioridade)

- Medir a largura real da rota `/app/perfil` no viewport mobile e identificar qual bloco excede a largura, antes de mudar qualquer estilo (a causa ainda não está confirmada).
- Depois de identificado: garantir que o contêiner da rota não role na horizontal, que cada cartão respeite a largura disponível e que rótulos longos possam quebrar linha em vez de empurrar o layout.
- Nos itens com interruptor, o texto passa a ter largura flexível e o interruptor fica fixo à direita, sem risco de sair da tela.

## 2. Unificar Lembretes num só lugar

Hoje há dois pontos de entrada seguidos. Fica assim:

- No Perfil, um cartão curto: estado atual em uma frase ("Terças, 19:00 — por e-mail" ou "Lembretes desligados"), interruptor de ligar/desligar e um único caminho "Ajustar lembretes".
- Todo o resto (canais, dia, horário, dias sem praticar, notificações do dispositivo, histórico, pausa) vive na Central de lembretes, que já existe.

## 3. Organização da página em seções editoriais

A página é uma pilha longa de cartões de mesmo peso. Reagrupar com os rótulos de seção já usados no Início:

```text
Retrato do seu caminho   -> capa + números
Você                     -> nome, e-mail, modo de uso
Seu ritmo                -> meta semanal, lembretes
Seu processo             -> meus caminhos, privacidade, relatório
Este aplicativo          -> versão, reinstalar, sair da conta
```

- Espaço vertical maior entre seções e menor entre cartões da mesma seção, com o mesmo raio e sombra em todos.
- "Sair da conta" fica no fim, dentro da última seção, mantendo a confirmação atual.

## 4. Formatação e legibilidade

- Padronizar títulos de cartão na serifada de display (hoje alguns usam a fonte do corpo).
- Rótulos em versalete com o mesmo tamanho e espaçamento em todos os campos.
- Selects e botões com a mesma altura e o mesmo raio; alvos de toque ≥44px.
- Feedback de salvamento discreto e consistente (uma confirmação por ação, sem repetir aviso a cada troca).
- Estados vazios com convite em vez de espaço em branco ("nenhum lembrete enviado ainda").

## Detalhes técnicos

- Arquivos: `src/routes/_authenticated/app.perfil.tsx` (ordem, seções, link único), `src/components/preferencias-lembretes.tsx` (versão resumida), `src/components/app-perfil/*` (padronização de título/rótulos), `src/routes/_authenticated/app.lembretes.tsx` (recebe os controles completos, se algum ainda não estiver lá).
- Reaproveitar `RotuloSecao` de `src/components/app-casca/`.
- Só apresentação: nenhuma mudança de regra de negócio, consulta, tabela ou permissão. As server functions de lembretes continuam as mesmas.
- Verificação: medição de largura no mobile (384px) após a correção e suíte de testes existente verde.
