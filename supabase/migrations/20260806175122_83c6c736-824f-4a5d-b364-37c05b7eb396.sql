-- ENUMS
CREATE TYPE public.app_role AS ENUM ('terapeuta', 'cliente');
CREATE TYPE public.conteudo_tipo AS ENUM ('video', 'audio', 'exercicio', 'texto', 'tarefa');
CREATE TYPE public.liberacao_status AS ENUM ('bloqueado', 'liberado');
CREATE TYPE public.progresso_status AS ENUM ('nao_iniciado', 'em_andamento', 'concluido');
CREATE TYPE public.tipo_cobranca AS ENUM ('pagamento_unico', 'assinatura');
CREATE TYPE public.pagamento_status AS ENUM ('pendente', 'pago', 'cancelado');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_terapeuta()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'terapeuta')
$$;

CREATE POLICY "perfil proprio ou terapeuta" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_terapeuta());
CREATE POLICY "atualiza proprio perfil" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_terapeuta()) WITH CHECK (id = auth.uid() OR public.is_terapeuta());
CREATE POLICY "insere proprio perfil" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "ve proprios papeis" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_terapeuta());

-- EIXOS
CREATE TABLE public.eixos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  icone TEXT NOT NULL DEFAULT 'sprout',
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eixos TO authenticated;
GRANT ALL ON public.eixos TO service_role;
ALTER TABLE public.eixos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eixos visiveis a autenticados" ON public.eixos FOR SELECT TO authenticated USING (true);
CREATE POLICY "terapeuta gerencia eixos" ON public.eixos FOR ALL TO authenticated
  USING (public.is_terapeuta()) WITH CHECK (public.is_terapeuta());

-- CONTEUDOS
CREATE TABLE public.conteudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eixo_id UUID NOT NULL REFERENCES public.eixos ON DELETE CASCADE,
  tipo public.conteudo_tipo NOT NULL DEFAULT 'video',
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  storage_path TEXT,
  corpo_texto TEXT,
  duracao_segundos INTEGER NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conteudos TO authenticated;
GRANT ALL ON public.conteudos TO service_role;
ALTER TABLE public.conteudos ENABLE ROW LEVEL SECURITY;

-- LIBERACOES
CREATE TABLE public.liberacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  eixo_id UUID REFERENCES public.eixos ON DELETE CASCADE,
  conteudo_id UUID REFERENCES public.conteudos ON DELETE CASCADE,
  status public.liberacao_status NOT NULL DEFAULT 'liberado',
  liberado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (eixo_id IS NOT NULL OR conteudo_id IS NOT NULL)
);
CREATE UNIQUE INDEX liberacoes_cliente_eixo_idx ON public.liberacoes (cliente_id, eixo_id) WHERE conteudo_id IS NULL;
CREATE UNIQUE INDEX liberacoes_cliente_conteudo_idx ON public.liberacoes (cliente_id, conteudo_id) WHERE conteudo_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liberacoes TO authenticated;
GRANT ALL ON public.liberacoes TO service_role;
ALTER TABLE public.liberacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cliente ve proprias liberacoes" ON public.liberacoes FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.is_terapeuta());
CREATE POLICY "terapeuta gerencia liberacoes" ON public.liberacoes FOR ALL TO authenticated
  USING (public.is_terapeuta()) WITH CHECK (public.is_terapeuta());

CREATE OR REPLACE FUNCTION public.conteudo_liberado(_cliente_id UUID, _conteudo_id UUID, _eixo_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.liberacoes l
    WHERE l.cliente_id = _cliente_id AND l.status = 'liberado'
      AND ((l.conteudo_id = _conteudo_id) OR (l.conteudo_id IS NULL AND l.eixo_id = _eixo_id))
  )
$$;

CREATE POLICY "cliente ve conteudos liberados" ON public.conteudos FOR SELECT TO authenticated
  USING (public.is_terapeuta() OR public.conteudo_liberado(auth.uid(), id, eixo_id));
CREATE POLICY "terapeuta gerencia conteudos" ON public.conteudos FOR ALL TO authenticated
  USING (public.is_terapeuta()) WITH CHECK (public.is_terapeuta());

-- PACOTES
CREATE TABLE public.pacotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  eixos_incluidos UUID[] NOT NULL DEFAULT '{}',
  tipo_cobranca public.tipo_cobranca NOT NULL DEFAULT 'pagamento_unico',
  preco_centavos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacotes TO authenticated;
GRANT ALL ON public.pacotes TO service_role;
ALTER TABLE public.pacotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pacotes visiveis a autenticados" ON public.pacotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "terapeuta gerencia pacotes" ON public.pacotes FOR ALL TO authenticated
  USING (public.is_terapeuta()) WITH CHECK (public.is_terapeuta());

CREATE TABLE public.clientes_pacotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  pacote_id UUID NOT NULL REFERENCES public.pacotes ON DELETE CASCADE,
  status_pagamento public.pagamento_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_pacotes TO authenticated;
GRANT ALL ON public.clientes_pacotes TO service_role;
ALTER TABLE public.clientes_pacotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cliente ve proprios pacotes" ON public.clientes_pacotes FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.is_terapeuta());
CREATE POLICY "terapeuta gerencia clientes_pacotes" ON public.clientes_pacotes FOR ALL TO authenticated
  USING (public.is_terapeuta()) WITH CHECK (public.is_terapeuta());

-- PROGRESSO
CREATE TABLE public.progresso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  conteudo_id UUID NOT NULL REFERENCES public.conteudos ON DELETE CASCADE,
  status public.progresso_status NOT NULL DEFAULT 'nao_iniciado',
  concluido_em TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, conteudo_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progresso TO authenticated;
GRANT ALL ON public.progresso TO service_role;
ALTER TABLE public.progresso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cliente ve proprio progresso" ON public.progresso FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.is_terapeuta());
CREATE POLICY "cliente registra proprio progresso" ON public.progresso FOR INSERT TO authenticated
  WITH CHECK (cliente_id = auth.uid());
CREATE POLICY "cliente atualiza proprio progresso" ON public.progresso FOR UPDATE TO authenticated
  USING (cliente_id = auth.uid()) WITH CHECK (cliente_id = auth.uid());

-- DIARIO
CREATE TABLE public.diario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  conteudo_id UUID REFERENCES public.conteudos ON DELETE SET NULL,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diario TO authenticated;
GRANT ALL ON public.diario TO service_role;
ALTER TABLE public.diario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cliente ve proprio diario" ON public.diario FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.is_terapeuta());
CREATE POLICY "cliente escreve proprio diario" ON public.diario FOR INSERT TO authenticated
  WITH CHECK (cliente_id = auth.uid());
CREATE POLICY "cliente edita proprio diario" ON public.diario FOR UPDATE TO authenticated
  USING (cliente_id = auth.uid()) WITH CHECK (cliente_id = auth.uid());
CREATE POLICY "cliente apaga proprio diario" ON public.diario FOR DELETE TO authenticated
  USING (cliente_id = auth.uid());

-- NOTIFICACOES
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL DEFAULT '',
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cliente ve proprias notificacoes" ON public.notificacoes FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.is_terapeuta());
CREATE POLICY "cliente marca notificacao lida" ON public.notificacoes FOR UPDATE TO authenticated
  USING (cliente_id = auth.uid()) WITH CHECK (cliente_id = auth.uid());
CREATE POLICY "terapeuta gerencia notificacoes" ON public.notificacoes FOR ALL TO authenticated
  USING (public.is_terapeuta()) WITH CHECK (public.is_terapeuta());

-- NOVO USUARIO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', ''), COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN NEW.raw_user_meta_data ->> 'papel' = 'terapeuta' THEN 'terapeuta'::public.app_role ELSE 'cliente'::public.app_role END)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SEED EIXOS
INSERT INTO public.eixos (nome, descricao, icone, ordem) VALUES
  ('Pai', 'A força, a direção e o lugar do masculino na sua história.', 'mountain', 1),
  ('Mãe', 'O acolhimento, o pertencimento e o direito de receber.', 'heart-handshake', 2),
  ('Filhos', 'O que passa adiante e o que se interrompe em você.', 'baby', 3),
  ('Ancestralidade', 'Os que vieram antes e o que ainda pede lugar.', 'trees', 4),
  ('Dinheiro', 'Merecimento, troca e fluxo de abundância.', 'coins', 5),
  ('Saúde', 'O corpo como mensageiro do sistema familiar.', 'activity', 6),
  ('Relacionamentos', 'Vínculos, equilíbrio entre dar e receber.', 'users', 7),
  ('Propósito', 'O movimento próprio, livre de cargas herdadas.', 'compass', 8);

-- SEED CONTEUDOS
INSERT INTO public.conteudos (eixo_id, tipo, titulo, descricao, duracao_segundos, ordem, corpo_texto)
SELECT e.id, t.tipo, t.titulo || ' — ' || e.nome, t.descricao, t.dur, t.ordem, t.corpo
FROM public.eixos e
CROSS JOIN (VALUES
  ('video'::public.conteudo_tipo, 'Abertura do eixo', 'Uma introdução guiada ao que este eixo movimenta em você.', 480, 1, NULL),
  ('audio'::public.conteudo_tipo, 'Meditação de reconhecimento', 'Prática de respiração e reconhecimento para fazer em silêncio.', 720, 2, NULL),
  ('exercicio'::public.conteudo_tipo, 'Exercício prático', 'Um movimento simples para levar o reconhecimento ao corpo.', 300, 3, NULL),
  ('texto'::public.conteudo_tipo, 'Texto de apoio', 'Leitura curta para sustentar o que foi movimentado.', 240, 4, 'Todo sistema busca equilíbrio. Quando reconhecemos o lugar de cada um, a força volta a circular. Leia devagar e observe o que ecoa no corpo.'),
  ('tarefa'::public.conteudo_tipo, 'Tarefa da semana', 'Um gesto concreto para praticar até a próxima sessão.', 0, 5, 'Durante sete dias, ao acordar, diga internamente: "eu reconheço o meu lugar". Anote no diário o que muda.')
) AS t(tipo, titulo, descricao, dur, ordem, corpo);