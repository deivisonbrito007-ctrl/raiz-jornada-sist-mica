INSERT INTO public.liberacoes (cliente_id, eixo_id, status)
SELECT '72da950b-37a9-4874-9f97-fc81260e09d8', '1cd83870-6a43-44bf-a092-21a89e9aa828', 'liberado'
WHERE NOT EXISTS (SELECT 1 FROM public.liberacoes WHERE cliente_id='72da950b-37a9-4874-9f97-fc81260e09d8' AND eixo_id='1cd83870-6a43-44bf-a092-21a89e9aa828' AND conteudo_id IS NULL);

INSERT INTO public.progresso (cliente_id, conteudo_id, status, concluido_em) VALUES
  ('72da950b-37a9-4874-9f97-fc81260e09d8','95eff31f-df0e-4479-8f4d-17873d1b96fe','concluido', now() - interval '1 day'),
  ('72da950b-37a9-4874-9f97-fc81260e09d8','23261047-f3c0-43b9-b235-8c1d16ef43eb','concluido', now() - interval '1 day' + interval '2 hours'),
  ('72da950b-37a9-4874-9f97-fc81260e09d8','dae0a9dc-9d82-4ae1-a549-081958766406','concluido', now() - interval '3 hours')
ON CONFLICT DO NOTHING;