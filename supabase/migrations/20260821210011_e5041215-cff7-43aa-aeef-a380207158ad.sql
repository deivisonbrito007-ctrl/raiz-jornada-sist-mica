CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
    INSERT INTO public.clientes_acesso (user_id, terapeuta_id, telefone, modo)
    VALUES (NEW.id, _conv_cliente.terapeuta_id, _conv_cliente.telefone, 'acompanhado')
    ON CONFLICT (user_id) DO UPDATE SET terapeuta_id = EXCLUDED.terapeuta_id;

    UPDATE public.convites_clientes
    SET status = 'aceito', aceito_em = now(), cliente_id = NEW.id
    WHERE id = _conv_cliente.id;
  ELSIF _papel = 'cliente' AND _convite.id IS NULL THEN
    -- Sem convite: a conta começa autoguiada para já ter acesso às trilhas.
    INSERT INTO public.clientes_acesso (user_id, terapeuta_id, modo)
    VALUES (NEW.id, NULL, 'autoguiado')
    ON CONFLICT (user_id) DO NOTHING;

    -- Mas se a pessoa escolheu entrar com acompanhamento, registramos o pedido
    -- para a terapeuta responder, em vez de descartar a escolha.
    IF _caminho = 'convite' THEN
      INSERT INTO public.solicitacoes_acompanhamento (cliente_id, mensagem)
      VALUES (NEW.id, 'Pedido criado no cadastro: escolheu entrar com acompanhamento.');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;