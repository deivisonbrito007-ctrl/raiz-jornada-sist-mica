CREATE TABLE public.anotacoes_etapa (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conteudo_id uuid NOT NULL REFERENCES public.conteudos(id) ON DELETE CASCADE,
  atribuicao_id uuid REFERENCES public.atribuicoes(id) ON DELETE SET NULL,
  texto text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX anotacoes_etapa_unica
  ON public.anotacoes_etapa (cliente_id, conteudo_id, COALESCE(atribuicao_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anotacoes_etapa TO authenticated;
GRANT ALL ON public.anotacoes_etapa TO service_role;

ALTER TABLE public.anotacoes_etapa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente gerencia suas anotacoes"
  ON public.anotacoes_etapa FOR ALL TO authenticated
  USING (cliente_id = auth.uid())
  WITH CHECK (cliente_id = auth.uid());

CREATE TRIGGER anotacoes_etapa_updated_at
  BEFORE UPDATE ON public.anotacoes_etapa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();