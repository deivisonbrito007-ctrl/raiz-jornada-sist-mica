import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Lock, Pencil, Share2, Sprout, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ehCompartilhada,
  eixosDaEntrada,
  recortar,
  tempoRelativo,
  type EntradaDiario,
  type Visibilidade,
} from "@/lib/diario-cliente";
import { formatarData } from "@/lib/raiz-format";

/**
 * Uma reflexão no caminho: data, prática de origem, o texto e — com calma — as
 * ações de editar, apagar e mudar quem pode ler.
 */
export function CartaoReflexao({
  entrada,
  podeCompartilhar,
  ocupado,
  onEditar,
  onApagar,
  onVisibilidade,
}: {
  entrada: EntradaDiario;
  podeCompartilhar: boolean;
  ocupado: boolean;
  onEditar: (id: string, texto: string) => Promise<void> | void;
  onApagar: (id: string) => Promise<void> | void;
  onVisibilidade: (id: string, visibilidade: Visibilidade) => Promise<void> | void;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(entrada.texto);
  const [expandido, setExpandido] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const compartilhada = ehCompartilhada(entrada);
  const { trecho, cortado } = recortar(entrada.texto);

  return (
    <article className="relative rounded-[1.75rem] bg-card p-5 shadow-organico">
      <span
        aria-hidden="true"
        className="absolute -left-[1.55rem] top-7 hidden h-3 w-3 rounded-full bg-ocre ring-4 ring-background sm:block"
      />
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-xs font-normal text-salvia">
          {formatarData(entrada.created_at)} · {tempoRelativo(entrada.created_at)}
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.65rem] uppercase tracking-wider ${
            compartilhada ? "bg-salvia/15 text-salvia" : "bg-secondary text-muted-foreground"
          }`}
        >
          {compartilhada ? (
            <>
              <Share2 className="h-3 w-3" aria-hidden="true" /> Compartilhada
            </>
          ) : (
            <>
              <Lock className="h-3 w-3" aria-hidden="true" /> Só minha
            </>
          )}
        </span>
      </header>

      {entrada.conteudos?.titulo && (
        <p className="mt-2 inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Sprout className="h-3.5 w-3.5 text-salvia" aria-hidden="true" />
          {entrada.conteudo_id ? (
            <Link
              to="/app/conteudo/$conteudoId"
              params={{ conteudoId: entrada.conteudo_id }}
              className="underline decoration-dotted underline-offset-4 hover:text-floresta"
            >
              {entrada.conteudos.titulo}
            </Link>
          ) : (
            entrada.conteudos.titulo
          )}
          {entrada.conteudos.eixos?.nome ? ` · eixo ${entrada.conteudos.eixos.nome}` : ""}
        </p>
      )}

      {eixosDaEntrada(entrada).length > 0 && (
        <ul aria-label="Eixos desta reflexão" className="mt-2 flex list-none flex-wrap gap-2 p-0">
          {eixosDaEntrada(entrada).map((eixo) => (
            <li
              key={eixo.id}
              className="rounded-full bg-salvia/10 px-2.5 py-1 text-[0.65rem] uppercase tracking-wider text-salvia"
            >
              {eixo.nome}
            </li>
          ))}
        </ul>
      )}


      {editando ? (
        <div className="mt-3">
          <label htmlFor={`editar-${entrada.id}`} className="sr-only">
            Editar reflexão
          </label>
          <Textarea
            id={`editar-${entrada.id}`}
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            rows={7}
            className="resize-none rounded-2xl border-border bg-background text-[15px] leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={ocupado || !rascunho.trim()}
              onClick={async () => {
                await onEditar(entrada.id, rascunho.trim());
                setEditando(false);
              }}
              className="min-h-10 rounded-full bg-floresta text-floresta-foreground hover:bg-floresta/90"
            >
              <Check className="mr-1.5 h-4 w-4" aria-hidden="true" /> Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRascunho(entrada.texto);
                setEditando(false);
              }}
              className="min-h-10 rounded-full"
            >
              <X className="mr-1.5 h-4 w-4" aria-hidden="true" /> Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
            {expandido ? entrada.texto : trecho}
          </p>
          {cortado && (
            <button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              className="mt-2 text-xs text-salvia underline decoration-dotted underline-offset-4"
            >
              {expandido ? "Recolher" : "Ler tudo"}
            </button>
          )}

          <footer className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditando(true)}
              className="min-h-10 rounded-full text-salvia hover:text-floresta"
            >
              <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" /> Editar
            </Button>

            {podeCompartilhar && (
              <Button
                size="sm"
                variant="ghost"
                disabled={ocupado}
                onClick={() =>
                  onVisibilidade(entrada.id, compartilhada ? "somente_eu" : "compartilhado")
                }
                className="min-h-10 rounded-full text-salvia hover:text-floresta"
              >
                {compartilhada ? (
                  <>
                    <Lock className="mr-1.5 h-4 w-4" aria-hidden="true" /> Deixar só para mim
                  </>
                ) : (
                  <>
                    <Share2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> Compartilhar
                  </>
                )}
              </Button>
            )}

            {confirmando ? (
              <span className="flex flex-wrap items-center gap-2 rounded-2xl bg-terracota/10 px-3 py-2 text-xs text-terracota">
                Apagar para sempre?
                <Button
                  size="sm"
                  disabled={ocupado}
                  onClick={() => onApagar(entrada.id)}
                  className="min-h-9 rounded-full bg-terracota text-terracota-foreground hover:bg-terracota/90"
                >
                  Apagar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmando(false)}
                  className="min-h-9 rounded-full"
                >
                  Manter
                </Button>
              </span>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmando(true)}
                className="min-h-10 rounded-full text-muted-foreground hover:text-terracota"
              >
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> Apagar
              </Button>
            )}
          </footer>
        </>
      )}
    </article>
  );
}
