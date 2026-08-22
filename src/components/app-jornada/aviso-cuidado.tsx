import { HeartHandshake, ShieldAlert } from "lucide-react";

/**
 * Cuidados da trilha: alertas, orientações de pausa e recomendações da
 * terapeuta. Tom de acolhimento, nunca de alarme.
 */
export function AvisoCuidado({
  alertas,
  orientacoesPausa,
  orientacoesEspeciais,
}: {
  alertas?: string | null | undefined;
  orientacoesPausa?: string | null | undefined;
  orientacoesEspeciais?: string | null | undefined;
}) {
  if (!alertas && !orientacoesPausa && !orientacoesEspeciais) return null;

  return (
    <section className="mt-4 rounded-2xl border border-ocre/40 bg-ocre/10 p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium text-floresta">
        <ShieldAlert className="h-4 w-4 text-ocre" aria-hidden="true" />
        Cuidados deste caminho
      </h3>
      {alertas && (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">{alertas}</p>
      )}
      {orientacoesEspeciais && (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
          {orientacoesEspeciais}
        </p>
      )}
      {orientacoesPausa && (
        <p className="mt-3 flex gap-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-salvia" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">Se precisar pausar: </span>
            {orientacoesPausa}
          </span>
        </p>
      )}
    </section>
  );
}
