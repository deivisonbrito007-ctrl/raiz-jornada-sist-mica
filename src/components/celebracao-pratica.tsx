import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Leaf, MessageCircleHeart, NotebookPen, Sparkles } from "lucide-react";

import { getMeuContexto, getMinhaBiblioteca } from "@/lib/raiz.functions";
import { getMinhaJornada } from "@/lib/trilhas.functions";
import { CHAVES } from "@/lib/cache-chaves";
import { calcularStreak } from "@/lib/raiz-format";
import { praticasNaSemana, recompensaDaConclusao } from "@/lib/inicio-cliente";
import { blocosDoModo, normalizarModo } from "@/lib/modo-uso";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * O acolhimento de depois: quando a pessoa conclui a prática do dia, ela recebe
 * um selo simples, as marcações do seu ritmo e — no modo acompanhado — o recado
 * da terapeuta. Nada de pontuação competitiva; só reconhecimento do gesto.
 */
export function CelebracaoPratica({
  aberto,
  onFechar,
  conteudoId,
}: {
  aberto: boolean;
  onFechar: () => void;
  conteudoId: string;
}) {
  const buscarBiblioteca = useServerFn(getMinhaBiblioteca);
  const buscarContexto = useServerFn(getMeuContexto);
  const buscarJornada = useServerFn(getMinhaJornada);

  const { data: biblioteca } = useQuery({
    queryKey: CHAVES.biblioteca,
    queryFn: () => buscarBiblioteca(),
    enabled: aberto,
  });
  const { data: contexto } = useQuery({
    queryKey: CHAVES.contexto,
    queryFn: () => buscarContexto(),
    enabled: aberto,
  });
  const modo = normalizarModo(contexto?.modo);
  const blocos = blocosDoModo(modo);
  const { data: jornada } = useQuery({
    queryKey: CHAVES.jornada,
    queryFn: () => buscarJornada(),
    enabled: aberto && blocos.planoDaTerapeuta,
  });

  const datas = biblioteca?.resumo.datasConclusao ?? [];
  const primeiroNome = (contexto?.perfil?.nome || "").split(" ")[0] ?? "";
  const recompensa = recompensaDaConclusao({
    totalConcluidos: biblioteca?.resumo.totalConcluidos ?? 0,
    feitasNaSemana: praticasNaSemana(datas),
    metaSemanal: contexto?.perfil?.meta_semanal ?? 3,
    streakSemanas: calcularStreak(datas),
    primeiroNome,
  });

  const trilha =
    (jornada?.trilhas ?? []).find((t) => t.status === "em_andamento") ??
    (jornada?.trilhas ?? [])[0];
  const recado = trilha?.mensagem?.trim() || null;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-md overflow-hidden rounded-[2rem] border-ocre/30 p-0">
        <div className="relative isolate bg-floresta px-6 pb-7 pt-8 text-floresta-foreground">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{ backgroundImage: "var(--gradiente-aura)", opacity: 0.9 }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 animate-respirar"
            style={{ backgroundImage: "var(--halo-entrada)" }}
          />
          <span className="inline-flex items-center gap-2 rounded-full border border-ocre/40 px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-ocre">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {recompensa.selo}
          </span>
          <DialogTitle className="mt-4 font-display text-2xl leading-snug">
            {recompensa.titulo}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-floresta-foreground/85">
            {recompensa.frase}
          </DialogDescription>
        </div>

        <div className="px-6 pb-6">
          <dl className="-mt-4 grid grid-cols-3 gap-2 rounded-3xl bg-card p-4 shadow-organico">
            {recompensa.marcos.map((m) => (
              <div key={m.rotulo} className="text-center">
                <dt className="text-[0.6rem] uppercase tracking-wider text-salvia">{m.rotulo}</dt>
                <dd className="mt-1 font-display text-lg text-floresta">{m.valor}</dd>
              </div>
            ))}
          </dl>

          {recado && (
            <div className="mt-4 rounded-3xl bg-secondary p-4">
              <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-salvia">
                <MessageCircleHeart className="h-4 w-4" aria-hidden="true" /> Da sua terapeuta
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                {recado}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <Button
              asChild
              className="min-h-12 rounded-full bg-terracota text-terracota-foreground hover:bg-terracota/90"
            >
              <Link to="/app/diario" search={{ conteudoId }}>
                <NotebookPen className="mr-2 h-4 w-4" aria-hidden="true" /> Registrar no diário
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={onFechar}
              className="min-h-12 rounded-full border-floresta/20 text-floresta"
            >
              <Leaf className="mr-2 h-4 w-4" aria-hidden="true" /> Ficar com o que senti
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
