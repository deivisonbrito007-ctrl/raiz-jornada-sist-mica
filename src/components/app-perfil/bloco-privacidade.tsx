import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { itensPrivacidade } from "@/lib/perfil-cliente";
import type { ModoUso } from "@/lib/modo-uso";

type Props = { modo: ModoUso };

/** O que fica só com a pessoa e o que a terapeuta enxerga. */
export function BlocoPrivacidade({ modo }: Props) {
  const itens = itensPrivacidade(modo);

  return (
    <section
      aria-labelledby="titulo-privacidade"
      className="mt-4 rounded-3xl bg-secondary p-6"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-card p-3 text-salvia">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="titulo-privacidade" className="font-display text-xl text-floresta">
            Cuidado com o que é seu
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Privacidade aqui não é letra miúda: é parte do tratamento.
          </p>
        </div>
      </div>

      <dl className="mt-5 space-y-4">
        {itens.map((item) => (
          <div key={item.titulo}>
            <dt className="text-xs uppercase tracking-wider text-salvia">{item.titulo}</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.texto}</dd>
          </div>
        ))}
      </dl>

      {modo === "acompanhado" && (
        <Link
          to="/app/diario"
          className="mt-5 inline-flex min-h-11 items-center rounded-full border border-border bg-card px-5 text-sm text-floresta"
        >
          Revisar o que compartilhei no diário
        </Link>
      )}
    </section>
  );
}
