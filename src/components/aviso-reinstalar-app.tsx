import { RefreshCw, Share, MoreVertical, Trash2, ExternalLink } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  useInstalacaoDesatualizada,
  type PlataformaInstalacao,
} from "@/hooks/use-instalacao-desatualizada";

interface Passos {
  rotulo: string;
  remover: string[];
  instalar: string[];
}

const INSTRUCOES: Record<PlataformaInstalacao, Passos> = {
  ios: {
    rotulo: "iPhone e iPad (Safari)",
    remover: [
      "Mantenha o ícone do Raiz pressionado na tela de Início.",
      "Toque em “Remover app” e depois em “Excluir da Tela de Início”.",
    ],
    instalar: [
      "Abra o Raiz no Safari.",
      "Toque no botão Compartilhar (quadrado com a flecha para cima).",
      "Escolha “Adicionar à Tela de Início” e confirme em “Adicionar”.",
    ],
  },
  android: {
    rotulo: "Android (Chrome)",
    remover: [
      "Mantenha o ícone do Raiz pressionado na tela inicial.",
      "Toque em “Desinstalar” (ou arraste até “Desinstalar”).",
    ],
    instalar: [
      "Abra o Raiz no Chrome.",
      "Toque no menu ⋮ no canto superior direito.",
      "Escolha “Instalar app” (ou “Adicionar à tela inicial”).",
    ],
  },
  desktop: {
    rotulo: "Computador",
    remover: [
      "Abra o menu do app (⋮ na janela do Raiz) e escolha “Desinstalar”.",
      "Confirme a remoção.",
    ],
    instalar: [
      "Abra o Raiz no navegador.",
      "Clique no ícone de instalar na barra de endereço.",
      "Confirme em “Instalar”.",
    ],
  },
};

function Lista({
  titulo,
  passos,
  icone,
}: {
  titulo: string;
  passos: string[];
  icone: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icone}
        {titulo}
      </h3>
      <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
        {passos.map((passo) => (
          <li key={passo}>{passo}</li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Aviso de instalação antiga: aparece só dentro do app instalado quando o build
 * atual traz ícones/manifest mais novos do que os que ficaram salvos no
 * dispositivo. Fora disso não renderiza nada.
 */
export function AvisoReinstalarApp() {
  const { desatualizada, plataforma, dispensar } = useInstalacaoDesatualizada();
  const [mostrandoPassos, setMostrandoPassos] = useState(false);
  const [outra, setOutra] = useState<PlataformaInstalacao | null>(null);
  const caixa = useRef<HTMLDivElement | null>(null);
  const anterior = useRef<HTMLElement | null>(null);
  const tituloId = useId();
  const descricaoId = useId();

  useEffect(() => {
    if (!desatualizada) return;
    anterior.current = document.activeElement as HTMLElement | null;
    caixa.current?.querySelector<HTMLElement>("button")?.focus();
  }, [desatualizada]);

  useEffect(() => {
    if (!desatualizada) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        dispensar();
        anterior.current?.focus?.();
        return;
      }
      if (evento.key !== "Tab" || !caixa.current) return;
      const focaveis = Array.from(
        caixa.current.querySelectorAll<HTMLElement>("button, a[href]"),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0]!;
      const ultimo = focaveis[focaveis.length - 1]!;
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [desatualizada, dispensar]);

  if (!desatualizada) return null;

  const atual = INSTRUCOES[plataforma];
  const alternativas = (Object.keys(INSTRUCOES) as PlataformaInstalacao[]).filter(
    (p) => p !== plataforma,
  );
  const extra = outra ? INSTRUCOES[outra] : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-floresta/60 p-4 backdrop-blur-sm sm:items-center">
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricaoId}
        className="w-full max-w-md space-y-5 rounded-3xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="space-y-2">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <RefreshCw className="size-5" aria-hidden="true" />
          </span>
          <h2 id={tituloId} className="text-xl font-semibold text-foreground">
            Seu app está com uma versão antiga
          </h2>
          <p id={descricaoId} className="text-sm leading-relaxed text-muted-foreground">
            O ícone e a tela de abertura do Raiz foram atualizados, mas o atalho salvo no seu
            aparelho guardou a versão anterior. Reinstalar leva menos de um minuto e mantém todo o
            seu histórico, diário e progresso.
          </p>
        </div>

        <div aria-live="polite" className="sr-only">
          {mostrandoPassos ? `Instruções de reinstalação para ${atual.rotulo} abertas.` : ""}
        </div>

        {mostrandoPassos ? (
          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {atual.rotulo}
            </p>
            <Lista
              titulo="1. Remover o atalho antigo"
              passos={atual.remover}
              icone={<Trash2 className="size-4" aria-hidden="true" />}
            />
            <Lista
              titulo="2. Instalar novamente"
              passos={atual.instalar}
              icone={
                plataforma === "ios" ? (
                  <Share className="size-4" aria-hidden="true" />
                ) : (
                  <MoreVertical className="size-4" aria-hidden="true" />
                )
              }
            />

            {extra ? (
              <div className="space-y-4 rounded-2xl bg-muted/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {extra.rotulo}
                </p>
                <Lista
                  titulo="Remover"
                  passos={extra.remover}
                  icone={<Trash2 className="size-4" aria-hidden="true" />}
                />
                <Lista
                  titulo="Instalar"
                  passos={extra.instalar}
                  icone={<Share className="size-4" aria-hidden="true" />}
                />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {alternativas.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setOutra(outra === p ? null : p)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                >
                  {outra === p ? "Ocultar" : "Ver"} passos de {INSTRUCOES[p].rotulo}
                </button>
              ))}
            </div>

            <a
              href={window.location.origin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              Abrir o Raiz no navegador
            </a>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => setMostrandoPassos(true)}
            aria-expanded={mostrandoPassos}
          >
            {mostrandoPassos ? "Ver instruções novamente" : "Reinstalar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => {
              dispensar();
              anterior.current?.focus?.();
            }}
          >
            Agora não
          </Button>
        </div>
      </div>
    </div>
  );
}
