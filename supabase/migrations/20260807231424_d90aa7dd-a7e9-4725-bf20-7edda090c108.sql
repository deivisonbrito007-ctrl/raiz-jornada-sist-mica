ALTER TABLE public.progresso
  ADD COLUMN IF NOT EXISTS posicao_segundos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estava_tocando BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS posicao_atualizada_em TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS progresso_cliente_conteudo_uniq
  ON public.progresso (cliente_id, conteudo_id);