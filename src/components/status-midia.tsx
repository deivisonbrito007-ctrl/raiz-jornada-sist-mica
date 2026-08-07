import { Lock, PlayCircle, TimerOff } from "lucide-react";

export type StatusMidia = "liberada" | "expirada" | "revogada";

const CONFIG: Record<
  StatusMidia,
  { rotulo: string; icone: React.ReactNode; classes: string; descricao: string }
> = {
  liberada: {
    rotulo: "Mídia liberada",
    icone: <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />,
    classes: "border-salvia/40 bg-salvia/15 text-floresta",
    descricao: "Você pode reproduzir esta prática agora.",
  },
  expirada: {
    rotulo: "Acesso expirado",
    icone: <TimerOff className="h-3.5 w-3.5" aria-hidden="true" />,
    classes: "border-ocre/40 bg-ocre/15 text-floresta",
    descricao: "O link seguro venceu, mas a prática continua liberada para você.",
  },
  revogada: {
    rotulo: "Acesso revogado",
    icone: <Lock className="h-3.5 w-3.5" aria-hidden="true" />,
    classes: "border-terracota/40 bg-terracota/15 text-terracota",
    descricao: "O terapeuta recolheu esta prática por enquanto.",
  },
};

/** Selo curto e sempre visível com a situação atual da mídia no player. */
export function StatusMidiaBadge({ status }: { status: StatusMidia }) {
  const cfg = CONFIG[status];
  return (
    <span
      role="status"
      aria-label={`Status da mídia: ${cfg.rotulo}. ${cfg.descricao}`}
      title={cfg.descricao}
      className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${cfg.classes}`}
    >
      {cfg.icone}
      {cfg.rotulo}
    </span>
  );
}
