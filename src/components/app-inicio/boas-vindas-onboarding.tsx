import { Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { progressoOnboarding, type EstadoOnboarding } from "@/lib/onboarding-cliente";

/**
 * Boas-vindas do Início: quatro passos curtos explicando como a Raiz funciona.
 * Some sozinho quando tudo foi feito, e pode ser fechado a qualquer momento.
 */
export function BoasVindasOnboarding({
  estado,
  primeiroNome,
  onFechar,
}: {
  estado: EstadoOnboarding;
  primeiroNome?: string;
  onFechar: () => void;
}) {
  const { passos, feitos, total, percentual } = progressoOnboarding(estado);

  return (
    <section
      aria-labelledby="titulo-boas-vindas"
      className="mt-4 rounded-[2rem] border border-salvia/30 bg-card p-6 shadow-organico"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia">
            Primeiros passos
          </p>
          <h2 id="titulo-boas-vindas" className="mt-3 font-display text-2xl leading-snug text-floresta">
            {primeiroNome ? `Bem-vindo, ${primeiroNome}.` : "Bem-vindo à Raiz."} Vamos com calma.
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Fechar as boas-vindas"
          onClick={onFechar}
          className="shrink-0 rounded-full text-salvia hover:text-floresta"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div
        role="progressbar"
        aria-label="Progresso das boas-vindas"
        aria-valuenow={percentual}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary"
      >
        <span
          aria-hidden="true"
          className="block h-full rounded-full bg-salvia transition-all"
          style={{ width: `${percentual}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {feitos} de {total} passos — no seu tempo, sem pressa.
      </p>

      <ol className="mt-5 list-none space-y-3 p-0">
        {passos.map((passo) => (
          <li
            key={passo.chave}
            className={`rounded-2xl border p-4 ${
              passo.feito ? "border-salvia/40 bg-salvia/10" : "border-border bg-background"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                  passo.feito ? "bg-salvia text-floresta-foreground" : "bg-secondary text-salvia"
                }`}
              >
                {passo.feito ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-floresta">{passo.titulo}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {passo.descricao}
                </p>
                {!passo.feito && (
                  <Link
                    to={passo.para}
                    className="mt-3 inline-flex min-h-10 items-center rounded-full bg-secondary px-4 text-sm text-foreground hover:bg-secondary/70"
                  >
                    {passo.acao}
                  </Link>
                )}
                <p className="sr-only">{passo.feito ? "Passo concluído" : "Passo pendente"}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
