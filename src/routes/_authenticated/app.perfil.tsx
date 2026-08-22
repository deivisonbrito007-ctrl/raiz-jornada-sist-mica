import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { History, Sparkles } from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMeuContexto } from "@/lib/raiz.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatarData } from "@/lib/raiz-format";
import { PreferenciasLembretes } from "@/components/preferencias-lembretes";

export const Route = createFileRoute("/_authenticated/app/perfil")({
  component: Perfil,
});

function Perfil() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchContexto = useServerFn(getMeuContexto);
  const { data } = useQuery({ queryKey: ["contexto"], queryFn: () => fetchContexto() });

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div>
      <h1 className="text-3xl text-floresta">Perfil</h1>

      <div className="mt-7 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-salvia">Nome</dt>
            <dd className="mt-0.5 text-base text-floresta">{data?.perfil?.nome ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-salvia">E-mail</dt>
            <dd className="mt-0.5 text-base text-floresta">{data?.perfil?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-salvia">No Raiz desde</dt>
            <dd className="mt-0.5 text-base text-floresta">
              {data?.perfil?.created_at ? formatarData(data.perfil.created_at) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-salvia">Papel</dt>
            <dd className="mt-0.5 text-base text-floresta">
              {data?.papel === "terapeuta" ? "Terapeuta" : "Cliente"}
            </dd>
          </div>
        </dl>
      </div>

      <Link
        to="/app/historico"
        className="mt-6 flex min-h-11 items-center justify-between rounded-3xl bg-card px-6 py-4 text-sm text-floresta shadow-[var(--shadow-organico)]"
      >
        <span>
          Meu histórico
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Práticas liberadas, concluídas e suas reflexões por trilha
          </span>
        </span>
        <History className="h-5 w-5 shrink-0 text-salvia" aria-hidden="true" />
      </Link>

      <Link
        to="/app/eixos-preferidos"
        className="mt-4 flex min-h-11 items-center justify-between rounded-3xl bg-card px-6 py-4 text-sm text-floresta shadow-[var(--shadow-organico)]"
      >
        <span>
          Meus eixos preferidos
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Escolha seus temas e qual eixo fica em destaque no Início
          </span>
        </span>
        <Sparkles className="h-5 w-5 shrink-0 text-salvia" aria-hidden="true" />
      </Link>

      <PreferenciasLembretes />


      <div className="mt-6 rounded-3xl bg-secondary p-6">
        <h2 className="text-lg text-floresta">Privacidade</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Suas reflexões do diário são visíveis apenas para você e para o terapeuta que acompanha o
          seu processo. As mídias são servidas por links temporários e não podem ser acessadas por
          terceiros.
        </p>
      </div>

      <Button
        variant="outline"
        onClick={sair}
        className="mt-6 w-full rounded-full border-floresta/20 py-6 text-floresta"
      >
        Sair da conta
      </Button>
    </div>
  );
}
