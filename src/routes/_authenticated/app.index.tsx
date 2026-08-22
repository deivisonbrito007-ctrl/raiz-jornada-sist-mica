import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMeuContexto, getMinhaBiblioteca } from "@/lib/raiz.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { calcularStreak } from "@/lib/raiz-format";
import { LembreteRetorno } from "@/components/lembrete-retorno";
import { useSincronizarLiberacoes } from "@/hooks/use-sincronizar-liberacoes";
import { VitrinePacotes } from "@/components/vitrine-pacotes";
import { blocosDoModo, normalizarModo } from "@/lib/modo-uso";
import { cicloAtual, conviteDeHoje, eixoEmDestaque, praticasNaSemana } from "@/lib/inicio-cliente";
import { SaudacaoInicio } from "@/components/app-inicio/saudacao-inicio";
import { PraticaDeHoje } from "@/components/app-inicio/pratica-de-hoje";
import { PalavraDaTerapeuta } from "@/components/app-inicio/palavra-da-terapeuta";
import { CarrosselEixos } from "@/components/app-inicio/carrossel-eixos";
import { MomentosRapidos } from "@/components/app-inicio/momentos-rapidos";
import { BuscarPraticas } from "@/components/app-inicio/buscar-praticas";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Início — Raiz" },
      {
        name: "description",
        content:
          "Sua prática de hoje, o recado da terapeuta e o ritmo da sua semana, num só lugar.",
      },
      { property: "og:title", content: "Início — Raiz" },
      {
        property: "og:description",
        content: "O convite do dia, seus eixos e o seu ritmo de prática no Raiz.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  useSincronizarLiberacoes();
  const fetchBiblioteca = useServerFn(getMinhaBiblioteca);
  const fetchContexto = useServerFn(getMeuContexto);
  const { data: contexto } = useQuery({ queryKey: ["contexto"], queryFn: () => fetchContexto() });
  const { data, isLoading } = useQuery({
    queryKey: ["biblioteca"],
    queryFn: () => fetchBiblioteca(),
  });

  const primeiroNome = (contexto?.perfil?.nome || "").split(" ")[0] ?? "";
  const blocos = blocosDoModo(normalizarModo(contexto?.modo));

  const praticas = data?.praticas ?? [];
  const eixos = data?.eixos ?? [];
  const datasConclusao = data?.resumo.datasConclusao ?? [];
  const streak = calcularStreak(datasConclusao);
  const convite = conviteDeHoje({ praticas, retomar: data?.retomar ?? null });
  const feitasNaSemana = praticasNaSemana(datasConclusao);
  const metaSemanal = contexto?.perfil?.meta_semanal ?? 3;
  const escolhas = {
    destaqueId: contexto?.perfil?.eixo_destaque ?? null,
    preferidos: contexto?.perfil?.eixos_preferidos ?? [],
  };
  const preferido = eixoEmDestaque(eixos, escolhas);
  const ciclo = cicloAtual({
    inicioEm: contexto?.modoDesde ?? contexto?.perfil?.created_at ?? null,
    concluidos: data?.resumo.totalConcluidos ?? 0,
    total: data?.resumo.totalItens ?? 0,
  });

  const conviteId = convite.estado === "nada" || convite.estado === "ciclo_fechado" ? null : convite.pratica.id;
  const curta =
    praticas.find(
      (p) =>
        p.id !== conviteId &&
        p.status !== "concluido" &&
        p.duracaoSegundos > 0 &&
        p.duracaoSegundos <= 300,
    ) ?? null;

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Carregando seu início</span>
        <Skeleton className="h-56 rounded-[2rem] bg-floresta/10" />
        <Skeleton className="h-40 rounded-[2rem] bg-salvia/10" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 rounded-3xl bg-salvia/10" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SaudacaoInicio
        primeiroNome={primeiroNome}
        streakSemanas={streak}
        feitasNaSemana={feitasNaSemana}
        metaSemanal={metaSemanal}
        ciclo={ciclo}
        eixoFoco={preferido?.nome ?? null}
      />

      <PraticaDeHoje convite={convite} primeiroNome={primeiroNome} />

      <LembreteRetorno datas={datasConclusao} streakSemanas={streak} />

      {blocos.planoDaTerapeuta && <PalavraDaTerapeuta />}
      {blocos.vitrinePacotes && <VitrinePacotes />}

      <CarrosselEixos
        eixos={eixos}
        preferidoId={preferido?.id ?? null}
        preferidos={escolhas.preferidos}
      />

      <MomentosRapidos curta={curta} />

      <BuscarPraticas
        praticas={praticas}
        eixos={eixos.map((e) => ({ id: e.id, nome: e.nome }))}
      />
    </div>
  );
}
