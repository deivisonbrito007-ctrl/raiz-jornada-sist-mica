import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircleHeart, PartyPopper, Play } from "lucide-react";
import { formatarData, formatarDuracao } from "@/lib/raiz-format";
import { etapaAtual, planoFechado, seloDeFechamento } from "@/lib/jornada-cliente";
import { AvisoCuidado } from "./aviso-cuidado";
import { SelosPlano } from "./selos-plano";
import { CaminhoEtapas, type EtapaJornada } from "./caminho-etapas";

export type PlanoJornada = {
  atribuicaoId: string;
  status: string;
  objetivo: string | null;
  motivoIndicacao?: string | null;
  mensagem: string | null;
  frequencia: string | null;
  dataInicio: string | null;
  dataRevisao: string | null;
  nivel: string | null;
  exigeAcompanhamento?: boolean | null;
  somenteEmSessao?: boolean | null;
  orientacoesEspeciais?: string | null;
  trilha?: {
    nome?: string | null;
    resumo?: string | null;
    alertas?: string | null;
    orientacoes_pausa?: string | null;
    eixos?: { nome?: string | null } | null;
  } | null;
  etapas: EtapaJornada[];
  total: number;
  concluidas: number;
  percentual: number;
  proximaEtapaId: string | null;
};

/** Cartão de um plano de acompanhamento: onde estou, o que vem agora e cuidados. */
export function CartaoPlano({ plano }: { plano: PlanoJornada }) {
  const nome = plano.trilha?.nome ?? "Trilha";
  const eixo = plano.trilha?.eixos?.nome ?? null;
  const fechado = planoFechado(plano);
  const atual = etapaAtual(plano.etapas);

  return (
    <article className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-organico">
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-b border-border/70 bg-secondary/40 p-5">
        <AnelProgresso percentual={plano.percentual} nome={nome} />
        <div className="min-w-0">
          {eixo && (
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-salvia">
              {eixo}
            </p>
          )}
          <h2 className="mt-1 font-display text-xl leading-snug text-floresta">{nome}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {plano.concluidas} de {plano.total} etapas
            {plano.dataInicio ? ` · desde ${formatarData(plano.dataInicio)}` : ""}
          </p>
        </div>
      </header>

      <div className="p-5">
        {plano.trilha?.resumo && (
          <p className="text-sm leading-relaxed text-muted-foreground">{plano.trilha.resumo}</p>
        )}

        {fechado ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-salvia/15 p-4">
            <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-salvia" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-floresta">{seloDeFechamento(plano)}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Você percorreu este caminho até o fim. Deixe assentar — você pode revisitar qualquer
                etapa quando quiser.
              </p>
            </div>
          </div>
        ) : (
          atual && (
            <Link
              to="/app/etapa/$conteudoId"
              params={{ conteudoId: atual.id }}
              className="group mt-4 grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-floresta p-4 text-floresta-foreground"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-floresta-foreground/15">
                <Play className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.65rem] uppercase tracking-[0.18em] text-ocre">
                  Seu próximo passo
                </span>
                <span className="mt-0.5 block truncate text-sm font-medium">{atual.titulo}</span>
                {atual.duracaoSegundos ? (
                  <span className="block text-xs text-floresta-foreground/70">
                    {formatarDuracao(atual.duracaoSegundos)}
                  </span>
                ) : null}
              </span>
              <ArrowRight
                className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          )
        )}

        {(plano.objetivo || plano.mensagem || plano.motivoIndicacao) && (
          <section className="mt-4 rounded-2xl bg-secondary p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium text-floresta">
              <MessageCircleHeart className="h-4 w-4 text-salvia" aria-hidden="true" />
              Da sua terapeuta
            </h3>
            {plano.objetivo && (
              <p className="mt-2 font-display text-base leading-relaxed text-foreground">
                “{plano.objetivo}”
              </p>
            )}
            {plano.motivoIndicacao && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Por que este caminho: </span>
                {plano.motivoIndicacao}
              </p>
            )}
            {plano.mensagem && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {plano.mensagem}
              </p>
            )}
          </section>
        )}

        <SelosPlano
          nivel={plano.nivel}
          frequencia={plano.frequencia}
          somenteEmSessao={plano.somenteEmSessao}
          exigeAcompanhamento={plano.exigeAcompanhamento}
          dataRevisao={plano.dataRevisao}
        />

        <AvisoCuidado
          alertas={plano.trilha?.alertas}
          orientacoesPausa={plano.trilha?.orientacoes_pausa}
          orientacoesEspeciais={plano.orientacoesEspeciais}
        />

        <CaminhoEtapas etapas={plano.etapas} atualId={atual?.id ?? null} nomeTrilha={nome} />
      </div>
    </article>
  );
}

function AnelProgresso({ percentual, nome }: { percentual: number; nome: string }) {
  const perimetro = 2 * Math.PI * 26;
  const proporcao = Math.min(1, Math.max(0, percentual / 100));
  return (
    <div
      className="relative h-16 w-16 shrink-0"
      role="progressbar"
      aria-valuenow={percentual}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progresso da trilha ${nome}`}
    >
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r="26" fill="none" strokeWidth="5" className="stroke-border" />
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className="stroke-salvia transition-all duration-700"
          strokeDasharray={perimetro}
          strokeDashoffset={perimetro * (1 - proporcao)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-floresta">
        {percentual}%
      </span>
    </div>
  );
}
