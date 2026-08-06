CREATE POLICY "terapeuta le midias" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'midias' AND public.is_terapeuta());
CREATE POLICY "terapeuta envia midias" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'midias' AND public.is_terapeuta());
CREATE POLICY "terapeuta atualiza midias" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'midias' AND public.is_terapeuta()) WITH CHECK (bucket_id = 'midias' AND public.is_terapeuta());
CREATE POLICY "terapeuta apaga midias" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'midias' AND public.is_terapeuta());