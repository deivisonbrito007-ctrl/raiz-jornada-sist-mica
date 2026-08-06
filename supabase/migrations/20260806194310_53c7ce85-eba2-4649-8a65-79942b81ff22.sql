ALTER TABLE public.liberacoes ADD COLUMN IF NOT EXISTS liberar_em timestamp with time zone;

CREATE OR REPLACE FUNCTION public.conteudo_liberado(_cliente_id uuid, _conteudo_id uuid, _eixo_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.liberacoes l
    WHERE l.cliente_id = _cliente_id AND l.status = 'liberado'
      AND (l.liberar_em IS NULL OR l.liberar_em <= now())
      AND ((l.conteudo_id = _conteudo_id) OR (l.conteudo_id IS NULL AND l.eixo_id = _eixo_id))
  )
$function$;