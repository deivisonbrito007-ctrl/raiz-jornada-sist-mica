-- 1. Modo de uso
CREATE TYPE public.modo_uso AS ENUM ('acompanhado', 'autoguiado');

ALTER TABLE public.clientes_acesso
  ADD COLUMN modo public.modo_uso NOT NULL DEFAULT 'acompanhado',
  ADD COLUMN modo_desde TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

ALTER TABLE public.trilhas
  ADD COLUMN modos public.modo_uso[] NOT NULL DEFAULT '{acompanhado}';

ALTER TABLE public.pacotes
  ADD COLUMN trilhas_incluidas UUID[] NOT NULL DEFAULT '{}';

-- 2. Pedidos de acompanhamento
CREATE TABLE public.solicitacoes_acompanhamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'aberta',
  resposta TEXT NOT NULL DEFAULT '',
  respondido_por UUID REFERENCES auth.users(id),
  respondido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.solicitacoes_acompanhamento TO authenticated;
GRANT ALL ON public.solicitacoes_acompanhamento TO service_role;

ALTER TABLE public.solicitacoes_acompanhamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cliente pede acompanhamento"
  ON public.solicitacoes_acompanhamento FOR INSERT TO authenticated
  WITH CHECK (cliente_id = auth.uid());

CREATE POLICY "ve pedidos de acompanhamento permitidos"
  ON public.solicitacoes_acompanhamento FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.pode('ver_clientes'));

CREATE POLICY "equipe responde pedidos de acompanhamento"
  ON public.solicitacoes_acompanhamento FOR UPDATE TO authenticated
  USING (public.pode('ver_clientes'))
  WITH CHECK (public.pode('ver_clientes'));

CREATE TRIGGER update_solicitacoes_acompanhamento_updated_at
  BEFORE UPDATE ON public.solicitacoes_acompanhamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_solic_acomp_status ON public.solicitacoes_acompanhamento (status, created_at DESC);
CREATE INDEX idx_solic_acomp_cliente ON public.solicitacoes_acompanhamento (cliente_id, created_at DESC);

-- 3. Liberação autoguiada por pacote pago
CREATE OR REPLACE FUNCTION public.trilha_liberada_autoguiada(_cliente_id uuid, _trilha uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trilhas t
    JOIN public.clientes_pacotes cp
      ON cp.cliente_id = _cliente_id AND cp.status_pagamento = 'pago'
    JOIN public.pacotes p ON p.id = cp.pacote_id
    WHERE t.id = _trilha
      AND t.status = 'publicado'
      AND 'autoguiado' = ANY (t.modos)
      AND (t.id = ANY (p.trilhas_incluidas) OR t.eixo_id = ANY (p.eixos_incluidos))
  )
$$;

REVOKE ALL ON FUNCTION public.trilha_liberada_autoguiada(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trilha_liberada_autoguiada(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.conteudo_liberado(_cliente_id uuid, _conteudo_id uuid, _eixo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (_cliente_id = auth.uid() OR public.acompanha_cliente(_cliente_id))
  AND (
    EXISTS (
      SELECT 1 FROM public.liberacoes l
      WHERE l.cliente_id = _cliente_id AND l.status = 'liberado'
        AND (l.liberar_em IS NULL OR l.liberar_em <= now())
        AND ((l.conteudo_id = _conteudo_id) OR (l.conteudo_id IS NULL AND l.eixo_id = _eixo_id))
    )
    OR EXISTS (
      SELECT 1
      FROM public.conteudos c
      JOIN public.atribuicoes a ON a.trilha_id = c.trilha_id
      WHERE c.id = _conteudo_id
        AND c.trilha_id IS NOT NULL
        AND a.cliente_id = _cliente_id
        AND a.status IN ('ativa', 'concluida')
        AND a.data_inicio <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
    )
    OR EXISTS (
      SELECT 1
      FROM public.conteudos c
      WHERE c.id = _conteudo_id
        AND c.trilha_id IS NOT NULL
        AND public.trilha_liberada_autoguiada(_cliente_id, c.trilha_id)
    )
  )
$$;

-- 4. Vitrine: trilhas autoguiadas publicadas ficam visíveis (o conteúdo segue fechado)
DROP POLICY "ve trilhas atribuidas" ON public.trilhas;
CREATE POLICY "ve trilhas permitidas"
  ON public.trilhas FOR SELECT TO authenticated
  USING (
    public.pode('gerenciar_conteudos')
    OR public.pode('gerenciar_liberacoes')
    OR public.trilha_atribuida(id)
    OR (status = 'publicado' AND 'autoguiado' = ANY (modos))
  );

-- 5. Cadastro sem convite entra como autoguiado
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
    -- Cadastro aberto: começa por conta própria, sem terapeuta responsável.
    INSERT INTO public.clientes_acesso (user_id, terapeuta_id, modo)
    VALUES (NEW.id, NULL, 'autoguiado')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
