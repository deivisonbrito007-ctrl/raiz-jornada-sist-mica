ALTER TABLE public.equipe_permissoes REPLICA IDENTITY FULL;
ALTER TABLE public.equipe_admins REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipe_permissoes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipe_admins;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;