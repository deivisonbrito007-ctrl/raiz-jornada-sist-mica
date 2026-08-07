import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RaizLogo } from "@/components/raiz-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({
    modo: z.enum(["entrar", "cadastro"]).optional(),
    next: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Entrar no Raiz" },
      { name: "description", content: "Acesse sua jornada terapêutica no Raiz." },
      { property: "og:title", content: "Entrar no Raiz" },
      { property: "og:description", content: "Acesse sua jornada terapêutica no Raiz." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { modo, next } = Route.useSearch();
  const destinoSeguro = next && /^\/[^/\\]/.test(next) ? next : null;
  const navigate = useNavigate();
  const [cadastro, setCadastro] = useState(modo === "cadastro");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [souTerapeuta, setSouTerapeuta] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [confirmeEmail, setConfirmeEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      if (destinoSeguro) {
        window.location.replace(destinoSeguro);
        return;
      }
      navigate({ to: "/entrada", replace: true });
    });
  }, [navigate, destinoSeguro]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      if (cadastro) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            emailRedirectTo: destinoSeguro
              ? `${window.location.origin}${destinoSeguro}`
              : window.location.origin,
            data: { nome, papel: souTerapeuta ? "terapeuta" : "cliente" },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmeEmail(true);
          return;
        }
        if (destinoSeguro) {
          window.location.replace(destinoSeguro);
          return;
        }
        navigate({ to: "/entrada", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        if (destinoSeguro) {
          window.location.replace(destinoSeguro);
          return;
        }
        navigate({ to: "/entrada", replace: true });
      }
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível continuar");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <Link to="/" className="mb-2 self-center">
          <RaizLogo className="h-24" />
        </Link>
        <h1 className="text-center text-3xl text-floresta">
          {confirmeEmail
            ? "Confirme seu e-mail"
            : cadastro
              ? "Criar sua conta"
              : "Bem-vindo de volta"}
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
          {confirmeEmail
            ? `Enviamos um link para ${email}. Abra o e-mail para confirmar e entrar na sua jornada.`
            : "Um espaço para continuar o que começou na sessão."}
        </p>

        {!confirmeEmail && (
          <form
            onSubmit={enviar}
            className="mt-9 space-y-5 rounded-3xl bg-card p-7 shadow-[var(--shadow-organico)]"
          >
            {cadastro && (
              <div className="space-y-2">
                <Label htmlFor="nome">Como podemos te chamar?</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete={cadastro ? "new-password" : "current-password"}
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
            {cadastro && !existeTerapeuta && (
              <label className="flex items-start gap-3 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
                <Checkbox
                  checked={souTerapeuta}
                  onCheckedChange={(v) => setSouTerapeuta(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Sou a terapeuta responsável por este espaço.
                  <span className="mt-1 block text-xs">
                    Disponível apenas para a primeira conta de terapeuta.
                  </span>
                </span>
              </label>
            )}
            <Button
              type="submit"
              disabled={carregando}
              className="w-full rounded-full bg-terracota py-6 text-base font-semibold text-terracota-foreground hover:bg-terracota/90"
            >
              {carregando ? "Um instante..." : cadastro ? "Criar conta" : "Entrar"}
            </Button>
            <button
              type="button"
              onClick={() => setCadastro((v) => !v)}
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {cadastro ? "Já tenho conta — entrar" : "Não tenho conta — criar agora"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
