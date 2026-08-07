CREATE TABLE public.auditoria_acessos_negados (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  user_email text NOT NULL DEFAULT '',
  acao text NOT NULL,
  permissao text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'papel',
  alvo_id uuid,
  rota text NOT NULL DEFAULT '',
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auditoria_acessos_negados TO authenticated;
GRANT ALL ON public.auditoria_acessos_negados TO service_role;

ALTER TABLE public.auditoria_acessos_negados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acessos negados visiveis a gestores"
ON public.auditoria_acessos_negados
FOR SELECT
TO authenticated
USING (public.pode('gerenciar_equipe'));

CREATE INDEX auditoria_acessos_negados_created_at_idx
ON public.auditoria_acessos_negados (created_at DESC);
