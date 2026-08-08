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
import { getConteudo, marcarProgresso, salvarPosicao } from "@/lib/raiz.functions";
import { TIPO_LABEL, formatarDuracao } from "@/lib/raiz-format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AvisoMidiaBloqueada, MotivoBloqueio } from "@/components/aviso-midia-bloqueada";
import { useFocoRetorno } from "@/hooks/use-foco-retorno";
import { StatusMidiaBadge } from "@/components/status-midia";
import { useSincronizarLiberacoes } from "@/hooks/use-sincronizar-liberacoes";


export const Route = createFileRoute("/_authenticated/app/conteudo/$conteudoId")({
  // ?retomar=1 vem do botão "Continuar de onde parei" na trilha
  validateSearch: (busca: Record<string, unknown>): { retomar?: boolean } => {
    const v = busca["retomar"];
    const ligado = v === true || v === "true" || v === "1";
    return ligado ? { retomar: true } : {};
  },
  component: Player,
});

/** Antecedência do aviso "prestes a expirar" antes do fim do link seguro. */
export const AVISO_ANTECEDENCIA_MS = 60_000;

function ehMidiaTipo(tipo?: string) {
  return tipo === "video" || tipo === "audio";
}


function Player() {
  const { conteudoId } = Route.useParams();
  // Route.useSearch pode não existir em ambientes de teste com router simulado
  const { retomar: retomarAoAbrir } = (Route.useSearch?.() ?? {}) as { retomar?: boolean };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchConteudo = useServerFn(getConteudo);
  const salvarProgresso = useServerFn(marcarProgresso);
  const persistirPosicao = useServerFn(salvarPosicao);

  const { data, isLoading } = useQuery({
    queryKey: ["conteudo", conteudoId],
    queryFn: () => fetchConteudo({ data: { conteudoId } }),
  });

  // A remoção da prática tem aviso próprio; as outras mudanças passam pela
  // revalidação da liberação (que decide entre liberar e bloquear).
  useSincronizarLiberacoes((mudanca) => {
    if (mudanca.tipo === "removido" && mudanca.conteudoId === conteudoId) {
      pararMidia();
      if (bloqueioRef.current !== "removido") {
        bloqueioRef.current = "removido";
        setBloqueio("removido");
        toast.error("Esta prática foi removida pelo seu terapeuta.");
      }
      return;
    }
    void revalidarLiberacao();
  });

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  /** link de saída: recebe o foco quando a pessoa pressiona Esc no aviso */
  const voltarRef = useRef<HTMLAnchorElement | null>(null);
  /** botão principal do player: destino do foco quando o acesso é liberado */
  const playRef = useRef<HTMLButtonElement | null>(null);
  const posicaoRef = useRef(0);
  /** estava tocando no instante em que o link venceu? */
  const tocandoAntesRef = useRef(false);
  /** deve dar play sozinho quando a nova mídia carregar? */
  const retomarAutoRef = useRef(false);
  /** o pedido de retomada automática (vindo da trilha) já foi consumido? */
  const retomadaPedidaRef = useRef(false);
  /** o "em andamento" desta sessão já foi registrado — não repetir na retomada */
  const progressoIniciadoRef = useRef(false);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [total, setTotal] = useState(0);
  const [terminou, setTerminou] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [bloqueio, setBloqueio] = useState<MotivoBloqueio | null>(null);
  /** o link seguro está perto de vencer: mostramos o aviso antes de interromper */
  const [prestesAExpirar, setPrestesAExpirar] = useState(false);
  /** espelho do bloqueio para leitura dentro de callbacks de tempo real */
  const bloqueioRef = useRef<MotivoBloqueio | null>(null);
  /** ordem das revalidações concorrentes — só a última pode aplicar estado */
  const revalidacaoRef = useRef(0);
  const [renovando, setRenovando] = useState(false);
  const [emEspera, setEmEspera] = useState(false);
  /** quando a nova tentativa volta a ser permitida (usado na contagem do aviso) */
  const [esperaAte, setEsperaAte] = useState<number | null>(null);

  // Foco: guarda quem estava focado quando o aviso apareceu e devolve o foco
  // depois que o acesso é liberado — de volta ao controle original ou, se ele
  // foi desmontado durante o bloqueio, ao botão de reprodução recriado.
  const { registrarOrigem } = useFocoRetorno(bloqueio !== null, {
    alternativo: () => playRef.current,
    fallback: () => voltarRef.current,
  });



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

  // Carga nova da página (F5 ou novo acesso) com a liberação já revogada: o
  // servidor não devolve a prática, então a tela mostra o mesmo aviso de sempre
  // em vez de ficar vazia — nenhum trecho já visto volta a ficar acessível.
  useEffect(() => {
    if (isLoading || !data) return;
    const semAcesso = !data.conteudo && !(data as { limitado?: boolean }).limitado;
    if (semAcesso && bloqueioRef.current !== "revogado" && bloqueioRef.current !== "removido") {
      bloqueioRef.current = "revogado";
      setBloqueio("revogado");
    }
  }, [data, isLoading]);

  useEffect(() => {
    setConcluido(data?.status === "concluido");
    if (data?.status && data.status !== "nao_iniciado") progressoIniciadoRef.current = true;
  }, [data?.status]);

  /** a posição guardada no backend já foi aplicada nesta visita? */
  const posicaoRestauradaRef = useRef(false);
  /** última posição enviada ao backend, para não gravar a mesma coisa toda hora */
  const ultimaSalvaRef = useRef(-1);

  // Retoma o ponto exato salvo no backend — vale após fechar o app, recarregar
  // a página ou continuar em outro aparelho.
  useEffect(() => {
    if (posicaoRestauradaRef.current) return;
    if (typeof data?.posicaoSegundos !== "number") return;
    posicaoRestauradaRef.current = true;
    // vindo do botão "Continuar de onde parei": já volta a tocar sozinho
    if (retomarAoAbrir && !retomadaPedidaRef.current && data.posicaoSegundos > 0) {
      retomadaPedidaRef.current = true;
      retomarAutoRef.current = true;
      tocandoAntesRef.current = true;
    }
    if (data.posicaoSegundos > 0) {
      posicaoRef.current = data.posicaoSegundos;
      ultimaSalvaRef.current = data.posicaoSegundos;
      setTempo(data.posicaoSegundos);
      const el = mediaRef.current;
      if (el && el.readyState > 0) el.currentTime = data.posicaoSegundos;
    }
  }, [data?.posicaoSegundos, retomarAoAbrir]);

  /** Grava no backend onde a pessoa parou (no máximo uma gravação a cada 5s). */
  function guardarPosicao(agora = false) {
    const el = mediaRef.current;
    if (!el || bloqueioRef.current) return;
    const pos = Math.floor(el.currentTime || posicaoRef.current || 0);
    posicaoRef.current = el.currentTime || posicaoRef.current;
    if (!agora && Math.abs(pos - ultimaSalvaRef.current) < 5) return;
    ultimaSalvaRef.current = pos;
    void Promise.resolve(
      persistirPosicao({ data: { conteudoId, posicaoSegundos: pos, tocando: !el.paused } }),
    ).catch(() => {
      // falhou: libera a próxima tentativa em vez de perder a posição
      ultimaSalvaRef.current = -1;
    });
  }

  /** Terminou a prática: a próxima escuta começa do início. */
  function zerarPosicao() {
    posicaoRef.current = 0;
    ultimaSalvaRef.current = 0;
    void Promise.resolve(
      persistirPosicao({ data: { conteudoId, posicaoSegundos: 0, tocando: false } }),
    ).catch(() => {
      ultimaSalvaRef.current = -1;
    });
  }

  // Fechar a aba, minimizar o app ou sair da tela também salva o ponto atual.
  useEffect(() => {
    const aoSair = () => guardarPosicao(true);
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") aoSair();
    };
    window.addEventListener("pagehide", aoSair);
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      window.removeEventListener("pagehide", aoSair);
      document.removeEventListener("visibilitychange", aoEsconder);
      aoSair();
    };
  }, [conteudoId]);


  const conteudo = data?.conteudo;
  const ehMidia = conteudo?.tipo === "video" || conteudo?.tipo === "audio";

  /** Para a mídia guardando onde a pessoa estava — usado quando o acesso cai. */
  function pararMidia() {
    const el = mediaRef.current;
    if (el) {
      posicaoRef.current = el.currentTime || posicaoRef.current;
      tocandoAntesRef.current = !el.paused;
      el.pause();
    }
    setTocando(false);
  }

  function expirarMidia() {
    pararMidia();
    setBloqueio("validade");
    toast.error("O link seguro desta prática expirou. Renove o acesso para continuar.");
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

  // O servidor recusou gerar um novo link por excesso de pedidos: avisamos e
  // seguramos o botão pelo tempo que ele pediu, em vez de falhar em silêncio.
  useEffect(() => {
    if (data?.limitado) {
      setBloqueio("limite");
      segurarNovaTentativa((data.esperarSegundos || 5) * 1000);
    }
  }, [data?.limitado, data?.esperarSegundos]);

  // O link seguro da mídia tem validade limitada: ao chegar ao fim, o player para
  // sozinho e passa a exigir uma nova liberação em vez de tentar tocar um link morto.
  // Antes disso, avisamos que está prestes a expirar, para dar tempo de renovar.
  useEffect(() => {
    if (!data?.url || !data?.urlExpiraEm) return;
    setBloqueio(null);
    setPrestesAExpirar(false);
    const restante = new Date(data.urlExpiraEm).getTime() - Date.now();
    if (restante <= 0) {
      expirarMidia();
      return;
    }
    // aviso prévio: 60s antes, ou na metade do tempo quando a validade é curta
    const antecedencia = Math.min(AVISO_ANTECEDENCIA_MS, Math.floor(restante / 2));
    const avisar = setTimeout(() => {
      setPrestesAExpirar(true);
      const segundos = Math.max(1, Math.round(antecedencia / 1000));
      toast.warning(
        `Esta prática expira em cerca de ${segundos} ${segundos === 1 ? "segundo" : "segundos"}. Renove o acesso para não interromper.`,
      );
    }, restante - antecedencia);
    const timer = setTimeout(expirarMidia, restante);
    return () => {
      clearTimeout(avisar);
      clearTimeout(timer);
    };
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
      if (novo?.limitado) {
        setBloqueio("limite");
        segurarNovaTentativa((novo.esperarSegundos || 5) * 1000);
        toast.error(
          `Muitos pedidos de link em pouco tempo. Aguarde ${novo.esperarSegundos || 5}s e tente de novo.`,
        );
      } else if (novo?.url) {
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
        if (bloqueioRef.current !== "revogado" && bloqueioRef.current !== "removido") {
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
  function segurarNovaTentativa(espera = 5000) {
    setEmEspera(true);
    setEsperaAte(Date.now() + espera);
    setTimeout(() => {
      setEmEspera(false);
      setEsperaAte(null);
    }, espera);
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
          ref={voltarRef}
          to="/app/eixo/$eixoId"
          params={{ eixoId: conteudo.eixo_id }}
          className="inline-flex items-center gap-1.5 rounded-full text-sm text-muted-foreground hover:text-floresta focus-visible:ring-2 focus-visible:ring-floresta focus-visible:ring-offset-2"
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

          {(ehMidia || bloqueio === "revogado" || bloqueio === "removido") && (
            <div>
              <StatusMidiaBadge
                status={
                  bloqueio === "revogado" || bloqueio === "removido"
                    ? "revogada"
                    : bloqueio === "limite"
                      ? "limitada"
                      : bloqueio
                        ? "expirada"
                        : "liberada"

                }
              />
            </div>
          )}

          {(ehMidia || bloqueio === "revogado" || bloqueio === "removido") && (
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {bloqueio === "removido"
                ? "Player indisponível: esta prática foi removida pelo terapeuta."
                : bloqueio === "revogado"
                  ? "Player indisponível: esta prática não está mais liberada."
                  : bloqueio === "limite"
                    ? "Player pausado: muitos pedidos de link em pouco tempo. Aguarde para renovar o acesso."
                    : bloqueio
                      ? `Player pausado: o link seguro expirou em ${formatarDuracao(Math.floor(tempo))}. Renove o acesso para continuar.`
                      : renovando
                        ? "Renovando o acesso à mídia."
                        : prestesAExpirar
                          ? "Atenção: o link seguro desta prática está prestes a expirar. Renove o acesso para não interromper."
                          : terminou
                            ? "Prática concluída até o fim."
                            : tocando
                              ? `Reproduzindo, ${formatarDuracao(Math.floor(tempo))} de ${formatarDuracao(Math.floor(total))}.`
                              : `Pausado em ${formatarDuracao(Math.floor(tempo))} de ${formatarDuracao(Math.floor(total))}.`}
            </p>
          )}

          {/* Aviso prévio: dá tempo de renovar antes de a mídia ser interrompida */}
          {ehMidia && prestesAExpirar && !bloqueio && (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-ocre/30 bg-ocre/10 p-4"
            >
              <p className="text-sm text-floresta">
                O link seguro desta prática está prestes a expirar. Renove agora para continuar sem
                interrupção.
              </p>
              <Button
                onClick={(e) => {
                  registrarOrigem(e.currentTarget);
                  renovarMidia();
                }}
                disabled={renovando || emEspera}
                className="rounded-full bg-floresta px-5 text-floresta-foreground hover:bg-floresta/90"
              >
                {renovando ? "Renovando..." : "Renovar acesso"}
              </Button>
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
                  onPause={() => {
                    setTocando(false);
                    guardarPosicao(true);
                  }}
                  onTimeUpdate={(e) => {
                    setTempo(e.currentTarget.currentTime);
                    guardarPosicao();
                  }}
                  onLoadedMetadata={(e) => retomarPosicao(e.currentTarget)}
                  onEnded={() => {
                    setTocando(false);
                    setTerminou(true);
                    zerarPosicao();
                  }}
                  onError={expirarMidia}
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-2xl bg-floresta-foreground/5">
                  <audio
                    ref={mediaRef as React.RefObject<HTMLAudioElement>}
                    src={data.url}
                    onPlay={() => setTocando(true)}
                    onPause={() => {
                      setTocando(false);
                      guardarPosicao(true);
                    }}
                    onTimeUpdate={(e) => {
                      setTempo(e.currentTarget.currentTime);
                      guardarPosicao();
                    }}
                    onLoadedMetadata={(e) => retomarPosicao(e.currentTarget)}
                    onEnded={() => {
                      setTocando(false);
                      setTerminou(true);
                      zerarPosicao();
                    }}
                    onError={expirarMidia}
                  />

                  <p className="font-display text-lg text-floresta-foreground/70">
                    Feche os olhos e apenas escute.
                  </p>
                </div>
              )}

              <div className="mt-4 px-1">
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-floresta-foreground/20"
                  role="progressbar"
                  aria-label="Progresso da reprodução"
                  aria-valuemin={0}
                  aria-valuemax={Math.floor(total) || 0}
                  aria-valuenow={Math.floor(tempo)}
                  aria-valuetext={`${formatarDuracao(Math.floor(tempo))} de ${formatarDuracao(Math.floor(total))}`}
                >
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

              <div
                className="mt-4 flex items-center justify-center gap-6"
                role="group"
                aria-label="Controles de reprodução"
              >
                <button
                  onClick={() => pular(-15)}
                  className="rounded-full text-floresta-foreground/80 hover:text-ocre focus-visible:ring-2 focus-visible:ring-ocre focus-visible:ring-offset-2"
                  aria-label="Voltar 15 segundos"
                >
                  <RotateCcw className="h-6 w-6" />
                </button>
                <button
                  ref={playRef}
                  onClick={alternar}
                  className="rounded-full bg-terracota p-4 text-terracota-foreground focus-visible:ring-2 focus-visible:ring-ocre focus-visible:ring-offset-2"
                  aria-label={tocando ? "Pausar" : "Reproduzir"}
                  aria-pressed={tocando}
                >
                  {tocando ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
                </button>
                <button
                  onClick={() => pular(15)}
                  className="rounded-full text-floresta-foreground/80 hover:text-ocre focus-visible:ring-2 focus-visible:ring-ocre focus-visible:ring-offset-2"
                  aria-label="Avançar 15 segundos"
                >
                  <RotateCw className="h-6 w-6" />
                </button>
              </div>
            </div>
          )}

          {(ehMidia || bloqueio === "revogado" || bloqueio === "removido") && bloqueio && (
            <AvisoMidiaBloqueada
              motivo={bloqueio}
              renovando={renovando}
              emEspera={emEspera}
              esperaAte={esperaAte}
              eixoId={conteudo.eixo_id}
              onRenovar={renovarMidia}
              onSair={() => voltarRef.current?.focus()}
            />
          )}

          {ehMidia && !data?.url && !bloqueio && (
            <p className="mt-6 rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              A mídia desta prática ainda não foi enviada.
            </p>
          )}


          {!ehMidia && bloqueio !== "revogado" && bloqueio !== "removido" && (
            <div className="mt-6 whitespace-pre-line rounded-3xl bg-card p-6 text-[15px] leading-relaxed text-foreground shadow-[var(--shadow-organico)]">
              {conteudo.corpo_texto || "Conteúdo em preparação."}
            </div>
          )}

          {/* Nada de concluir nem diário enquanto o acesso está bloqueado: os CTAs
              saem da tela no mesmo instante em que a prática expira ou é removida. */}
          {!bloqueio && (
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
          )}
        </>
      )}

      {!conteudo && !isLoading && (bloqueio === "revogado" || bloqueio === "removido") && (
        <>
          <div>
            <StatusMidiaBadge status="revogada" />
          </div>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {bloqueio === "removido"
              ? "Player indisponível: esta prática foi removida pelo terapeuta."
              : "Player indisponível: o terapeuta recolheu o acesso a esta prática."}
          </p>
          <AvisoMidiaBloqueada
            motivo={bloqueio}
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
