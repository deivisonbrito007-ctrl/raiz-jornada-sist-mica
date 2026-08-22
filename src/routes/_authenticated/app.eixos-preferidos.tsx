import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Lock, Star } from "lucide-react";
import { toast } from "sonner";

import { getMeuContexto, getMinhaBiblioteca, salvarPreferenciasEixos } from "@/lib/raiz.functions";
import { CHAVES } from "@/lib/cache-chaves";
import { IconeEixo } from "@/components/icone-eixo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/eixos-preferidos")({
  head: () => ({
    meta: [
      { title: "Meus eixos preferidos — Raiz" },
      {
        name: "description",
        content:
          "Escolha os eixos que mais fazem sentido para você e qual deles quer ver em destaque no Início.",
      },
      { property: "og:title", content: "Meus eixos preferidos — Raiz" },
      {
        property: "og:description",
        content: "Personalize os temas do seu processo e o eixo em destaque no Início.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EixosPreferidos,
});

function EixosPreferidos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const buscarBiblioteca = useServerFn(getMinhaBiblioteca);
  const buscarContexto = useServerFn(getMeuContexto);
  const salvar = useServerFn(salvarPreferenciasEixos);

  const { data: biblioteca, isLoading } = useQuery({
    queryKey: CHAVES.biblioteca,
    queryFn: () => buscarBiblioteca(),
  });
  const { data: contexto } = useQuery({
    queryKey: CHAVES.contexto,
    queryFn: () => buscarContexto(),
  });

  const [preferidos, setPreferidos] = useState<string[]>([]);
  const [destaque, setDestaque] = useState<string | null>(null);

  useEffect(() => {
    const perfil = contexto?.perfil;
    if (!perfil) return;
    setPreferidos(perfil.eixos_preferidos ?? []);
    setDestaque(perfil.eixo_destaque ?? null);
  }, [contexto?.perfil]);

  const eixos = biblioteca?.eixos ?? [];
  const liberados = eixos.filter((e) => e.liberado);
  const fechados = eixos.filter((e) => !e.liberado);

  const mutation = useMutation({
    mutationFn: () => salvar({ data: { preferidos, destaque } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.contexto });
      toast.success("Suas preferências de eixos foram guardadas.");
      navigate({ to: "/app" });
    },
    onError: () => toast.error("Não foi possível guardar suas preferências agora."),
  });

  function alternar(id: string) {
    setPreferidos((atual) => {
      const marcado = atual.includes(id);
      const novo = marcado ? atual.filter((x) => x !== id) : [...atual, id];
      if (marcado && destaque === id) setDestaque(null);
      return novo;
    });
  }

  return (
    <div>
      <Link
        to="/app"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-floresta"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao Início
      </Link>

      <h1 className="mt-4 font-display text-3xl leading-tight text-floresta">Meus eixos</h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Marque os temas que mais fazem sentido para o seu momento. Eles aparecem primeiro no Início.
        Depois, escolha um deles para ficar em destaque.
      </p>

      {isLoading ? (
        <div className="mt-8 space-y-3" role="status" aria-busy="true">
          <span className="sr-only">Carregando seus eixos</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-3xl bg-salvia/10" />
          ))}
        </div>
      ) : (
        <>
          <section aria-labelledby="titulo-escolher" className="mt-8">
            <h2 id="titulo-escolher" className="font-display text-xl text-floresta">
              Escolher meus eixos
            </h2>
            {liberados.length === 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Assim que um eixo for liberado para você, ele aparece aqui para ser escolhido.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {liberados.map((eixo) => {
                  const marcado = preferidos.includes(eixo.id);
                  return (
                    <li key={eixo.id}>
                      <button
                        type="button"
                        onClick={() => alternar(eixo.id)}
                        aria-pressed={marcado}
                        className={`flex w-full items-start gap-4 rounded-3xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          marcado
                            ? "border-salvia bg-secondary shadow-organico"
                            : "border-border bg-card"
                        }`}
                      >
                        <span className="rounded-2xl bg-secondary p-3 text-floresta">
                          <IconeEixo nome={eixo.icone} className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-lg text-floresta">
                            {eixo.nome}
                          </span>
                          <span className="mt-1 block line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                            {eixo.descricao}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                            marcado
                              ? "border-salvia bg-salvia text-salvia-foreground"
                              : "border-border"
                          }`}
                        >
                          {marcado && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="titulo-destaque" className="mt-10">
            <h2 id="titulo-destaque" className="font-display text-xl text-floresta">
              Em destaque no Início
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              O eixo em destaque aparece primeiro e é lembrado na sua saudação.
            </p>
            {preferidos.length === 0 ? (
              <p className="mt-4 rounded-3xl bg-secondary p-5 text-sm leading-relaxed text-muted-foreground">
                Marque ao menos um eixo acima para poder escolher o destaque.
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-labelledby="titulo-destaque"
                className="mt-4 flex flex-wrap gap-2"
              >
                {liberados
                  .filter((e) => preferidos.includes(e.id))
                  .map((eixo) => {
                    const ativo = destaque === eixo.id;
                    return (
                      <button
                        key={eixo.id}
                        type="button"
                        role="radio"
                        aria-checked={ativo}
                        onClick={() => setDestaque(ativo ? null : eixo.id)}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          ativo
                            ? "border-terracota bg-terracota text-terracota-foreground"
                            : "border-border bg-card text-floresta"
                        }`}
                      >
                        <Star
                          className={`h-4 w-4 ${ativo ? "fill-current" : ""}`}
                          aria-hidden="true"
                        />
                        {eixo.nome}
                      </button>
                    );
                  })}
              </div>
            )}
          </section>

          {fechados.length > 0 && (
            <section aria-labelledby="titulo-fechados" className="mt-10">
              <h2 id="titulo-fechados" className="font-display text-xl text-floresta">
                Ainda não abertos
              </h2>
              <ul className="mt-4 space-y-2">
                {fechados.map((eixo) => (
                  <li
                    key={eixo.id}
                    className="flex items-center gap-3 rounded-3xl border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground"
                  >
                    <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {eixo.nome}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="mt-10 min-h-12 w-full rounded-full bg-floresta text-floresta-foreground hover:bg-floresta/90"
          >
            {mutation.isPending ? "Guardando…" : "Guardar minhas escolhas"}
          </Button>
        </>
      )}
    </div>
  );
}
