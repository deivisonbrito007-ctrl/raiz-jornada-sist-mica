# Raiz — trilhas terapêuticas guiadas pela terapeuta

Evolução do app atual (nome, identidade e dados preservados) para o modelo completo do MVP: a terapeuta monta trilhas com etapas de tipos fixos, atribui a um cliente com objetivo/prazo/frequência/profundidade, e o cliente percorre a jornada com check-in, práticas, diário com privacidade e check-out.

## O que já existe e será reaproveitado

- Autenticação, perfis, papéis (`terapeuta`/`cliente`), equipe com permissões e auditoria.
- 8 áreas da vida cadastradas (Pai, Mãe, Filhos, Ancestralidade, Dinheiro, Saúde, Relacionamentos, Propósito) e 40 conteúdos.
- Biblioteca de conteúdos com upload de mídia em bucket privado + URL assinada, player com retomada de posição, liberações agendadas, progresso, diário, lembretes push/e-mail, notificações, relatório PDF.
- Nenhum cliente cadastrado ainda e apenas 1 registro de diário, então a migração de estrutura é segura.

## Ajustes de conteúdo das áreas

- Acrescentar duas áreas: “Presença e segurança emocional” e “Eu, identidade e limites”, no início da ordem.
- Atualizar nomes/descrições para o texto da especificação (Filhos e descendência, Dinheiro e prosperidade, Saúde e autocuidado etc.).

## Novo modelo de dados (sobre o atual)

- `trilhas`: pertence a uma área, com objetivo, resumo, nível de profundidade (leve / intermediário / profundo), status (rascunho, em revisão, publicado, arquivado), versão, autor, revisor, pré-requisitos, alertas e orientações de pausa.
- `conteudos` passa a ser a etapa da trilha: ganha `trilha_id`, `tipo_etapa` (os 10 tipos fixos: orientação, preparação, check-in, compreensão, aterramento, meditação, movimento sistêmico, integração, ação alinhada, check-out), obrigatória/opcional, materiais, local recomendado, sensibilidades, transcrição, legendas, critérios de interrupção, permite repetir.
- `atribuicoes` (evolução de `liberacoes`): trilha + cliente, objetivo personalizado, mensagem de orientação, áudio da terapeuta, início, revisão, frequência, nível, se pode ser feita sozinha / exige acompanhamento / só em sessão, status (ativa, pausada, concluída, encerrada), observações operacionais.
- `atribuicao_etapas`: ordem, obrigatoriedade e estado por etapa da atribuição (o `progresso` atual continua guardando conclusão e posição de mídia).
- `checkins`: momento (inicial/final), emoção, intensidade 0–10, local no corpo, condições de continuar, intenção, clareza, presença, necessidade de contato.
- `diario`: ganha visibilidade (`somente_eu` | `compartilhado`), vínculo com etapa/atribuição e registro de quando o compartilhamento foi autorizado ou revogado.
- `solicitacoes_apoio`: mensagem, origem (etapa/intensidade alta), status, resposta da terapeuta, prazo de resposta configurado.
- `consentimentos`: termos, privacidade e consentimento de acompanhamento aceitos no primeiro acesso, com data e versão.
- `revisoes`: fechamento do ciclo (estado inicial vs atual, ações realizadas, aprendizados, devolutiva).
- `convites_clientes`: convite por e-mail com token, aceite no primeiro acesso, e ativar/pausar/encerrar acesso.
- `configuracoes_terapeuta`: prazo de resposta do apoio e contatos de emergência.

Regras de acesso: cliente vê apenas os próprios dados e apenas trilhas atribuídas; terapeuta vê apenas clientes vinculados; diário privado nunca aparece para a terapeuta (filtro na própria política, não só na tela); administrador não acessa conteúdo terapêutico sem permissão; mídia continua privada, servida por URL assinada após checar a atribuição.

## Área da terapeuta

- Painel: resumo de clientes, trilhas em andamento, atividades pendentes, check-ins que pedem atenção, solicitações de apoio, trilhas concluídas recentemente, próximas revisões.
- Clientes: cadastro (nome, e-mail, telefone), convite, terapeuta responsável, ativar/pausar/encerrar, histórico de trilhas, observações e leitura apenas do que foi compartilhado.
- Gerenciador de trilhas: criar, editar, duplicar, arquivar, reordenar etapas por arrastar, salvar rascunho, enviar para revisão, publicar, “visualizar como cliente”, mídia/PDF/texto/exercício por etapa.
- Atribuição: formulário com todos os campos de direcionamento, incluindo áudio de orientação e seleção de etapas obrigatórias/opcionais.
- Acompanhamento: progresso por trilha, check-ins, registros compartilhados, pausar/adaptar/concluir.

## Jornada do cliente (mobile-first)

- Início: saudação pelo nome, “Seu espaço de continuidade”, cartão da trilha atual (nome, objetivo, mensagem da terapeuta, próxima revisão, progresso), “Continuar minha prática”, “Preciso de apoio”, histórico e próximos lembretes. Sem catálogo livre de trilhas.
- Etapas em tela única por instrução, com preparação e consentimento de seguir (“Estou em condições de continuar” / “Prefiro em outro momento”), pausa para voltar ao presente, retomada e encerramento cuidadoso.
- Check-in inicial e check-out final com as perguntas definidas; intensidade alta abre opções acolhedoras, sem diagnóstico.
- Diário com escolha visível de privacidade, alteração posterior, download e exclusão.
- Progresso com linguagem de clareza, consciência, autonomia, presença e próximo movimento — sem “cura”, ranking ou comparação.
- “Preciso de apoio” com aviso de não emergência, prazo de resposta, mensagem e contatos configuráveis.

## Design

Mantém a identidade Raiz atual (marfim, verde oliva, dourado suave, terracota, roxo acinzentado, títulos serifados, cantos arredondados, sombras suaves, botões grandes) e ajusta os tokens de `src/styles.css` para a paleta da especificação onde houver divergência. Acessibilidade: legendas, transcrição, controle de velocidade, opção sem música, opção de olhos abertos, contraste e estados nunca só por cor — reaproveitando os componentes de acessibilidade já existentes.

## Ordem de execução

1. Migração: áreas atualizadas, novas tabelas, colunas novas em `conteudos` e `diario`, RLS + GRANTs, funções de checagem de vínculo terapeuta–cliente.
2. Convite/primeiro acesso com consentimento e recuperação de senha.
3. Painel da terapeuta + clientes + gerenciador de trilhas com etapas fixas.
4. Atribuição de trilha e acompanhamento.
5. Jornada do cliente: etapas, check-in/check-out, diário com privacidade, apoio, progresso e revisão.
6. Testes automatizados (RLS de privacidade do diário e do vínculo, fluxo de etapas) somados à suíte atual.

## Notas técnicas

- Rotas protegidas seguem em `src/routes/_authenticated/`; leituras e escritas por server functions com `requireSupabaseAuth`; URLs assinadas apenas no servidor.
- `liberacoes` é substituída por `atribuicoes` com migração das 7 linhas existentes; `progresso`, `notificacoes` e lembretes continuam funcionando.
- Diário nunca vai para analytics; exclusão respeita as obrigações legais aplicáveis.
