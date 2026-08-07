import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { equipeAceitarConvite, type ResultadoConvite } from "@/lib/equipe.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/convite/$token")({
  ssr: false,
  component: ConvitePagina,
  head: () => ({
    meta: [
      { title: "Convite para administrar o Raiz" },
      {
        name: "description",
        content:
          "Confirme seu convite para ajudar a administrar o espaço terapêutico Raiz. Convites têm validade limitada.",
      },
      { property: "og:title", content: "Convite para administrar o Raiz" },
      {
        property: "og:description",
        content: "Confirme seu convite de administração no Raiz.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const MENSAGEM: Record<ResultadoConvite, { titulo: string; texto: string; ok?: boolean }> = {
  aceito: {
    titulo: "Convite confirmado",
    texto: "Seu acesso de administração já está ativo. Bem-vinda ao cuidado do espaço.",
    ok: true,
  },
  usado: {
    titulo: "Convite já utilizado",
    texto: "Este link foi confirmado antes. Se você já é admin, entre pelo painel.",
  },
  expirado: {
    titulo: "Convite expirado",
    texto: "O prazo deste convite terminou. Peça um novo link a quem administra o espaço.",
  },
  invalido: {
    titulo: "Convite não encontrado",
    texto: "O link está incompleto ou foi cancelado. Peça um novo convite.",
  },
  outro_email: {
    titulo: "E-mail diferente",
    texto:
      "Este convite foi enviado para outro e-mail. Entre com a conta do e-mail convidado e abra o link novamente.",
  },
  sem_sessao: {
    titulo: "Entre para confirmar",
    texto: "Faça login ou crie sua conta com o e-mail convidado para confirmar o convite.",
  },
};

function ConvitePagina() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const aceitar = useServerFn(equipeAceitarConvite);
  const [estado, setEstado] = useState<"carregando" | "sem_login" | ResultadoConvite>("carregando");

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!ativo) return;
      if (!data.user) {
        setEstado("sem_login");
        return;
      }
      try {
        const r = await aceitar({ data: { token } });
        if (ativo) setEstado(r.resultado);
      } catch {
        if (ativo) setEstado("invalido");
      }
    })();
    return () => {
      ativo = false;
    };
  }, [token, aceitar]);

  const info = estado === "sem_login" ? MENSAGEM.sem_sessao : MENSAGEM[estado as ResultadoConvite];

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16">
      <div className="w-full rounded-3xl bg-card p-8 text-center shadow-[var(--shadow-organico)]">
        {estado === "carregando" ? (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-salvia" />
            <h1 className="mt-4 text-2xl text-floresta">Confirmando seu convite…</h1>
          </>
        ) : (
          <>
            {info?.ok ? (
              <CheckCircle2 className="mx-auto h-10 w-10 text-salvia" />
            ) : (
              <ShieldAlert className="mx-auto h-10 w-10 text-terracota" />
            )}
            <h1 className="mt-4 text-2xl text-floresta">{info?.titulo}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{info?.texto}</p>

            <div className="mt-6 flex flex-col gap-2">
              {info?.ok && (
                <Button
                  className="rounded-full bg-floresta text-floresta-foreground hover:bg-floresta/90"
                  onClick={() => navigate({ to: "/admin" })}
                >
                  Ir para o painel
                </Button>
              )}
              {estado === "sem_login" && (
                <Button
                  asChild
                  className="rounded-full bg-terracota text-terracota-foreground hover:bg-terracota/90"
                >
                  <Link to="/auth">Entrar ou criar conta</Link>
                </Button>
              )}
              {!info?.ok && estado !== "sem_login" && (
                <Button asChild variant="outline" className="rounded-full border-floresta/20">
                  <Link to="/app">Voltar ao início</Link>
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
