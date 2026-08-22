import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { UserPlus, ClipboardList, RefreshCw } from "lucide-react";

import { adminInicio } from "@/lib/inicio.functions";
import { CHAVES } from "@/lib/cache-chaves";
import {
  dataExtensa,
  montarAgenda,
  montarLinhaDoTempo,
  montarPrioridades,
  montarResumo,
} from "@/lib/inicio-painel";
import { useMeuContexto } from "@/hooks/use-meu-contexto";
import { useMinhasPermissoes } from "@/hooks/use-minhas-permissoes";
import { Skeleton } from "@/components/ui/skeleton";
import { SecaoSemPermissao } from "@/components/permissao-ui";
import { CartoesResumo } from "@/components/painel/inicio/cartao-resumo";
import { ListaPrioridades } from "@/components/painel/inicio/lista-prioridades";
import { AgendaRevisoes } from "@/components/painel/inicio/agenda-revisoes";
import { LinhaDoTempo } from "@/components/painel/inicio/linha-do-tempo";
import { AcoesRapidas } from "@/components/painel/inicio/acoes-rapidas";

export const Route = createFileRoute("/_authenticated/admin/inicio")({
  component: AdminInicio,
});

function AdminInicio() {
  const { pode, carregando: carregandoPermissoes } = useMinhasPermissoes();
  const { data: contexto } = useMeuContexto();
  const podeVerClientes = pode("ver_clientes");
  const fetchInicio = useServerFn(adminInicio);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: CHAVES.adminInicio,
    queryFn: () => fetchInicio(),
    enabled: podeVerClientes,
  });

  const derivado = useMemo(() => {
    if (!data) return null;
    const agora = new Date();
    return {
      resumo: montarResumo(data, agora),
      prioridades: montarPrioridades(data, agora),
      agenda: montarAgenda(data, agora),
      linhaDoTempo: montarLinhaDoTempo(data, agora),
    };
  }, [data]);

  const primeiroNome = (contexto?.perfil?.nome ?? "").trim().split(" ")[0];

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-salvia">{dataExtensa()}</p>
          <h1 className="mt-1 font-display text-3xl text-floresta">
            {primeiroNome ? `Olá, ${primeiroNome}` : "Olá"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Aqui está o que precisa da sua atenção hoje.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {podeVerClientes && (
            <Link
              to="/admin/clientes"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-floresta px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Adicionar cliente
            </Link>
          )}
          {pode("criar_planos") && (
            <Link
              to="/admin/clientes"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-card px-5 text-sm font-medium text-floresta shadow-[var(--shadow-organico)] hover:bg-card/80"
            >
              <ClipboardList className="size-4" aria-hidden="true" />
              Criar plano de acompanhamento
            </Link>
          )}
        </div>
      </header>

      {!carregandoPermissoes && !podeVerClientes && (
        <SecaoSemPermissao
          permissao="ver_clientes"
          titulo="Indicadores de clientes restritos"
        />
      )}

      {podeVerClientes && isError && (
        <div
          role="alert"
          className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground"
        >
          <p className="font-medium text-foreground">Não conseguimos carregar o panorama agora</p>
          <p className="mt-1">
            Pode ter sido uma falha de conexão. Seus dados estão salvos — tente novamente em
            instantes.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-card px-5 text-sm font-medium text-floresta shadow-[var(--shadow-organico)]"
          >
            <RefreshCw className={`size-4 ${isRefetching ? "animate-spin" : ""}`} aria-hidden="true" />
            Tentar de novo
          </button>
        </div>
      )}

      {podeVerClientes && isLoading && (
        <div className="space-y-8" aria-hidden="true">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[6.5rem] rounded-3xl" />
            ))}
          </div>
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      )}

      {podeVerClientes && isLoading && (
        <p role="status" className="sr-only">
          Carregando o panorama do acompanhamento.
        </p>
      )}

      {podeVerClientes && derivado && (
        <>
          <section aria-labelledby="titulo-resumo">
            <h2 id="titulo-resumo" className="font-display text-xl text-floresta">
              Resumo
            </h2>
            <div className="mt-3">
              <CartoesResumo cartoes={derivado.resumo} />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section
              aria-labelledby="titulo-prioridades"
              className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]"
            >
              <h2 id="titulo-prioridades" className="font-display text-xl text-floresta">
                Prioridades do dia
              </h2>
              <div className="mt-3">
                <ListaPrioridades itens={derivado.prioridades.slice(0, 8)} />
              </div>
            </section>

            <section
              aria-labelledby="titulo-atividade"
              className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]"
            >
              <h2 id="titulo-atividade" className="font-display text-xl text-floresta">
                Atividade recente
              </h2>
              <div className="mt-4">
                <LinhaDoTempo eventos={derivado.linhaDoTempo} />
              </div>
            </section>
          </div>

          <section
            aria-labelledby="titulo-agenda"
            className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]"
          >
            <h2 id="titulo-agenda" className="font-display text-xl text-floresta">
              Agenda de revisões
            </h2>
            <div className="mt-3">
              <AgendaRevisoes itens={derivado.agenda} />
            </div>
          </section>
        </>
      )}

      <section aria-labelledby="titulo-acoes">
        <h2 id="titulo-acoes" className="font-display text-xl text-floresta">
          Ações rápidas
        </h2>
        <div className="mt-3">
          <AcoesRapidas pode={pode} />
        </div>
      </section>
    </div>
  );
}
