import { useEffect, useState } from "react";
import { ArrowRight, Moon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PERGUNTA_FECHO, SILENCIO_FECHO_SEGUNDOS } from "@/lib/rituais";

/**
 * Ritual de fecho: um silêncio curto e uma pergunta só — "O que fica?".
 * Nada é exigido aqui; o registro acontece no check-out, logo depois.
 */
export function RitualFecho({
  intencao,
  onSeguir,
}: {
  intencao: string;
  onSeguir: () => void;
}) {
  const [restante, setRestante] = useState(SILENCIO_FECHO_SEGUNDOS);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRestante((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section
      aria-labelledby="titulo-fecho"
      className="rounded-3xl border border-border bg-card p-6 shadow-organico"
    >
      <p className="inline-flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia">
        <Moon className="h-3.5 w-3.5" aria-hidden="true" /> Ritual de fecho
      </p>
      <h2 id="titulo-fecho" className="mt-3 font-display text-2xl text-floresta">
        {PERGUNTA_FECHO}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Fique um instante em silêncio antes de nomear. Não precisa responder em voz alta.
      </p>

      {intencao && (
        <p className="mt-4 rounded-2xl bg-secondary/60 p-4 text-sm text-foreground">
          Você entrou com a intenção de <strong className="font-medium">{intencao}</strong>.
        </p>
      )}

      <p aria-live="polite" role="status" className="mt-5 text-sm text-muted-foreground">
        {restante > 0 ? `Silêncio de ${restante}s…` : "Quando quiser, siga para o check-out."}
      </p>

      <Button className="mt-5 min-h-11 rounded-full" onClick={onSeguir}>
        Seguir para o check-out
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </section>
  );
}
