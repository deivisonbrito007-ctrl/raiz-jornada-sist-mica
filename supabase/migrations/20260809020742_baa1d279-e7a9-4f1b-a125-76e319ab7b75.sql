-- 1) configuracoes_terapeuta: leitura restrita
DROP POLICY IF EXISTS "todos autenticados leem configuracoes" ON public.configuracoes_terapeuta;

CREATE POLICY "leitura restrita das configuracoes"
ON public.configuracoes_terapeuta
FOR SELECT
TO authenticated
USING (
  terapeuta_id = auth.uid()
  OR public.pode_administrar()
  OR EXISTS (
    SELECT 1 FROM public.clientes_acesso ca
    WHERE ca.user_id = auth.uid()
      AND ca.terapeuta_id = public.configuracoes_terapeuta.terapeuta_id
  )
);

-- 2) existe_terapeuta deixa de ser executável sem login
REVOKE EXECUTE ON FUNCTION public.existe_terapeuta() FROM anon;

-- 3) conteudo_liberado só responde sobre o cliente da sessão
CREATE OR REPLACE FUNCTION public.conteudo_liberado(_cliente_id uuid, _conteudo_id uuid, _eixo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  )
$function$;

REVOKE ALL ON FUNCTION public.conteudo_liberado(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conteudo_liberado(uuid, uuid, uuid) TO authenticated, service_role;