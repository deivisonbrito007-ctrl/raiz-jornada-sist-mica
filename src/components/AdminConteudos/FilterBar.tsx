import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTEUDO_STATUS_LABEL, NIVEL_LABEL, TIPO_LABEL } from "@/lib/raiz-format";
import { cn } from "@/lib/utils";
import type { EixoAdmin } from "@/hooks/useConteudos";

export type FiltrosConteudos = {
  busca: string;
  eixo: string;
  tipo: string;
  /** Situação da mídia (com/sem arquivo, com capa). */
  status: string;
  /** Situação editorial: rascunho, em revisão, publicado, arquivado. */
  situacao: string;
  nivel: string;
};

export const FILTROS_VAZIOS: FiltrosConteudos = {
  busca: "",
  eixo: "todos",
  tipo: "todos",
  status: "todos",
  situacao: "todos",
  nivel: "todos",
};

type Props = {
  filtros: FiltrosConteudos;
  eixos: EixoAdmin[];
  onChange: (filtros: FiltrosConteudos) => void;
  quantidade: number;
};

const gatilhoBase =
  "min-h-11 rounded-full bg-papel focus-visible:ring-2 focus-visible:ring-terracota";
const gatilhoAtivo = "bg-ouro/15 border-ouro";

function Ativo() {
  return (
    <span className="ml-2 rounded-full bg-ouro/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-floresta">
      Ativo
    </span>
  );
}

export function temFiltroAtivo(filtros: FiltrosConteudos) {
  return (
    filtros.busca.trim() !== "" ||
    filtros.eixo !== "todos" ||
    filtros.tipo !== "todos" ||
    filtros.status !== "todos" ||
    (filtros.situacao ?? "todos") !== "todos" ||
    (filtros.nivel ?? "todos") !== "todos"
  );
}

/** Busca + filtros por eixo, tipo e status, com destaque de filtro ativo. */
export function FilterBar({ filtros, eixos, onChange, quantidade }: Props) {
  const ativo = temFiltroAtivo(filtros);

  return (
    <div className="space-y-3 rounded-3xl bg-papel p-4 shadow-organico">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={filtros.busca}
          onChange={(e) => onChange({ ...filtros, busca: e.target.value })}
          placeholder="Buscar prática por título ou descrição"
          aria-label="Buscar prática por título ou descrição"
          className={cn(
            "min-h-11 rounded-full pl-11 focus-visible:ring-2 focus-visible:ring-terracota",
            filtros.busca.trim() !== "" && "border-ouro bg-ouro/10",
          )}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Select
          value={filtros.situacao ?? "todos"}
          onValueChange={(v) => onChange({ ...filtros, situacao: v })}
        >
          <SelectTrigger
            aria-label="Filtrar por situação"
            className={cn(gatilhoBase, (filtros.situacao ?? "todos") !== "todos" && gatilhoAtivo)}
          >
            <span className="flex min-w-0 items-center">
              <SelectValue placeholder="Situação" />
              {(filtros.situacao ?? "todos") !== "todos" && <Ativo />}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            {Object.entries(CONTEUDO_STATUS_LABEL).map(([valor, label]) => (
              <SelectItem key={valor} value={valor}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.nivel ?? "todos"}
          onValueChange={(v) => onChange({ ...filtros, nivel: v })}
        >
          <SelectTrigger
            aria-label="Filtrar por profundidade"
            className={cn(gatilhoBase, (filtros.nivel ?? "todos") !== "todos" && gatilhoAtivo)}
          >
            <span className="flex min-w-0 items-center">
              <SelectValue placeholder="Profundidade" />
              {(filtros.nivel ?? "todos") !== "todos" && <Ativo />}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as profundidades</SelectItem>
            {Object.entries(NIVEL_LABEL).map(([valor, label]) => (
              <SelectItem key={valor} value={valor}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtros.eixo} onValueChange={(v) => onChange({ ...filtros, eixo: v })}>
          <SelectTrigger
            aria-label="Filtrar por eixo"
            className={cn(gatilhoBase, filtros.eixo !== "todos" && gatilhoAtivo)}
          >
            <span className="flex min-w-0 items-center">
              <SelectValue placeholder="Eixo" />
              {filtros.eixo !== "todos" && <Ativo />}
            </span>
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

        <Select value={filtros.tipo} onValueChange={(v) => onChange({ ...filtros, tipo: v })}>
          <SelectTrigger
            aria-label="Filtrar por tipo"
            className={cn(gatilhoBase, filtros.tipo !== "todos" && gatilhoAtivo)}
          >
            <span className="flex min-w-0 items-center">
              <SelectValue placeholder="Tipo" />
              {filtros.tipo !== "todos" && <Ativo />}
            </span>
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

        <Select value={filtros.status} onValueChange={(v) => onChange({ ...filtros, status: v })}>
          <SelectTrigger
            aria-label="Filtrar por status da mídia"
            className={cn(gatilhoBase, filtros.status !== "todos" && gatilhoAtivo)}
          >
            <span className="flex min-w-0 items-center">
              <SelectValue placeholder="Status" />
              {filtros.status !== "todos" && <Ativo />}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="com_midia">Com mídia enviada</SelectItem>
            <SelectItem value="sem_midia">Sem mídia</SelectItem>
            <SelectItem value="com_capa">Com capa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {quantidade} prática(s) encontrada(s)
        </p>
        {ativo && (
          <button
            type="button"
            onClick={() => onChange(FILTROS_VAZIOS)}
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-xs font-medium text-terracota underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
