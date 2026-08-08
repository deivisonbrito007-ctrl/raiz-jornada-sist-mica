import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMeuContexto } from "@/lib/raiz.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatarData } from "@/lib/raiz-format";
import {
  lerPreferenciaAnuncios,
  salvarPreferenciaAnuncios,
  usePreferenciaAnuncios,
  type PreferenciaAnuncios,
} from "@/lib/preferencia-anuncios";

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

      <PreferenciaAnunciosCartao />

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

const OPCOES: { valor: PreferenciaAnuncios; titulo: string; descricao: string }[] = [
  {
    valor: "completo",
    titulo: "Anúncios completos",
    descricao:
      "O leitor de tela fala todas as mudanças: estado do player, contagem para renovar, progresso e confirmações.",
  },
  {
    valor: "reduzido",
    titulo: "Somente o essencial",
    descricao:
      "Fala apenas o que é importante: bloqueio de acesso, expiração, remoção de prática e erros.",
  },
  {
    valor: "desativado",
    titulo: "Sem anúncios",
    descricao:
      "Nada é falado automaticamente. Mensagens importantes continuam aparecendo na tela, em destaque.",
  },
];

/**
 * Preferência de anúncios em live region. Fica no dispositivo e vale
 * imediatamente para o player, o diário e os avisos em tempo real.
 */
function PreferenciaAnunciosCartao() {
  const atual = usePreferenciaAnuncios();

  return (
    <section
      aria-labelledby="titulo-preferencia-anuncios"
      className="mt-6 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]"
    >
      <h2 id="titulo-preferencia-anuncios" className="text-lg text-floresta">
        Acessibilidade: avisos falados
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Escolha quanto o leitor de tela deve falar sozinho. Mesmo com os anúncios desativados, os
        avisos importantes seguem visíveis na tela.
      </p>

      <fieldset className="mt-4 space-y-3">
        <legend className="sr-only">Nível dos anúncios para leitor de tela</legend>
        {OPCOES.map((opcao) => (
          <label
            key={opcao.valor}
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-floresta/15 p-4 focus-within:ring-2 focus-within:ring-floresta has-[:checked]:border-floresta/50 has-[:checked]:bg-secondary"
          >
            <input
              type="radio"
              name="preferencia-anuncios"
              value={opcao.valor}
              checked={atual === opcao.valor}
              onChange={() => salvarPreferenciaAnuncios(opcao.valor)}
              className="mt-1 h-4 w-4 accent-[hsl(var(--floresta))]"
            />
            <span>
              <span className="block text-sm font-medium text-floresta">{opcao.titulo}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {opcao.descricao}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <p aria-live="polite" role="status" className="mt-3 text-xs text-salvia">
        {atual === lerPreferenciaAnuncios() ? "Preferência salva neste dispositivo." : ""}
      </p>
    </section>
  );
}
