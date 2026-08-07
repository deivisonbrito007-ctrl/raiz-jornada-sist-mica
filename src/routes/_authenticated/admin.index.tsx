import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminResumo } from "@/lib/raiz.functions";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatarData,
  PAGAMENTO_LABEL,
  calcularStreak,
  linhaDoTempoSemanal,
} from "@/lib/raiz-format";
import { Flame } from "lucide-react";
import { AvisoPermissao } from "@/components/aviso-permissao";
import { useMinhasPermissoes } from "@/hooks/use-minhas-permissoes";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminClientes,
});

function AdminClientes() {
  const fetchResumo = useServerFn(adminResumo);
  const perms = useMinhasPermissoes();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-resumo"],
    queryFn: () => fetchResumo(),
    enabled: !perms.bloqueado("ver_clientes"),
    retry: false,
  });
  const [busca, setBusca] = useState("");

  const clientes = (data?.clientes ?? []).filter((c) =>
    `${c.nome ?? ""} ${c.email ?? ""}`.toLowerCase().includes(busca.toLowerCase()),
  );

  const metricas = [
    { label: "Clientes ativos", valor: data?.metricas.clientesAtivos ?? 0 },
    { label: "Trilhas em andamento", valor: data?.metricas.trilhasEmAndamento ?? 0 },
    { label: "Conclusão média", valor: `${data?.metricas.conclusaoMedia ?? 0}%` },
  ];

  if (perms.bloqueado("ver_clientes")) {
    return (
      <div>
        <h1 className="text-3xl text-floresta">Clientes</h1>
        <div className="mt-6">
          <AvisoPermissao permissao="ver_clientes" />
        </div>
      </div>
    );
  }

  return (
    <div>

      <h1 className="text-3xl text-floresta">Clientes</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Acompanhe o processo de cada pessoa e libere o próximo passo no tempo dela.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {metricas.map((m) => (
          <div key={m.label} className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]">
            <p className="text-xs uppercase tracking-wider text-salvia">{m.label}</p>
            <p className="mt-2 font-display text-4xl text-floresta">{m.valor}</p>
          </div>
        ))}
      </div>

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou e-mail"
        className="mt-8 max-w-sm rounded-full border-border bg-card"
      />

      {isLoading && <Skeleton className="mt-6 h-48 rounded-3xl" />}

      <div className="mt-6 space-y-3">
        {clientes.map((cliente) => {
          const datas = cliente.datasConclusao ?? [];
          const streak = calcularStreak(datas);
          const semanas = linhaDoTempoSemanal(datas, 8);
          const maximo = Math.max(1, ...semanas.map((s) => s.total));
          return (
            <Link
              key={cliente.id}
              to="/admin/cliente/$clienteId"
              params={{ clienteId: cliente.id }}
              className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)] transition-transform hover:-translate-y-0.5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-floresta">
                  {cliente.nome ?? cliente.email}
                </p>
                <p className="truncate text-xs text-muted-foreground">{cliente.email}</p>
                <p className="mt-1 text-xs text-salvia">
                  {cliente.eixoAtual ? `Eixo atual: ${cliente.eixoAtual}` : "Nenhum eixo liberado"}
                  {cliente.ultimaAtividade
                    ? ` · última atividade ${formatarData(cliente.ultimaAtividade)}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-terracota">
                    <Flame className="h-4 w-4" />
                    <span className="font-display text-2xl leading-none">{streak}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {streak === 1 ? "semana" : "semanas"}
                  </p>
                </div>
                <div>
                  <div className="flex h-10 items-end gap-1" aria-label="Linha do tempo semanal">
                    {semanas.map((s) => (
                      <div
                        key={s.inicio}
                        title={`${s.label}: ${s.total}`}
                        className={`w-2 rounded-full ${
                          s.total === 0 ? "bg-secondary" : s.atual ? "bg-terracota" : "bg-salvia"
                        }`}
                        style={{ height: `${Math.max(12, (s.total / maximo) * 100)}%` }}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">8 semanas</p>
                </div>
                {cliente.statusPagamento && (
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs text-floresta">
                    {PAGAMENTO_LABEL[cliente.statusPagamento] ?? cliente.statusPagamento}
                  </span>
                )}

                <div className="w-32">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>
                      {cliente.concluidos}/{cliente.totalLiberado}
                    </span>
                    <span>{cliente.percentual}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-salvia"
                      style={{ width: `${cliente.percentual}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {!isLoading && clientes.length === 0 && (
          <p className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nenhum cliente encontrado. Convide sua cliente a criar uma conta em /auth.
          </p>
        )}
      </div>
    </div>
  );
}
