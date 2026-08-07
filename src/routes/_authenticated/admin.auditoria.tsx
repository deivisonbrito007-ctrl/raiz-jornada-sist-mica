import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";

import { equipeAcessosNegados } from "@/lib/equipe.functions";
import { PERMISSAO_LABEL, type Permissao } from "@/lib/permissoes";
import { AvisoPermissao } from "@/components/aviso-permissao";
import { ehErroPermissao } from "@/lib/erro-permissao";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Auditoria de acessos negados — Raiz" },
      {
        name: "description",
        content:
          "Registro das tentativas bloqueadas por falta de permissão no painel: data, usuário e ação.",
      },
      { property: "og:title", content: "Auditoria de acessos negados — Raiz" },
      {
        property: "og:description",
        content: "Tentativas bloqueadas por permissão, com data/hora, usuário e ação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditoriaAcessos,
});

const TIPO_LABEL: Record<string, string> = {
  permissao: "Permissão ausente",
  papel: "Papel insuficiente",
  rls: "Bloqueio no banco (RLS)",
  grant: "Bloqueio no banco (privilégio)",
  storage: "Mídia protegida",
  desconhecido: "Outro bloqueio",
};

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuditoriaAcessos() {
  const listar = useServerFn(equipeAcessosNegados);
  const [busca, setBusca] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["auditoria-acessos-negados"],
    queryFn: () => listar(),
    refetchInterval: 30000,
  });

  if (error) {
    return (
      <section className="space-y-4">
        <h1 className="font-serif text-2xl text-foreground">Acessos negados</h1>
        <AvisoPermissao erro={ehErroPermissao(error) ? undefined : error} />
      </section>
    );
  }

  const registros = (data?.registros ?? []).filter((r) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return [r.userEmail, r.acao, r.permissao, r.rota].some((c) =>
      (c ?? "").toLowerCase().includes(termo),
    );
  });

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-2xl text-foreground">Acessos negados</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Toda tentativa bloqueada por falta de permissão fica registrada aqui, com data e hora,
          quem tentou e qual ação foi barrada. Use para revisar as permissões da equipe na aba
          Equipe.
        </p>
      </header>

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por e-mail, ação ou permissão"
        className="max-w-sm"
        aria-label="Buscar tentativas negadas"
      />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : registros.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          Nenhuma tentativa negada registrada até agora.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {registros.map((r) => (
            <li key={r.id} className="flex items-start gap-3 bg-card p-4">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-terracota" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {r.userEmail || "Usuário sem perfil"}
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
                    {TIPO_LABEL[r.tipo] ?? r.tipo}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Ação bloqueada: <span className="font-medium">{r.acao}</span>
                  {r.permissao
                    ? ` — exigia “${PERMISSAO_LABEL[r.permissao as Permissao] ?? r.permissao}”`
                    : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dataHora(r.quando)}
                  {r.rota ? ` · ${r.rota}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
