import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CalendarCheck, MessageCircleHeart } from "lucide-react";
import { getMinhaJornada } from "@/lib/trilhas.functions";
import { formatarData } from "@/lib/raiz-format";
import { PedirApoio } from "@/components/pedir-apoio";

/**
 * O que a terapeuta combinou com a pessoa: objetivo da trilha ativa, recado,
 * próxima revisão e o canal de apoio. Só aparece no modo acompanhado.
 */
export function PalavraDaTerapeuta() {
  const carregar = useServerFn(getMinhaJornada);
  const { data } = useQuery({ queryKey: ["minha-jornada"], queryFn: () => carregar() });

  const trilha = (data?.trilhas ?? []).find((t) => t.status === "em_andamento") ?? (data?.trilhas ?? [])[0];
  if (!data) return null;

  return (
    <section className="mt-6 rounded-[2rem] bg-secondary p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-card p-2.5 text-salvia">
          <MessageCircleHeart className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl text-floresta">Da sua terapeuta</h2>
          {trilha ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Trilha em curso: <span className="text-foreground">{trilha.trilha?.nome ?? "Trilha"}</span>
              </p>
              {trilha.objetivo && (
                <p className="mt-3 text-sm leading-relaxed text-foreground">
                  <span className="font-medium">Objetivo combinado: </span>
                  {trilha.objetivo}
                </p>
              )}
              {trilha.mensagem && (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {trilha.mensagem}
                </p>
              )}
              {trilha.dataRevisao && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground">
                  <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" /> Revisão em{" "}
                  {formatarData(trilha.dataRevisao)}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Quando sua terapeuta indicar uma trilha, o objetivo combinado e os recados dela
              aparecem aqui.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link
          to="/app/jornada"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-card px-5 text-sm font-medium text-floresta transition hover:bg-card/70"
        >
          Ver minha jornada <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <PedirApoio
          prazoRespostaHoras={data.prazoRespostaHoras ?? 48}
          contatos={data.contatosEmergencia ?? []}
        />
      </div>
    </section>
  );
}
