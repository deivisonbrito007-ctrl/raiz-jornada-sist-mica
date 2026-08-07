-- 1. Existe terapeuta? (usado na tela de cadastro, sem expor papéis)
CREATE OR REPLACE FUNCTION public.existe_terapeuta()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'terapeuta')
$$;
GRANT EXECUTE ON FUNCTION public.existe_terapeuta() TO anon, authenticated;

-- 2. Tabelas de equipe
CREATE TABLE public.equipe_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipe_admins TO authenticated;
GRANT ALL ON public.equipe_admins TO service_role;
ALTER TABLE public.equipe_admins ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.equipe_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permissao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipe_permissoes TO authenticated;
GRANT ALL ON public.equipe_permissoes TO service_role;
ALTER TABLE public.equipe_permissoes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.convites_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  permissoes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pendente',
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  aceito_em timestamptz
);
CREATE UNIQUE INDEX convites_equipe_email_pendente ON public.convites_equipe (lower(email)) WHERE status = 'pendente';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites_equipe TO authenticated;
GRANT ALL ON public.convites_equipe TO service_role;
ALTER TABLE public.convites_equipe ENABLE ROW LEVEL SECURITY;

-- 3. Funções de permissão
CREATE OR REPLACE FUNCTION public.tem_permissao(_user_id uuid, _permissao text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'terapeuta')
    OR EXISTS (
      SELECT 1 FROM public.equipe_permissoes p
      JOIN public.equipe_admins a ON a.user_id = p.user_id
      WHERE p.user_id = _user_id AND p.permissao = _permissao
    )
$$;

CREATE OR REPLACE FUNCTION public.pode(_permissao text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.tem_permissao(auth.uid(), _permissao)
$$;

CREATE OR REPLACE FUNCTION public.pode_administrar()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_terapeuta() OR EXISTS (SELECT 1 FROM public.equipe_admins WHERE user_id = auth.uid())
$$;

GRANT EXECUTE ON FUNCTION public.tem_permissao(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_administrar() TO authenticated;

-- 4. Políticas das tabelas de equipe
CREATE POLICY "equipe admins visiveis" ON public.equipe_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.pode('gerenciar_equipe'));
CREATE POLICY "equipe admins gerenciada" ON public.equipe_admins
  FOR ALL TO authenticated
  USING (public.pode('gerenciar_equipe')) WITH CHECK (public.pode('gerenciar_equipe'));

CREATE POLICY "equipe permissoes visiveis" ON public.equipe_permissoes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.pode('gerenciar_equipe'));
CREATE POLICY "equipe permissoes gerenciadas" ON public.equipe_permissoes
  FOR ALL TO authenticated
  USING (public.pode('gerenciar_equipe')) WITH CHECK (public.pode('gerenciar_equipe'));

CREATE POLICY "convites equipe gerenciados" ON public.convites_equipe
  FOR ALL TO authenticated
  USING (public.pode('gerenciar_equipe')) WITH CHECK (public.pode('gerenciar_equipe'));

-- 5. Cadastro consome convite pendente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _papel public.app_role := 'cliente';
  _existe_terapeuta BOOLEAN;
  _convite public.convites_equipe;
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
  WHERE status = 'pendente' AND lower(email) = lower(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF _convite.id IS NOT NULL THEN
    INSERT INTO public.equipe_admins (user_id, criado_por)
    VALUES (NEW.id, _convite.criado_por)
    ON CONFLICT (user_id) DO NOTHING;

    FOREACH _perm IN ARRAY _convite.permissoes LOOP
      INSERT INTO public.equipe_permissoes (user_id, permissao)
      VALUES (NEW.id, _perm)
      ON CONFLICT (user_id, permissao) DO NOTHING;
    END LOOP;

    UPDATE public.convites_equipe
    SET status = 'aceito', aceito_em = now()
    WHERE id = _convite.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Políticas existentes passam a respeitar permissões granulares
DROP POLICY "terapeuta gerencia conteudos" ON public.conteudos;
CREATE POLICY "gerencia conteudos" ON public.conteudos
  FOR ALL TO authenticated
  USING (public.pode('gerenciar_conteudos')) WITH CHECK (public.pode('gerenciar_conteudos'));
DROP POLICY "cliente ve conteudos liberados" ON public.conteudos;
CREATE POLICY "ve conteudos liberados" ON public.conteudos
  FOR SELECT TO authenticated
  USING (public.pode('gerenciar_conteudos') OR public.pode('gerenciar_liberacoes') OR public.conteudo_liberado(auth.uid(), id, eixo_id));

DROP POLICY "terapeuta gerencia eixos" ON public.eixos;
CREATE POLICY "gerencia eixos" ON public.eixos
  FOR ALL TO authenticated
  USING (public.pode('gerenciar_conteudos')) WITH CHECK (public.pode('gerenciar_conteudos'));

DROP POLICY "terapeuta gerencia liberacoes" ON public.liberacoes;
CREATE POLICY "gerencia liberacoes" ON public.liberacoes
  FOR ALL TO authenticated
  USING (public.pode('gerenciar_liberacoes')) WITH CHECK (public.pode('gerenciar_liberacoes'));
DROP POLICY "cliente ve proprias liberacoes" ON public.liberacoes;
CREATE POLICY "ve liberacoes permitidas" ON public.liberacoes
  FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.pode('gerenciar_liberacoes') OR public.pode('ver_clientes'));

DROP POLICY "terapeuta gerencia pacotes" ON public.pacotes;
CREATE POLICY "gerencia pacotes" ON public.pacotes
  FOR ALL TO authenticated
  USING (public.pode('gerenciar_pacotes')) WITH CHECK (public.pode('gerenciar_pacotes'));

DROP POLICY "terapeuta gerencia clientes_pacotes" ON public.clientes_pacotes;
CREATE POLICY "gerencia clientes_pacotes" ON public.clientes_pacotes
  FOR ALL TO authenticated
  USING (public.pode('gerenciar_pacotes')) WITH CHECK (public.pode('gerenciar_pacotes'));
DROP POLICY "cliente ve proprios pacotes" ON public.clientes_pacotes;
CREATE POLICY "ve pacotes permitidos" ON public.clientes_pacotes
  FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.pode('gerenciar_pacotes') OR public.pode('ver_clientes'));

DROP POLICY "perfil proprio ou terapeuta" ON public.profiles;
CREATE POLICY "ve perfis permitidos" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.pode('ver_clientes'));
DROP POLICY "atualiza proprio perfil" ON public.profiles;
CREATE POLICY "atualiza perfis permitidos" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_terapeuta()) WITH CHECK (id = auth.uid() OR public.is_terapeuta());

DROP POLICY "cliente ve proprio progresso" ON public.progresso;
CREATE POLICY "ve progresso permitido" ON public.progresso
  FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.pode('ver_clientes'));

DROP POLICY "cliente ve proprio diario" ON public.diario;
CREATE POLICY "ve diario permitido" ON public.diario
  FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.pode('ver_diario'));

DROP POLICY "terapeuta gerencia notificacoes" ON public.notificacoes;
CREATE POLICY "gerencia notificacoes" ON public.notificacoes
  FOR ALL TO authenticated
  USING (public.pode('gerenciar_liberacoes')) WITH CHECK (public.pode('gerenciar_liberacoes'));
DROP POLICY "cliente ve proprias notificacoes" ON public.notificacoes;
CREATE POLICY "ve notificacoes permitidas" ON public.notificacoes
  FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.pode('gerenciar_liberacoes') OR public.pode('ver_clientes'));

DROP POLICY "ve proprios papeis" ON public.user_roles;
CREATE POLICY "ve papeis permitidos" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.pode('ver_clientes') OR public.pode('gerenciar_equipe'));
