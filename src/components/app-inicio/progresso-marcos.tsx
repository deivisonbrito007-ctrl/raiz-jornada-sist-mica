import { Award, Sparkles } from "lucide-react";

import { resumoMarcos, type DadosMarcos } from "@/lib/marcos-cliente";

/**
 * Marcos do caminho: sequência e ciclo, quanto já caminhou em cada eixo e as
 * conquistas — desenhadas com suavidade, sem placar nem competição.
 */
export function ProgressoMarcos(dados: DadosMarcos) {
  const { fatias, conquistas, conquistadas, frase } = resumoMarcos(dados);

  return (
    <section
      aria-labelledby="titulo-marcos"
      className="mt-4 rounded-[2rem] bg-card p-6 shadow-organico"
    >
      <h2
        id="titulo-marcos"
        className="inline-flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Marcos do seu caminho
      </h2>
      <p className="mt-3 font-display text-xl leading-snug text-floresta">{frase}</p>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-secondary/60 p-4">
          <dt className="text-xs text-muted-foreground">Sequência</dt>
          <dd className="mt-1 font-display text-2xl text-floresta">
            {dados.streakSemanas}{" "}
            <span className="text-sm text-muted-foreground">
              semana{dados.streakSemanas === 1 ? "" : "s"}
            </span>
          </dd>
        </div>
        <div className="rounded-2xl bg-secondary/60 p-4">
          <dt className="text-xs text-muted-foreground">Ciclo</dt>
          <dd className="mt-1 font-display text-2xl text-floresta">
            semana {dados.cicloSemana}
          </dd>
        </div>
      </dl>

      {fatias.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-salvia">
            Por eixo
          </h3>
          <ul className="mt-3 list-none space-y-3 p-0">
            {fatias.map((fatia) => (
              <li key={fatia.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-foreground">{fatia.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {fatia.concluidos} de {fatia.total} · {fatia.percentual}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`Progresso no eixo ${fatia.nome}`}
                  aria-valuenow={fatia.percentual}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary"
                >
                  <span
                    aria-hidden="true"
                    className="block h-full rounded-full bg-salvia transition-all"
                    style={{ width: `${fatia.percentual}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <h3 className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-salvia">
          <Award className="h-3.5 w-3.5" aria-hidden="true" /> Conquistas ({conquistadas} de{" "}
          {conquistas.length})
        </h3>
        <ul className="mt-3 grid list-none gap-2 p-0 sm:grid-cols-2">
          {conquistas.map((conquista) => (
            <li
              key={conquista.chave}
              className={`rounded-2xl border p-3 text-sm transition ${
                conquista.conquistada
                  ? "border-salvia/40 bg-salvia/10 text-foreground"
                  : "border-dashed border-border text-muted-foreground"
              }`}
            >
              <p className="font-medium text-floresta">{conquista.titulo}</p>
              <p className="mt-1 text-xs leading-relaxed">{conquista.descricao}</p>
              <p className="sr-only">
                {conquista.conquistada ? "Conquistada" : "Ainda por acontecer"}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
