import { CalendarRange } from "lucide-react";

import { serieLinhaDoTempo, type EntradaDiario } from "@/lib/diario-cliente";
import { formatarData } from "@/lib/raiz-format";

const TAMANHO = { 1: "h-2 w-2", 2: "h-3 w-3", 3: "h-4 w-4" } as const;

/**
 * Linha do tempo das reflexões: um ponto por entrada, um traço por mês.
 * O tamanho do ponto mostra o quanto foi escrito; a cor, se é só sua ou
 * se acompanha o processo. Serve para ver o caminho, não para medir.
 */
export function LinhaDoTempoDiario({ entradas }: { entradas: EntradaDiario[] }) {
  const faixas = serieLinhaDoTempo(entradas);
  if (faixas.length === 0) return null;

  return (
    <section aria-labelledby="titulo-linha-tempo" className="mt-7 rounded-[2rem] bg-card p-6 shadow-organico">
      <h2
        id="titulo-linha-tempo"
        className="inline-flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia"
      >
        <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" /> Sua linha do tempo
      </h2>

      <ul className="mt-5 list-none space-y-5 p-0">
        {faixas.slice(0, 8).map((faixa) => (
          <li key={faixa.chave}>
            <p className="text-xs text-muted-foreground">{faixa.rotulo}</p>
            <ul className="mt-2 flex list-none flex-wrap items-center gap-2 p-0">
              {faixa.pontos.map((ponto) => (
                <li key={ponto.id}>
                  <span
                    title={`${formatarData(ponto.data)}${ponto.eixoNome ? ` · ${ponto.eixoNome}` : ""}`}
                    className={`block rounded-full ${TAMANHO[ponto.peso]} ${
                      ponto.compartilhada ? "bg-salvia" : "bg-ocre"
                    }`}
                  >
                    <span className="sr-only">
                      Dia {ponto.dia}
                      {ponto.eixoNome ? `, eixo ${ponto.eixoNome}` : ""},{" "}
                      {ponto.compartilhada ? "compartilhada" : "só sua"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <p className="mt-5 flex flex-wrap items-center gap-4 text-[0.7rem] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-ocre" /> só sua
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-salvia" /> compartilhada
        </span>
        <span>pontos maiores, textos mais longos</span>
      </p>
    </section>
  );
}
