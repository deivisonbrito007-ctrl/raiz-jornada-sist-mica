import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { notificarErro } from "@/lib/erro-permissao";
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
    try {
      await salvar({ data: { texto, conteudoId: conteudoId ?? null } });
      setTexto("");
      queryClient.invalidateQueries({ queryKey: ["diario"] });
      toast.success("Reflexão guardada.");
    } catch (erro) {
      notificarErro(erro, "Não foi possível salvar sua reflexão");
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

      <div className="mt-7 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <p className="font-display text-lg leading-snug text-floresta">{prompt}</p>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={7}
          placeholder="Escreva sem filtro. Ninguém além de vocês dois lê isto."
          className="mt-4 resize-none rounded-2xl border-border bg-background text-[15px] leading-relaxed"
        />
        <Button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="mt-4 w-full rounded-full bg-terracota py-6 text-base font-semibold text-terracota-foreground hover:bg-terracota/90"
        >
          {enviando ? "Guardando..." : "Salvar reflexão"}
        </Button>
      </div>

      <h2 className="mt-10 text-xl text-floresta">Entradas anteriores</h2>
      <div className="mt-4 space-y-4">
        {(entradas ?? []).length === 0 && (
          <p className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Suas reflexões aparecerão aqui.
          </p>
        )}
        {(entradas ?? []).map((entrada) => (
          <article key={entrada.id} className="rounded-3xl bg-secondary p-5">
            <p className="text-xs text-salvia">
              {formatarData(entrada.created_at)}
              {entrada.conteudos?.titulo ? ` · ${entrada.conteudos.titulo}` : ""}
            </p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
              {entrada.texto}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
