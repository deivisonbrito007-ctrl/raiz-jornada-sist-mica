import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_ATRIBUICAO, STATUS_ATRIBUICAO_LABEL } from "@/lib/etapas";
import { FILTROS_PADRAO, type FiltrosMonitoramento } from "@/lib/monitoramento";

type Props = {
  filtros: FiltrosMonitoramento;
  aoMudar: (filtros: FiltrosMonitoramento) => void;
  terapeutas: { id: string; nome: string }[];
  trilhas: { id: string; nome: string }[];
};

/** Filtros da listagem: terapeuta, trilha, status, período, revisão e apoio. */
export function FiltrosMonitoramentoBarra({ filtros, aoMudar, terapeutas, trilhas }: Props) {
  const definir = <C extends keyof FiltrosMonitoramento>(
    chave: C,
    valor: FiltrosMonitoramento[C],
  ) => aoMudar({ ...filtros, [chave]: valor });

  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-organico">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label htmlFor="filtro-terapeuta">Terapeuta</Label>
          <Select
            value={filtros.terapeuta}
            onValueChange={(v) => definir("terapeuta", v)}
          >
            <SelectTrigger id="filtro-terapeuta" className="min-h-11">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as terapeutas</SelectItem>
              {terapeutas.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="filtro-trilha">Trilha</Label>
          <Select value={filtros.trilha} onValueChange={(v) => definir("trilha", v)}>
            <SelectTrigger id="filtro-trilha" className="min-h-11">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as trilhas</SelectItem>
              {trilhas.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="filtro-status">Status do plano</Label>
          <Select
            value={filtros.status}
            onValueChange={(v) => definir("status", v as FiltrosMonitoramento["status"])}
          >
            <SelectTrigger id="filtro-status" className="min-h-11">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_ATRIBUICAO.filter((s) => s !== "rascunho").map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_ATRIBUICAO_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="filtro-periodo">Período</Label>
          <Select
            value={String(filtros.periodoDias)}
            onValueChange={(v) =>
              definir("periodoDias", Number(v) as FiltrosMonitoramento["periodoDias"])
            }
          >
            <SelectTrigger id="filtro-periodo" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="0">Todo o histórico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="filtro-revisao">Revisão</Label>
          <Select
            value={filtros.revisao}
            onValueChange={(v) => definir("revisao", v as FiltrosMonitoramento["revisao"])}
          >
            <SelectTrigger id="filtro-revisao" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Qualquer revisão</SelectItem>
              <SelectItem value="pendente">Pendente ou vencida</SelectItem>
              <SelectItem value="vencida">Somente vencida</SelectItem>
              <SelectItem value="sem_data">Sem data marcada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="filtro-apoio">Solicitação de apoio</Label>
          <Select
            value={filtros.apoio}
            onValueChange={(v) => definir("apoio", v as FiltrosMonitoramento["apoio"])}
          >
            <SelectTrigger id="filtro-apoio" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Com ou sem pedido</SelectItem>
              <SelectItem value="com_apoio">Somente com pedido em aberto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={filtros.inatividade ? "default" : "outline"}
          className="min-h-11 rounded-full"
          aria-pressed={filtros.inatividade}
          onClick={() => definir("inatividade", !filtros.inatividade)}
        >
          Sem atividade recente
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 rounded-full"
          onClick={() => aoMudar({ ...FILTROS_PADRAO, termo: filtros.termo })}
        >
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
          Limpar filtros
        </Button>
      </div>
    </div>
  );
}
