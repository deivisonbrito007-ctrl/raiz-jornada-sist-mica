import { useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { mensagemErroAuth } from "@/lib/erro-auth";
import { gravarIntencaoLogin, limparIntencaoLogin } from "@/lib/intencao-login";


/**
 * Entrada com Google pelo intermediador da Lovable (funciona também dentro do
 * preview). O destino pretendido e o jeito de caminhar escolhido ficam
 * guardados em sessionStorage e são aplicados depois que a sessão existe —
 * nunca vamos direto para rota protegida.
 */
export function BotaoGoogle({
  destino,
  caminho,
  papel = "cliente",
}: {
  destino?: string | null;
  caminho?: "acompanhado" | "autoguiado";
  papel?: "cliente" | "terapeuta";
}) {
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setCarregando(true);
    try {
      // Reescreve a intenção do zero: nada de sobra de uma tentativa anterior.
      limparIntencaoLogin();
      gravarIntencaoLogin({ destino, caminho: papel === "terapeuta" ? null : caminho, papel });
      const resultado = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (resultado && "error" in resultado && resultado.error) throw resultado.error;
    } catch (erro) {
      // Se o Google nem abriu, a intenção guardada não deve sobreviver.
      limparIntencaoLogin();
      toast.error(mensagemErroAuth(erro));
    } finally {
      setCarregando(false);
    }
  }


  return (
    <button
      type="button"
      onClick={entrar}
      disabled={carregando}
      className="flex h-13 w-full items-center justify-center gap-3 rounded-full border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota disabled:opacity-60"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path
          fill="#4285F4"
          d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1a7 7 0 0 1-6.6-4.8H1.4v3.1A11.9 11.9 0 0 0 12 24Z"
        />
        <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path
          fill="#EA4335"
          d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.5 11.5 0 0 0 12 0 11.9 11.9 0 0 0 1.4 6.7l4 3.1A7 7 0 0 1 12 4.8Z"
        />
      </svg>
      {carregando ? "Abrindo o Google..." : "Continuar com Google"}
    </button>
  );
}
