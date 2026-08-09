-- 1) Novo conjunto de status para os planos de acompanhamento
CREATE TYPE public.atribuicao_status_novo AS ENUM (
  'rascunho',
  'aguardando_inicio',
  'em_andamento',
  'aguardando_revisao',
  'pausado',
  'concluido',
  'encerrado'
);

ALTER TABLE public.atribuicoes ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.atribuicoes
  ALTER COLUMN status TYPE public.atribuicao_status_novo
  USING (
    CASE status::text
      WHEN 'ativa' THEN
        CASE WHEN data_inicio > (now() AT TIME ZONE 'America/Sao_Paulo')::date
          THEN 'aguardando_inicio' ELSE 'em_andamento' END
      WHEN 'pausada' THEN 'pausado'
      WHEN 'concluida' THEN 'concluido'
      WHEN 'encerrada' THEN 'encerrado'
      ELSE 'em_andamento'
    END
  )::public.atribuicao_status_novo;

DROP TYPE public.atribuicao_status;
ALTER TYPE public.atribuicao_status_novo RENAME TO atribuicao_status;

ALTER TABLE public.atribuicoes ALTER COLUMN status SET DEFAULT 'rascunho'::public.atribuicao_status;

-- 2) Novos campos do plano
ALTER TABLE public.atribuicoes
  ADD COLUMN IF NOT EXISTS motivo_indicacao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS liberar_em timestamptz,
  ADD COLUMN IF NOT EXISTS liberada_em timestamptz,
  ADD COLUMN IF NOT EXISTS lembretes_ativos boolean NOT NULL DEFAULT false;

UPDATE public.atribuicoes SET liberada_em = COALESCE(liberada_em, created_at);

-- 3) Personalização das etapas por plano
ALTER TABLE public.atribuicao_etapas
  ADD COLUMN IF NOT EXISTS visivel boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permite_repetir boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prazo_dias integer,
  ADD COLUMN IF NOT EXISTS titulo_personalizado text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS descricao_personalizada text NOT NULL DEFAULT '';

ALTER TABLE public.atribuicao_etapas ALTER COLUMN conteudo_id DROP NOT NULL;

-- 4) Funções de acesso passam a considerar rascunho e liberação agendada
CREATE OR REPLACE FUNCTION public.trilha_atribuida(_trilha uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.atribuicoes a
    WHERE a.trilha_id = _trilha
      AND a.cliente_id = auth.uid()
      AND a.status IN ('aguardando_inicio','em_andamento','aguardando_revisao','pausado','concluido')
      AND (a.liberar_em IS NULL OR a.liberar_em <= now())
      AND a.data_inicio <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );
$function$;

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
      LEFT JOIN public.atribuicao_etapas ae
        ON ae.atribuicao_id = a.id AND ae.conteudo_id = c.id
      WHERE c.id = _conteudo_id
        AND c.trilha_id IS NOT NULL
        AND a.cliente_id = _cliente_id
        AND a.status IN ('aguardando_inicio','em_andamento','aguardando_revisao','pausado','concluido')
        AND (a.liberar_em IS NULL OR a.liberar_em <= now())
        AND a.data_inicio <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
        AND COALESCE(ae.visivel, true) = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.conteudos c
      WHERE c.id = _conteudo_id
        AND c.trilha_id IS NOT NULL
        AND public.trilha_liberada_autoguiada(_cliente_id, c.trilha_id)
    )
  )
$function$;

REVOKE ALL ON FUNCTION public.trilha_atribuida(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.conteudo_liberado(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trilha_atribuida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conteudo_liberado(uuid, uuid, uuid) TO authenticated;