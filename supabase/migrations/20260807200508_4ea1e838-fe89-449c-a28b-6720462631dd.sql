ALTER TABLE public.convites_equipe
  ADD COLUMN IF NOT EXISTS token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  ADD COLUMN IF NOT EXISTS expira_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days');

CREATE UNIQUE INDEX IF NOT EXISTS convites_equipe_token_key ON public.convites_equipe (token);

CREATE OR REPLACE FUNCTION public.aceitar_convite_equipe(_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _email TEXT;
  _convite public.convites_equipe;
  _perm TEXT;
BEGIN
  IF _uid IS NULL THEN
    RETURN 'sem_sessao';
  END IF;

  SELECT lower(email) INTO _email FROM auth.users WHERE id = _uid;

  SELECT * INTO _convite FROM public.convites_equipe
  WHERE token = _token
  LIMIT 1;

  IF _convite.id IS NULL THEN
    RETURN 'invalido';
  END IF;

  IF _convite.status <> 'pendente' THEN
    RETURN 'usado';
  END IF;

  IF _convite.expira_em <= now() THEN
    UPDATE public.convites_equipe SET status = 'expirado' WHERE id = _convite.id;
    RETURN 'expirado';
  END IF;

  IF lower(_convite.email) <> coalesce(_email, '') THEN
    RETURN 'outro_email';
  END IF;

  INSERT INTO public.equipe_admins (user_id, criado_por)
  VALUES (_uid, _convite.criado_por)
  ON CONFLICT (user_id) DO NOTHING;

  FOREACH _perm IN ARRAY _convite.permissoes LOOP
    INSERT INTO public.equipe_permissoes (user_id, permissao)
    VALUES (_uid, _perm)
    ON CONFLICT (user_id, permissao) DO NOTHING;
  END LOOP;

  UPDATE public.convites_equipe
  SET status = 'aceito', aceito_em = now()
  WHERE id = _convite.id;

  RETURN 'aceito';
END;
$$;

REVOKE ALL ON FUNCTION public.aceitar_convite_equipe(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aceitar_convite_equipe(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.aceitar_convite_equipe(TEXT) TO authenticated;

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
  WHERE status = 'pendente'
    AND expira_em > now()
    AND lower(email) = lower(COALESCE(NEW.email, ''))
  ORDER BY created_at DESC
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