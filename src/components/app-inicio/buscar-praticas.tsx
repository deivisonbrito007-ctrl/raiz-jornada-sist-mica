import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Circle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatarDuracao, TIPO_LABEL } from "@/lib/raiz-format";
import { useValorAtrasado } from "@/hooks/use-valor-atrasado";
import type { PraticaBase } from "@/lib/inicio-cliente";

type EixoOpcao = { id: string; nome: string };

/**
 * Busca por prática: fica recolhida por padrão, para a tela abrir com o convite
 * do dia e não com um catálogo de filtros.
 */
export function BuscarPraticas({
  praticas,
  eixos,
}: {
  praticas: PraticaBase[];
  eixos: EixoOpcao[];
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [eixoFiltro, setEixoFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");

  const termo = useValorAtrasado(busca.trim().toLowerCase(), 300);
  const filtrando =
    termo !== "" || tipoFiltro !== "todos" || statusFiltro !== "todos" || eixoFiltro !== "todos";

  const visiveis = useMemo(
    () =>
      praticas.filter((p) => {
        if (eixoFiltro !== "todos" && p.eixoId !== eixoFiltro) return false;
        if (tipoFiltro !== "todos" && p.tipo !== tipoFiltro) return false;
        if (statusFiltro === "concluido" && p.status !== "concluido") return false;
        if (statusFiltro === "pendente" && p.status === "concluido") return false;
        if (termo && !`${p.titulo} ${p.eixoNome}`.toLowerCase().includes(termo)) return false;
        return true;
      }),
    [praticas, eixoFiltro, tipoFiltro, statusFiltro, termo],
  );

  return (
    <section className="mt-10 rounded-3xl border border-border p-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls="painel-buscar-praticas"
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-secondary"
      >
        <span className="flex items-center gap-3">
          <Search className="h-4 w-4 text-salvia" aria-hidden="true" />
          <span className="text-sm font-medium text-floresta">Buscar uma prática</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {aberto && (
        <div id="painel-buscar-praticas" className="space-y-3 p-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="campo-busca-biblioteca" className="sr-only">
              Buscar eixo ou prática
            </label>
            <Input
              id="campo-busca-biblioteca"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar eixo ou prática"
              className="min-h-11 rounded-full pl-11"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={eixoFiltro} onValueChange={setEixoFiltro}>
              <SelectTrigger aria-label="Filtrar por eixo" className="min-h-11 rounded-full">
                <SelectValue placeholder="Eixo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os eixos</SelectItem>
                {eixos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger aria-label="Filtrar por tipo" className="min-h-11 rounded-full">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {Object.entries(TIPO_LABEL).map(([valor, label]) => (
                  <SelectItem key={valor} value={valor}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger aria-label="Filtrar por status" className="min-h-11 rounded-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">A fazer</SelectItem>
                <SelectItem value="concluido">Concluídas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtrando && (
            <button
              type="button"
              onClick={() => {
                setBusca("");
                setEixoFiltro("todos");
                setTipoFiltro("todos");
                setStatusFiltro("todos");
              }}
              className="text-xs font-medium text-terracota underline"
            >
              Limpar filtros
            </button>
          )}

          <ul className="space-y-2">
            {visiveis.map((pratica) => (
              <li key={pratica.id}>
                <Link
                  to="/app/conteudo/$conteudoId"
                  params={{ conteudoId: pratica.id }}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-organico"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-floresta">
                      {pratica.titulo}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {pratica.eixoNome} · {TIPO_LABEL[pratica.tipo] ?? pratica.tipo}
                      {pratica.duracaoSegundos
                        ? ` · ${formatarDuracao(pratica.duracaoSegundos)}`
                        : ""}
                    </span>
                  </span>
                  {pratica.status === "concluido" ? (
                    <Check className="h-4 w-4 shrink-0 text-salvia" aria-label="Concluída" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="A fazer" />
                  )}
                </Link>
              </li>
            ))}
            {visiveis.length === 0 && (
              <li className="rounded-2xl bg-secondary/50 p-6 text-center text-sm text-muted-foreground">
                Nenhuma prática encontrada com esses filtros.
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
