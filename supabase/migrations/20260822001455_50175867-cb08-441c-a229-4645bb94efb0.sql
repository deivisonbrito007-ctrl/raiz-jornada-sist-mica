ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS eixos_preferidos uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS eixo_destaque uuid REFERENCES public.eixos(id) ON DELETE SET NULL;