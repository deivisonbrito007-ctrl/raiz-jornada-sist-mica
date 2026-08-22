import { CalendarCheck, Compass, Lock, Users } from "lucide-react";
import { formatarData } from "@/lib/raiz-format";
import { NIVEL_LABEL, type Nivel } from "@/lib/etapas";

/** Pílulas de contexto do plano: nível, frequência, restrições e revisão. */
export function SelosPlano({
  nivel,
  frequencia,
  somenteEmSessao,
  exigeAcompanhamento,
  dataRevisao,
}: {
  nivel: string | null;
  frequencia: string | null;
  somenteEmSessao?: boolean | null;
  exigeAcompanhamento?: boolean | null;
  dataRevisao?: string | null;
}) {
  return (
    <ul className="mt-4 flex flex-wrap gap-2 text-xs">
      {nivel && (
        <li className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-floresta">
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          {NIVEL_LABEL[nivel as Nivel] ?? nivel}
        </li>
      )}
      {frequencia && (
        <li className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-muted-foreground">
          {frequencia}
        </li>
      )}
      {somenteEmSessao && (
        <li className="inline-flex items-center gap-1.5 rounded-full bg-terracota/10 px-3 py-1 text-terracota">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Somente em sessão
        </li>
      )}
      {exigeAcompanhamento && (
        <li className="inline-flex items-center gap-1.5 rounded-full bg-ocre/15 px-3 py-1 text-floresta">
          <Users className="h-3.5 w-3.5" aria-hidden="true" /> Com acompanhamento
        </li>
      )}
      {dataRevisao && (
        <li className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-muted-foreground">
          <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" /> Revisão em{" "}
          {formatarData(dataRevisao)}
        </li>
      )}
    </ul>
  );
}
