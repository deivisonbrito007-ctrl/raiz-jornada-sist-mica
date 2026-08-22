import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, NotebookPen } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { getAnotacaoEtapa, salvarAnotacaoEtapa } from "@/lib/trilhas.functions";

type Estado = "ocioso" | "salvando" | "salvo" | "erro";

/**
 * Espaço privado de anotações e reflexões da etapa. O texto é salvo sozinho
 * pouco depois de a pessoa parar de escrever — sem botão, sem risco de perder.
 */
export function AnotacoesEtapa({
  conteudoId,
  atribuicaoId,
}: {
  conteudoId: string;
  atribuicaoId: string | null;
}) {
  const carregar = useServerFn(getAnotacaoEtapa);
  const salvar = useServerFn(salvarAnotacaoEtapa);

  const { data } = useQuery({
    queryKey: ["anotacao-etapa", conteudoId, atribuicaoId],
    queryFn: () => carregar({ data: { conteudoId, atribuicaoId } }),
  });

  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<Estado>("ocioso");
  const carregado = useRef(false);
  const ultimoSalvo = useRef("");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Só preenche uma vez, para não sobrescrever o que já está sendo digitado.
  useEffect(() => {
    if (!data || carregado.current) return;
    carregado.current = true;
    setTexto(data.texto);
    ultimoSalvo.current = data.texto;
  }, [data]);

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  function agendarSalvamento(valor: string) {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(async () => {
      if (valor === ultimoSalvo.current) return;
      setEstado("salvando");
      try {
        await salvar({ data: { conteudoId, atribuicaoId, texto: valor } });
        ultimoSalvo.current = valor;
        setEstado("salvo");
      } catch {
        setEstado("erro");
      }
    }, 1200);
  }

  return (
    <section
      aria-labelledby="titulo-anotacoes"
      className="rounded-3xl border border-border bg-card p-5 shadow-organico"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="titulo-anotacoes"
            className="flex items-center gap-2 font-display text-lg text-floresta"
          >
            <NotebookPen className="h-4 w-4 text-salvia" aria-hidden="true" />
            Minhas anotações desta etapa
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escreva sem preparar as palavras. É só seu — ninguém mais vê, e salva sozinho.
          </p>
        </div>
        <Indicador estado={estado} />
      </div>

      <Textarea
        id="anotacoes-etapa"
        aria-label="Anotações e reflexões desta etapa"
        rows={6}
        value={texto}
        placeholder="O que apareceu enquanto você fazia esta etapa? Imagens, memórias, sensações..."
        onChange={(e) => {
          setTexto(e.target.value);
          setEstado("ocioso");
          agendarSalvamento(e.target.value);
        }}
        onBlur={() => agendarSalvamento(texto)}
        className="mt-4 min-h-[9rem] resize-y leading-relaxed"
      />

      <p role="status" aria-live="polite" className="mt-2 text-xs text-muted-foreground">
        {estado === "salvando"
          ? "Guardando sua anotação..."
          : estado === "salvo"
            ? "Anotação guardada."
            : estado === "erro"
              ? "Não conseguimos guardar agora. Seu texto continua aqui — tente escrever novamente em instantes."
              : "Salva automaticamente enquanto você escreve."}
      </p>
    </section>
  );
}

function Indicador({ estado }: { estado: Estado }) {
  if (estado === "salvando") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Salvando
      </span>
    );
  }
  if (estado === "salvo") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-salvia/20 px-3 py-1 text-xs text-floresta">
        <Check className="h-3 w-3" aria-hidden="true" />
        Salvo
      </span>
    );
  }
  return null;
}
