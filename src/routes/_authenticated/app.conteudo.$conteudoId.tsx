import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  NotebookPen,
} from "lucide-react";
import { getConteudo, marcarProgresso } from "@/lib/raiz.functions";
import { TIPO_LABEL, formatarDuracao } from "@/lib/raiz-format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/conteudo/$conteudoId")({
  component: Player,
});

function Player() {
  const { conteudoId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchConteudo = useServerFn(getConteudo);
  const salvarProgresso = useServerFn(marcarProgresso);

  const { data, isLoading } = useQuery({
    queryKey: ["conteudo", conteudoId],
    queryFn: () => fetchConteudo({ data: { conteudoId } }),
  });

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [total, setTotal] = useState(0);
  const [terminou, setTerminou] = useState(false);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    setConcluido(data?.status === "concluido");
  }, [data?.status]);

  const conteudo = data?.conteudo;
  const ehMidia = conteudo?.tipo === "video" || conteudo?.tipo === "audio";

  async function registrar(status: "em_andamento" | "concluido") {
    await salvarProgresso({ data: { conteudoId, status } });
    queryClient.invalidateQueries({ queryKey: ["biblioteca"] });
    queryClient.invalidateQueries({ queryKey: ["conteudo", conteudoId] });
    queryClient.invalidateQueries({ queryKey: ["trilha"] });
  }

  function alternar() {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      if (data?.status === "nao_iniciado") void registrar("em_andamento");
    } else {
      el.pause();
    }
  }

  function pular(segundos: number) {
    const el = mediaRef.current;
    if (el) el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + segundos));
  }

  async function concluir() {
    await registrar("concluido");
    setConcluido(true);
    toast.success("Prática concluída. Que tal registrar no diário?");
  }

  return (
    <div>
      {conteudo ? (
        <Link
          to="/app/eixo/$eixoId"
          params={{ eixoId: conteudo.eixo_id }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-floresta"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar à trilha
        </Link>
      ) : (
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-floresta"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar à trilha
        </Link>
      )}

      {isLoading && <Skeleton className="mt-6 h-64 rounded-3xl" />}

      {conteudo && (
        <>
          <p className="mt-5 text-[11px] font-medium uppercase tracking-wider text-salvia">
            {conteudo.eixos?.nome} · {TIPO_LABEL[conteudo.tipo] ?? conteudo.tipo}
          </p>
          <h1 className="mt-1 text-3xl text-floresta">{conteudo.titulo}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{conteudo.descricao}</p>

          {ehMidia && data?.url && (
            <div className="mt-6 overflow-hidden rounded-3xl bg-floresta p-4">
              {conteudo.tipo === "video" ? (
                <video
                  ref={mediaRef as React.RefObject<HTMLVideoElement>}
                  src={data.url}
                  className="w-full rounded-2xl bg-black"
                  playsInline
                  onPlay={() => setTocando(true)}
                  onPause={() => setTocando(false)}
                  onTimeUpdate={(e) => setTempo(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => setTotal(e.currentTarget.duration)}
                  onEnded={() => {
                    setTocando(false);
                    setTerminou(true);
                  }}
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-2xl bg-floresta-foreground/5">
                  <audio
                    ref={mediaRef as React.RefObject<HTMLAudioElement>}
                    src={data.url}
                    onPlay={() => setTocando(true)}
                    onPause={() => setTocando(false)}
                    onTimeUpdate={(e) => setTempo(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setTotal(e.currentTarget.duration)}
                    onEnded={() => {
                      setTocando(false);
                      setTerminou(true);
                    }}
                  />
                  <p className="font-display text-lg text-floresta-foreground/70">
                    Feche os olhos e apenas escute.
                  </p>
                </div>
              )}

              <div className="mt-4 px-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-floresta-foreground/20">
                  <div
                    className="h-full rounded-full bg-ocre transition-all"
                    style={{ width: `${total ? (tempo / total) * 100 : 0}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-floresta-foreground/60">
                  <span>{formatarDuracao(Math.floor(tempo))}</span>
                  <span>{formatarDuracao(Math.floor(total))}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-6">
                <button
                  onClick={() => pular(-15)}
                  className="text-floresta-foreground/80 hover:text-ocre"
                  aria-label="Voltar 15 segundos"
                >
                  <RotateCcw className="h-6 w-6" />
                </button>
                <button
                  onClick={alternar}
                  className="rounded-full bg-terracota p-4 text-terracota-foreground"
                  aria-label={tocando ? "Pausar" : "Reproduzir"}
                >
                  {tocando ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
                </button>
                <button
                  onClick={() => pular(15)}
                  className="text-floresta-foreground/80 hover:text-ocre"
                  aria-label="Avançar 15 segundos"
                >
                  <RotateCw className="h-6 w-6" />
                </button>
              </div>
            </div>
          )}

          {ehMidia && !data?.url && (
            <p className="mt-6 rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              A mídia desta prática ainda não foi enviada.
            </p>
          )}

          {!ehMidia && (
            <div className="mt-6 whitespace-pre-line rounded-3xl bg-card p-6 text-[15px] leading-relaxed text-foreground shadow-[var(--shadow-organico)]">
              {conteudo.corpo_texto || "Conteúdo em preparação."}
            </div>
          )}

          <div className="mt-8 rounded-3xl bg-secondary p-6">
            <h2 className="text-xl text-floresta">
              {concluido ? "Prática concluída" : terminou ? "Como foi para você?" : "Ao terminar"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Marque como concluída e registre no diário o que se moveu.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                onClick={concluir}
                disabled={concluido}
                className="rounded-full bg-salvia px-6 text-salvia-foreground hover:bg-salvia/90"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {concluido ? "Concluída" : "Marcar como concluída"}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/app/diario", search: { conteudoId } })}
                className="rounded-full border-floresta/20 px-6 text-floresta"
              >
                <NotebookPen className="mr-2 h-4 w-4" /> Ir ao diário
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
