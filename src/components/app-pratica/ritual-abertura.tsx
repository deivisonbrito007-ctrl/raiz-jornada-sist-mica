import { useEffect, useState } from "react";
import { ArrowRight, Wind } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ANCORAGENS,
  DURACAO_ABERTURA_SEGUNDOS,
  INTENCOES_SUGERIDAS,
  RESPIROS,
  ancoragemDoDia,
  faseDoRespiro,
  guardarUltimaIntencao,
  lerUltimaIntencao,
  respirosFeitos,
} from "@/lib/rituais";

/**
 * Ritual de abertura: três respiros guiados e a intenção do dia.
 * Curto de propósito — o suficiente para chegar, sem virar tarefa. Pode ser
 * pulado a qualquer momento, e a última intenção é oferecida de novo.
 */
export function RitualAbertura({
  titulo,
  onSeguir,
}: {
  titulo: string;
  onSeguir: (intencao: string) => void;
}) {
  const [segundo, setSegundo] = useState(0);
  const [respirando, setRespirando] = useState(false);
  const [intencao, setIntencao] = useState("");

  useEffect(() => {
    const anterior = lerUltimaIntencao();
    if (anterior) setIntencao(anterior);
  }, []);

  useEffect(() => {
    if (!respirando) return;
    const id = window.setInterval(() => {
      setSegundo((s) => {
        if (s + 1 >= DURACAO_ABERTURA_SEGUNDOS) {
          window.clearInterval(id);
          setRespirando(false);
          return DURACAO_ABERTURA_SEGUNDOS;
        }
        return s + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [respirando]);

  const parte = faseDoRespiro(segundo);
  const feitos = respirosFeitos(segundo);
  const completo = segundo >= DURACAO_ABERTURA_SEGUNDOS;

  function seguir() {
    guardarUltimaIntencao(intencao);
    onSeguir(intencao.trim());
  }

  return (
    <section
      aria-labelledby="titulo-abertura"
      className="rounded-3xl border border-border bg-card p-6 shadow-organico"
    >
      <p className="inline-flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia">
        <Wind className="h-3.5 w-3.5" aria-hidden="true" /> Ritual de abertura
      </p>
      <h2 id="titulo-abertura" className="mt-3 font-display text-2xl leading-snug text-floresta">
        Antes de {titulo.toLowerCase()}, chegue aqui.
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ancoragemDoDia()}</p>

      <div className="mt-6 flex flex-col items-center rounded-[1.75rem] bg-secondary/60 p-6">
        <span
          aria-hidden="true"
          className={`flex h-28 w-28 items-center justify-center rounded-full bg-floresta/10 text-center transition-transform duration-1000 ${
            respirando && parte.fase === "inspire"
              ? "scale-110"
              : respirando && parte.fase === "solte"
                ? "scale-90"
                : "scale-100"
          }`}
        >
          <span className="font-display text-lg text-floresta">
            {completo ? "Pronto" : respirando ? parte.rotulo : "Respire"}
          </span>
        </span>
        <p aria-live="polite" role="status" className="mt-4 text-sm text-muted-foreground">
          {completo
            ? "Três respiros feitos. Siga quando quiser."
            : respirando
              ? `${parte.rotulo} · respiro ${Math.min(RESPIROS, feitos + 1)} de ${RESPIROS}`
              : "Três respiros, no seu ritmo."}
        </p>
        {!respirando && !completo && (
          <Button
            type="button"
            variant="secondary"
            className="mt-4 min-h-11 rounded-full"
            onClick={() => setRespirando(true)}
          >
            Começar os respiros
          </Button>
        )}
      </div>

      <div className="mt-6">
        <Label htmlFor="intencao-do-dia">Sua intenção para hoje (opcional)</Label>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTENCOES_SUGERIDAS.map((sugestao) => (
            <button
              key={sugestao}
              type="button"
              aria-pressed={intencao === sugestao}
              onClick={() => setIntencao(sugestao)}
              className={`min-h-10 rounded-full px-4 text-sm transition ${
                intencao === sugestao
                  ? "bg-floresta text-floresta-foreground"
                  : "bg-secondary text-foreground hover:bg-secondary/70"
              }`}
            >
              {sugestao}
            </button>
          ))}
        </div>
        <Input
          id="intencao-do-dia"
          value={intencao}
          onChange={(e) => setIntencao(e.target.value)}
          placeholder="Ou escreva com suas palavras"
          className="mt-3 min-h-12 rounded-2xl"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button className="min-h-11 rounded-full" onClick={seguir}>
          Estou pronto para seguir
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" className="min-h-11 rounded-full" onClick={seguir}>
          Pular o ritual
        </Button>
      </div>

      <p className="sr-only">{ANCORAGENS.length} frases de ancoragem se alternam por dia.</p>
    </section>
  );
}
