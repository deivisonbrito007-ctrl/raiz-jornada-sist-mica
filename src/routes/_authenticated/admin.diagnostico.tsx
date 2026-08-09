import { createFileRoute } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { Gauge, RotateCcw, ShieldCheck } from "lucide-react";
import {
  inscreverDiagnostico,
  lerDiagnostico,
  limparDiagnostico,
  type Agregado,
} from "@/lib/diagnostico";

export const Route = createFileRoute("/_authenticated/admin/diagnostico")({
  component: Diagnostico,
});

function ms(valor: number) {
  if (valor >= 1000) return `${(valor / 1000).toFixed(valor >= 10_000 ? 0 : 1)} s`;
  return `${Math.round(valor)} ms`;
}

function desde(inicio: number) {
  const seg = Math.max(0, Math.round((Date.now() - inicio) / 1000));
  if (seg < 60) return `${seg}s`;
  const min = Math.floor(seg / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

function Tabela({
  titulo,
  descricao,
  colunaRotulo,
  linhas,
}: {
  titulo: string;
  descricao: string;
  colunaRotulo: string;
  linhas: Agregado[];
}) {
  return (
    <section className="mt-8 rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]">
      <h2 className="text-lg text-floresta">{titulo}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>

      {linhas.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-secondary/50 p-5 text-center text-sm text-muted-foreground">
          Nada medido ainda nesta sessão. Navegue pelo painel e volte aqui.
        </p>
      ) : (
        <div className="mt-4 -mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <caption className="sr-only">
              {titulo}: {descricao}
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  {colunaRotulo}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Nº
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Mediana
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  p95
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Máx.
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Falhas
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.rotulo} className="border-t border-border/60">
                  <th
                    scope="row"
                    className="max-w-[16rem] truncate py-2 pr-3 text-left font-medium text-floresta"
                    title={linha.rotulo}
                  >
                    {linha.rotulo}
                  </th>
                  <td className="py-2 pr-3 text-right tabular-nums">{linha.chamadas}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{ms(linha.p50)}</td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums ${
                      linha.p95 > 1500 ? "font-semibold text-terracota" : ""
                    }`}
                  >
                    {ms(linha.p95)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{ms(linha.max)}</td>
                  <td
                    className={`py-2 text-right tabular-nums ${
                      linha.erros > 0 ? "font-semibold text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {linha.erros}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Diagnostico() {
  const dados = useSyncExternalStore(inscreverDiagnostico, lerDiagnostico, lerDiagnostico);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm text-salvia">
            <Gauge className="h-4 w-4" aria-hidden="true" /> Diagnóstico interno
          </p>
          <h1 className="mt-1 text-3xl text-floresta">Desempenho desta sessão</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Medições feitas neste navegador nos últimos {desde(dados.desdeEm)}. Servem para achar
            telas lentas e requisições repetidas.
          </p>
        </div>
        <button
          type="button"
          onClick={limparDiagnostico}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-floresta"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Zerar medições
        </button>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl bg-secondary/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Rotas medidas</dt>
          <dd className="mt-1 text-2xl tabular-nums text-floresta">{dados.rotas.length}</dd>
        </div>
        <div className="rounded-3xl bg-secondary/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Requisições</dt>
          <dd className="mt-1 text-2xl tabular-nums text-floresta">{dados.totalRequisicoes}</dd>
        </div>
        <div className="rounded-3xl bg-secondary/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Com falha</dt>
          <dd
            className={`mt-1 text-2xl tabular-nums ${
              dados.totalErros > 0 ? "text-destructive" : "text-floresta"
            }`}
          >
            {dados.totalErros}
          </dd>
        </div>
      </dl>

      <Tabela
        titulo="Tempo por rota"
        descricao="Do início da navegação até a tela pronta. Ids dinâmicos aparecem como :id."
        colunaRotulo="Rota"
        linhas={dados.rotas}
      />

      <Tabela
        titulo="Requisições por origem"
        descricao="Contagem e duração agrupadas por função de servidor ou endereço, sem parâmetros."
        colunaRotulo="Origem"
        linhas={dados.requisicoes}
      />

      <p className="mt-6 flex items-start gap-2 rounded-3xl border border-dashed border-border p-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-salvia" aria-hidden="true" />
        <span>
          Somente números agregados. Nada de nomes, e-mails, ids de clientes, conteúdo do diário ou
          corpo das requisições é registrado. Os dados ficam apenas na memória deste navegador e
          desaparecem ao recarregar a página — nada é salvo no banco nem enviado a terceiros.
        </span>
      </p>
    </div>
  );
}
