import { CONTEUDO_STATUS_LABEL } from "@/lib/raiz-format";
import { cn } from "@/lib/utils";

const ESTILO: Record<string, string> = {
  rascunho: "bg-secondary text-muted-foreground",
  em_revisao: "bg-ouro/25 text-floresta",
  publicado: "bg-salvia/25 text-floresta",
  arquivado: "bg-destructive/15 text-destructive",
};

/** Etiqueta da situação do conteúdo (rascunho, revisão, publicado, arquivado). */
export function BadgeStatus({ status, className }: { status?: string; className?: string }) {
  const valor = status ?? "publicado";
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        ESTILO[valor] ?? ESTILO["rascunho"],
        className,
      )}
    >
      {CONTEUDO_STATUS_LABEL[valor] ?? valor}
    </span>
  );
}
