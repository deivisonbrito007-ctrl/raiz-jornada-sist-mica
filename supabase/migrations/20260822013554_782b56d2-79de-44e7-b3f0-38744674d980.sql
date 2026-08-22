-- 1. Tipos
CREATE TYPE public.equipe_funcao AS ENUM ('administrador','terapeuta','editor','assistente','suporte');
CREATE TYPE public.equipe_status AS ENUM ('ativo','suspenso');
CREATE TYPE public.equipe_escopo AS ENUM ('todos','vinculados');

-- 2. Membros da equipe
CREATE TABLE public.equipe_membros (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  funcao public.equipe_funcao NOT NULL DEFAULT 'assistente',
  status public.equipe_status NOT NULL DEFAULT 'ativo',
  escopo public.equipe_escopo NOT NULL DEFAULT 'vinculados',
  principal boolean NOT NULL DEFAULT false,
  convidado_em timestamptz,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipe_membros TO authenticated;
GRANT ALL ON public.equipe_membros TO service_role;
ALTER TABLE public.equipe_membros ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.equipe_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cliente_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipe_clientes TO authenticated;
GRANT ALL ON public.equipe_clientes TO service_role;
ALTER TABLE public.equipe_clientes ENABLE ROW LEVEL SECURITY;

-- 3. Convites com função e escopo
ALTER TABLE public.convites_equipe
  ADD COLUMN IF NOT EXISTS funcao public.equipe_funcao NOT NULL DEFAULT 'assistente',
  ADD COLUMN IF NOT EXISTS escopo public.equipe_escopo NOT NULL DEFAULT 'vinculados',
  ADD COLUMN IF NOT EXISTS reenviado_em timestamptz;

-- 4. Migração dos membros atuais
INSERT INTO public.equipe_membros (user_id, funcao, status, escopo, principal)
SELECT ur.user_id, 'administrador', 'ativo', 'todos', true
FROM public.user_roles ur WHERE ur.role = 'terapeuta'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.equipe_membros (user_id, funcao, status, escopo, principal, criado_por, created_at)
SELECT ea.user_id,
       CASE WHEN EXISTS (
         SELECT 1 FROM public.equipe_permissoes p
         WHERE p.user_id = ea.user_id AND p.permissao = 'gerenciar_equipe'
       ) THEN 'administrador'::public.equipe_funcao ELSE 'assistente'::public.equipe_funcao END,
       'ativo', 'todos', false, ea.criado_por, ea.created_at
FROM public.equipe_admins ea
ON CONFLICT (user_id) DO NOTHING;

-- 5. Migração das permissões antigas
INSERT INTO public.equipe_permissoes (user_id, permissao)
SELECT user_id, 'publicar_conteudos' FROM public.equipe_permissoes WHERE permissao = 'gerenciar_conteudos'
ON CONFLICT (user_id, permissao) DO NOTHING;
INSERT INTO public.equipe_permissoes (user_id, permissao)
SELECT user_id, 'monitorar_trilhas' FROM public.equipe_permissoes WHERE permissao = 'gerenciar_liberacoes'
ON CONFLICT (user_id, permissao) DO NOTHING;
INSERT INTO public.equipe_permissoes (user_id, permissao)
SELECT user_id, 'editar_clientes' FROM public.equipe_permissoes WHERE permissao = 'ver_clientes'
ON CONFLICT (user_id, permissao) DO NOTHING;
INSERT INTO public.equipe_permissoes (user_id, permissao)
SELECT user_id, 'ver_auditoria' FROM public.equipe_permissoes WHERE permissao = 'gerenciar_equipe'
ON CONFLICT (user_id, permissao) DO NOTHING;
UPDATE public.equipe_permissoes SET permissao = 'ver_registros' WHERE permissao = 'ver_diario';
UPDATE public.equipe_permissoes SET permissao = 'criar_conteudos' WHERE permissao = 'gerenciar_conteudos';
UPDATE public.equipe_permissoes SET permissao = 'criar_planos' WHERE permissao = 'gerenciar_liberacoes';

-- 6. Funções de apoio
CREATE OR REPLACE FUNCTION public.eh_admin_total(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'terapeuta')
     OR EXISTS (
       SELECT 1 FROM public.equipe_membros m
       WHERE m.user_id = _user_id AND m.status = 'ativo' AND m.funcao = 'administrador'
     )
$$;

CREATE OR REPLACE FUNCTION public.membro_ativo(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.equipe_membros m WHERE m.user_id = _user_id AND m.status = 'ativo'
  )
$$;

CREATE OR REPLACE FUNCTION public.tem_permissao(_user_id uuid, _permissao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.eh_admin_total(_user_id)
     OR EXISTS (
       SELECT 1 FROM public.equipe_permissoes ep
       JOIN public.equipe_membros m ON m.user_id = ep.user_id AND m.status = 'ativo'
       WHERE ep.user_id = _user_id
         AND ep.permissao = CASE _permissao
           WHEN 'ver_diario' THEN 'ver_registros'
           WHEN 'gerenciar_conteudos' THEN 'criar_conteudos'
           WHEN 'gerenciar_liberacoes' THEN 'criar_planos'
           ELSE _permissao END
     )
$$;

CREATE OR REPLACE FUNCTION public.pode_administrar()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.eh_admin_total(auth.uid()) OR public.membro_ativo(auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.escopo_cliente(_user_id uuid, _cliente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.eh_admin_total(_user_id)
     OR EXISTS (
       SELECT 1 FROM public.equipe_membros m
       WHERE m.user_id = _user_id AND m.status = 'ativo' AND m.escopo = 'todos'
     )
     OR EXISTS (
       SELECT 1 FROM public.clientes_acesso c
       WHERE c.user_id = _cliente AND c.terapeuta_id = _user_id
     )
     OR EXISTS (
       SELECT 1 FROM public.equipe_clientes v
       WHERE v.user_id = _user_id AND v.cliente_id = _cliente
     )
$$;

CREATE OR REPLACE FUNCTION public.no_escopo(_cliente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.escopo_cliente(auth.uid(), _cliente)
$$;

CREATE OR REPLACE FUNCTION public.acompanha_cliente(_cliente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.eh_admin_total(auth.uid())
     OR (public.pode('ver_clientes') AND public.escopo_cliente(auth.uid(), _cliente))
$$;

REVOKE EXECUTE ON FUNCTION public.eh_admin_total(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.membro_ativo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.escopo_cliente(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.no_escopo(uuid) FROM anon;

-- 7. Proteções da equipe
CREATE OR REPLACE FUNCTION public.proteger_equipe()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _restantes integer;
BEGIN
  IF TG_OP = 'DELETE' AND OLD.principal THEN
    RAISE EXCEPTION 'A conta principal não pode ser removida da equipe.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.principal AND (NEW.status <> 'ativo' OR NEW.funcao <> 'administrador') THEN
    RAISE EXCEPTION 'A conta principal deve permanecer administradora e ativa.';
  END IF;

  SELECT count(*) INTO _restantes FROM public.equipe_membros m
  WHERE m.funcao = 'administrador' AND m.status = 'ativo'
    AND m.user_id <> COALESCE(OLD.user_id, NEW.user_id);

  IF _restantes = 0 THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'É preciso manter pelo menos um administrador ativo.';
    ELSIF NOT (NEW.funcao = 'administrador' AND NEW.status = 'ativo') THEN
      RAISE EXCEPTION 'É preciso manter pelo menos um administrador ativo.';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER equipe_membros_protecao BEFORE UPDATE OR DELETE ON public.equipe_membros
FOR EACH ROW EXECUTE FUNCTION public.proteger_equipe();
CREATE TRIGGER equipe_membros_updated_at BEFORE UPDATE ON public.equipe_membros
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Convites passam a criar membros com função e escopo
CREATE OR REPLACE FUNCTION public.aceitar_convite_equipe(_token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _email TEXT;
  _convite public.convites_equipe;
  _perm TEXT;
BEGIN
  IF _uid IS NULL THEN RETURN 'sem_sessao'; END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = _uid;
  SELECT * INTO _convite FROM public.convites_equipe WHERE token = _token LIMIT 1;
  IF _convite.id IS NULL THEN RETURN 'invalido'; END IF;
  IF _convite.status <> 'pendente' THEN RETURN 'usado'; END IF;
  IF _convite.expira_em <= now() THEN
    UPDATE public.convites_equipe SET status = 'expirado' WHERE id = _convite.id;
    RETURN 'expirado';
  END IF;
  IF lower(_convite.email) <> coalesce(_email, '') THEN RETURN 'outro_email'; END IF;

  INSERT INTO public.equipe_membros (user_id, funcao, escopo, status, convidado_em, criado_por)
  VALUES (_uid, _convite.funcao, _convite.escopo, 'ativo', _convite.created_at, _convite.criado_por)
  ON CONFLICT (user_id) DO UPDATE
    SET funcao = EXCLUDED.funcao, escopo = EXCLUDED.escopo, status = 'ativo';

  FOREACH _perm IN ARRAY _convite.permissoes LOOP
    INSERT INTO public.equipe_permissoes (user_id, permissao)
    VALUES (_uid, _perm) ON CONFLICT (user_id, permissao) DO NOTHING;
  END LOOP;

  UPDATE public.convites_equipe SET status = 'aceito', aceito_em = now() WHERE id = _convite.id;
  RETURN 'aceito';
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _papel public.app_role := 'cliente';
  _existe_terapeuta BOOLEAN;
  _convite public.convites_equipe;
  _conv_cliente public.convites_clientes;
  _perm TEXT;
  _caminho TEXT := COALESCE(NEW.raw_user_meta_data ->> 'caminho_entrada', 'propria');
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', ''), COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;

  IF NEW.raw_user_meta_data ->> 'papel' = 'terapeuta' THEN
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'terapeuta') INTO _existe_terapeuta;
    IF NOT _existe_terapeuta THEN _papel := 'terapeuta'; END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _papel) ON CONFLICT DO NOTHING;

  IF _papel = 'terapeuta' THEN
    INSERT INTO public.equipe_membros (user_id, funcao, escopo, status, principal)
    VALUES (NEW.id, 'administrador', 'todos', 'ativo', true)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  SELECT * INTO _convite FROM public.convites_equipe
  WHERE status = 'pendente' AND expira_em > now()
    AND lower(email) = lower(COALESCE(NEW.email, ''))
  ORDER BY created_at DESC LIMIT 1;

  IF _convite.id IS NOT NULL THEN
    INSERT INTO public.equipe_membros (user_id, funcao, escopo, status, convidado_em, criado_por)
    VALUES (NEW.id, _convite.funcao, _convite.escopo, 'ativo', _convite.created_at, _convite.criado_por)
    ON CONFLICT (user_id) DO UPDATE
      SET funcao = EXCLUDED.funcao, escopo = EXCLUDED.escopo, status = 'ativo';

    FOREACH _perm IN ARRAY _convite.permissoes LOOP
      INSERT INTO public.equipe_permissoes (user_id, permissao)
      VALUES (NEW.id, _perm) ON CONFLICT (user_id, permissao) DO NOTHING;
    END LOOP;

    UPDATE public.convites_equipe SET status = 'aceito', aceito_em = now() WHERE id = _convite.id;
  END IF;

  SELECT * INTO _conv_cliente FROM public.convites_clientes
  WHERE status = 'pendente' AND expira_em > now()
    AND lower(email) = lower(COALESCE(NEW.email, ''))
  ORDER BY created_at DESC LIMIT 1;

  IF _conv_cliente.id IS NOT NULL THEN
    INSERT INTO public.clientes_acesso (user_id, terapeuta_id, telefone, modo)
    VALUES (NEW.id, _conv_cliente.terapeuta_id, _conv_cliente.telefone, 'acompanhado')
    ON CONFLICT (user_id) DO UPDATE SET terapeuta_id = EXCLUDED.terapeuta_id;

    UPDATE public.convites_clientes
    SET status = 'aceito', aceito_em = now(), cliente_id = NEW.id
    WHERE id = _conv_cliente.id;
  ELSIF _papel = 'cliente' AND _convite.id IS NULL THEN
    INSERT INTO public.clientes_acesso (user_id, terapeuta_id, modo)
    VALUES (NEW.id, NULL, 'autoguiado')
    ON CONFLICT (user_id) DO NOTHING;

    IF _caminho = 'convite' THEN
      INSERT INTO public.solicitacoes_acompanhamento (cliente_id, mensagem)
      VALUES (NEW.id, 'Pedido criado no cadastro: escolheu entrar com acompanhamento.');
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- 9. equipe_admins deixa de existir
DROP TABLE public.equipe_admins CASCADE;

-- 10. Políticas das novas tabelas
CREATE POLICY "equipe membros visiveis" ON public.equipe_membros
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.pode('gerenciar_equipe'));
CREATE POLICY "equipe membros gerenciados" ON public.equipe_membros
FOR ALL TO authenticated USING (public.pode('gerenciar_equipe')) WITH CHECK (public.pode('gerenciar_equipe'));

CREATE POLICY "vinculos visiveis" ON public.equipe_clientes
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.pode('gerenciar_equipe'));
CREATE POLICY "vinculos gerenciados" ON public.equipe_clientes
FOR ALL TO authenticated USING (public.pode('gerenciar_equipe')) WITH CHECK (public.pode('gerenciar_equipe'));

-- 11. Menor acesso possível nas tabelas sensíveis
DROP POLICY IF EXISTS "ve diario permitido" ON public.diario;
CREATE POLICY "ve diario permitido" ON public.diario
FOR SELECT TO authenticated USING (
  cliente_id = auth.uid()
  OR (public.pode('ver_registros') AND visibilidade = 'compartilhado' AND public.no_escopo(cliente_id))
);

DROP POLICY IF EXISTS "ve checkins permitidos" ON public.checkins;
CREATE POLICY "ve checkins permitidos" ON public.checkins
FOR SELECT TO authenticated USING (
  cliente_id = auth.uid() OR (public.pode('ver_registros') AND public.no_escopo(cliente_id))
);

DROP POLICY IF EXISTS "ve revisoes permitidas" ON public.revisoes;
CREATE POLICY "ve revisoes permitidas" ON public.revisoes
FOR SELECT TO authenticated USING (
  cliente_id = auth.uid() OR (public.pode('ver_registros') AND public.no_escopo(cliente_id))
);
DROP POLICY IF EXISTS "cliente edita propria revisao" ON public.revisoes;
CREATE POLICY "atualiza revisao permitida" ON public.revisoes
FOR UPDATE TO authenticated
USING (cliente_id = auth.uid() OR (public.pode('monitorar_trilhas') AND public.no_escopo(cliente_id)))
WITH CHECK (cliente_id = auth.uid() OR (public.pode('monitorar_trilhas') AND public.no_escopo(cliente_id)));

DROP POLICY IF EXISTS "ve progresso permitido" ON public.progresso;
CREATE POLICY "ve progresso permitido" ON public.progresso
FOR SELECT TO authenticated USING (
  cliente_id = auth.uid() OR (public.pode('ver_clientes') AND public.no_escopo(cliente_id))
);

DROP POLICY IF EXISTS "ve perfis permitidos" ON public.profiles;
CREATE POLICY "ve perfis permitidos" ON public.profiles
FOR SELECT TO authenticated USING (
  id = auth.uid() OR public.pode('gerenciar_equipe')
  OR (public.pode('ver_clientes') AND public.no_escopo(id))
);
DROP POLICY IF EXISTS "atualiza perfis permitidos" ON public.profiles;
CREATE POLICY "atualiza perfis permitidos" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() OR (public.pode('editar_clientes') AND public.no_escopo(id)))
WITH CHECK (id = auth.uid() OR (public.pode('editar_clientes') AND public.no_escopo(id)));

DROP POLICY IF EXISTS "equipe gerencia acesso de clientes" ON public.clientes_acesso;
CREATE POLICY "equipe le acesso de clientes" ON public.clientes_acesso
FOR SELECT TO authenticated USING (public.pode('ver_clientes') AND public.no_escopo(user_id));
CREATE POLICY "equipe cria acesso de clientes" ON public.clientes_acesso
FOR INSERT TO authenticated WITH CHECK (public.pode('editar_clientes'));
CREATE POLICY "equipe edita acesso de clientes" ON public.clientes_acesso
FOR UPDATE TO authenticated
USING (public.pode('editar_clientes') AND public.no_escopo(user_id))
WITH CHECK (public.pode('editar_clientes'));
CREATE POLICY "equipe apaga acesso de clientes" ON public.clientes_acesso
FOR DELETE TO authenticated USING (public.eh_admin_total(auth.uid()));

DROP POLICY IF EXISTS "equipe gerencia atribuicoes" ON public.atribuicoes;
CREATE POLICY "equipe gerencia atribuicoes" ON public.atribuicoes
FOR ALL TO authenticated
USING (public.pode('criar_planos') AND public.no_escopo(cliente_id))
WITH CHECK (public.pode('criar_planos') AND public.no_escopo(cliente_id));
DROP POLICY IF EXISTS "ve atribuicoes permitidas" ON public.atribuicoes;
CREATE POLICY "ve atribuicoes permitidas" ON public.atribuicoes
FOR SELECT TO authenticated USING (
  cliente_id = auth.uid()
  OR ((public.pode('criar_planos') OR public.pode('monitorar_trilhas') OR public.pode('ver_clientes'))
      AND public.no_escopo(cliente_id))
);

DROP POLICY IF EXISTS "equipe gerencia etapas da atribuicao" ON public.atribuicao_etapas;
CREATE POLICY "equipe gerencia etapas da atribuicao" ON public.atribuicao_etapas
FOR ALL TO authenticated
USING (public.pode('criar_planos') OR public.pode('monitorar_trilhas'))
WITH CHECK (public.pode('criar_planos') OR public.pode('monitorar_trilhas'));
DROP POLICY IF EXISTS "ve etapas da atribuicao" ON public.atribuicao_etapas;
CREATE POLICY "ve etapas da atribuicao" ON public.atribuicao_etapas
FOR SELECT TO authenticated USING (
  public.minha_atribuicao(atribuicao_id) OR public.pode('ver_clientes')
  OR public.pode('criar_planos') OR public.pode('monitorar_trilhas')
);

DROP POLICY IF EXISTS "gerencia conteudos" ON public.conteudos;
CREATE POLICY "cria conteudos" ON public.conteudos
FOR INSERT TO authenticated
WITH CHECK (public.pode('criar_conteudos') AND (status <> 'publicado' OR public.pode('publicar_conteudos')));
CREATE POLICY "edita conteudos" ON public.conteudos
FOR UPDATE TO authenticated
USING (public.pode('criar_conteudos'))
WITH CHECK (public.pode('criar_conteudos') AND (status <> 'publicado' OR public.pode('publicar_conteudos')));
CREATE POLICY "apaga conteudos" ON public.conteudos
FOR DELETE TO authenticated USING (public.pode('criar_conteudos'));
DROP POLICY IF EXISTS "ve conteudos liberados" ON public.conteudos;
CREATE POLICY "ve conteudos liberados" ON public.conteudos
FOR SELECT TO authenticated USING (
  public.pode('criar_conteudos') OR public.pode('publicar_conteudos') OR public.pode('monitorar_trilhas')
  OR public.pode('criar_planos')
  OR public.conteudo_liberado(auth.uid(), id, eixo_id)
  OR (trilha_id IS NOT NULL AND public.trilha_atribuida(trilha_id))
);

DROP POLICY IF EXISTS "gerencia trilhas" ON public.trilhas;
CREATE POLICY "gerencia trilhas" ON public.trilhas
FOR ALL TO authenticated
USING (public.pode('criar_conteudos')) WITH CHECK (public.pode('criar_conteudos'));
DROP POLICY IF EXISTS "ve trilhas permitidas" ON public.trilhas;
CREATE POLICY "ve trilhas permitidas" ON public.trilhas
FOR SELECT TO authenticated USING (
  public.pode('criar_conteudos') OR public.pode('publicar_conteudos')
  OR public.pode('criar_planos') OR public.pode('monitorar_trilhas')
  OR public.trilha_atribuida(id)
  OR (status = 'publicado' AND 'autoguiado'::modo_uso = ANY (modos))
);

DROP POLICY IF EXISTS "gerencia liberacoes" ON public.liberacoes;
CREATE POLICY "gerencia liberacoes" ON public.liberacoes
FOR ALL TO authenticated
USING (public.pode('criar_planos') AND public.no_escopo(cliente_id))
WITH CHECK (public.pode('criar_planos') AND public.no_escopo(cliente_id));
DROP POLICY IF EXISTS "ve liberacoes permitidas" ON public.liberacoes;
CREATE POLICY "ve liberacoes permitidas" ON public.liberacoes
FOR SELECT TO authenticated USING (
  cliente_id = auth.uid()
  OR ((public.pode('criar_planos') OR public.pode('monitorar_trilhas') OR public.pode('ver_clientes'))
      AND public.no_escopo(cliente_id))
);

DROP POLICY IF EXISTS "auditoria visivel a gestores" ON public.auditoria_equipe;
CREATE POLICY "auditoria visivel a gestores" ON public.auditoria_equipe
FOR SELECT TO authenticated USING (public.pode('gerenciar_equipe') OR public.pode('ver_auditoria'));
DROP POLICY IF EXISTS "acessos negados visiveis a gestores" ON public.auditoria_acessos_negados;
CREATE POLICY "acessos negados visiveis a gestores" ON public.auditoria_acessos_negados
FOR SELECT TO authenticated USING (public.pode('gerenciar_equipe') OR public.pode('ver_auditoria'));

DROP POLICY IF EXISTS "gerencia eixos" ON public.eixos;
CREATE POLICY "gerencia eixos" ON public.eixos
FOR ALL TO authenticated USING (public.pode('criar_conteudos')) WITH CHECK (public.pode('criar_conteudos'));

DROP POLICY IF EXISTS "equipe responde apoio" ON public.solicitacoes_apoio;
CREATE POLICY "equipe responde apoio" ON public.solicitacoes_apoio
FOR UPDATE TO authenticated
USING (public.pode('ver_clientes') AND public.no_escopo(cliente_id))
WITH CHECK (public.pode('ver_clientes') AND public.no_escopo(cliente_id));
DROP POLICY IF EXISTS "ve apoio permitido" ON public.solicitacoes_apoio;
CREATE POLICY "ve apoio permitido" ON public.solicitacoes_apoio
FOR SELECT TO authenticated USING (
  cliente_id = auth.uid() OR (public.pode('ver_clientes') AND public.no_escopo(cliente_id))
);
