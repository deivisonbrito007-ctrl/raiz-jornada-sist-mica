import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { mensagemErroAuth } from "@/lib/erro-auth";
import { MolduraEntrada } from "@/components/auth/moldura-entrada";
import { CampoSenha } from "@/components/auth/campo-senha";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Criar nova senha — Raiz" },
      { name: "description", content: "Defina uma nova senha para acessar sua jornada no Raiz." },
      { property: "og:title", content: "Criar nova senha — Raiz" },
      {
        property: "og:description",
        content: "Defina uma nova senha para acessar sua jornada no Raiz.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [linkValido, setLinkValido] = useState<boolean | null>(null);

  useEffect(() => {
    // O link de recuperação chega como hash (type=recovery) e o cliente troca
    // por uma sessão temporária que só permite atualizar a senha.
    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "PASSWORD_RECOVERY" || sessao) setLinkValido(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      setLinkValido(Boolean(s.session) || hash.includes("type=recovery"));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== confirmacao) {
      toast.error("As senhas não são iguais.");
      return;
    }
    setCarregando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      setPronto(true);
      toast.success("Senha atualizada.");
    } catch (erro) {
      toast.error(mensagemErroAuth(erro));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <MolduraEntrada frase="Uma nova senha e você volta para onde parou.">
      <div>
          <h1 className="font-display text-2xl text-floresta">Criar nova senha</h1>

          {linkValido === false ? (
            <div className="mt-4" role="status">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Este link de recuperação não é mais válido. Peça um novo na tela de entrada.
              </p>
              <Button
                type="button"
                onClick={() => navigate({ to: "/auth", replace: true })}
                className="mt-6 h-13 w-full rounded-full bg-terracota text-base font-semibold text-terracota-foreground hover:bg-terracota/90"
              >
                Voltar para entrar
              </Button>
            </div>
          ) : pronto ? (
            <div className="mt-4" role="status">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Tudo pronto: sua senha foi atualizada.
              </p>
              <Button
                type="button"
                onClick={() => navigate({ to: "/entrada", replace: true })}
                className="mt-6 h-13 w-full rounded-full bg-terracota text-base font-semibold text-terracota-foreground hover:bg-terracota/90"
              >
                Entrar na minha jornada
              </Button>
            </div>
          ) : (
            <form onSubmit={salvar} className="mt-6 space-y-5">
              <CampoSenha
                id="nova-senha"
                rotulo="Nova senha"
                valor={senha}
                onChange={setSenha}
                autoComplete="new-password"
                dica="Pelo menos 6 caracteres."
              />
              <CampoSenha
                id="confirmar-senha"
                rotulo="Repita a nova senha"
                valor={confirmacao}
                onChange={setConfirmacao}
                autoComplete="new-password"
              />
              <Button
                type="submit"
                disabled={carregando}
                className="h-13 w-full rounded-full bg-terracota text-base font-semibold text-terracota-foreground shadow-organico hover:bg-terracota/90"
              >
                {carregando ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
      </div>
    </MolduraEntrada>
  );
}
