import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock } from "lucide-react";
import { IconeEixo } from "@/components/icone-eixo";
import { formatarData } from "@/lib/raiz-format";

export type EixoResumo = {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  liberado: boolean;
  abreEm: string | null;
  total: number;
  concluidos: number;
};

function Anel({ concluidos, total }: { concluidos: number; total: number }) {
  const proporcao = total ? concluidos / total : 0;
  const perimetro = 2 * Math.PI * 18;
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90" aria-hidden="true">
      <circle cx="22" cy="22" r="18" fill="none" strokeWidth="3.5" className="stroke-border" />
      <circle
        cx="22"
        cy="22"
        r="18"
        fill="none"
        strokeWidth="3.5"
        strokeLinecap="round"
        className="stroke-salvia"
        strokeDasharray={perimetro}
        strokeDashoffset={perimetro * (1 - proporcao)}
      />
    </svg>
  );
}

/**
 * Os eixos do processo: carrossel com encaixe no mobile, grade no desktop.
 * Cada cartão mostra o quanto já caminhou; os fechados dizem quando abrem.
 */
export function CarrosselEixos({ eixos }: { eixos: EixoResumo[] }) {
  if (eixos.length === 0) return null;

  return (
    <section aria-labelledby="titulo-eixos" className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="titulo-eixos" className="font-display text-xl text-floresta">
            Seus eixos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada eixo é um tema do seu sistema familiar.
          </p>
        </div>
        <Link
          to="/app/jornada"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-terracota"
        >
          Ver tudo <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <ul className="-mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
        {eixos.map((eixo) => (
          <li key={eixo.id} className="w-[76%] shrink-0 snap-start sm:w-auto">
            {eixo.liberado ? (
              <Link
                to="/app/eixo/$eixoId"
                params={{ eixoId: eixo.id }}
                className="flex h-full flex-col rounded-3xl bg-card p-5 shadow-organico transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-2xl bg-secondary p-3 text-floresta">
                    <IconeEixo nome={eixo.icone} className="h-5 w-5" />
                  </span>
                  <Anel concluidos={eixo.concluidos} total={eixo.total} />
                </div>
                <h3 className="mt-4 font-display text-lg text-floresta">{eixo.nome}</h3>
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {eixo.descricao}
                </p>
                <p className="mt-3 text-xs font-medium text-salvia">
                  {eixo.concluidos}/{eixo.total} concluídos
                </p>
              </Link>
            ) : (
              <div className="flex h-full flex-col rounded-3xl border border-dashed border-border bg-secondary/40 p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-2xl bg-secondary p-3 text-muted-foreground">
                    <IconeEixo nome={eixo.icone} className="h-5 w-5" />
                  </span>
                  <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-display text-lg text-muted-foreground">{eixo.nome}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground/80">
                  {eixo.abreEm
                    ? `Abre em ${formatarData(eixo.abreEm)}.`
                    : "Será liberado quando for o momento do seu processo."}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
