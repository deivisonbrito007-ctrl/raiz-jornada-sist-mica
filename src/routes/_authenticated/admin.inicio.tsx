import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Flame } from "lucide-react";
import { adminResumo } from "@/lib/raiz.functions";
import { adminAcompanhamento } from "@/lib/trilhas.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { useMinhasPermissoes } from "@/hooks/use-minhas-permissoes";
import { GRUPOS_PAINEL } from "@/components/painel/navegacao";
import { calcularStreak, formatarData } from "@/lib/raiz-format";

export const Route = createFileRoute("/_authenticated/admin/inicio")({
  component: AdminInicio,
});

function AdminInicio() {
  const { pode, carregando } = useMinhasPermissoes();
  const podeVerClientes = pode("ver_clientes");
  const fetchResumo = useServerFn(adminResumo);
  const fetchAcompanhamento = useServerFn(adminAcompanhamento);

  const { data: resumo, isLoading } = useQuery({
    queryKey: ["admin-resumo"],
    queryFn: () => fetchResumo(),
    enabled: podeVerClientes,
  });
  const { data: acompanhamento } = useQuery({
    queryKey: ["admin-acompanhamento"],
    queryFn: () => fetchAcompanhamento(),
    enabled: podeVerClientes,
  });

  const metricas = [
    { label: "Clientes ativos", valor: resumo?.metricas.clientesAtivos ?? 0 },
    { label: "Trilhas em andamento", valor: resumo?.metricas.trilhasEmAndamento ?? 0 },
    { label: "Conclusão média", valor: `${resumo?.metricas.conclusaoMedia ?? 0}%` },
  ];

  const apoioPendente = (acompanhamento?.apoio ?? []).filter((a) => a.status !== "respondido");
  const nomePorId = new Map(
    (acompanhamento?.perfis ?? []).map((p) => [p.id, p.nome ?? p.email ?? "Cliente"]),
  );

  const recentes = [...(resumo?.clientes ?? [])]
    .filter((c) => c.ultimaAtividade)
    .sort((a, b) => String(b.ultimaAtividade).localeCompare(String(a.ultimaAtividade)))
    .slice(0, 5);

  const atalhos = GRUPOS_PAINEL.flatMap((g) => g.itens).filter(
    (i) => !i.externo && i.to !== "/admin/inicio" && (!i.permissao || pode(i.permissao)),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-floresta">Bom te ver por aqui</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Um panorama do acompanhamento antes de você entrar em cada área.
        </p>
      </div>

      {podeVerClientes && (
        <section aria-labelledby="titulo-metricas">
          <h2 id="titulo-metricas" className="sr-only">
            Métricas gerais
          </h2>
          {isLoading ? (
            <Skeleton className="h-28 rounded-3xl" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {metricas.map((m) => (
                <div
                  key={m.label}
                  className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]"
                >
                  <p className="text-xs uppercase tracking-wider text-salvia">{m.label}</p>
                  <p className="mt-2 font-display text-4xl text-floresta">{m.valor}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {podeVerClientes && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section
            aria-labelledby="titulo-apoio"
            className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]"
          >
            <h2 id="titulo-apoio" className="font-display text-xl text-floresta">
              Pedidos de apoio em aberto
            </h2>
            {apoioPendente.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhum pedido aguardando resposta.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {apoioPendente.slice(0, 5).map((a) => (
                  <li key={a.id} className="rounded-2xl bg-secondary p-3">
                    <p className="text-sm font-medium text-floresta">
                      {nomePorId.get(a.cliente_id) ?? "Cliente"}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{a.mensagem}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatarData(a.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/admin/acompanhamento"
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-salvia hover:text-floresta"
            >
              Ir para Monitoramento <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>

          <section
            aria-labelledby="titulo-recentes"
            className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]"
          >
            <h2 id="titulo-recentes" className="font-display text-xl text-floresta">
              Atividade recente
            </h2>
            {recentes.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Ainda não há práticas registradas.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recentes.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/admin/cliente/$clienteId"
                      params={{ clienteId: c.id }}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-secondary"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-floresta">
                          {c.nome ?? c.email}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {c.ultimaAtividade ? formatarData(c.ultimaAtividade) : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-terracota">
                        <Flame className="h-4 w-4" aria-hidden="true" />
                        <span className="font-display text-lg leading-none">
                          {calcularStreak(c.datasConclusao ?? [])}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {!carregando && !podeVerClientes && (
        <p className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Você ainda não tem permissão para ver dados de clientes. Abaixo estão as áreas liberadas
          para você.
        </p>
      )}

      <section aria-labelledby="titulo-atalhos">
        <h2 id="titulo-atalhos" className="font-display text-xl text-floresta">
          Atalhos
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {atalhos.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-h-11 items-center gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-organico)] transition-transform hover:-translate-y-0.5"
            >
              <item.icone className="h-5 w-5 shrink-0 text-salvia" aria-hidden="true" />
              <span className="truncate text-sm font-medium text-floresta">{item.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
