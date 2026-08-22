import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, MapPin, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { getMinhaEtapa, registrarCheckin, salvarRegistroDiario } from "@/lib/trilhas.functions";
import { marcarProgresso } from "@/lib/raiz.functions";
import { EMOCOES, ETAPA_LABEL, LOCAIS_CORPO, type TipoEtapa } from "@/lib/etapas";
import { formatarDuracao } from "@/lib/raiz-format";
import { PedirApoio } from "@/components/pedir-apoio";
import { usePreCarregarProximas } from "@/hooks/use-pre-carregar-proximas";

export const Route = createFileRoute("/_authenticated/app/etapa/$conteudoId")({
  head: () => ({
    meta: [
      { title: "Etapa da trilha — Raiz" },
      {
        name: "description",
        content:
          "Faça a etapa no seu ritmo: check-in do estado, orientações da prática, registro no diário e check-out.",
      },
      { property: "og:title", content: "Etapa da trilha — Raiz" },
      {
        property: "og:description",
        content: "Prática guiada com check-in, orientações e registro de reflexão.",
      },
    ],
  }),
  component: EtapaTrilha,
});

type Fase = "checkin" | "pratica" | "checkout";

/** Materiais e sensibilidades podem vir como texto livre ou lista. */
function paraLista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map((v) => String(v)).filter(Boolean);
  if (typeof valor === "string") {
    return valor
      .split(/\r?\n|;/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}


function EtapaTrilha() {
  const { conteudoId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const carregar = useServerFn(getMinhaEtapa);
  const enviarCheckin = useServerFn(registrarCheckin);
  const salvarDiario = useServerFn(salvarRegistroDiario);
  const concluir = useServerFn(marcarProgresso);

  const { data, isLoading } = useQuery({
    queryKey: ["minha-etapa", conteudoId],
    queryFn: () => carregar({ data: { conteudoId } }),
  });

  // Enquanto a etapa atual é feita, adianta a seguinte (e a anterior, para voltar).
  usePreCarregarProximas(
    [data?.proximaId, data?.anteriorId]
      .filter((id): id is string => Boolean(id))
      .map((conteudoId) => ({
        queryKey: ["minha-etapa", conteudoId],
        carregar: () => carregar({ data: { conteudoId } }),
      })),
    Boolean(data?.etapa),
  );

  const [fase, setFase] = useState<Fase>("checkin");
  const [inicial, setInicial] = useState({
    emocao: "",
    intensidade: 5,
    localCorpo: "",
    intencao: "",
    condicoesContinuar: true,
  });
  const [final, setFinal] = useState({
    emocao: "",
    intensidade: 5,
    localCorpo: "",
    aprendizado: "",
    clareza: 5,
    precisaContato: false,
  });
  const [reflexao, setReflexao] = useState("");
  const [compartilhar, setCompartilhar] = useState(false);

  const mutCheckin = useMutation({ mutationFn: enviarCheckin });
  const mutDiario = useMutation({ mutationFn: salvarDiario });
  const mutConcluir = useMutation({ mutationFn: concluir });

  if (isLoading) {
    return (
      <p role="status" aria-busy className="text-sm text-muted-foreground">
        Carregando etapa...
      </p>
    );
  }

  const etapa = data?.etapa;
  if (!etapa) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6">
        <h1 className="font-display text-xl text-floresta">Etapa não disponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta etapa não está liberada para você neste momento.
        </p>
        <Link
          to="/app/jornada"
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-terracota px-5 py-2.5 text-sm font-medium text-terracota-foreground"
        >
          Voltar para a jornada
        </Link>
      </div>
    );
  }

  const atribuicaoId = data?.atribuicao?.id ?? null;
  const materiais = paraLista(etapa.materiais);
  const sensibilidades = paraLista(etapa.sensibilidades);

  const somenteEmSessao = Boolean(data?.atribuicao?.somente_em_sessao);

  async function finalizar() {
    await mutCheckin.mutateAsync({
      data: {
        atribuicaoId,
        conteudoId,
        momento: "final",
        emocao: final.emocao,
        intensidade: final.intensidade,
        localCorpo: final.localCorpo,
        aprendizado: final.aprendizado,
        clareza: final.clareza,
        precisaContato: final.precisaContato,
      },
    });
    if (reflexao.trim()) {
      await mutDiario.mutateAsync({
        data: {
          texto: reflexao,
          conteudoId,
          atribuicaoId,
          visibilidade: compartilhar ? "compartilhado" : "somente_eu",
        },
      });
    }
    await mutConcluir.mutateAsync({ data: { conteudoId, status: "concluido" } });
    await queryClient.invalidateQueries({ queryKey: ["minha-jornada"] });
    await queryClient.invalidateQueries({ queryKey: ["minha-etapa", conteudoId] });
    toast.success("Etapa concluída. Obrigada por cuidar disso.");
    if (data?.proximaId) {
      navigate({ to: "/app/etapa/$conteudoId", params: { conteudoId: data.proximaId } });
      setFase("checkin");
    } else {
      navigate({ to: "/app/jornada" });
    }
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Voltar">
        <Link
          to="/app/jornada"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Minha jornada
        </Link>
      </nav>

      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-salvia">
          {ETAPA_LABEL[(etapa.tipo_etapa ?? "pratica") as TipoEtapa]}
          {data?.totalEtapas ? ` · etapa ${data.posicaoEtapa} de ${data.totalEtapas}` : ""}
        </p>
        <h1 className="mt-1 font-display text-2xl text-floresta">{etapa.titulo}</h1>
        {etapa.duracao_segundos ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Duração aproximada: {formatarDuracao(etapa.duracao_segundos)}
          </p>
        ) : null}
      </header>

      {somenteEmSessao && (
        <p
          role="note"
          className="rounded-2xl border border-terracota/40 bg-terracota/10 p-4 text-sm text-foreground"
        >
          Esta trilha foi marcada para ser feita junto da sua terapeuta, em sessão.
        </p>
      )}

      {sensibilidades.length > 0 && (
        <div className="rounded-2xl border border-ocre/40 bg-ocre/10 p-4 text-sm text-foreground">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Antes de começar, saiba que esta prática pode tocar em:
          </p>
          <ul className="mt-2 list-inside list-disc text-muted-foreground">
            {sensibilidades.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {fase === "checkin" && (
        <section
          aria-labelledby="titulo-checkin"
          className="rounded-3xl border border-border bg-card p-5 shadow-organico"
        >
          <h2 id="titulo-checkin" className="font-display text-lg text-floresta">
            Como você chega agora?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sem certo ou errado. Isso só ajuda a perceber o movimento.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="checkin-emocao">O que está mais presente</Label>
              <Input
                id="checkin-emocao"
                list="lista-emocoes"
                value={inicial.emocao}
                onChange={(e) => setInicial({ ...inicial, emocao: e.target.value })}
                placeholder="Ex.: cansaço, medo, alívio"
              />
              <datalist id="lista-emocoes">
                {EMOCOES.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </div>

            <div>
              <Label htmlFor="checkin-intensidade">
                Intensidade: {inicial.intensidade} de 10
              </Label>
              <input
                id="checkin-intensidade"
                type="range"
                min={0}
                max={10}
                value={inicial.intensidade}
                onChange={(e) => setInicial({ ...inicial, intensidade: Number(e.target.value) })}
                className="mt-2 h-11 w-full accent-terracota"
              />
            </div>

            <div>
              <Label htmlFor="checkin-corpo">Onde você sente no corpo</Label>
              <Input
                id="checkin-corpo"
                list="lista-corpo"
                value={inicial.localCorpo}
                onChange={(e) => setInicial({ ...inicial, localCorpo: e.target.value })}
              />
              <datalist id="lista-corpo">
                {LOCAIS_CORPO.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </div>

            <div>
              <Label htmlFor="checkin-intencao">Sua intenção para esta etapa</Label>
              <Textarea
                id="checkin-intencao"
                rows={3}
                value={inicial.intencao}
                onChange={(e) => setInicial({ ...inicial, intencao: e.target.value })}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={inicial.condicoesContinuar}
                onCheckedChange={(v) =>
                  setInicial({ ...inicial, condicoesContinuar: v === true })
                }
              />
              Tenho condições de seguir agora
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              className="min-h-11 rounded-full"
              disabled={mutCheckin.isPending}
              onClick={() => {
                mutCheckin.mutate(
                  {
                    data: {
                      atribuicaoId,
                      conteudoId,
                      momento: "inicial",
                      emocao: inicial.emocao,
                      intensidade: inicial.intensidade,
                      localCorpo: inicial.localCorpo,
                      intencao: inicial.intencao,
                      condicoesContinuar: inicial.condicoesContinuar,
                    },
                  },
                  {
                    onSuccess: (resultado) => {
                      setFase("pratica");
                      if (resultado?.intensidadeAlta) {
                        toast.info(
                          "Intensidade alta registrada. Se precisar, use o botão de apoio.",
                        );
                      }
                    },
                    onError: () => toast.error("Não foi possível registrar o check-in."),
                  },
                );
              }}
            >
              Registrar e seguir
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
            <PedirApoio
              atribuicaoId={atribuicaoId}
              origem="checkin"
              intensidade={inicial.intensidade}
              prazoRespostaHoras={48}
              contatos={[]}
              rotulo="Não estou bem para seguir"
            />
          </div>
        </section>
      )}

      {fase === "pratica" && (
        <section
          aria-labelledby="titulo-pratica"
          className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-organico"
        >
          <h2 id="titulo-pratica" className="font-display text-lg text-floresta">
            A prática
          </h2>

          {etapa.descricao && (
            <p className="whitespace-pre-line text-sm text-foreground">{etapa.descricao}</p>
          )}

          {materiais.length > 0 && (
            <div className="rounded-2xl bg-secondary p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Package className="h-4 w-4" aria-hidden /> O que ter por perto
              </p>
              <ul className="mt-2 list-inside list-disc text-muted-foreground">
                {materiais.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {etapa.local_recomendado && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" aria-hidden /> {etapa.local_recomendado}
            </p>
          )}

          {etapa.corpo_texto && (
            <div
              className="prose prose-sm max-w-none text-foreground"
              // Conteúdo criado pela terapeuta no editor do painel.
              dangerouslySetInnerHTML={{ __html: etapa.corpo_texto }}
            />
          )}

          {etapa.storage_path && (
            <Link
              to="/app/conteudo/$conteudoId"
              params={{ conteudoId }}
              className="inline-flex min-h-11 items-center rounded-full bg-floresta px-5 py-2.5 text-sm font-medium text-floresta-foreground"
            >
              Abrir áudio ou vídeo guiado
            </Link>
          )}

          {etapa.criterios_interrupcao && (
            <div className="rounded-2xl border border-terracota/40 bg-terracota/10 p-4 text-sm text-foreground">
              <p className="font-medium">Quando parar</p>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">
                {etapa.criterios_interrupcao}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11 rounded-full" onClick={() => setFase("checkout")}>
              Terminei esta etapa
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 rounded-full"
              onClick={() => setFase("checkin")}
            >
              Voltar ao check-in
            </Button>
            <PedirApoio
              atribuicaoId={atribuicaoId}
              origem="pratica"
              prazoRespostaHoras={48}
              contatos={[]}
              rotulo="Preciso parar e falar"
            />
          </div>
        </section>
      )}

      {fase === "checkout" && (
        <section
          aria-labelledby="titulo-checkout"
          className="rounded-3xl border border-border bg-card p-5 shadow-organico"
        >
          <h2 id="titulo-checkout" className="font-display text-lg text-floresta">
            Como você sai daqui?
          </h2>

          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="checkout-emocao">O que ficou mais presente</Label>
              <Input
                id="checkout-emocao"
                list="lista-emocoes"
                value={final.emocao}
                onChange={(e) => setFinal({ ...final, emocao: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="checkout-intensidade">Intensidade: {final.intensidade} de 10</Label>
              <input
                id="checkout-intensidade"
                type="range"
                min={0}
                max={10}
                value={final.intensidade}
                onChange={(e) => setFinal({ ...final, intensidade: Number(e.target.value) })}
                className="mt-2 h-11 w-full accent-terracota"
              />
            </div>
            <div>
              <Label htmlFor="checkout-corpo">Onde você sente agora</Label>
              <Input
                id="checkout-corpo"
                list="lista-corpo"
                value={final.localCorpo}
                onChange={(e) => setFinal({ ...final, localCorpo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="checkout-clareza">Clareza: {final.clareza} de 10</Label>
              <input
                id="checkout-clareza"
                type="range"
                min={0}
                max={10}
                value={final.clareza}
                onChange={(e) => setFinal({ ...final, clareza: Number(e.target.value) })}
                className="mt-2 h-11 w-full accent-salvia"
              />
            </div>
            <div>
              <Label htmlFor="checkout-aprendizado">O que você percebeu</Label>
              <Textarea
                id="checkout-aprendizado"
                rows={3}
                value={final.aprendizado}
                onChange={(e) => setFinal({ ...final, aprendizado: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="checkout-reflexao">Registro no diário (opcional)</Label>
              <Textarea
                id="checkout-reflexao"
                rows={5}
                value={reflexao}
                onChange={(e) => setReflexao(e.target.value)}
                placeholder="Escreva livremente. Este espaço é seu."
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={compartilhar}
                  onCheckedChange={(v) => setCompartilhar(v === true)}
                />
                Compartilhar este registro com minha terapeuta
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={final.precisaContato}
                onCheckedChange={(v) => setFinal({ ...final, precisaContato: v === true })}
              />
              Quero que minha terapeuta entre em contato
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              className="min-h-11 rounded-full"
              disabled={mutCheckin.isPending || mutConcluir.isPending}
              onClick={() => {
                void finalizar().catch(() => toast.error("Não foi possível concluir agora."));
              }}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Concluir etapa
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 rounded-full"
              onClick={() => setFase("pratica")}
            >
              Voltar à prática
            </Button>
          </div>
        </section>
      )}

      <AnotacoesEtapa conteudoId={conteudoId} atribuicaoId={atribuicaoId} />

      <nav aria-label="Outras etapas" className="flex flex-wrap justify-between gap-2">

        {data?.anteriorId ? (
          <Link
            to="/app/etapa/$conteudoId"
            params={{ conteudoId: data.anteriorId }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Etapa anterior
          </Link>
        ) : (
          <span />
        )}
        {data?.proximaId && (
          <Link
            to="/app/etapa/$conteudoId"
            params={{ conteudoId: data.proximaId }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm"
          >
            Próxima etapa <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </nav>
    </div>
  );
}
