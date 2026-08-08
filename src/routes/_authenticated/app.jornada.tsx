import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CalendarCheck, Lock, Users } from "lucide-react";

import { getMinhaJornada } from "@/lib/trilhas.functions";
import { ETAPA_LABEL, NIVEL_LABEL, type Nivel, type TipoEtapa } from "@/lib/etapas";
import { formatarData, formatarDuracao } from "@/lib/raiz-format";
import { PedirApoio } from "@/components/pedir-apoio";
import { ConsentimentoPrimeiroAcesso } from "@/components/consentimento-primeiro-acesso";

export const Route = createFileRoute("/_authenticated/app/jornada")({
  head: () => ({
    meta: [
      { title: "Minha jornada — Raiz" },
      {
        name: "description",
        content:
          "Suas trilhas atribuídas, o próximo passo sugerido e o espaço para pedir apoio entre as sessões.",
      },
      { property: "og:title", content: "Minha jornada — Raiz" },
      {
        property: "og:description",
        content: "Continuidade do acompanhamento entre sessões: trilhas, etapas e apoio.",
      },
    ],
  }),
  component: MinhaJornada;
});

function MinhaJornada() {
  const queryClient = useQueryClient();
  const carregar = useServerFn(getMinhaJornada);
  const { data, isLoading } = useQuery({ queryKey: ["minha-jornada"], queryFn: () => carregar() });

  if (isLoading) {
    return (
      <p role="status" aria-busy className="text-sm text-muted-foreground">
        Carregando sua jornada...
      </p>
    );
  }

  const consentimentos = data?.consentimentos ?? [];

  return (
    <div className="space-y-6">
      <ConsentimentoPrimeiroAcesso
        aceitos={consentimentos}
        aoAceitar={() => queryClient.invalidateQueries({ queryKey: ["minha-jornada"] })}
      />

      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-floresta">Minha jornada</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Um passo por vez, no seu ritmo. Nada aqui precisa ser feito às pressas.
          </p>
        </div>
        <div className="shrink-0">
          <PedirApoio
            prazoRespostaHoras={data?.prazoRespostaHoras ?? 48}
            contatos={data?.contatosEmergencia ?? []}
          />
        </div>
      </header>

      {(data?.trilhas ?? []).length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Nenhuma trilha atribuída ainda</p>
          <p className="mt-1">
            Quando sua terapeuta indicar um caminho, ele aparece aqui com o objetivo combinado.
          </p>
        </div>
      )}

      <ul className="space-y-5">
        {(data?.trilhas ?? []).map((t) => (
          <li
            key={t.atribuicaoId}
            className="rounded-3xl border border-border bg-card p-5 shadow-organico"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <h2 className="truncate font-display text-xl text-floresta">
                  {t.trilha?.nome ?? "Trilha"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {NIVEL_LABEL[t.nivel as Nivel]} · {t.frequencia} · desde{" "}
                  {formatarData(t.dataInicio)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-floresta">
                {t.concluidas}/{t.total} etapas
              </span>
            </div>

            <div
              className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-valuenow={t.percentual}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progresso da trilha ${t.trilha?.nome ?? ""}`}
            >
              <div className="h-full rounded-full bg-salvia" style={{ width: `${t.percentual}%` }} />
            </div>

            {t.objetivo && (
              <p className="mt-4 rounded-2xl bg-secondary p-4 text-sm text-foreground">
                <span className="font-medium">Objetivo combinado: </span>
                {t.objetivo}
              </p>
            )}
            {t.mensagem && (
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{t.mensagem}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {t.somenteEmSessao && (
                <span className="inline-flex items-center gap-1 rounded-full bg-terracota/10 px-3 py-1 text-terracota">
                  <Lock className="h-3.5 w-3.5" aria-hidden /> Somente em sessão
                </span>
              )}
              {t.exigeAcompanhamento && (
                <span className="inline-flex items-center gap-1 rounded-full bg-ocre/15 px-3 py-1 text-floresta">
                  <Users className="h-3.5 w-3.5" aria-hidden /> Com acompanhamento
                </span>
              )}
              {t.dataRevisao && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-muted-foreground">
                  <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> Revisão em{" "}
                  {formatarData(t.dataRevisao)}
                </span>
              )}
            </div>

            {t.orientacoesEspeciais && (
              <p className="mt-3 rounded-2xl border border-ocre/40 bg-ocre/10 p-4 text-sm text-foreground">
                {t.orientacoesEspeciais}
              </p>
            )}

            <ol className="mt-5 space-y-2">
              {t.etapas.map((e) => (
                <li key={e.id}>
                  <Link
                    to="/app/etapa/$conteudoId"
                    params={{ conteudoId: e.id }}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-secondary px-4 py-3 transition-colors hover:bg-secondary/70"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {e.ordem}. {e.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ETAPA_LABEL[(e.tipoEtapa ?? "pratica") as TipoEtapa]}
                        {e.duracaoSegundos ? ` · ${formatarDuracao(e.duracaoSegundos)}` : ""}
                        {e.obrigatoria ? " · obrigatória" : " · opcional"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                        e.status === "concluido"
                          ? "bg-salvia text-floresta-foreground"
                          : e.status === "em_andamento"
                            ? "bg-ocre/20 text-floresta"
                            : "bg-card text-muted-foreground"
                      }`}
                    >
                      {e.status === "concluido"
                        ? "Concluída"
                        : e.status === "em_andamento"
                          ? "Em andamento"
                          : "A fazer"}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>

            {t.proximaEtapaId && (
              <Link
                to="/app/etapa/$conteudoId"
                params={{ conteudoId: t.proximaEtapaId }}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-terracota px-5 py-2.5 text-sm font-medium text-terracota-foreground"
              >
                Continuar próxima etapa
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ul>

      {(data?.apoio ?? []).length > 0 && (
        <section
          aria-labelledby="titulo-apoio"
          className="rounded-3xl border border-border bg-card p-5"
        >
          <h2 id="titulo-apoio" className="font-display text-lg text-floresta">
            Seus pedidos de apoio
          </h2>
          <ul className="mt-3 space-y-2">
            {(data?.apoio ?? []).map((s) => (
              <li key={s.id} className="rounded-2xl bg-secondary p-4 text-sm">
                <p className="text-xs text-muted-foreground">
                  {formatarData(s.created_at)} ·{" "}
                  {s.status === "respondida" ? "respondido" : "aguardando retorno"}
                </p>
                <p className="mt-1 whitespace-pre-line text-foreground">{s.mensagem}</p>
                {s.resposta && (
                  <p className="mt-2 rounded-xl bg-card p-3 text-muted-foreground">{s.resposta}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
