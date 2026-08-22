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
      className="mt-3 w-full rounded-3xl bg-secondary p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-2xl bg-card p-3 text-salvia">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="titulo-privacidade" className="perfil-titulo">
            Cuidado com o que é seu
          </h2>
          <p className="mt-1 perfil-texto break-words text-muted-foreground">
            Privacidade aqui não é letra miúda: é parte do tratamento.
          </p>
        </div>
      </div>

      <dl className="mt-5 space-y-4">
        {itens.map((item) => (
          <div key={item.titulo} className="min-w-0">
            <dt className="break-words perfil-rotulo">
              {item.titulo}
            </dt>
            <dd className="mt-0.5 perfil-texto break-words text-muted-foreground">
              {item.texto}
            </dd>
          </div>
        ))}
      </dl>

      {modo === "acompanhado" && (
        <Link
          to="/app/diario"
          className="mt-5 inline-flex min-h-11 max-w-full items-center justify-center rounded-full border border-border bg-card px-5 py-2 text-center text-sm leading-snug text-floresta"
        >
          Revisar o que compartilhei no diário
        </Link>
      )}
    </section>
  );
}
