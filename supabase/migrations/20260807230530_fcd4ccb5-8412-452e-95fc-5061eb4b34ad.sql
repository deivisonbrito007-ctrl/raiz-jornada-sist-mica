CREATE TABLE public.limites_uso (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  acao text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX limites_uso_lookup_idx ON public.limites_uso (user_id, acao, created_at DESC);

GRANT ALL ON public.limites_uso TO service_role;

ALTER TABLE public.limites_uso ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy: acesso somente via service_role (servidor)

CREATE OR REPLACE FUNCTION public.consumir_limite(
  _user_id uuid,
  _acao text,
  _limite integer,
  _janela_segundos integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inicio timestamptz := now() - make_interval(secs => _janela_segundos);
  _usados integer;
  _mais_antigo timestamptz;
BEGIN
  DELETE FROM public.limites_uso
  WHERE created_at < now() - interval '1 day';

  SELECT count(*), min(created_at)
  INTO _usados, _mais_antigo
  FROM public.limites_uso
  WHERE user_id = _user_id AND acao = _acao AND created_at >= _inicio;

  IF _usados >= _limite THEN
    RETURN jsonb_build_object(
      'permitido', false,
      'usados', _usados,
      'limite', _limite,
      'liberar_em', to_char(_mais_antigo + make_interval(secs => _janela_segundos), 'YYYY-MM-DD"T"HH24:MI:SS.MSOF')
    );
  END IF;

  INSERT INTO public.limites_uso (user_id, acao) VALUES (_user_id, _acao);

  RETURN jsonb_build_object(
    'permitido', true,
    'usados', _usados + 1,
    'limite', _limite,
    'liberar_em', null
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consumir_limite(uuid, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consumir_limite(uuid, text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.consumir_limite(uuid, text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_limite(uuid, text, integer, integer) TO service_role;