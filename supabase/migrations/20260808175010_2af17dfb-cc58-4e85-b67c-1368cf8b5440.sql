CREATE TABLE public.preferencias_lembretes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  canal_push boolean NOT NULL DEFAULT true,
  canal_email boolean NOT NULL DEFAULT true,
  dia_semana smallint NOT NULL DEFAULT 2 CHECK (dia_semana BETWEEN 0 AND 6),
  hora_local smallint NOT NULL DEFAULT 19 CHECK (hora_local BETWEEN 0 AND 23),
  fuso text NOT NULL DEFAULT 'America/Sao_Paulo',
  dias_inatividade smallint NOT NULL DEFAULT 3 CHECK (dias_inatividade BETWEEN 1 AND 30),
  definido_por text NOT NULL DEFAULT 'cliente',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.preferencias_lembretes TO authenticated;
GRANT ALL ON public.preferencias_lembretes TO service_role;
ALTER TABLE public.preferencias_lembretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ve preferencias lembretes permitidas" ON public.preferencias_lembretes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.pode('ver_clientes'));

CREATE POLICY "cliente cria propria preferencia lembretes" ON public.preferencias_lembretes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.pode('gerenciar_liberacoes'));

CREATE POLICY "atualiza preferencias lembretes permitidas" ON public.preferencias_lembretes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.pode('gerenciar_liberacoes'))
  WITH CHECK (user_id = auth.uid() OR public.pode('gerenciar_liberacoes'));

CREATE TABLE public.dispositivos_push (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.dispositivos_push TO authenticated;
GRANT ALL ON public.dispositivos_push TO service_role;
ALTER TABLE public.dispositivos_push ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cliente ve proprios dispositivos" ON public.dispositivos_push
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "cliente registra proprio dispositivo" ON public.dispositivos_push
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "cliente remove proprio dispositivo" ON public.dispositivos_push
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.lembretes_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  chave_dedupe text NOT NULL UNIQUE,
  canal text NOT NULL DEFAULT 'app',
  status text NOT NULL DEFAULT 'enviado',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lembretes_enviados TO authenticated;
GRANT ALL ON public.lembretes_enviados TO service_role;
ALTER TABLE public.lembretes_enviados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ve lembretes enviados permitidos" ON public.lembretes_enviados
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.pode('ver_clientes'));

CREATE INDEX idx_lembretes_enviados_user_data ON public.lembretes_enviados (user_id, created_at DESC);
CREATE INDEX idx_dispositivos_push_user ON public.dispositivos_push (user_id);