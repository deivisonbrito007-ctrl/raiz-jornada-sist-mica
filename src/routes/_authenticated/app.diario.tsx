import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { getConteudo, listarDiario, salvarDiario } from "@/lib/raiz.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatarData } from "@/lib/raiz-format";

export const Route = createFileRoute("/_authenticated/app/diario")({
  validateSearch: z.object({ conteudoId: z.string().uuid().optional() }),
  component: Diario,
});

const PROMPTS = [
  "O que se moveu no seu corpo durante a prática?",
  "Que imagem ou lembrança apareceu com mais força?",
  "O que você reconhece hoje que ontem ainda não conseguia?",
  "Se pudesse dizer uma frase a essa pessoa do seu sistema, qual seria?",
];

function Diario() {
  const { conteudoId } = Route.useSearch();
  const queryClient = useQueryClient();
  const fetchDiario = useServerFn(listarDiario);
  const fetchConteudo = useServerFn(getConteudo);
  const salvar = useServerFn(salvarDiario);

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [anuncio, setAnuncio] = useState("");

  const { data: entradas } = useQuery({ queryKey: ["diario"], queryFn: () => fetchDiario() });
  const { data: conteudo } = useQuery({
    queryKey: ["conteudo", conteudoId],
    queryFn: () => fetchConteudo({ data: { conteudoId: conteudoId! } }),
    enabled: Boolean(conteudoId),
  });

  const prompt = conteudoId
    ? `Depois de "${conteudo?.conteudo?.titulo ?? "esta prática"}": o que se moveu em você?`
    : PROMPTS[new Date().getDay() % PROMPTS.length];

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    setAnuncio("Guardando sua reflexão...");
    try {
      await salvar({ data: { texto, conteudoId: conteudoId ?? null } });
      setTexto("");
      queryClient.invalidateQueries({ queryKey: ["diario"] });
      toast.success("Reflexão guardada.");
      setAnuncio("Reflexão guardada.");
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Não foi possível salvar";
      toast.error(mensagem);
      setAnuncio(`Erro ao salvar: ${mensagem}`);
    } finally {
      setEnviando(false);
    }
  }


  return (
    <div>
      <h1 className="text-3xl text-floresta">Diário de reflexão</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Um espaço privado entre você e quem acompanha o seu processo.
      </p>

      <p aria-live="polite" role="status" className="sr-only">
        {anuncio}
      </p>

      <section aria-labelledby="titulo-nova-reflexao" className="mt-7 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <h2 id="titulo-nova-reflexao" className="sr-only">
          Nova reflexão
        </h2>
        <label htmlFor="campo-reflexao" className="block font-display text-lg leading-snug text-floresta">
          {prompt}
        </label>
        <Textarea
          id="campo-reflexao"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={7}
          aria-describedby="dica-reflexao"
          placeholder="Escreva sem filtro. Ninguém além de vocês dois lê isto."
          className="mt-4 resize-none rounded-2xl border-border bg-background text-[15px] leading-relaxed"
        />
        <p id="dica-reflexao" className="mt-2 text-xs text-muted-foreground">
          Escreva sem filtro. Ninguém além de você e de quem acompanha o seu processo lê isto.
        </p>
        <Button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          aria-busy={enviando}
          className="mt-4 w-full rounded-full bg-terracota py-6 text-base font-semibold text-terracota-foreground hover:bg-terracota/90"
        >
          {enviando ? "Guardando..." : "Salvar reflexão"}
        </Button>
      </section>

      <h2 className="mt-10 text-xl text-floresta" id="titulo-entradas">
        Entradas anteriores
      </h2>
      {(entradas ?? []).length === 0 ? (
        <p className="mt-4 rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Suas reflexões aparecerão aqui.
        </p>
      ) : (
        <ul aria-labelledby="titulo-entradas" className="mt-4 space-y-4 list-none p-0">
          {(entradas ?? []).map((entrada) => (
            <li key={entrada.id}>
              <article className="rounded-3xl bg-secondary p-5">
                <h3 className="text-xs font-normal text-salvia">
                  {formatarData(entrada.created_at)}
                  {entrada.conteudos?.titulo ? ` · ${entrada.conteudos.titulo}` : ""}
                </h3>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                  {entrada.texto}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}
