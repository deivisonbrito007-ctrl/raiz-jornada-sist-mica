import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Tela dedicada depois do cadastro, com opção de reenviar o link. */
export function EstadoConfirmeEmail({
  email,
  onReenviar,
  reenviando,
  onVoltar,
}: {
  email: string;
  onReenviar: () => void;
  reenviando: boolean;
  onVoltar: () => void;
}) {
  return (
    <div className="text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
        <MailCheck aria-hidden="true" className="h-7 w-7 text-salvia" />
      </span>
      <h2 className="mt-5 font-display text-2xl text-floresta">Confirme seu e-mail</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Enviamos um link para <span className="font-semibold text-foreground">{email}</span>. Abra o
        e-mail para confirmar e entrar na sua jornada.
      </p>
      <Button
        type="button"
        onClick={onReenviar}
        disabled={reenviando}
        className="mt-7 h-13 w-full rounded-full bg-terracota text-base font-semibold text-terracota-foreground hover:bg-terracota/90"
      >
        {reenviando ? "Reenviando..." : "Reenviar o link"}
      </Button>
      <button
        type="button"
        onClick={onVoltar}
        className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Usar outro e-mail
      </button>
    </div>
  );
}
