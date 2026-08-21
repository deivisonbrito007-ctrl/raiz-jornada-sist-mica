import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { existeTerapeuta as consultarExisteTerapeuta } from "@/lib/cadastro.functions";
import { mensagemErroAuth } from "@/lib/erro-auth";
import { PainelMarca } from "@/components/auth/painel-marca";
import { FormularioEntrar } from "@/components/auth/formulario-entrar";
import { FormularioCadastro, type CaminhoEntrada } from "@/components/auth/formulario-cadastro";
import { EstadoConfirmeEmail } from "@/components/auth/estado-confirme-email";
import { BotaoGoogle } from "@/components/auth/botao-google";
import { CampoEmail } from "@/components/auth/campo-email";
import { Button } from "@/components/ui/button";

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

type Aba = "entrar" | "cadastro";

const SELOS = ["Privado", "No seu ritmo", "Com acompanhamento"];

function AuthPage() {
  const { modo, next } = Route.useSearch();
  const destinoSeguro = next && /^\/[^/\\]/.test(next) ? next : null;
  const navigate = useNavigate();

  const [aba, setAba] = useState<Aba>(modo === "cadastro" ? "cadastro" : "entrar");
  const [etapaCadastro, setEtapaCadastro] = useState<1 | 2>(1);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [caminho, setCaminho] = useState<CaminhoEntrada>(
    destinoSeguro?.startsWith("/convite") ? "convite" : "propria",
  );
  const [souTerapeuta, setSouTerapeuta] = useState(false);

  const [carregando, setCarregando] = useState(false);
  const [confirmeEmail, setConfirmeEmail] = useState(false);
  const [recuperar, setRecuperar] = useState(false);
  const [linkEnviado, setLinkEnviado] = useState(false);
  const [existeTerapeuta, setExisteTerapeuta] = useState(true);

  const cadastro = aba === "cadastro";

  useEffect(() => {
    consultarExisteTerapeuta()
      .then((r: { existe: boolean }) => setExisteTerapeuta(r.existe))
      .catch(() => setExisteTerapeuta(true));
  }, []);

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

  function seguir() {
    if (destinoSeguro) {
      window.location.replace(destinoSeguro);
      return;
    }
    navigate({ to: "/entrada", replace: true });
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      seguir();
    } catch (erro) {
      toast.error(mensagemErroAuth(erro));
    } finally {
      setCarregando(false);
    }
  }

  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: destinoSeguro
            ? `${window.location.origin}${destinoSeguro}`
            : window.location.origin,
          data: {
            nome,
            papel: souTerapeuta ? "terapeuta" : "cliente",
            caminho_entrada: souTerapeuta ? "terapeuta" : caminho,
          },
        },
      });
      if (error) throw error;
      if (!data.session) {
        setConfirmeEmail(true);
        return;
      }
      seguir();
    } catch (erro) {
      toast.error(mensagemErroAuth(erro));
    } finally {
      setCarregando(false);
    }
  }

  async function reenviarConfirmacao() {
    setCarregando(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: destinoSeguro
            ? `${window.location.origin}${destinoSeguro}`
            : window.location.origin,
        },
      });
      if (error) throw error;
      toast.success("Enviamos o link novamente.");
    } catch (erro) {
      toast.error(mensagemErroAuth(erro));
    } finally {
      setCarregando(false);
    }
  }

  async function pedirRecuperacao(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setLinkEnviado(true);
    } catch (erro) {
      toast.error(mensagemErroAuth(erro));
    } finally {
      setCarregando(false);
    }
  }

  const frase = cadastro
    ? "Comece um espaço só seu para continuar o que se moveu na sessão."
    : "Respire. Você chegou ao seu espaço de cuidado.";

  return (
    <div className="min-h-screen bg-background md:grid md:min-h-screen md:grid-cols-[1fr_minmax(0,30rem)]">
      <PainelMarca frase={frase} />

      <main className="relative z-10 -mt-8 rounded-t-[2.5rem] bg-background px-6 pb-[calc(env(safe-area-inset-bottom)+3rem)] pt-8 md:mt-0 md:flex md:flex-col md:justify-center md:rounded-none md:px-12 md:py-12">
        <div className="mx-auto w-full max-w-md">
          {confirmeEmail ? (
            <EstadoConfirmeEmail
              email={email}
              onReenviar={reenviarConfirmacao}
              reenviando={carregando}
              onVoltar={() => {
                setConfirmeEmail(false);
                setEtapaCadastro(1);
              }}
            />
          ) : recuperar ? (
            <div>
              <h2 className="font-display text-2xl text-floresta">Recuperar acesso</h2>
              {linkEnviado ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground" role="status">
                  Se existir uma conta para{" "}
                  <span className="font-semibold text-foreground">{email}</span>, o link de
                  redefinição já está a caminho.
                </p>
              ) : (
                <form onSubmit={pedirRecuperacao} className="mt-6 space-y-5">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Informe seu e-mail e enviaremos um link para criar uma nova senha.
                  </p>
                  <CampoEmail id="email-recuperacao" valor={email} onChange={setEmail} />
                  <Button
                    type="submit"
                    disabled={carregando}
                    className="h-13 w-full rounded-full bg-terracota text-base font-semibold text-terracota-foreground shadow-organico hover:bg-terracota/90"
                  >
                    {carregando ? "Enviando..." : "Enviar link de recuperação"}
                  </Button>
                </form>
              )}
              <button
                type="button"
                onClick={() => {
                  setRecuperar(false);
                  setLinkEnviado(false);
                }}
                className="mt-5 text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Voltar para entrar
              </button>
            </div>
          ) : (
            <>
              <div
                role="tablist"
                aria-label="Entrar ou criar conta"
                className="flex rounded-full bg-secondary p-1"
              >
                {(
                  [
                    { valor: "entrar" as const, texto: "Entrar" },
                    { valor: "cadastro" as const, texto: "Criar conta" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.valor}
                    type="button"
                    role="tab"
                    aria-selected={aba === item.valor}
                    onClick={() => {
                      setAba(item.valor);
                      setEtapaCadastro(1);
                    }}
                    className={`h-11 flex-1 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota ${
                      aba === item.valor
                        ? "bg-card text-floresta shadow-organico"
                        : "text-muted-foreground"
                    }`}
                  >
                    {item.texto}
                  </button>
                ))}
              </div>

              <h2 className="mt-7 font-display text-2xl text-floresta">
                {cadastro ? "Criar sua conta" : "Bem-vindo de volta"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {cadastro
                  ? "Dois passos rápidos e seu espaço está pronto."
                  : "Um espaço para continuar o que começou na sessão."}
              </p>

              <div className="mt-6">
                {cadastro ? (
                  <FormularioCadastro
                    etapa={etapaCadastro}
                    nome={nome}
                    email={email}
                    senha={senha}
                    caminho={caminho}
                    souTerapeuta={souTerapeuta}
                    mostrarOpcaoTerapeuta={!existeTerapeuta}
                    onNome={setNome}
                    onEmail={setEmail}
                    onSenha={setSenha}
                    onCaminho={setCaminho}
                    onSouTerapeuta={setSouTerapeuta}
                    onAvancar={(e) => {
                      e.preventDefault();
                      setEtapaCadastro(2);
                    }}
                    onVoltar={() => setEtapaCadastro(1)}
                    onEnviar={criarConta}
                    carregando={carregando}
                  />
                ) : (
                  <FormularioEntrar
                    email={email}
                    senha={senha}
                    onEmail={setEmail}
                    onSenha={setSenha}
                    onEnviar={entrar}
                    onEsqueciSenha={() => setRecuperar(true)}
                    carregando={carregando}
                  />
                )}
              </div>

              <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-wider text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou
                <span className="h-px flex-1 bg-border" />
              </div>
              <BotaoGoogle destino={destinoSeguro} />

              <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {SELOS.map((selo) => (
                  <li key={selo} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-salvia" />
                    {selo}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
                Seu diário e seu progresso são privados.{" "}
                <Link to="/" className="underline underline-offset-4">
                  Voltar ao início
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
