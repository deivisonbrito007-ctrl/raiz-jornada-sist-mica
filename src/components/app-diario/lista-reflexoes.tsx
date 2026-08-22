import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { CartaoReflexao } from "@/components/app-diario/cartao-reflexao";
import {
  FILTROS_DIARIO,
  FILTRO_DIARIO_LABEL,
  agruparPorMes,
  filtrarEntradas,
  type EntradaDiario,
  type FiltroDiario,
  type Visibilidade,
} from "@/lib/diario-cliente";

/**
 * As reflexões como caminho, e não como lista: agrupadas por mês, com busca e
 * um filtro simples entre o que é só seu e o que acompanha o processo.
 */
export function ListaReflexoes({
  entradas,
  busca,
  filtro,
  eixoId = null,
  eixos = [],
  podeCompartilhar,
  ocupado,
  onBusca,
  onFiltro,
  onEixo,
  onEditar,
  onApagar,
  onVisibilidade,
}: {
  entradas: EntradaDiario[];
  busca: string;
  filtro: FiltroDiario;
  eixoId?: string | null;
  eixos?: Array<{ id: string; nome: string }>;
  podeCompartilhar: boolean;
  ocupado: boolean;
  onBusca: (valor: string) => void;
  onFiltro: (valor: FiltroDiario) => void;
  onEixo?: (valor: string | null) => void;
  onEditar: (id: string, texto: string) => Promise<void> | void;
  onApagar: (id: string) => Promise<void> | void;
  onVisibilidade: (id: string, visibilidade: Visibilidade) => Promise<void> | void;
}) {
  const filtradas = filtrarEntradas(entradas, { busca, filtro, eixoId });
  const grupos = agruparPorMes(filtradas);
  const opcoes = podeCompartilhar
    ? FILTROS_DIARIO
    : FILTROS_DIARIO.filter((f) => f !== "compartilhadas" && f !== "privadas");

  return (
    <section aria-labelledby="titulo-entradas" className="mt-10">
      <h2 id="titulo-entradas" className="font-display text-2xl text-floresta">
        O caminho das suas palavras
      </h2>

      <div className="mt-4 flex flex-col gap-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="busca-reflexoes" className="sr-only">
            Buscar nas suas reflexões
          </label>
          <Input
            id="busca-reflexoes"
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Buscar uma palavra, prática ou eixo"
            className="min-h-12 rounded-full border-border bg-card pl-11"
          />
        </div>

        <div role="group" aria-label="Filtrar reflexões" className="flex flex-wrap gap-2">
          {opcoes.map((opcao) => (
            <button
              key={opcao}
              type="button"
              aria-pressed={filtro === opcao}
              onClick={() => onFiltro(opcao)}
              className={`min-h-10 rounded-full px-4 text-sm transition ${
                filtro === opcao
                  ? "bg-floresta text-floresta-foreground"
                  : "bg-secondary text-foreground hover:bg-secondary/70"
              }`}
            >
              {FILTRO_DIARIO_LABEL[opcao]}
            </button>
          ))}
        </div>

        {eixos.length > 0 && onEixo && (
          <div role="group" aria-label="Filtrar por eixo" className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={eixoId === null}
              onClick={() => onEixo(null)}
              className={`min-h-10 rounded-full px-4 text-sm transition ${
                eixoId === null
                  ? "bg-salvia text-floresta-foreground"
                  : "bg-secondary/60 text-foreground hover:bg-secondary"
              }`}
            >
              Todos os eixos
            </button>
            {eixos.map((eixo) => (
              <button
                key={eixo.id}
                type="button"
                aria-pressed={eixoId === eixo.id}
                onClick={() => onEixo(eixo.id)}
                className={`min-h-10 rounded-full px-4 text-sm transition ${
                  eixoId === eixo.id
                    ? "bg-salvia text-floresta-foreground"
                    : "bg-secondary/60 text-foreground hover:bg-secondary"
                }`}
              >
                {eixo.nome}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtradas.length === 0 ? (
        <p className="mt-6 rounded-[1.75rem] border border-dashed border-border p-6 text-sm leading-relaxed text-muted-foreground">
          {entradas.length === 0
            ? "Suas reflexões aparecerão aqui, uma a uma, como marcas no caminho."
            : "Nenhuma reflexão encontrada com esse recorte. Tente outra palavra ou volte para “Todas”."}
        </p>
      ) : (
        <div className="mt-6 space-y-9">
          {grupos.map((grupo) => (
            <section key={grupo.chave} aria-label={grupo.rotulo}>
              <h3 className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia">
                {grupo.rotulo}
              </h3>
              <ul className="mt-4 list-none space-y-4 p-0 sm:ml-6 sm:border-l sm:border-dashed sm:border-salvia/30 sm:pl-6">
                {grupo.entradas.map((entrada) => (
                  <li key={entrada.id} className="relative">
                    <CartaoReflexao
                      entrada={entrada}
                      podeCompartilhar={podeCompartilhar}
                      ocupado={ocupado}
                      onEditar={onEditar}
                      onApagar={onApagar}
                      onVisibilidade={onVisibilidade}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
