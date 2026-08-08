CREATE OR REPLACE FUNCTION public.conteudo_liberado(_cliente_id uuid, _conteudo_id uuid, _eixo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
  SELECT EXISTS (
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
$function$;

REVOKE EXECUTE ON FUNCTION public.acompanha_cliente(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trilha_atribuida(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.minha_atribuicao(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;