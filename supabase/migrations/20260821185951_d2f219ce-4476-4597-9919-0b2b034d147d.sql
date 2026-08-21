-- 1. Novos tipos de conteúdo (mantendo os existentes)
ALTER TYPE public.conteudo_tipo ADD VALUE IF NOT EXISTS 'meditacao';
ALTER TYPE public.conteudo_tipo ADD VALUE IF NOT EXISTS 'aterramento';
ALTER TYPE public.conteudo_tipo ADD VALUE IF NOT EXISTS 'movimento_sistemico';
ALTER TYPE public.conteudo_tipo ADD VALUE IF NOT EXISTS 'texto_educativo';
ALTER TYPE public.conteudo_tipo ADD VALUE IF NOT EXISTS 'diario_integracao';
ALTER TYPE public.conteudo_tipo ADD VALUE IF NOT EXISTS 'pergunta_reflexiva';
ALTER TYPE public.conteudo_tipo ADD VALUE IF NOT EXISTS 'checkin';
ALTER TYPE public.conteudo_tipo ADD VALUE IF NOT EXISTS 'checkout';
ALTER TYPE public.conteudo_tipo ADD VALUE IF NOT EXISTS 'acao_alinhada';
ALTER TYPE public.conteudo_tipo ADD VALUE IF NOT EXISTS 'pratica_semanal';
ALTER TYPE public.conteudo_tipo ADD VALUE IF NOT EXISTS 'pdf';

-- 2. Situação do conteúdo
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conteudo_status') THEN
    CREATE TYPE public.conteudo_status AS ENUM ('rascunho', 'em_revisao', 'publicado', 'arquivado');
  END IF;
END $$;

-- 3. Novas colunas de curadoria e condução
ALTER TABLE public.conteudos
  ADD COLUMN IF NOT EXISTS objetivo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instrucoes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS perguntas_integracao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nivel public.nivel_profundidade NOT NULL DEFAULT 'leve',
  ADD COLUMN IF NOT EXISTS autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status public.conteudo_status NOT NULL DEFAULT 'publicado',
  ADD COLUMN IF NOT EXISTS data_revisao date,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS conteudo_origem_id uuid REFERENCES public.conteudos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conteudos_status_idx ON public.conteudos (status);
CREATE INDEX IF NOT EXISTS conteudos_origem_idx ON public.conteudos (conteudo_origem_id);

DROP TRIGGER IF EXISTS update_conteudos_updated_at ON public.conteudos;
CREATE TRIGGER update_conteudos_updated_at
  BEFORE UPDATE ON public.conteudos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Cliente só vê conteúdo publicado
CREATE OR REPLACE FUNCTION public.conteudo_liberado(_cliente_id uuid, _conteudo_id uuid, _eixo_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT (_cliente_id = auth.uid() OR public.acompanha_cliente(_cliente_id))
  AND EXISTS (
    SELECT 1 FROM public.conteudos cc
    WHERE cc.id = _conteudo_id AND cc.status = 'publicado'
  )
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