-- 1) Áreas da vida
UPDATE public.eixos SET ordem = ordem + 2;
UPDATE public.eixos SET nome = 'Filhos e descendência', descricao = 'O que você escolhe interromper, transformar e transmitir às próximas gerações.' WHERE nome = 'Filhos';
UPDATE public.eixos SET nome = 'Dinheiro e prosperidade', descricao = 'Crenças, escolhas e comportamentos na relação com recursos, merecimento, troca e prosperidade.' WHERE nome = 'Dinheiro';
UPDATE public.eixos SET nome = 'Saúde e autocuidado', descricao = 'Escuta do corpo, bem-estar e autocuidado responsável.' WHERE nome = 'Saúde';
UPDATE public.eixos SET descricao = 'A relação com a figura paterna: presença, limites, direção e o lugar dessa história em você.' WHERE nome = 'Pai';
UPDATE public.eixos SET descricao = 'A relação com a figura materna: cuidado, pertencimento e a forma como você recebe e oferece acolhimento.' WHERE nome = 'Mãe';
UPDATE public.eixos SET descricao = 'Reconhecer origens, influências e recursos herdados, escolhendo conscientemente o que continua.' WHERE nome = 'Ancestralidade';
UPDATE public.eixos SET descricao = 'Vínculos, limites, reciprocidade e equilíbrio entre dar e receber.' WHERE nome = 'Relacionamentos';
UPDATE public.eixos SET descricao = 'Valores, talentos e próximos passos, reconhecendo influências da história sem perder a autonomia.' WHERE nome = 'Propósito';

INSERT INTO public.eixos (nome, descricao, icone, ordem)
SELECT 'Presença e segurança emocional', 'Reconhecer emoções, limites e recursos para retornar ao momento presente.', 'sprout', 1
WHERE NOT EXISTS (SELECT 1 FROM public.eixos WHERE nome = 'Presença e segurança emocional');
INSERT INTO public.eixos (nome, descricao, icone, ordem)
SELECT 'Eu, identidade e limites', 'Fortalecer a percepção de si, das próprias necessidades e escolhas.', 'user-round', 2
WHERE NOT EXISTS (SELECT 1 FROM public.eixos WHERE nome = 'Eu, identidade e limites');

-- 2) Tipos
CREATE TYPE public.trilha_status AS ENUM ('rascunho', 'em_revisao', 'publicado', 'arquivado');
CREATE TYPE public.nivel_profundidade AS ENUM ('leve', 'intermediario', 'profundo');
CREATE TYPE public.etapa_tipo AS ENUM ('orientacao','preparacao','checkin_inicial','compreensao','aterramento','meditacao','movimento','integracao','acao','checkout');
CREATE TYPE public.atribuicao_status AS ENUM ('ativa','pausada','concluida','encerrada');
CREATE TYPE public.diario_visibilidade AS ENUM ('somente_eu','compartilhado');
CREATE TYPE public.momento_checkin AS ENUM ('inicial','final');
CREATE TYPE public.apoio_status AS ENUM ('aberta','em_atendimento','respondida','encerrada');
CREATE TYPE public.acesso_status AS ENUM ('ativo','pausado','encerrado');

-- 3) Vínculo cliente-terapeuta
CREATE TABLE public.clientes_acesso (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  terapeuta_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  telefone TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  status public.acesso_status NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_acesso TO authenticated;
GRANT ALL ON public.clientes_acesso TO service_role;
ALTER TABLE public.clientes_acesso ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.acompanha_cliente(_cliente UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_terapeuta()
    OR (public.pode('ver_clientes') AND EXISTS (SELECT 1 FROM public.clientes_acesso c WHERE c.user_id = _cliente));
$$;

CREATE POLICY "cliente ve proprio acesso" ON public.clientes_acesso FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.acompanha_cliente(user_id));
CREATE POLICY "equipe gerencia acesso de clientes" ON public.clientes_acesso FOR ALL TO authenticated
  USING (public.pode('ver_clientes')) WITH CHECK (public.pode('ver_clientes'));

-- 4) Trilhas
CREATE TABLE public.trilhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eixo_id UUID NOT NULL REFERENCES public.eixos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  resumo TEXT NOT NULL DEFAULT '',
  objetivo TEXT NOT NULL DEFAULT '',
  nivel public.nivel_profundidade NOT NULL DEFAULT 'leve',
  status public.trilha_status NOT NULL DEFAULT 'rascunho',
  versao INTEGER NOT NULL DEFAULT 1,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revisor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prerequisitos TEXT NOT NULL DEFAULT '',
  alertas TEXT NOT NULL DEFAULT '',
  orientacoes_pausa TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trilhas TO authenticated;
GRANT ALL ON public.trilhas TO service_role;
ALTER TABLE public.trilhas ENABLE ROW LEVEL SECURITY;

-- 5) Etapas dentro de conteudos
ALTER TABLE public.conteudos
  ADD COLUMN trilha_id UUID REFERENCES public.trilhas(id) ON DELETE CASCADE,
  ADD COLUMN tipo_etapa public.etapa_tipo,
  ADD COLUMN obrigatoria BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN materiais TEXT NOT NULL DEFAULT '',
  ADD COLUMN local_recomendado TEXT NOT NULL DEFAULT '',
  ADD COLUMN sensibilidades TEXT NOT NULL DEFAULT '',
  ADD COLUMN transcricao TEXT NOT NULL DEFAULT '',
  ADD COLUMN legendas_path TEXT,
  ADD COLUMN criterios_interrupcao TEXT NOT NULL DEFAULT '',
  ADD COLUMN permite_repetir BOOLEAN NOT NULL DEFAULT true;

-- 6) Atribuições
CREATE TABLE public.atribuicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trilha_id UUID NOT NULL REFERENCES public.trilhas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terapeuta_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  objetivo TEXT NOT NULL DEFAULT '',
  mensagem TEXT NOT NULL DEFAULT '',
  audio_path TEXT,
  frequencia TEXT NOT NULL DEFAULT '',
  data_inicio DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  data_revisao DATE,
  nivel public.nivel_profundidade NOT NULL DEFAULT 'leve',
  pode_sozinho BOOLEAN NOT NULL DEFAULT true,
  exige_acompanhamento BOOLEAN NOT NULL DEFAULT false,
  somente_em_sessao BOOLEAN NOT NULL DEFAULT false,
  permite_repetir BOOLEAN NOT NULL DEFAULT true,
  orientacoes_especiais TEXT NOT NULL DEFAULT '',
  status public.atribuicao_status NOT NULL DEFAULT 'ativa',
  observacoes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atribuicoes TO authenticated;
GRANT ALL ON public.atribuicoes TO service_role;
ALTER TABLE public.atribuicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ve atribuicoes permitidas" ON public.atribuicoes FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.pode('gerenciar_liberacoes') OR public.pode('ver_clientes'));
CREATE POLICY "equipe gerencia atribuicoes" ON public.atribuicoes FOR ALL TO authenticated
  USING (public.pode('gerenciar_liberacoes')) WITH CHECK (public.pode('gerenciar_liberacoes'));

CREATE OR REPLACE FUNCTION public.trilha_atribuida(_trilha UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.atribuicoes a
    WHERE a.trilha_id = _trilha
      AND a.cliente_id = auth.uid()
      AND a.status IN ('ativa','concluida')
      AND a.data_inicio <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );
$$;

CREATE POLICY "ve trilhas atribuidas" ON public.trilhas FOR SELECT TO authenticated
  USING (public.pode('gerenciar_conteudos') OR public.pode('gerenciar_liberacoes') OR public.trilha_atribuida(id));
CREATE POLICY "gerencia trilhas" ON public.trilhas FOR ALL TO authenticated
  USING (public.pode('gerenciar_conteudos')) WITH CHECK (public.pode('gerenciar_conteudos'));

-- etapas da atribuição
CREATE TABLE public.atribuicao_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atribuicao_id UUID NOT NULL REFERENCES public.atribuicoes(id) ON DELETE CASCADE,
  conteudo_id UUID NOT NULL REFERENCES public.conteudos(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  obrigatoria BOOLEAN NOT NULL DEFAULT true,
  concluida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (atribuicao_id, conteudo_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atribuicao_etapas TO authenticated;
GRANT ALL ON public.atribuicao_etapas TO service_role;
ALTER TABLE public.atribuicao_etapas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.minha_atribuicao(_atribuicao UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.atribuicoes a WHERE a.id = _atribuicao AND a.cliente_id = auth.uid());
$$;

CREATE POLICY "ve etapas da atribuicao" ON public.atribuicao_etapas FOR SELECT TO authenticated
  USING (public.minha_atribuicao(atribuicao_id) OR public.pode('ver_clientes') OR public.pode('gerenciar_liberacoes'));
CREATE POLICY "cliente conclui etapa" ON public.atribuicao_etapas FOR UPDATE TO authenticated
  USING (public.minha_atribuicao(atribuicao_id)) WITH CHECK (public.minha_atribuicao(atribuicao_id));
CREATE POLICY "equipe gerencia etapas da atribuicao" ON public.atribuicao_etapas FOR ALL TO authenticated
  USING (public.pode('gerenciar_liberacoes')) WITH CHECK (public.pode('gerenciar_liberacoes'));

-- 7) Check-ins
CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  atribuicao_id UUID REFERENCES public.atribuicoes(id) ON DELETE CASCADE,
  conteudo_id UUID REFERENCES public.conteudos(id) ON DELETE SET NULL,
  momento public.momento_checkin NOT NULL,
  emocao TEXT NOT NULL DEFAULT '',
  intensidade SMALLINT NOT NULL DEFAULT 0 CHECK (intensidade BETWEEN 0 AND 10),
  local_corpo TEXT NOT NULL DEFAULT '',
  condicoes_continuar BOOLEAN NOT NULL DEFAULT true,
  intencao TEXT NOT NULL DEFAULT '',
  clareza SMALLINT CHECK (clareza BETWEEN 0 AND 10),
  presenca BOOLEAN,
  precisa_contato BOOLEAN NOT NULL DEFAULT false,
  aprendizado TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cliente registra checkin" ON public.checkins FOR INSERT TO authenticated
  WITH CHECK (cliente_id = auth.uid());
CREATE POLICY "ve checkins permitidos" ON public.checkins FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.pode('ver_clientes'));

-- 8) Diário com privacidade
ALTER TABLE public.diario
  ADD COLUMN visibilidade public.diario_visibilidade NOT NULL DEFAULT 'somente_eu',
  ADD COLUMN atribuicao_id UUID REFERENCES public.atribuicoes(id) ON DELETE SET NULL,
  ADD COLUMN compartilhado_em TIMESTAMPTZ,
  ADD COLUMN compartilhamento_revogado_em TIMESTAMPTZ;

DROP POLICY "ve diario permitido" ON public.diario;
CREATE POLICY "ve diario permitido" ON public.diario FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR (public.pode('ver_diario') AND visibilidade = 'compartilhado'));

-- 9) Solicitações de apoio
CREATE TABLE public.solicitacoes_apoio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  atribuicao_id UUID REFERENCES public.atribuicoes(id) ON DELETE SET NULL,
  mensagem TEXT NOT NULL DEFAULT '',
  origem TEXT NOT NULL DEFAULT 'botao_apoio',
  intensidade SMALLINT CHECK (intensidade BETWEEN 0 AND 10),
  status public.apoio_status NOT NULL DEFAULT 'aberta',
  resposta TEXT NOT NULL DEFAULT '',
  respondido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  respondido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.solicitacoes_apoio TO authenticated;
GRANT ALL ON public.solicitacoes_apoio TO service_role;
ALTER TABLE public.solicitacoes_apoio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cliente pede apoio" ON public.solicitacoes_apoio FOR INSERT TO authenticated
  WITH CHECK (cliente_id = auth.uid());
CREATE POLICY "ve apoio permitido" ON public.solicitacoes_apoio FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.pode('ver_clientes'));
CREATE POLICY "equipe responde apoio" ON public.solicitacoes_apoio FOR UPDATE TO authenticated
  USING (public.pode('ver_clientes')) WITH CHECK (public.pode('ver_clientes'));

-- 10) Consentimentos
CREATE TABLE public.consentimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  versao TEXT NOT NULL DEFAULT '1',
  aceito_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tipo, versao)
);
GRANT SELECT, INSERT ON public.consentimentos TO authenticated;
GRANT ALL ON public.consentimentos TO service_role;
ALTER TABLE public.consentimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario aceita termos" ON public.consentimentos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "ve consentimentos permitidos" ON public.consentimentos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.pode('ver_clientes'));

-- 11) Revisões
CREATE TABLE public.revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atribuicao_id UUID NOT NULL REFERENCES public.atribuicoes(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estado_inicial TEXT NOT NULL DEFAULT '',
  estado_atual TEXT NOT NULL DEFAULT '',
  clareza SMALLINT CHECK (clareza BETWEEN 0 AND 10),
  autonomia SMALLINT CHECK (autonomia BETWEEN 0 AND 10),
  acoes TEXT NOT NULL DEFAULT '',
  aprendizados TEXT NOT NULL DEFAULT '',
  precisa_acompanhamento TEXT NOT NULL DEFAULT '',
  devolutiva TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.revisoes TO authenticated;
GRANT ALL ON public.revisoes TO service_role;
ALTER TABLE public.revisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cliente registra revisao" ON public.revisoes FOR INSERT TO authenticated
  WITH CHECK (cliente_id = auth.uid());
CREATE POLICY "cliente edita propria revisao" ON public.revisoes FOR UPDATE TO authenticated
  USING (cliente_id = auth.uid()) WITH CHECK (cliente_id = auth.uid());
CREATE POLICY "ve revisoes permitidas" ON public.revisoes FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.pode('ver_clientes'));

-- 12) Convites de clientes
CREATE TABLE public.convites_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT NOT NULL DEFAULT 'pendente',
  terapeuta_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  aceito_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites_clientes TO authenticated;
GRANT ALL ON public.convites_clientes TO service_role;
ALTER TABLE public.convites_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipe gerencia convites de clientes" ON public.convites_clientes FOR ALL TO authenticated
  USING (public.pode('ver_clientes')) WITH CHECK (public.pode('ver_clientes'));

-- 13) Configurações da terapeuta
CREATE TABLE public.configuracoes_terapeuta (
  terapeuta_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prazo_resposta_horas INTEGER NOT NULL DEFAULT 48,
  contatos_emergencia JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.configuracoes_terapeuta TO authenticated;
GRANT ALL ON public.configuracoes_terapeuta TO service_role;
ALTER TABLE public.configuracoes_terapeuta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos autenticados leem configuracoes" ON public.configuracoes_terapeuta FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "terapeuta edita configuracoes" ON public.configuracoes_terapeuta FOR ALL TO authenticated
  USING (public.is_terapeuta()) WITH CHECK (public.is_terapeuta());

-- 14) Etapas visíveis ao cliente por atribuição
DROP POLICY "ve conteudos liberados" ON public.conteudos;
CREATE POLICY "ve conteudos liberados" ON public.conteudos FOR SELECT TO authenticated
  USING (
    public.pode('gerenciar_conteudos')
    OR public.pode('gerenciar_liberacoes')
    OR public.conteudo_liberado(auth.uid(), id, eixo_id)
    OR (trilha_id IS NOT NULL AND public.trilha_atribuida(trilha_id))
  );

-- 15) updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_trilhas_updated_at BEFORE UPDATE ON public.trilhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_atribuicoes_updated_at BEFORE UPDATE ON public.atribuicoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clientes_acesso_updated_at BEFORE UPDATE ON public.clientes_acesso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_configuracoes_terapeuta_updated_at BEFORE UPDATE ON public.configuracoes_terapeuta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 16) Aceite de convite de cliente no primeiro acesso
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _papel public.app_role := 'cliente';
  _existe_terapeuta BOOLEAN;
  _convite public.convites_equipe;
  _conv_cliente public.convites_clientes;
  _perm TEXT;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', ''), COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;

  IF NEW.raw_user_meta_data ->> 'papel' = 'terapeuta' THEN
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'terapeuta') INTO _existe_terapeuta;
    IF NOT _existe_terapeuta THEN
      _papel := 'terapeuta';
    END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _papel)
  ON CONFLICT DO NOTHING;

  SELECT * INTO _convite FROM public.convites_equipe
  WHERE status = 'pendente' AND expira_em > now()
    AND lower(email) = lower(COALESCE(NEW.email, ''))
  ORDER BY created_at DESC LIMIT 1;

  IF _convite.id IS NOT NULL THEN
    INSERT INTO public.equipe_admins (user_id, criado_por)
    VALUES (NEW.id, _convite.criado_por)
    ON CONFLICT (user_id) DO NOTHING;

    FOREACH _perm IN ARRAY _convite.permissoes LOOP
      INSERT INTO public.equipe_permissoes (user_id, permissao)
      VALUES (NEW.id, _perm)
      ON CONFLICT (user_id, permissao) DO NOTHING;
    END LOOP;

    UPDATE public.convites_equipe SET status = 'aceito', aceito_em = now() WHERE id = _convite.id;
  END IF;

  SELECT * INTO _conv_cliente FROM public.convites_clientes
  WHERE status = 'pendente' AND expira_em > now()
    AND lower(email) = lower(COALESCE(NEW.email, ''))
  ORDER BY created_at DESC LIMIT 1;

  IF _conv_cliente.id IS NOT NULL THEN
    INSERT INTO public.clientes_acesso (user_id, terapeuta_id, telefone)
    VALUES (NEW.id, _conv_cliente.terapeuta_id, _conv_cliente.telefone)
    ON CONFLICT (user_id) DO UPDATE SET terapeuta_id = EXCLUDED.terapeuta_id;

    UPDATE public.convites_clientes
    SET status = 'aceito', aceito_em = now(), cliente_id = NEW.id
    WHERE id = _conv_cliente.id;
  END IF;

  RETURN NEW;
END;
$function$;