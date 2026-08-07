CREATE TABLE public.auditoria_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao text NOT NULL,
  alvo_tipo text NOT NULL DEFAULT 'geral',
  alvo_id uuid,
  alvo_email text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ator_email text NOT NULL DEFAULT ''::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.auditoria_equipe TO authenticated;
GRANT ALL ON public.auditoria_equipe TO service_role;

ALTER TABLE public.auditoria_equipe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditoria visivel a gestores"
ON public.auditoria_equipe FOR SELECT TO authenticated
USING (public.pode('gerenciar_equipe'));

CREATE POLICY "admins registram auditoria"
ON public.auditoria_equipe FOR INSERT TO authenticated
WITH CHECK (public.pode_administrar() AND ator_id = auth.uid());

CREATE INDEX idx_auditoria_equipe_created_at ON public.auditoria_equipe (created_at DESC);