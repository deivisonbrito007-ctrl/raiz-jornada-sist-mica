import { CampoEmail } from "@/components/auth/campo-email";
import { CampoSenha } from "@/components/auth/campo-senha";
import { Button } from "@/components/ui/button";

/** Passo único de login: e-mail, senha, recuperação e envio. */
export function FormularioEntrar({
  email,
  senha,
  onEmail,
  onSenha,
  onEnviar,
  onEsqueciSenha,
  carregando,
}: {
  email: string;
  senha: string;
  onEmail: (v: string) => void;
  onSenha: (v: string) => void;
  onEnviar: (e: React.FormEvent) => void;
  onEsqueciSenha: () => void;
  carregando: boolean;
}) {
  return (
    <form onSubmit={onEnviar} className="space-y-5">
      <CampoEmail valor={email} onChange={onEmail} />
      <CampoSenha valor={senha} onChange={onSenha} autoComplete="current-password" />
      <button
        type="button"
        onClick={onEsqueciSenha}
        className="text-sm font-medium text-terracota underline-offset-4 hover:underline"
      >
        Esqueci minha senha
      </button>
      <Button
        type="submit"
        disabled={carregando}
        className="h-13 w-full rounded-full bg-terracota text-base font-semibold text-terracota-foreground shadow-organico hover:bg-terracota/90"
      >
        {carregando ? "Abrindo seu espaço..." : "Entrar"}
      </Button>
    </form>
  );
}
