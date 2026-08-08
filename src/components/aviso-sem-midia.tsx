import { Link } from "@tanstack/react-router";
import { useId, useRef } from "react";
import { CloudOff, NotebookPen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** trilha de origem, para a saída de teclado */
  eixoId?: string;
  /** uma verificação está em andamento */
  carregando: boolean;
  onVerificar: () => void;
}

/**
 * Estado "mídia ainda não enviada": a prática existe e está liberada, mas o
 * arquivo não foi publicado pelo terapeuta.
 *
 * Vira uma região nomeada, com anúncio do estado do player e dois caminhos
 * alcançáveis por teclado (verificar de novo e ir ao diário), em vez de um
 * texto solto sem interação.
 */
export function AvisoSemMidia({ eixoId, carregando, onVerificar }: Props) {
  const idTitulo = useId();
  const idTexto = useId();
  const botaoRef = useRef<HTMLButtonElement | null>(null);

  return (
    <section
      aria-labelledby={idTitulo}
      aria-describedby={idTexto}
      aria-busy={carregando}
      className="mt-6 rounded-3xl border border-dashed border-border p-6"
    >
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {carregando
          ? "Verificando se a mídia desta prática já foi enviada."
          : "Player indisponível: a mídia desta prática ainda não foi enviada pelo terapeuta."}
      </p>

      <div className="flex items-start gap-3">
        <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex-1">
          <h2 id={idTitulo} className="text-lg text-floresta">
            A mídia ainda não foi enviada
          </h2>
          <p id={idTexto} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Esta prática já está liberada para você, mas o arquivo de áudio ou vídeo ainda não foi
            publicado pelo seu terapeuta. Não há nada para reproduzir por enquanto — você pode
            verificar de novo mais tarde ou registrar algo no diário.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              ref={botaoRef}
              onClick={onVerificar}
              aria-disabled={carregando}
              variant="outline"
              className="min-h-11 rounded-full border-floresta/20 px-6 text-floresta focus-visible:ring-2 focus-visible:ring-floresta focus-visible:ring-offset-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              {carregando ? "Verificando..." : "Verificar de novo"}
            </Button>
            <Link
              to="/app/diario"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-6 text-sm text-floresta hover:bg-floresta/5 focus-visible:ring-2 focus-visible:ring-floresta focus-visible:ring-offset-2"
            >
              <NotebookPen className="h-4 w-4" aria-hidden="true" /> Ir ao diário
            </Link>
            {eixoId && (
              <Link
                to="/app/eixo/$eixoId"
                params={{ eixoId }}
                className="inline-flex min-h-11 items-center rounded-full px-6 text-sm text-muted-foreground hover:text-floresta focus-visible:ring-2 focus-visible:ring-floresta focus-visible:ring-offset-2"
              >
                Voltar à trilha
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
