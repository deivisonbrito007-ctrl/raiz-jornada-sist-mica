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
import { AvisoMidiaBloqueada, MotivoBloqueio } from "@/components/aviso-midia-bloqueada";
import { StatusMidiaBadge } from "@/components/status-midia";
import { useSincronizarLiberacoes } from "@/hooks/use-sincronizar-liberacoes";


export const Route = createFileRoute("/_authenticated/app/conteudo/$conteudoId")({
  component: Player,
});

function ehMidiaTipo(tipo?: string) {
  return tipo === "video" || tipo === "audio";
}

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

  useSincronizarLiberacoes(() => void revalidarLiberacao());

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const posicaoRef = useRef(0);
  /** estava tocando no instante em que o link venceu? */
  const tocandoAntesRef = useRef(false);
  /** deve dar play sozinho quando a nova mídia carregar? */
  const retomarAutoRef = useRef(false);
  /** o "em andamento" desta sessão já foi registrado — não repetir na retomada */
  const progressoIniciadoRef = useRef(false);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [total, setTotal] = useState(0);
  const [terminou, setTerminou] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [bloqueio, setBloqueio] = useState<MotivoBloqueio | null>(null);
  /** espelho do bloqueio para leitura dentro de callbacks de tempo real */
  const bloqueioRef = useRef<MotivoBloqueio | null>(null);
  /** ordem das revalidações concorrentes — só a última pode aplicar estado */
  const revalidacaoRef = useRef(0);
  const [renovando, setRenovando] = useState(false);
  const [emEspera, setEmEspera] = useState(false);
  /** quando a nova tentativa volta a ser permitida (usado na contagem do aviso) */
  const [esperaAte, setEsperaAte] = useState<number | null>(null);



  useEffect(() => {
    bloqueioRef.current = bloqueio;
  }, [bloqueio]);

  // A prática voltou a aparecer na consulta: o acesso foi liberado de novo e o
  // aviso de revogação sai sozinho, sem precisar recarregar a página.
  useEffect(() => {
    if (data?.conteudo && bloqueioRef.current === "revogado") {
      setBloqueio(null);
      toast.success("Esta prática foi liberada de novo pelo seu terapeuta.");
    }
  }, [data?.conteudo]);

  useEffect(() => {
    setConcluido(data?.status === "concluido");
    if (data?.status && data.status !== "nao_iniciado") progressoIniciadoRef.current = true;
  }, [data?.status]);

  const conteudo = data?.conteudo;
  const ehMidia = conteudo?.tipo === "video" || conteudo?.tipo === "audio";

  function expirarMidia() {
    const el = mediaRef.current;
    if (el) {
      // guarda onde a pessoa parou e se estava tocando, para retomar igual depois
      posicaoRef.current = el.currentTime || posicaoRef.current;
      tocandoAntesRef.current = !el.paused;
      el.pause();
    }
    setTocando(false);
    setBloqueio("validade");
  }


  /** Ao carregar a nova mídia, volta ao ponto salvo e retoma se estava tocando. */
  function retomarPosicao(el: HTMLVideoElement | HTMLAudioElement) {
    setTotal(el.duration);
    const alvo = posicaoRef.current;
    if (alvo > 0 && alvo < (el.duration || Infinity)) {
      el.currentTime = alvo;
      setTempo(alvo);
    }
    if (retomarAutoRef.current) {
      retomarAutoRef.current = false;
      // autoplay pode ser barrado pelo navegador: nesse caso apenas orientamos
      void Promise.resolve(el.play())
        .then(() => setTempo(el.currentTime))
        .catch(() => {
          el.pause();
          setTocando(false);
          toast.info("Toque em play para continuar de onde parou.");
        });
      return;
    }
    el.pause();
  }

  // O link seguro da mídia tem validade limitada: ao chegar ao fim, o player para
  // sozinho e passa a exigir uma nova liberação em vez de tentar tocar um link morto.
  useEffect(() => {
    if (!data?.url || !data?.urlExpiraEm) return;
    setBloqueio(null);
    const restante = new Date(data.urlExpiraEm).getTime() - Date.now();
    if (restante <= 0) {
      expirarMidia();
      return;
    }
    const timer = setTimeout(expirarMidia, restante);
    return () => clearTimeout(timer);
  }, [data?.url, data?.urlExpiraEm]);


  /** Pede uma URL assinada nova ao backend e reinicia o player se estiver liberado. */
  async function renovarMidia() {
    if (renovando || emEspera) return;
    setRenovando(true);
    try {
      // sempre uma chamada nova: a liberação pode ter mudado agora mesmo
      const novo = await queryClient.fetchQuery({
        queryKey: ["conteudo", conteudoId],
        queryFn: () => fetchConteudo({ data: { conteudoId } }),
        staleTime: 0,
      });
      if (novo?.url) {
        // só volta a tocar sozinho se estava tocando quando o link venceu
        retomarAutoRef.current = tocandoAntesRef.current;
        setBloqueio(null);
        setTocando(false);
        setTerminou(false);
        toast.success(
          retomarAutoRef.current
            ? "Mídia liberada novamente. Voltando de onde você parou."
            : "Mídia liberada novamente. Você pode continuar de onde parou.",
        );
      } else {
        setBloqueio("revogado");
        segurarNovaTentativa();
        toast.error("Esta prática não está mais liberada para você.");
      }
    } catch {
      setBloqueio("falha");
      segurarNovaTentativa();
      toast.error("Não foi possível renovar o acesso à mídia.");
    } finally {
      setRenovando(false);
      queryClient.invalidateQueries({ queryKey: ["biblioteca"] });
      queryClient.invalidateQueries({ queryKey: ["trilha"] });
    }
  }


  /**
   * Chega um aviso de mudança de liberação: confere na hora se a prática segue
   * liberada. Se foi revogada, para a mídia e mostra o aviso; se voltou a ser
   * liberada, libera o player sem exigir recarregar a página.
   */
  async function revalidarLiberacao() {
    // alterações em sequência rápida: só a checagem mais recente pode mudar a tela
    const minhaVez = (revalidacaoRef.current += 1);
    try {
      const novo = await queryClient.fetchQuery({
        queryKey: ["conteudo", conteudoId],
        queryFn: () => fetchConteudo({ data: { conteudoId } }),
        staleTime: 0,
      });
      if (minhaVez !== revalidacaoRef.current) return;
      // a liberação é o que define o acesso; mídia ainda não enviada tem aviso próprio
      const liberado = Boolean(novo?.conteudo);
      if (!liberado) {
        const el = mediaRef.current;
        if (el) {
          posicaoRef.current = el.currentTime || posicaoRef.current;
          el.pause();
        }
        setTocando(false);
        if (bloqueioRef.current !== "revogado") {
          bloqueioRef.current = "revogado";
          setBloqueio("revogado");
          toast.error("Esta prática não está mais liberada para você.");
        }
        return;
      }
      if (bloqueioRef.current) {
        bloqueioRef.current = null;
        setBloqueio(null);
        toast.success("Esta prática foi liberada de novo pelo seu terapeuta.");
      }
    } catch {
      /* falha de rede: o estado atual é mantido e o botão de renovar segue disponível */
    }
  }

  /** Pequena espera entre tentativas — o botão nunca fica travado para sempre. */
  function segurarNovaTentativa() {
    setEmEspera(true);
    setEsperaAte(Date.now() + 5000);
    setTimeout(() => {
      setEmEspera(false);
      setEsperaAte(null);
    }, 5000);
  }



  async function registrar(status: "em_andamento" | "concluido") {
    if (bloqueio) return;
    await salvarProgresso({ data: { conteudoId, status } });
    queryClient.invalidateQueries({ queryKey: ["biblioteca"] });
    queryClient.invalidateQueries({ queryKey: ["conteudo", conteudoId] });
    queryClient.invalidateQueries({ queryKey: ["trilha"] });
  }

  function alternar() {
    const el = mediaRef.current;
    if (!el || bloqueio) return;
    if (el.paused) {
      void el.play();
      // um único registro de "em andamento" por sessão, mesmo após renovar
      if (!progressoIniciadoRef.current) {
        progressoIniciadoRef.current = true;
        void registrar("em_andamento");
      }
    } else {
      el.pause();
    }
  }


  function pular(segundos: number) {
    const el = mediaRef.current;
    if (el) el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + segundos));
  }

  async function concluir() {
    if (bloqueio) {
      const texto =
        bloqueio === "revogado"
          ? "Esta prática não está mais liberada. Fale com seu terapeuta se quiser continuar."
          : "Acesso à mídia expirado. Renove antes de concluir a prática.";
      toast.error(texto);
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

          {(ehMidia || bloqueio === "revogado") && (
            <div>
              <StatusMidiaBadge
                status={
                  bloqueio === "revogado" ? "revogada" : bloqueio ? "expirada" : "liberada"
                }
              />
            </div>
          )}

          {ehMidia && data?.url && !bloqueio && (

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
                  onLoadedMetadata={(e) => retomarPosicao(e.currentTarget)}
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
                    onLoadedMetadata={(e) => retomarPosicao(e.currentTarget)}
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

          {(ehMidia || bloqueio === "revogado") && bloqueio && (
            <AvisoMidiaBloqueada
              motivo={bloqueio}
              renovando={renovando}
              emEspera={emEspera}
              esperaAte={esperaAte}
              eixoId={conteudo.eixo_id}
              onRenovar={renovarMidia}
            />
          )}

          {ehMidia && !data?.url && !bloqueio && (
            <p className="mt-6 rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              A mídia desta prática ainda não foi enviada.
            </p>
          )}


          {!ehMidia && bloqueio !== "revogado" && (
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

      {!conteudo && !isLoading && bloqueio === "revogado" && (
        <>
          <div>
            <StatusMidiaBadge status="revogada" />
          </div>
          <AvisoMidiaBloqueada
            motivo="revogado"
            renovando={renovando}
            emEspera={emEspera}
            esperaAte={esperaAte}
            onRenovar={renovarMidia}
          />
        </>
      )}

    </div>
  );
}
