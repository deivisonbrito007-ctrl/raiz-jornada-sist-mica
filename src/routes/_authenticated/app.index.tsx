import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import * as icones from "lucide-react";
import { getMeuContexto, getMinhaBiblioteca } from "@/lib/raiz.functions";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Biblioteca,
});

function Icone({ nome, className }: { nome: string; className?: string }) {
  const chave = nome
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  const Componente = (icones as unknown as Record<string, icones.LucideIcon>)[chave] ?? icones.Sprout;
  return <Componente className={className} />;
}

function Biblioteca() {
  const fetchBiblioteca = useServerFn(getMinhaBiblioteca);
  const fetchContexto = useServerFn(getMeuContexto);
  const { data: contexto } = useQuery({ queryKey: ["contexto"], queryFn: () => fetchContexto() });
  const { data, isLoading } = useQuery({ queryKey: ["biblioteca"], queryFn: () => fetchBiblioteca() });

  const primeiroNome = (contexto?.perfil?.nome || "").split(" ")[0];

  return (
    <div>
      <p className="text-sm text-salvia">Que bom te ver por aqui</p>
      <h1 className="mt-1 text-3xl text-floresta">
        {primeiroNome ? `Olá, ${primeiroNome}` : "Sua jornada"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Escolha um eixo para continuar. Os eixos ainda fechados mostram o caminho que vem a seguir.
      </p>

      {isLoading && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {(data?.eixos ?? []).map((eixo) =>
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
                Este eixo será liberado quando for o momento do seu processo.
              </p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
