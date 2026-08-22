import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { limparCachePersistido } from "@/lib/cache-persistente";
import { useMeuContexto } from "@/hooks/use-meu-contexto";
import { getMinhaBiblioteca, listarDiario } from "@/lib/raiz.functions";
import { CHAVES } from "@/lib/cache-chaves";
import { calcularStreak } from "@/lib/raiz-format";
import { cicloAtual } from "@/lib/inicio-cliente";
import { normalizarModo } from "@/lib/modo-uso";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PreferenciasLembretes } from "@/components/preferencias-lembretes";
import { AvisoReinstalarApp } from "@/components/aviso-reinstalar-app";
import { VERSAO_APP } from "@/lib/versao-app";
import { CabecalhoPerfil } from "@/components/app-perfil/cabecalho-perfil";
import { RetratoCaminho } from "@/components/app-perfil/retrato-caminho";
import { CartaoModoUso } from "@/components/app-perfil/cartao-modo-uso";
import { EditarNome } from "@/components/app-perfil/editar-nome";
import { MetaSemanal } from "@/components/app-perfil/meta-semanal";
import { MeusCaminhos } from "@/components/app-perfil/meus-caminhos";
import { BlocoPrivacidade } from "@/components/app-perfil/bloco-privacidade";
import { BlocoRelatorio } from "@/components/app-perfil/bloco-relatorio";

export const Route = createFileRoute("/_authenticated/app/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — Raiz" },
      {
        name: "description",
        content:
          "Seus dados, seu ritmo semanal, lembretes, privacidade e relatório do processo no Raiz.",
      },
      { property: "og:title", content: "Meu perfil — Raiz" },
      {
        property: "og:description",
        content: "Ajuste seu ritmo, seus lembretes e o que você compartilha no Raiz.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: contexto, isLoading } = useMeuContexto();
  const fetchBiblioteca = useServerFn(getMinhaBiblioteca);
  const fetchDiario = useServerFn(listarDiario);

  const { data: biblioteca } = useQuery({
    queryKey: CHAVES.biblioteca,
    queryFn: () => fetchBiblioteca(),
  });
  const { data: diario } = useQuery({ queryKey: CHAVES.diario, queryFn: () => fetchDiario() });

  const [saindo, setSaindo] = useState(false);

  const perfil = contexto?.perfil;
  const modo = normalizarModo(contexto?.modo);
  const datasConclusao = biblioteca?.resumo.datasConclusao ?? [];
  const streak = calcularStreak(datasConclusao);
  const ciclo = cicloAtual({
    inicioEm: perfil?.created_at ?? null,
    concluidos: biblioteca?.resumo.totalConcluidos ?? 0,
    total: biblioteca?.resumo.totalItens ?? 0,
  });

  async function gerarRelatorio() {
    const [entradas, { gerarRelatorioPdf }] = await Promise.all([
      fetchDiario(),
      import("@/lib/raiz-relatorio"),
    ]);
    gerarRelatorioPdf({
      nome: perfil?.nome ?? "",
      email: perfil?.email ?? "",
      metaSemanal: perfil?.meta_semanal ?? 3,
      eixos: biblioteca?.eixos ?? [],
      datasConclusao,
      diario: entradas ?? [],
    });
  }

  async function sair() {
    setSaindo(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    limparCachePersistido();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading && !perfil) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 rounded-[2rem]" />
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="pb-4">
      <CabecalhoPerfil
        nome={perfil?.nome}
        email={perfil?.email}
        desde={perfil?.created_at}
        cicloRotulo={ciclo.rotulo}
        cicloFrase={ciclo.frase}
        streakSemanas={streak}
      />

      <RetratoCaminho
        praticasConcluidas={biblioteca?.resumo.totalConcluidos ?? 0}
        streakSemanas={streak}
        reflexoes={(diario ?? []).length}
      />

      <CartaoModoUso
        modo={modo}
        temTerapeuta={Boolean(contexto?.temTerapeuta)}
        modoDesde={contexto?.modoDesde ?? null}
      />

      <EditarNome nome={perfil?.nome} email={perfil?.email} />

      <MetaSemanal meta={perfil?.meta_semanal ?? 3} />

      <PreferenciasLembretes />

      <Link
        to="/app/lembretes"
        className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-[1.75rem] bg-card px-5 py-4 text-sm shadow-organico transition hover:bg-secondary/40"
      >
        <span className="text-foreground">Central de lembretes e histórico</span>
        <span className="text-xs text-muted-foreground">pausar, ajustar, ver o que foi enviado</span>
      </Link>


      <MeusCaminhos />

      <BlocoPrivacidade modo={modo} />

      <BlocoRelatorio aoGerar={gerarRelatorio} pronto={Boolean(biblioteca)} />

      <section aria-labelledby="titulo-app" className="mt-4 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <h2 id="titulo-app" className="font-display text-xl text-floresta">
          Este aplicativo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Versão instalada {VERSAO_APP}.</p>
        <AvisoReinstalarApp />
      </section>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="mt-6 min-h-11 w-full rounded-full border-floresta/20 text-floresta">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Sair da conta</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-floresta">
              Sair da sua conta?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Seu processo fica guardado. Você entra de novo quando quiser, com o mesmo e-mail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 rounded-full">Ficar</AlertDialogCancel>
            <AlertDialogAction
              onClick={sair}
              disabled={saindo}
              className="min-h-11 rounded-full bg-floresta text-floresta-foreground"
            >
              {saindo ? "Saindo..." : "Sair"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
