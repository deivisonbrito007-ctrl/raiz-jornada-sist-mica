import { History } from "lucide-react";

import { ACAO_LABEL, ACOES_SENSIVEIS, type AcaoAuditoria } from "@/lib/auditoria-equipe";
import { PERMISSAO_LABEL, type Permissao } from "@/lib/permissoes";
import { Skeleton } from "@/components/ui/skeleton";

export type RegistroAuditoriaUI = {
  id: string;
  acao: string;
  alvoTipo: string;
  alvoEmail: string | null;
  permissoes: string[];
  anteriores: string[];
  titulo: string;
  agendadoPara: string;
  motivo: string;
  atorEmail: string;
  quando: string;
};

function rotularPermissoes(lista: string[]) {
  if (lista.length === 0) return "nenhuma";
  return lista.map((p) => PERMISSAO_LABEL[p as Permissao] ?? p).join(" · ");
}

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function detalhe(r: RegistroAuditoriaUI) {
  switch (r.acao as AcaoAuditoria) {
    case "convite_criado":
      return `Permissões do convite: ${rotularPermissoes(r.permissoes)}`;
    case "permissoes_definidas":
      return `Agora: ${rotularPermissoes(r.permissoes)} — antes: ${rotularPermissoes(r.anteriores)}`;
    case "permissoes_revogadas":
      return `Perdeu: ${rotularPermissoes(r.anteriores)}`;
    case "liberacao_agendada":
      return r.agendadoPara
        ? `${r.titulo || "Conteúdo"} — agendado para ${dataHora(r.agendadoPara)}`
        : r.titulo;
    case "conteudo_liberado":
    case "liberacao_revogada":
      return r.titulo || "Liberação por eixo";
    default:
      return "";
  }
}

export function HistoricoAuditoria({
  registros,
  carregando,
}: {
  registros: RegistroAuditoriaUI[];
  carregando: boolean;
}) {
  return (
    <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
      <h2 className="flex items-center gap-2 text-xl text-floresta">
        <History className="h-5 w-5 text-salvia" /> Histórico de auditoria
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Convites, promoções, permissões e liberações — com data, quem fez e o motivo.
      </p>

      {carregando && <Skeleton className="mt-4 h-32 rounded-2xl" />}

      {!carregando && registros.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nenhuma ação registrada ainda.
        </p>
      )}

      {!carregando && registros.length > 0 && (
        <ul className="mt-4 space-y-2">
          {registros.map((r) => {
            const sensivel = ACOES_SENSIVEIS.includes(r.acao as AcaoAuditoria);
            const extra = detalhe(r);
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-border p-4 text-sm"
                data-testid="registro-auditoria"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span
                    className={
                      sensivel ? "font-medium text-terracota" : "font-medium text-floresta"
                    }
                  >
                    {ACAO_LABEL[r.acao as AcaoAuditoria] ?? r.acao}
                  </span>
                  <span className="text-xs text-muted-foreground">{dataHora(r.quando)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  por {r.atorEmail || "responsável"}
                  {r.alvoEmail ? ` · alvo: ${r.alvoEmail}` : ""}
                </p>
                {extra && <p className="mt-1 text-xs text-muted-foreground">{extra}</p>}
                {r.motivo && (
                  <p className="mt-2 rounded-xl bg-secondary px-3 py-2 text-xs text-floresta">
                    Motivo: {r.motivo}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
