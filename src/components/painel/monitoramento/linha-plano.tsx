import { Link } from "@tanstack/react-router";
import { ChevronRight, HeartHandshake } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { formatarData } from "@/lib/raiz-format";
import { statusClasse, statusEfetivo } from "@/lib/planos";
import { STATUS_ATRIBUICAO_LABEL } from "@/lib/etapas";
import {
  diasSemAtividade,
  percentualProgresso,
  situacaoRevisao,
  type LinhaMonitoramento,
} from "@/lib/monitoramento";

type Props = { linha: LinhaMonitoramento };

/** Uma linha da listagem, com progresso e situação da revisão. */
export function LinhaPlano({ linha }: Props) {
  const status = statusEfetivo(linha);
  const dias = diasSemAtividade(linha.ultimaAtividade);
  const revisao = situacaoRevisao(linha.data_revisao);
  const percentual = percentualProgresso(linha.concluidas, linha.totalEtapas);

  return (
    <li className="rounded-3xl border border-border bg-card p-4 shadow-organico">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{linha.cliente}</p>
          <p className="truncate text-sm text-muted-foreground">{linha.trilha}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {linha.apoioAberto > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-terracota/10 px-3 py-1 text-xs font-medium text-terracota">
              <HeartHandshake className="h-3.5 w-3.5" aria-hidden />
              Pediu apoio
            </span>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasse(status)}`}
          >
            {STATUS_ATRIBUICAO_LABEL[status]}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Progresso percebido: {linha.concluidas} de {linha.totalEtapas} etapas
          </span>
          <span>{percentual}%</span>
        </div>
        <Progress value={percentual} className="mt-1 h-2" />
      </div>

      <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-medium text-foreground">Última etapa</dt>
          <dd className="truncate">{linha.ultimaEtapa ?? "Nenhuma concluída ainda"}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Última atividade</dt>
          <dd>
            {linha.ultimaAtividade
              ? `${formatarData(linha.ultimaAtividade)}${
                  dias !== null ? ` · ${dias === 0 ? "hoje" : `${dias} dia(s) atrás`}` : ""
                }`
              : "Sem registro"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Próxima revisão</dt>
          <dd>
            {linha.data_revisao
              ? `${formatarData(linha.data_revisao)}${revisao === "vencida" ? " · vencida" : ""}`
              : "Sem data marcada"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Terapeuta</dt>
          <dd className="truncate">{linha.terapeuta}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <Link
          to="/admin/monitoramento/$atribuicaoId"
          params={{ atribuicaoId: linha.atribuicaoId }}
          className="inline-flex min-h-11 items-center rounded-full bg-floresta px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Abrir monitoramento
          <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
        </Link>
      </div>
    </li>
  );
}
