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
  TimerOff,
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["conteudo", conteudoId],
    queryFn: () => fetchConteudo({ data: { conteudoId } }),
  });

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [total, setTotal] = useState(0);
  const [terminou, setTerminou] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [midiaExpirada, setMidiaExpirada] = useState(false);
  const [semLiberacao, setSemLiberacao] = useState(false);
  const [renovando, setRenovando] = useState(false);

  useEffect(() => {
    setConcluido(data?.status === "concluido");
  }, [data?.status]);

  const conteudo = data?.conteudo;
  const ehMidia = conteudo?.tipo === "video" || conteudo?.tipo === "audio";

  function expirarMidia() {
    const el = mediaRef.current;
    if (el) el.pause();
    setTocando(false);
    setMidiaExpirada(true);
  }

  // O link seguro da mídia tem validade limitada: ao chegar ao fim, o player para
  // sozinho e passa a exigir uma nova liberação em vez de tentar tocar um link morto.
  useEffect(() => {
    if (!data?.url || !data?.urlExpiraEm) return;
    setMidiaExpirada(false);
    setSemLiberacao(false);
    const restante = new Date(data.urlExpiraEm).getTime() - Date.now();
    if (restante <= 0) {
      expirarMidia();
      return;
    }
    const timer = setTimeout(expirarMidia, restante);
    return () => clearTimeout(timer);
  }, [data?.url, data?.urlExpiraEm]);

  async function renovarMidia() {
    if (semLiberacao || renovando) return;
    setRenovando(true);
    try {
      const novo = await refetch();
      if (novo.data?.url) {
        setMidiaExpirada(false);
        setTocando(false);
        toast.success("Mídia liberada novamente. Você pode continuar.");
      } else {
        setSemLiberacao(true);
        toast.error("Esta prática não está mais liberada para você.");
      }
    } catch {
      setSemLiberacao(true);
      toast.error("Não foi possível renovar o acesso à mídia.");
    } finally {
      setRenovando(false);
    }
  }

  async function registrar(status: "em_andamento" | "concluido") {
    if (midiaExpirada || semLiberacao) return;
    await salvarProgresso({ data: { conteudoId, status } });
    queryClient.invalidateQueries({ queryKey: ["biblioteca"] });
    queryClient.invalidateQueries({ queryKey: ["conteudo", conteudoId] });
    queryClient.invalidateQueries({ queryKey: ["trilha"] });
  }

  function alternar() {
    const el = mediaRef.current;
    if (!el || midiaExpirada || semLiberacao) return;
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
    if (midiaExpirada || semLiberacao) {
      toast.error("Acesso à mídia expirado. Renove antes de concluir a prática.");
      return;
    }
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

          {ehMidia && data?.url && !midiaExpirada && (
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
                  onError={expirarMidia}
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
                    onError={expirarMidia}
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

          {ehMidia && midiaExpirada && (
            <div className="mt-6 rounded-3xl border border-terracota/30 bg-terracota/10 p-6">
              <div className="flex items-start gap-3">
                <TimerOff className="mt-0.5 h-5 w-5 shrink-0 text-terracota" />
                <div>
                  <h2 className="text-lg text-floresta">Acesso à mídia expirou</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {semLiberacao
                      ? "Esta prática não está mais liberada para você. Fale com seu terapeuta para liberar novamente — até então, a reprodução fica indisponível e nada é registrado."
                      : "O link seguro desta mídia tem tempo de validade e acabou de encerrar. Renove o acesso para continuar de onde parou."}
                  </p>
                  <Button
                    onClick={renovarMidia}
                    disabled={semLiberacao || renovando}
                    className="mt-4 rounded-full bg-floresta px-6 text-floresta-foreground hover:bg-floresta/90"
                  >
                    {renovando ? "Renovando..." : "Renovar acesso"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {ehMidia && !data?.url && !midiaExpirada && (
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
