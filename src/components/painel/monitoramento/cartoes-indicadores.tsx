import { Activity, CalendarClock, CheckCircle2, HeartHandshake, MessageSquare, Moon } from "lucide-react";
import type { IndicadoresMonitoramento } from "@/lib/monitoramento";

type Props = {
  indicadores: IndicadoresMonitoramento;
  periodoDias: number;
  aoFiltrar: (chave: keyof IndicadoresMonitoramento) => void;
};

const CARTOES: {
  chave: keyof IndicadoresMonitoramento;
  label: string;
  ajuda: string;
  icone: typeof Activity;
}[] = [
  {
    chave: "emAndamento",
    label: "Trilhas em andamento",
    ajuda: "Planos liberados e em curso",
    icone: Activity,
  },
  {
    chave: "revisoesPendentes",
    label: "Revisões pendentes",
    ajuda: "Chegou a data combinada",
    icone: CalendarClock,
  },
  {
    chave: "apoio",
    label: "Solicitações de apoio",
    ajuda: "Aguardando seu retorno",
    icone: HeartHandshake,
  },
  {
    chave: "semAtividade",
    label: "Sem atividade recente",
    ajuda: "7 dias ou mais sem prática",
    icone: Moon,
  },
  {
    chave: "aguardandoDevolutiva",
    label: "Aguardando devolutiva",
    ajuda: "A pessoa já revisou, falta responder",
    icone: MessageSquare,
  },
  {
    chave: "concluidosNoPeriodo",
    label: "Planos concluídos",
    ajuda: "No período selecionado",
    icone: CheckCircle2,
  },
];

/** Seis indicadores reais; clicar em um deles filtra a listagem abaixo. */
export function CartoesIndicadores({ indicadores, periodoDias, aoFiltrar }: Props) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {CARTOES.map((c) => {
        const Icone = c.icone;
        const valor = indicadores[c.chave];
        const destaque = c.chave === "apoio" && valor > 0;
        return (
          <li key={c.chave}>
            <button
              type="button"
              onClick={() => aoFiltrar(c.chave)}
              className={`min-h-11 w-full rounded-3xl border p-4 text-left shadow-organico transition hover:border-floresta/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                destaque ? "border-terracota/40 bg-terracota/5" : "border-border bg-card"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <Icone
                  className={`h-4 w-4 shrink-0 ${destaque ? "text-terracota" : "text-floresta"}`}
                  aria-hidden
                />
              </span>
              <span className="mt-1 block font-display text-2xl text-floresta">{valor}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {c.chave === "concluidosNoPeriodo" && periodoDias
                  ? `Últimos ${periodoDias} dias`
                  : c.ajuda}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
