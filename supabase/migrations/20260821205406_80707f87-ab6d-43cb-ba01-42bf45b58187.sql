REVOKE EXECUTE ON FUNCTION public.trilha_liberada_autoguiada(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trilha_liberada_autoguiada(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.acompanha_cliente(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.minha_atribuicao(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trilha_atribuida(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_terapeuta() FROM authenticated;

DROP POLICY IF EXISTS "leitura restrita das configuracoes" ON public.configuracoes_terapeuta;
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
      AND ca.terapeuta_id = configuracoes_terapeuta.terapeuta_id
      AND ca.status::text = 'ativo'
  )
);