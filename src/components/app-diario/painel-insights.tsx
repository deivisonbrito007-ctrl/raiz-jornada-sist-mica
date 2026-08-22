import { useState } from "react";
import {
  ChevronDown,
  Lock,
  Minus,
  Share2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  TENDENCIA_LABEL,
  insightsDoDiario,
  type Tendencia,
} from "@/lib/diario-insights";
import { ehCompartilhada, type EntradaDiario } from "@/lib/diario-cliente";

/** Recorte que alimenta as leituras: tudo (privado) ou só o que já foi compartilhado. */
type Base = "todas" | "compartilhadas";

function IconeTendencia({ tendencia }: { tendencia: Tendencia }) {
  if (tendencia === "descendo")
    return <TrendingDown className="h-3.5 w-3.5 text-salvia" aria-hidden="true" />;
  if (tendencia === "estavel")
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />;
  return <TrendingUp className="h-3.5 w-3.5 text-ocre" aria-hidden="true" />;
}

/**
 * Painel de insights: o que o diário conta quando olhado de longe — como os
 * sentimentos se movem, que palavras voltam e como foi cada mês. Fechado por
 * padrão, para que a escrita continue sendo o centro da tela.
 */
export function PainelInsights({ entradas }: { entradas: EntradaDiario[] }) {
  const [aberto, setAberto] = useState(false);
  const { vazio, sentimentos, temas, meses } = insightsDoDiario(entradas);

  if (vazio) return null;

  return (
    <section aria-labelledby="titulo-insights" className="mt-10">
      <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-controls="conteudo-insights"
          className="flex min-h-14 w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-secondary/50"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-ocre" aria-hidden="true" />
          <span className="flex-1">
            <span id="titulo-insights" className="block font-display text-lg text-floresta">
              O que suas palavras vêm dizendo
            </span>
            <span className="block text-xs leading-relaxed text-muted-foreground">
              Tendências de sentimentos, temas recorrentes e resumo mês a mês
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        {aberto && (
          <div id="conteudo-insights" className="space-y-8 border-t border-border px-5 py-6">
            <div>
              <h3 className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia">
                Como os sentimentos se movem
              </h3>
              {sentimentos.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Você ainda não nomeou sentimentos nas suas reflexões. Quando quiser, escolha as
                  palavras ao escrever — elas aparecerão aqui.
                </p>
              ) : (
                <ul className="mt-4 list-none space-y-3 p-0">
                  {sentimentos.map((s) => (
                    <li key={s.chave}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-foreground">{s.rotulo}</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <IconeTendencia tendencia={s.tendencia} />
                          {TENDENCIA_LABEL[s.tendencia]}
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary"
                        role="img"
                        aria-label={`${s.rotulo}: ${s.total} ${s.total === 1 ? "marcação" : "marcações"}, ${TENDENCIA_LABEL[s.tendencia]}`}
                      >
                        <div
                          className="h-full rounded-full bg-floresta"
                          style={{ width: `${Math.max(6, Math.round(s.proporcao * 100))}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia">
                Temas que voltam
              </h3>
              {temas.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Ainda não há palavras repetidas o bastante para formar um tema. Continue
                  escrevendo no seu ritmo.
                </p>
              ) : (
                <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
                  {temas.map((t) => (
                    <li key={t.palavra}>
                      <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-secondary px-4 text-sm text-foreground">
                        {t.palavra}
                        <span className="text-xs text-muted-foreground">
                          {t.total}
                          <span className="sr-only">
                            {" "}
                            aparições em {t.entradas}{" "}
                            {t.entradas === 1 ? "reflexão" : "reflexões"}
                          </span>
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia">
                Resumo mês a mês
              </h3>
              <ul className="mt-4 list-none space-y-3 p-0">
                {meses.map((mes) => (
                  <li
                    key={mes.chave}
                    className="rounded-2xl border border-dashed border-salvia/30 p-4"
                  >
                    <p className="font-display text-base text-floresta">{mes.rotulo}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {mes.frase}
                    </p>
                    {(mes.dePraticas > 0 || mes.compartilhadas > 0) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {mes.dePraticas > 0 && `${mes.dePraticas} a partir de práticas`}
                        {mes.dePraticas > 0 && mes.compartilhadas > 0 && " · "}
                        {mes.compartilhadas > 0 && `${mes.compartilhadas} compartilhada(s)`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
