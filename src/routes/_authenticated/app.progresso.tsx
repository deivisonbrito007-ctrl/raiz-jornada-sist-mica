import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Flame, Sprout, Target, Check, Minus, Plus, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getMinhaBiblioteca,
  getMeuContexto,
  definirMetaSemanal,
  listarDiario,
} from "@/lib/raiz.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { gerarRelatorioPdf } from "@/lib/raiz-relatorio";
import { LembreteRetorno } from "@/components/lembrete-retorno";
import {
  calcularStreak,
  linhaDoTempoSemanal,
  mapaCalorDiario,
  avaliarMetaSemanal,
  DIAS_SEMANA_CURTO,
  avaliarLembrete,
  formatarDuracao,
  TIPO_LABEL,
} from "@/lib/raiz-format";


export const Route = createFileRoute("/_authenticated/app/progresso")({
  component: Progresso,
});

function Progresso() {
  const fetchBiblioteca = useServerFn(getMinhaBiblioteca);
  const fetchContexto = useServerFn(getMeuContexto);
  const salvarMeta = useServerFn(definirMetaSemanal);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["biblioteca"],
    queryFn: () => fetchBiblioteca(),
  });
  const { data: contexto } = useQuery({ queryKey: ["contexto"], queryFn: () => fetchContexto() });

  const mutarMeta = useMutation({
    mutationFn: (meta: number) => salvarMeta({ data: { meta } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contexto"] }),
  });

  const eixos = (data?.eixos ?? []).filter((e) => e.liberado);
  const total = eixos.reduce((soma, e) => soma + e.total, 0);
  const feitos = eixos.reduce((soma, e) => soma + e.concluidos, 0);
  const percentual = total ? Math.round((feitos / total) * 100) : 0;

  const datasConclusao = data?.resumo.datasConclusao ?? [];
  const streak = calcularStreak(datasConclusao);
  const semanas = linhaDoTempoSemanal(datasConclusao, 8);
  const maximoSemana = Math.max(1, ...semanas.map((s) => s.total));
  const colunas = mapaCalorDiario(datasConclusao, 12, data?.resumo.conclusoes ?? []);
  const metaAtual = contexto?.perfil?.meta_semanal ?? 3;
  const meta = avaliarMetaSemanal(datasConclusao, mutarMeta.variables ?? metaAtual);
  const sequenciasPorEixo = eixos
    .map((eixo) => ({
      id: eixo.id,
      nome: eixo.nome,
      streak: calcularStreak(eixo.datasConclusao ?? []),
      concluidos: eixo.concluidos,
    }))
    .sort((a, b) => b.streak - a.streak || b.concluidos - a.concluidos);
  const maiorStreakEixo = sequenciasPorEixo[0];
  const maximoStreak = Math.max(1, ...sequenciasPorEixo.map((e) => e.streak));
  const niveis = ["bg-secondary", "bg-salvia/25", "bg-salvia/50", "bg-salvia/75", "bg-floresta"];
  const anelMeta = 2 * Math.PI * 34;
  const proximaPratica = (data?.praticas ?? []).find((p) => p.status !== "concluido") ?? null;
  const lembrete = avaliarLembrete(datasConclusao, streak);

  const fetchDiario = useServerFn(listarDiario);
  const [gerando, setGerando] = useState(false);

  const baixarRelatorio = async () => {
    setGerando(true);
    try {
      const diario = await fetchDiario();
      gerarRelatorioPdf({
        nome: contexto?.perfil?.nome ?? "",
        email: contexto?.perfil?.email ?? "",
        metaSemanal: metaAtual,
        eixos: data?.eixos ?? [],
        datasConclusao,
        diario: diario ?? [],
      });
      toast.success("Relatório gerado. Verifique seus downloads.");
    } catch {
      toast.error("Não foi possível gerar o relatório agora.");
    } finally {
      setGerando(false);
    }
  };




  return (
    <div>
      <h1 className="text-3xl text-floresta">Seu caminho</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Progresso não é pressa. É o que você já foi capaz de olhar.
      </p>

      <button
        type="button"
        onClick={baixarRelatorio}
        disabled={gerando || isLoading}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-floresta px-5 py-3 text-sm text-floresta-foreground transition hover:bg-floresta/90 disabled:opacity-60"
      >
        {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {gerando ? "Gerando relatório..." : "Baixar relatório em PDF"}
      </button>
      <p className="mt-2 text-xs text-muted-foreground">
        Inclui seu progresso por eixo e suas entradas do diário, para compartilhar com quem acompanha você.
      </p>


      {isLoading && <Skeleton className="mt-7 h-40 rounded-3xl" />}

      <div className="mt-7 rounded-3xl bg-floresta p-7 text-floresta-foreground">
        <p className="text-sm text-floresta-foreground/70">Práticas concluídas</p>
        <p className="mt-1 font-display text-5xl">
          {feitos}
          <span className="text-2xl text-floresta-foreground/50">/{total}</span>
        </p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-floresta-foreground/20">
          <div className="h-full rounded-full bg-ocre" style={{ width: `${percentual}%` }} />
        </div>
        <p className="mt-3 text-xs text-floresta-foreground/60">
          {percentual}% do que está liberado para você neste momento.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-4 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <span className="rounded-2xl bg-terracota/10 p-3 text-terracota">
          <Flame className="h-6 w-6" />
        </span>
        <div>
          <p className="font-display text-3xl text-floresta">
            {streak} <span className="text-base">semana{streak === 1 ? "" : "s"}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {streak === 0
              ? "Sua sequência começa na primeira prática concluída desta semana."
              : "Sequência de semanas seguidas com pelo menos uma prática concluída."}
          </p>
        </div>
      </div>

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

      <section className="mt-4 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" strokeWidth="8" className="stroke-secondary" />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className={meta.alcancada ? "stroke-ocre" : "stroke-salvia"}
                strokeDasharray={anelMeta}
                strokeDashoffset={anelMeta * (1 - meta.percentual / 100)}
                style={{ transition: "stroke-dashoffset 500ms ease" }}
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              {meta.alcancada ? (
                <Check className="h-6 w-6 text-ocre" />
              ) : (
                <span className="font-display text-xl text-floresta">{meta.percentual}%</span>
              )}
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg text-floresta">
              <Target className="h-4 w-4 text-salvia" />
              Meta desta semana
            </h2>
            <p className="mt-1 font-display text-2xl text-floresta">
              {meta.concluidasSemana}
              <span className="text-base text-muted-foreground">/{meta.meta} práticas</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{meta.mensagem}</p>
            <p className="mt-2 text-xs text-salvia">
              {meta.tendencia === "acima"
                ? `Acima da semana passada (${meta.concluidasSemanaAnterior}).`
                : meta.tendencia === "igual"
                  ? `No mesmo ritmo da semana passada (${meta.concluidasSemanaAnterior}).`
                  : `Semana passada você concluiu ${meta.concluidasSemanaAnterior}.`}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3">
          <span className="text-xs text-muted-foreground">Ajustar minha meta semanal</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Diminuir meta"
              disabled={meta.meta <= 1 || mutarMeta.isPending}
              onClick={() => mutarMeta.mutate(meta.meta - 1)}
              className="rounded-full bg-card p-2 text-floresta shadow-sm disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center font-display text-lg text-floresta">{meta.meta}</span>
            <button
              type="button"
              aria-label="Aumentar meta"
              disabled={meta.meta >= 14 || mutarMeta.isPending}
              onClick={() => mutarMeta.mutate(meta.meta + 1)}
              className="rounded-full bg-card p-2 text-floresta shadow-sm disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>


      <section className="mt-4 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <h2 className="text-lg text-floresta">Linha do tempo semanal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Últimas 8 semanas — cada barra mostra quantas práticas você concluiu.
        </p>
        <div className="mt-6 flex items-end justify-between gap-2">
          {semanas.map((semana) => (
            <div key={semana.inicio} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] font-medium text-salvia">{semana.total || ""}</span>
              <div className="flex h-24 w-full items-end">
                <div
                  className={`w-full rounded-t-xl transition-all ${
                    semana.ativa ? "bg-salvia" : "bg-secondary"
                  } ${semana.atual ? "ring-2 ring-terracota/50" : ""}`}
                  style={{
                    height: semana.total ? `${(semana.total / maximoSemana) * 100}%` : "6px",
                  }}
                />
              </div>
              <span
                className={`text-[10px] ${semana.atual ? "font-semibold text-terracota" : "text-muted-foreground"}`}
              >
                {semana.label}
              </span>
            </div>
          ))}
        </div>
      </section>


      <section className="mt-4 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <h2 className="text-lg text-floresta">Sequência por eixo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {maiorStreakEixo && maiorStreakEixo.streak > 0
            ? `Hoje, ${maiorStreakEixo.nome} é o tema em que você mantém mais consistência.`
            : "Conclua uma prática nesta semana para começar a sequência de cada eixo."}
        </p>
        <div className="mt-6 space-y-4">
          {sequenciasPorEixo.map((eixo) => (
            <div key={eixo.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-floresta">
                  {eixo.id === maiorStreakEixo?.id && maiorStreakEixo.streak > 0 && (
                    <Sprout className="h-4 w-4 text-terracota" />
                  )}
                  {eixo.nome}
                </span>
                <span className="shrink-0 text-xs text-salvia">
                  {eixo.streak} sem{eixo.streak === 1 ? "ana" : "anas"}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full ${
                    eixo.id === maiorStreakEixo?.id && eixo.streak > 0 ? "bg-terracota" : "bg-salvia"
                  }`}
                  style={{ width: `${eixo.streak ? (eixo.streak / maximoStreak) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
          {!isLoading && sequenciasPorEixo.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum eixo liberado ainda para calcular sequências.
            </p>
          )}
        </div>
      </section>


      <section className="mt-4 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <h2 className="text-lg text-floresta">Calendário de prática</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Últimas 12 semanas — cada quadrado é um dia. Quanto mais escuro, mais práticas concluídas.
        </p>
        <div className="mt-6 overflow-x-auto">
          <div className="flex gap-2">
            <div className="flex flex-col gap-1 pt-4">
              {DIAS_SEMANA_CURTO.map((dia, indice) => (
                <span
                  key={indice}
                  className="flex h-4 items-center text-[9px] leading-none text-muted-foreground"
                >
                  {dia}
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              {colunas.map((coluna) => (
                <div key={coluna.inicio} className="flex flex-col gap-1">
                  <span className="h-4 text-[9px] leading-4 text-muted-foreground">
                    {coluna.labelMes}
                  </span>
                  {coluna.dias.map((dia) => {
                    const classes = `h-4 w-4 rounded-[5px] ${
                      dia.futuro ? "bg-secondary/40" : niveis[dia.nivel]
                    } ${dia.hoje ? "ring-2 ring-terracota/60" : ""}`;
                    if (dia.futuro || dia.total === 0) {
                      return (
                        <span
                          key={dia.data}
                          title={dia.futuro ? dia.label : `${dia.label} — nenhuma prática`}
                          className={classes}
                        />
                      );
                    }
                    return (
                      <Popover key={dia.data}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label={`${dia.label} — ${dia.total} prática${dia.total === 1 ? "" : "s"}`}
                            className={`${classes} transition hover:ring-2 hover:ring-floresta/40`}
                          />
                        </PopoverTrigger>
                        <PopoverContent align="center" className="w-64 rounded-2xl p-4">
                          <p className="text-sm text-floresta">{dia.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {dia.total} prática{dia.total === 1 ? "" : "s"}
                            {dia.totalSegundos > 0
                              ? ` · ${formatarDuracao(dia.totalSegundos)} registrados`
                              : ""}
                          </p>
                          <ul className="mt-3 space-y-2">
                            {dia.itens.map((item, indice) => (
                              <li key={`${item.titulo}-${indice}`} className="text-xs">
                                <span className="text-foreground">{item.titulo}</span>
                                <span className="block text-muted-foreground">
                                  {item.eixoNome}
                                  {item.eixoNome && " · "}
                                  {TIPO_LABEL[item.tipo] ?? item.tipo}
                                  {item.duracaoSegundos
                                    ? ` · ${formatarDuracao(item.duracaoSegundos)}`
                                    : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {lembrete.diasSemPratica === null
              ? "Nenhum dia marcado ainda."
              : lembrete.diasSemPratica === 0
                ? "Hoje já está marcado no mapa."
                : `${lembrete.diasSemPratica} dia${lembrete.diasSemPratica === 1 ? "" : "s"} desde o último quadrado preenchido.`}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">menos</span>
            {niveis.map((classe) => (
              <span key={classe} className={`h-3 w-3 rounded-[4px] ${classe}`} />
            ))}
            <span className="text-[10px] text-muted-foreground">mais</span>
          </span>
        </div>

      </section>


      <div className="mt-8 space-y-3">
        {eixos.map((eixo) => (
          <div key={eixo.id} className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg text-floresta">{eixo.nome}</h2>
              <span className="shrink-0 text-xs text-salvia">
                {eixo.concluidos}/{eixo.total}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-salvia"
                style={{ width: `${eixo.total ? (eixo.concluidos / eixo.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
        {!isLoading && eixos.length === 0 && (
          <p className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nenhum eixo liberado ainda. Fale com quem acompanha o seu processo.
          </p>
        )}
      </div>
    </div>
  );
}
