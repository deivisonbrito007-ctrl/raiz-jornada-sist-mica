import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMinhaEtapa, getMinhaJornada } from "@/lib/trilhas.functions";
import { getMeuContexto } from "@/lib/raiz.functions";
import { blocosDoModo, normalizarModo } from "@/lib/modo-uso";
import {
  FILTRO_JORNADA_LABEL,
  filtrarPlanos,
  resumoDaJornada,
  type FiltroJornada,
} from "@/lib/jornada-cliente";
import { PedirApoio } from "@/components/pedir-apoio";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreCarregarProximas } from "@/hooks/use-pre-carregar-proximas";
import { ConsentimentoPrimeiroAcesso } from "@/components/consentimento-primeiro-acesso";
import { CabecalhoJornada } from "@/components/app-jornada/cabecalho-jornada";
import { CartaoPlano, type PlanoJornada } from "@/components/app-jornada/cartao-plano";
import { PulsoEmocional } from "@/components/app-jornada/pulso-emocional";
import { ConversaApoio } from "@/components/app-jornada/conversa-apoio";
import { JornadaVazia } from "@/components/app-jornada/jornada-vazia";
import { RotuloSecao } from "@/components/app-casca/rotulo-secao";

export const Route = createFileRoute("/_authenticated/app/jornada")({
  head: () => ({
    meta: [
      { title: "Minha jornada — Raiz" },
      {
        name: "description",
        content:
          "Suas trilhas atribuídas, o próximo passo sugerido e o espaço para pedir apoio entre as sessões.",
      },
      { property: "og:title", content: "Minha jornada — Raiz" },
      {
        property: "og:description",
        content: "Continuidade do acompanhamento entre sessões: trilhas, etapas e apoio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MinhaJornada,
});

const FILTROS: FiltroJornada[] = ["andamento", "concluidas", "todas"];

function MinhaJornada() {
  const queryClient = useQueryClient();
  const carregar = useServerFn(getMinhaJornada);
  const carregarContexto = useServerFn(getMeuContexto);
  const { data, isLoading } = useQuery({ queryKey: ["minha-jornada"], queryFn: () => carregar() });
  const { data: contexto } = useQuery({
    queryKey: ["contexto"],
    queryFn: () => carregarContexto(),
  });
  const [filtro, setFiltro] = useState<FiltroJornada>("andamento");

  // Adianta a próxima etapa das trilhas ativas para o toque abrir sem espera.
  const carregarEtapa = useServerFn(getMinhaEtapa);
  const proximas = (data?.trilhas ?? [])
    .filter((t) => t.status === "em_andamento" && t.proximaEtapaId)
    .map((t) => t.proximaEtapaId as string);
  usePreCarregarProximas(
    proximas.map((conteudoId) => ({
      queryKey: ["minha-etapa", conteudoId],
      carregar: () => carregarEtapa({ data: { conteudoId } }),
    })),
  );

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Carregando sua jornada</span>
        <Skeleton className="h-52 rounded-[2rem] bg-floresta/10" />
        <Skeleton className="h-72 rounded-[2rem] bg-salvia/10" />
        <Skeleton className="h-40 rounded-[2rem] bg-salvia/10" />
      </div>
    );
  }

  const planos = (data?.trilhas ?? []) as PlanoJornada[];
  const resumo = resumoDaJornada(planos);
  const visiveis = filtrarPlanos(planos, filtro);
  const modo = normalizarModo(contexto?.modo);
  const blocos = blocosDoModo(modo);
  const primeiroNome = (contexto?.perfil?.nome || "").split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      <ConsentimentoPrimeiroAcesso
        aceitos={data?.consentimentos ?? []}
        aoAceitar={() => queryClient.invalidateQueries({ queryKey: ["minha-jornada"] })}
      />

      <CabecalhoJornada
        primeiroNome={primeiroNome}
        resumo={resumo}
        acao={
          blocos.pedirApoio ? (
            <PedirApoio
              prazoRespostaHoras={data?.prazoRespostaHoras ?? 48}
              contatos={data?.contatosEmergencia ?? []}
            />
          ) : undefined
        }
      />

      <RotuloSecao texto="Seus caminhos" />

      {planos.length === 0 ? (
        <JornadaVazia autoguiado={modo === "autoguiado"} />
      ) : (
        <>
          {resumo.fechados > 0 && (
            <div
              role="group"
              aria-label="Filtrar caminhos"
              className="flex flex-wrap gap-2 rounded-full bg-secondary/60 p-1.5"
            >
              {FILTROS.map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => setFiltro(opcao)}
                  aria-pressed={filtro === opcao}
                  className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
                    filtro === opcao
                      ? "bg-card text-floresta shadow-organico"
                      : "text-muted-foreground"
                  }`}
                >
                  {FILTRO_JORNADA_LABEL[opcao]}
                </button>
              ))}
            </div>
          )}

          {visiveis.length === 0 ? (
            <p className="rounded-[2rem] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum caminho neste filtro por enquanto.
            </p>
          ) : (
            <ul className="space-y-6">
              {visiveis.map((plano) => (
                <li key={plano.atribuicaoId}>
                  <CartaoPlano plano={plano} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <RotuloSecao texto="Como você tem estado" />
      <PulsoEmocional checkins={data?.checkins ?? []} />

      {blocos.pedirApoio && <RotuloSecao texto="Conversa com a terapeuta" />}
      {blocos.pedirApoio && (
        <ConversaApoio
          pedidos={data?.apoio ?? []}
          prazoRespostaHoras={data?.prazoRespostaHoras ?? 48}
        />
      )}
    </div>
  );
}
