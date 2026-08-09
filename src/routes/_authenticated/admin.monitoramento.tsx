import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CartoesIndicadores } from "@/components/painel/monitoramento/cartoes-indicadores";
import { FiltrosMonitoramentoBarra } from "@/components/painel/monitoramento/filtros-monitoramento";
import { LinhaPlano } from "@/components/painel/monitoramento/linha-plano";
import { ApoioEConfiguracoes } from "@/components/painel/monitoramento/apoio-e-configuracoes";
import { adminMonitoramentoResumo } from "@/lib/monitoramento.functions";
import {
  FILTROS_PADRAO,
  aplicarFiltros,
  calcularIndicadores,
  ordenarLinhas,
  type FiltrosMonitoramento,
  type IndicadoresMonitoramento,
} from "@/lib/monitoramento";

export const Route = createFileRoute("/_authenticated/admin/monitoramento")({
  head: () => ({
    meta: [
      { title: "Monitoramento das trilhas liberadas — Raiz" },
      {
        name: "description",
        content:
          "Acompanhe as trilhas já liberadas: progresso, revisões, pedidos de apoio e devolutivas.",
      },
      { property: "og:title", content: "Monitoramento das trilhas liberadas — Raiz" },
      {
        property: "og:description",
        content: "Progresso, revisões e pedidos de apoio dos planos em curso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminMonitoramento,
});

function AdminMonitoramento() {
  const carregar = useServerFn(adminMonitoramentoResumo);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-monitoramento"],
    queryFn: () => carregar(),
  });

  const [filtros, setFiltros] = useState<FiltrosMonitoramento>(FILTROS_PADRAO);

  const linhas = data?.linhas ?? [];
  const indicadores = useMemo(
    () => calcularIndicadores(linhas, filtros.periodoDias),
    [linhas, filtros.periodoDias],
  );
  const visiveis = useMemo(
    () => ordenarLinhas(aplicarFiltros(linhas, filtros)),
    [linhas, filtros],
  );

  const filtrarPorIndicador = (chave: keyof IndicadoresMonitoramento) => {
    setFiltros((atual) => {
      const base = { ...FILTROS_PADRAO, termo: atual.termo, periodoDias: atual.periodoDias };
      if (chave === "emAndamento") return { ...base, status: "em_andamento" };
      if (chave === "revisoesPendentes") return { ...base, revisao: "pendente" };
      if (chave === "apoio") return { ...base, apoio: "com_apoio" };
      if (chave === "semAtividade") return { ...base, inatividade: true };
      if (chave === "concluidosNoPeriodo") return { ...base, status: "concluido" };
      return { ...base, revisao: "todas" };
    });
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-2xl text-floresta">Monitoramento</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Aqui você acompanha o que já foi liberado. A criação e a personalização dos planos
          continuam em <strong>Planos de acompanhamento</strong>. Tudo o que aparece nesta página é
          registro da própria pessoa — nada é interpretado automaticamente.
        </p>
      </header>

      <CartoesIndicadores
        indicadores={indicadores}
        periodoDias={filtros.periodoDias}
        aoFiltrar={filtrarPorIndicador}
      />

      <div className="rounded-3xl border border-border bg-card p-4 shadow-organico">
        <Label htmlFor="busca-monitoramento">Buscar por pessoa, e-mail, trilha ou objetivo</Label>
        <div className="relative mt-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="busca-monitoramento"
            className="min-h-11 pl-9"
            placeholder="Ex.: Ana, calma, dizer não"
            value={filtros.termo}
            onChange={(e) => setFiltros({ ...filtros, termo: e.target.value })}
          />
        </div>
      </div>

      <FiltrosMonitoramentoBarra
        filtros={filtros}
        aoMudar={setFiltros}
        terapeutas={data?.terapeutas ?? []}
        trilhas={data?.trilhas ?? []}
      />

      {isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando planos liberados...
        </p>
      )}
      {isError && (
        <p role="alert" className="text-sm text-terracota">
          Não foi possível carregar o monitoramento agora.
        </p>
      )}

      {!isLoading && visiveis.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhum plano corresponde a estes filtros. Quando você liberar uma trilha em Planos de
          acompanhamento, ela aparece aqui.
        </p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((linha) => (
            <LinhaPlano key={linha.atribuicaoId} linha={linha} />
          ))}
        </ul>
      )}

      <ApoioEConfiguracoes />
    </section>
  );
}
