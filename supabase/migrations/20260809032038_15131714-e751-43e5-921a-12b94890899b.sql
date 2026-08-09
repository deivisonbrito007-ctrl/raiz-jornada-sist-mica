DO $$
DECLARE
  _eixo_presenca uuid := 'b87c404b-4dd4-456a-8cb3-9919ea7ee281';
  _eixo_limites  uuid := '1dbf6b7a-acf4-4344-8403-d8ce93be0210';
  _eixo_pai      uuid := '1cd83870-6a43-44bf-a092-21a89e9aa828';
  _t1 uuid; _t2 uuid; _t3 uuid;
BEGIN

INSERT INTO public.trilhas (eixo_id, nome, resumo, objetivo, nivel, status, versao, ordem, modos, prerequisitos, alertas, orientacoes_pausa)
VALUES (_eixo_presenca,
  'Reencontro com a calma (7 dias)',
  'Uma jornada curta e diária para o corpo aprender de novo o que é segurança. Ideal como primeira trilha.',
  'Ao final, a pessoa reconhece os sinais do próprio corpo e tem dois recursos simples para se acalmar sozinha.',
  'leve', 'publicado', 1, 1, ARRAY['acompanhado','autoguiado']::modo_uso[],
  'Nenhum. Pode ser a primeira trilha da pessoa.',
  'Se surgir tontura ou vontade de chorar sem parar, pare a prática e volte no dia seguinte.',
  'Pausar aqui é permitido. Retome do dia em que parou, sem recomeçar do zero.')
RETURNING id INTO _t1;

INSERT INTO public.conteudos (eixo_id, trilha_id, tipo, tipo_etapa, titulo, descricao, corpo_texto, duracao_segundos, ordem, obrigatoria, materiais, local_recomendado, sensibilidades) VALUES
(_eixo_presenca,_t1,'texto','orientacao','Como funciona esta trilha','Leia antes de começar: 7 dias, 10 minutos por dia.','Cada dia tem uma prática curta. O combinado é simples: pouco e todo dia vale mais do que muito de uma vez. Você pode repetir qualquer dia quantas vezes quiser.',180,1,true,'','Qualquer lugar tranquilo',''),
(_eixo_presenca,_t1,'exercicio','checkin_inicial','Como você chega hoje','Um registro rápido de emoção e intensidade.','Antes de qualquer prática, nomeie o que sente e onde sente no corpo. Nomear já organiza.',120,2,true,'','',''),
(_eixo_presenca,_t1,'audio','aterramento','Dia 1 e 2 - Os pés no chão','Aterramento guiado com apoio na respiração.','Sinta o peso do corpo entregue ao chão. Cinco respirações longas, sem forçar.',420,3,true,'Um cobertor ou almofada','Sentada, com os pés apoiados','Evite se estiver com labirintite em crise'),
(_eixo_presenca,_t1,'audio','meditacao','Dia 3 e 4 - Respiração que alonga a saída','Inspire em 4, solte em 6.','A saída mais longa que a entrada avisa ao corpo que não há perigo agora.',480,4,true,'','',''),
(_eixo_presenca,_t1,'exercicio','acao','Dia 5 e 6 - Um gesto de cuidado por dia','Escolha e cumpra um gesto pequeno.','Beber água com atenção, abrir a janela, alongar os ombros. Um gesto por dia, escolhido por você.',300,5,false,'','',''),
(_eixo_presenca,_t1,'texto','integracao','Dia 7 - O que mudou','Escreva no diário o que ficou diferente.','Releia seus check-ins da semana. O que o corpo aprendeu que a cabeça ainda não percebeu?',300,6,true,'','',''),
(_eixo_presenca,_t1,'exercicio','checkout','Fechamento da semana','Registro final de clareza e presença.','Marque como você sai desta semana. Isso ajuda a escolher a próxima trilha.',120,7,true,'','','');

INSERT INTO public.trilhas (eixo_id, nome, resumo, objetivo, nivel, status, versao, ordem, modos, prerequisitos, alertas, orientacoes_pausa)
VALUES (_eixo_limites,
  'Dizer não sem culpa',
  'Para quem se anula para manter a paz. Trabalha limite como cuidado, não como briga.',
  'Sair com uma frase própria de recusa e ter usado ela pelo menos uma vez na vida real.',
  'intermediario', 'publicado', 1, 2, ARRAY['acompanhado']::modo_uso[],
  'Ter concluído uma trilha de presença ou já ter prática de aterramento.',
  'Pode mexer com relações atuais. Combine com a terapeuta antes de conversas difíceis.',
  'Se der medo de perder alguém, pause e traga para a sessão antes de seguir.')
RETURNING id INTO _t2;

INSERT INTO public.conteudos (eixo_id, trilha_id, tipo, tipo_etapa, titulo, descricao, corpo_texto, duracao_segundos, ordem, obrigatoria, materiais, local_recomendado, sensibilidades) VALUES
(_eixo_limites,_t2,'texto','orientacao','Limite não é rejeição','O que estamos chamando de limite aqui.','Limite é dizer onde você termina e o outro começa. Não é castigo nem rompimento.',240,1,true,'','',''),
(_eixo_limites,_t2,'exercicio','checkin_inicial','Onde você cede demais','Mapa rápido das situações.','Liste tres situações recentes em que você disse sim querendo dizer não.',300,2,true,'Caderno','',''),
(_eixo_limites,_t2,'audio','compreensao','De onde vem a culpa','Áudio sobre a origem do medo de decepcionar.','Muitas vezes o sim automático foi, um dia, uma forma de proteção.',540,3,true,'','',''),
(_eixo_limites,_t2,'exercicio','acao','Sua frase de recusa','Escreva e treine em voz alta.','Modelo: obrigada por pensar em mim, hoje não vou conseguir. Reescreva com as suas palavras.',420,4,true,'','Em voz alta, sozinha',''),
(_eixo_limites,_t2,'exercicio','acao','Um não na vida real','Use a frase em uma situação de baixo risco.','Comece pelo mais fácil. Anote o que sentiu antes, durante e depois.',600,5,false,'','',''),
(_eixo_limites,_t2,'exercicio','checkout','Fechamento e devolutiva','Registro para conversar na sessão.','O que ficou mais leve e o que ainda aperta.',180,6,true,'','','');

INSERT INTO public.trilhas (eixo_id, nome, resumo, objetivo, nivel, status, versao, ordem, modos, prerequisitos, alertas, orientacoes_pausa)
VALUES (_eixo_pai,
  'Paz com a história do pai',
  'Jornada profunda de reconciliação interna com a figura paterna, presente ou ausente.',
  'Reduzir o peso da cobrança e da ausência, separando o que é história dele do que é vida sua.',
  'profundo', 'publicado', 1, 3, ARRAY['acompanhado']::modo_uso[],
  'Acompanhamento terapêutico ativo e prática de aterramento consolidada.',
  'Pode reativar memórias difíceis. Não recomendada em luto recente ou crise aguda.',
  'Interrompa ao primeiro sinal de sufocamento ou dissociação e avise a terapeuta.')
RETURNING id INTO _t3;

INSERT INTO public.conteudos (eixo_id, trilha_id, tipo, tipo_etapa, titulo, descricao, corpo_texto, duracao_segundos, ordem, obrigatoria, materiais, local_recomendado, sensibilidades, criterios_interrupcao) VALUES
(_eixo_pai,_t3,'texto','orientacao','Antes de entrar','Combinados de segurança desta trilha.','Aqui não se trata de perdoar por obrigação. Trata-se de devolver a ele o que é dele.',300,1,true,'','','Temas de ausência, rigidez e violência','Pare se o corpo travar'),
(_eixo_pai,_t3,'exercicio','checkin_inicial','Como está seu corpo agora','Check-in obrigatório antes de seguir.','Se a intensidade passar de 7, faça só o aterramento hoje.',180,2,true,'','',''
,'Intensidade acima de 7'),
(_eixo_pai,_t3,'audio','aterramento','Base antes da memória','Aterramento longo de preparação.','Primeiro o chão, depois a história.',480,3,true,'','Deitada ou sentada','','Tontura'),
(_eixo_pai,_t3,'audio','compreensao','O pai que existiu e o pai que faltou','Áudio de compreensão da história.','Separar a pessoa real da expectativa é o que abre espaço.',720,4,true,'','','Ausência paterna','Choro sem pausa'),
(_eixo_pai,_t3,'exercicio','integracao','Carta que não será enviada','Escrita livre para nomear o que ficou.','Escreva sem editar. Ninguém vai ler além de você, a não ser que você escolha compartilhar.',900,5,true,'Papel e caneta','Lugar reservado','','Vontade de parar'),
(_eixo_pai,_t3,'exercicio','checkout','Fechamento com cuidado','Check-out e pedido de contato se precisar.','Marque se quer conversar com a terapeuta nesta semana.',240,6,true,'','','','');

END $$;