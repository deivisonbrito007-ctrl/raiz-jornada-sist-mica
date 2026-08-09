import { formatarData } from "@/lib/raiz-format";

export type EventoTimeline = {
  id: string;
  quando: string;
  tipo: "etapa" | "checkin" | "revisao" | "apoio";
  titulo: string;
  detalhe?: string;
};

const CLASSE: Record<EventoTimeline["tipo"], string> = {
  etapa: "bg-floresta",
  checkin: "bg-salvia",
  revisao: "bg-secondary",
  apoio: "bg-terracota",
};

const ROTULO: Record<EventoTimeline["tipo"], string> = {
  etapa: "Etapa concluída",
  checkin: "Registro do cliente",
  revisao: "Revisão",
  apoio: "Solicitação de contato",
};

/** Linha do tempo do que aconteceu no plano, do mais recente ao mais antigo. */
export function LinhaDoTempoPlano({ eventos }: { eventos: EventoTimeline[] }) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nada registrado por enquanto. Assim que a pessoa praticar, aparece aqui.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {eventos.map((e) => (
        <li key={e.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <span
            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${CLASSE[e.tipo]}`}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{e.titulo}</p>
            <p className="text-xs text-muted-foreground">
              {ROTULO[e.tipo]} · {formatarData(e.quando)}
            </p>
            {e.detalhe && (
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{e.detalhe}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
