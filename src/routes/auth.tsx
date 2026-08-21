import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  existeTerapeuta as consultarExisteTerapeuta,
  convitePendente as consultarConvite,
} from "@/lib/cadastro.functions";

import { mensagemErroAuth } from "@/lib/erro-auth";
import { MolduraEntrada } from "@/components/auth/moldura-entrada";
import { FormularioEntrar } from "@/components/auth/formulario-entrar";
import { FormularioCadastro, type CaminhoEntrada } from "@/components/auth/formulario-cadastro";
import { EstadoConfirmeEmail } from "@/components/auth/estado-confirme-email";
import { BotaoGoogle } from "@/components/auth/botao-google";
import { CampoEmail } from "@/components/auth/campo-email";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({
    modo: z.enum(["entrar", "cadastro"]).optional(),
    caminho: z.enum(["acompanhado", "autoguiado"]).optional(),
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

type EstadoConvite =
  | { estado: "inicial" }
  | { estado: "conferindo" }
  | { estado: "encontrado"; terapeuta: string | null }
  | { estado: "ausente" };

const SELOS = ["Privado", "No seu ritmo", "Com acompanhamento"];


function AuthPage() {
  const { modo, caminho: caminhoUrl, next } = Route.useSearch();
  const destinoSeguro = next && /^\/[^/\\]/.test(next) ? next : null;
  const navigate = useNavigate();

  // A aba vem da URL: voltar no navegador restaura o estado da tela.
  const aba: Aba = modo === "cadastro" ? "cadastro" : "entrar";

  const caminhoInicial: CaminhoEntrada =
    caminhoUrl === "acompanhado" || destinoSeguro?.startsWith("/convite")
      ? "convite"
      : caminhoUrl === "autoguiado"
        ? "propria"
        : "propria";
  // Quem já escolheu na página inicial entra direto nos dados, com o resumo à vista.
  const escolhaVeioDeFora = Boolean(caminhoUrl) || Boolean(destinoSeguro?.startsWith("/convite"));

  const [etapaCadastro, setEtapaCadastro] = useState<1 | 2>(escolhaVeioDeFora ? 2 : 1);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [caminho, setCaminho] = useState<CaminhoEntrada>(caminhoInicial);

  const [carregando, setCarregando] = useState(false);
  const [confirmeEmail, setConfirmeEmail] = useState(false);
  const [recuperar, setRecuperar] = useState(false);
  const [linkEnviado, setLinkEnviado] = useState(false);
  const [existeTerapeuta, setExisteTerapeuta] = useState(true);
  const [convite, setConvite] = useState<EstadoConvite>({ estado: "inicial" });

  const souTerapeuta = caminho === "terapeuta";
  const cadastro = aba === "cadastro";

  const trocarAba = (proxima: Aba) => {
    setEtapaCadastro(escolhaVeioDeFora ? 2 : 1);
    navigate({ to: "/auth", search: (anterior) => ({ ...anterior, modo: proxima }), replace: true });
  };

  useEffect(() => {
    consultarExisteTerapeuta()
      .then((r: { existe: boolean }) => setExisteTerapeuta(r.existe))
      .catch(() => setExisteTerapeuta(true));
  }, []);

  // A escolha feita na página inicial vale mesmo se a pessoa recarregar a tela.
  useEffect(() => {
    if (caminhoUrl === "acompanhado") setCaminho("convite");
    if (caminhoUrl === "autoguiado") setCaminho("propria");
  }, [caminhoUrl]);

  // Trocar de caminho invalida a conferência de convite anterior.
  useEffect(() => {
    setConvite({ estado: "inicial" });
  }, [caminho]);

  useEffect(() => {
    // getUser revalida com o servidor: sessão vencida não redireciona por engano.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) seguir();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function seguir() {
    if (destinoSeguro) {
      navigate({ to: destinoSeguro, replace: true });
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

    // Quem diz ser cliente de uma terapeuta ganha uma conferência antes de
    // criar a conta: sem convite, explicamos o que vai acontecer em vez de
    // criar silenciosamente uma conta autoguiada.
    if (caminho === "convite" && convite.estado === "inicial") {
      setConvite({ estado: "conferindo" });
      try {
        const r = await consultarConvite({ data: { email } });
        if (r.existe) setConvite({ estado: "encontrado", terapeuta: r.terapeuta });
        else setConvite({ estado: "ausente" });
      } catch {
        // Se a conferência falhar, seguimos o cadastro normalmente.
        setConvite({ estado: "ausente" });
      }
      return;
    }

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
    <MolduraEntrada frase={frase}>
      <div>

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
                    onClick={() => trocarAba(item.valor)}

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

              {cadastro && caminhoUrl && (
                <p className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-sm leading-relaxed text-foreground">
                  {caminhoUrl === "acompanhado"
                    ? "Você escolheu seguir com acompanhamento de uma terapeuta. Dá para trocar no próximo passo."
                    : "Você escolheu começar por conta própria. Dá para pedir acompanhamento depois, sem perder nada."}
                </p>
              )}



              <div className="mt-6">
                {cadastro ? (
                  <FormularioCadastro
                    etapa={etapaCadastro}
                    nome={nome}
                    email={email}
                    senha={senha}
                    caminho={caminho}
                    mostrarOpcaoTerapeuta={!existeTerapeuta}
                    escolhaVeioDeFora={escolhaVeioDeFora}
                    onNome={setNome}
                    onEmail={setEmail}
                    onSenha={setSenha}
                    onCaminho={setCaminho}
                    onAvancar={(e) => {
                      e.preventDefault();
                      setEtapaCadastro(2);
                    }}
                    onVoltar={() => setEtapaCadastro(1)}
                    onEnviar={criarConta}
                    carregando={carregando}
                    avisoConvite={avisoConvite}
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
              <BotaoGoogle
                destino={destinoSeguro}
                caminho={caminho === "convite" ? "acompanhado" : "autoguiado"}
              />

              {!cadastro && (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Ainda não tem conta?{" "}
                  <Link
                    to="/auth"
                    search={{ modo: "cadastro" }}
                    className="font-semibold text-floresta underline underline-offset-4"
                  >
                    Escolha seu jeito de caminhar
                  </Link>
                </p>
              )}


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
    </MolduraEntrada>

  );
}
