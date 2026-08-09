import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Search, Check, Circle } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconeEixo as Icone } from "@/components/icone-eixo";
import { getMeuContexto, getMinhaBiblioteca } from "@/lib/raiz.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { calcularStreak, formatarData, formatarDuracao, TIPO_LABEL } from "@/lib/raiz-format";
import { LembreteRetorno } from "@/components/lembrete-retorno";
import { ContinuarDeOndeParei } from "@/components/continuar-de-onde-parei";
import { useSincronizarLiberacoes } from "@/hooks/use-sincronizar-liberacoes";
import { useValorAtrasado } from "@/hooks/use-valor-atrasado";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Biblioteca,
});


function Biblioteca() {
  useSincronizarLiberacoes();
  const fetchBiblioteca = useServerFn(getMinhaBiblioteca);
  const fetchContexto = useServerFn(getMeuContexto);
  const { data: contexto } = useQuery({ queryKey: ["contexto"], queryFn: () => fetchContexto() });
  const { data, isLoading } = useQuery({
    queryKey: ["biblioteca"],
    queryFn: () => fetchBiblioteca(),
  });

  const primeiroNome = (contexto?.perfil?.nome || "").split(" ")[0];

  const [busca, setBusca] = useState("");
  const [eixoFiltro, setEixoFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");

  const termo = useValorAtrasado(busca.trim().toLowerCase(), 300);
  const filtrando =
    termo !== "" || tipoFiltro !== "todos" || statusFiltro !== "todos" || eixoFiltro !== "todos";

  const eixosVisiveis = useMemo(
    () =>
      (data?.eixos ?? []).filter((e) => {
        if (eixoFiltro !== "todos" && e.id !== eixoFiltro) return false;
        if (termo && !`${e.nome} ${e.descricao}`.toLowerCase().includes(termo)) return false;
        return true;
      }),
    [data?.eixos, eixoFiltro, termo],
  );

  const praticasVisiveis = useMemo(
    () =>
      (data?.praticas ?? []).filter((p) => {
        if (eixoFiltro !== "todos" && p.eixoId !== eixoFiltro) return false;
        if (tipoFiltro !== "todos" && p.tipo !== tipoFiltro) return false;
        if (statusFiltro === "concluido" && p.status !== "concluido") return false;
        if (statusFiltro === "pendente" && p.status === "concluido") return false;
        if (termo && !`${p.titulo} ${p.eixoNome}`.toLowerCase().includes(termo)) return false;
        return true;
      }),
    [data?.praticas, eixoFiltro, tipoFiltro, statusFiltro, termo],
  );

  const datasConclusao = data?.resumo.datasConclusao ?? [];
  const streak = calcularStreak(datasConclusao);
  const proximaPratica = (data?.praticas ?? []).find((p) => p.status !== "concluido") ?? null;

  const mostrarPraticas = termo !== "" || tipoFiltro !== "todos" || statusFiltro !== "todos";

  const blocos = blocosDoModo(normalizarModo(contexto?.modo));

  return (
    <div>
      <p className="text-sm text-salvia">Que bom te ver por aqui</p>
      <h1 className="mt-1 text-3xl text-floresta">
        {primeiroNome ? `Olá, ${primeiroNome}` : "Sua jornada"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {blocos.vitrinePacotes
          ? "Você usa o Raiz no seu ritmo. Escolha um pacote para abrir as trilhas autoguiadas e siga por elas quando fizer sentido."
          : "Escolha um eixo para continuar. Os eixos ainda fechados mostram o caminho que vem a seguir."}
      </p>

      {blocos.vitrinePacotes && <VitrinePacotes />}

      {!isLoading && data?.retomar && <ContinuarDeOndeParei pratica={data.retomar} />}

      {!isLoading && (
        <LembreteRetorno
          datas={datasConclusao}
          streakSemanas={streak}
          sugestao={
            proximaPratica
              ? {
                  id: proximaPratica.id,
                  titulo: proximaPratica.titulo,
                  eixoNome: proximaPratica.eixoNome,
                }
              : null
          }
        />
      )}


      <div className="mt-6 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
              {(data?.eixos ?? []).map((e) => (
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
      </div>

      {isLoading && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      )}

      {mostrarPraticas ? (
        <div className="mt-8 space-y-2">
          {praticasVisiveis.map((pratica) => (
            <Link
              key={pratica.id}
              to="/app/conteudo/$conteudoId"
              params={{ conteudoId: pratica.id }}
              className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-organico)]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-floresta">{pratica.titulo}</p>
                <p className="text-[11px] text-muted-foreground">
                  {pratica.eixoNome} · {TIPO_LABEL[pratica.tipo] ?? pratica.tipo}
                  {pratica.duracaoSegundos ? ` · ${formatarDuracao(pratica.duracaoSegundos)}` : ""}
                </p>
              </div>
              {pratica.status === "concluido" ? (
                <Check className="h-4 w-4 shrink-0 text-salvia" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </Link>
          ))}
          {praticasVisiveis.length === 0 && !isLoading && (
            <p className="rounded-2xl bg-secondary/50 p-6 text-center text-sm text-muted-foreground">
              Nenhuma prática encontrada com esses filtros.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {eixosVisiveis.map((eixo) =>
            eixo.liberado ? (
              <Link
                key={eixo.id}
                to="/app/eixo/$eixoId"
                params={{ eixoId: eixo.id }}
                className="group rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)] transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between">
                  <span className="rounded-2xl bg-secondary p-3 text-floresta">
                    <Icone nome={eixo.icone} className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-medium text-salvia">
                    {eixo.concluidos}/{eixo.total} concluídos
                  </span>
                </div>
                <h2 className="mt-4 text-xl text-floresta">{eixo.nome}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{eixo.descricao}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-salvia transition-all"
                    style={{ width: `${eixo.total ? (eixo.concluidos / eixo.total) * 100 : 0}%` }}
                  />
                </div>
              </Link>
            ) : (
              <div
                key={eixo.id}
                className="rounded-3xl border border-dashed border-border bg-secondary/40 p-5"
              >
                <div className="flex items-start justify-between">
                  <span className="rounded-2xl bg-secondary p-3 text-muted-foreground">
                    <Icone nome={eixo.icone} className="h-5 w-5" />
                  </span>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <h2 className="mt-4 text-xl text-muted-foreground">{eixo.nome}</h2>
                <p className="mt-1 text-sm text-muted-foreground/80">
                  {eixo.abreEm
                    ? `Abre em ${formatarData(eixo.abreEm)}.`
                    : "Este eixo será liberado quando for o momento do seu processo."}
                </p>
              </div>
            ),
          )}
          {eixosVisiveis.length === 0 && !isLoading && (
            <p className="rounded-2xl bg-secondary/50 p-6 text-center text-sm text-muted-foreground sm:col-span-2">
              Nenhum eixo encontrado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
