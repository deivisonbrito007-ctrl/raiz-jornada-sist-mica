import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef } from "react";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rolarParaVista } from "@/lib/rolar-para-vista";

interface Props {
  /** uma nova tentativa está em andamento */
  carregando: boolean;
  onTentar: () => void;
}

/**
 * Estado de erro do player: a prática não pôde ser carregada.
 *
 * É um `alert` com nome acessível próprio, foco automático no botão de nova
 * tentativa e uma saída de teclado garantida (link de volta à trilha), para
 * que ninguém fique preso numa tela sem caminho.
 */
export function AvisoFalhaCarregamento({ carregando, onTentar }: Props) {
  const idTitulo = useId();
  const idTexto = useId();
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  const caixaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    botaoRef.current?.focus();
    rolarParaVista(caixaRef.current, "center");
  }, []);

  return (
    <div
      ref={caixaRef}
      role="alert"
      aria-labelledby={idTitulo}
      aria-describedby={idTexto}
      aria-busy={carregando}
      className="mt-6 rounded-3xl border border-border bg-muted/30 p-6"
    >
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {carregando
          ? "Tentando carregar a prática novamente."
          : "Player indisponível: não foi possível carregar esta prática."}
      </p>

      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex-1">
          <h2 id={idTitulo} className="text-lg text-floresta">
            Não conseguimos carregar esta prática
          </h2>
          <p id={idTexto} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Pode ter sido uma falha de conexão. Nada do seu progresso foi perdido — tente carregar de
            novo ou volte à trilha e entre na prática outra vez.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              ref={botaoRef}
              onClick={onTentar}
              aria-disabled={carregando}
              className="min-h-11 rounded-full bg-floresta px-6 text-floresta-foreground hover:bg-floresta/90 focus-visible:ring-2 focus-visible:ring-floresta focus-visible:ring-offset-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              {carregando ? "Carregando..." : "Tentar de novo"}
            </Button>
            <Link
              to="/app"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-floresta/20 px-6 text-sm text-floresta hover:bg-floresta/5 focus-visible:ring-2 focus-visible:ring-floresta focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar à trilha
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
