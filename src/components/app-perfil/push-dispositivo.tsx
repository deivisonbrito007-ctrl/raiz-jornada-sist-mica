import { BellOff, BellRing, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePushLembretes } from "@/hooks/use-push-lembretes";

/** Ativação das notificações push neste aparelho. Vive na Central de lembretes. */
export function PushDispositivo() {
  const push = usePushLembretes();

  const texto =
    push.estado === "ativado"
      ? "Este dispositivo receberá os lembretes."
      : push.estado === "bloqueado"
        ? "As notificações estão bloqueadas nas configurações do navegador."
        : push.estado === "indisponivel"
          ? "Este navegador não suporta notificações. Você ainda recebe por e-mail e no app."
          : "Ative para receber o aviso mesmo com o app fechado.";

  return (
    <div className="mt-5 rounded-2xl bg-secondary p-4">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-salvia" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-floresta">Notificações neste dispositivo</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{texto}</p>
          {push.erro ? <p className="mt-1 text-xs text-destructive">{push.erro}</p> : null}
        </div>
      </div>
      {push.suportado && push.estado !== "bloqueado" ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => (push.estado === "ativado" ? push.desativar() : push.ativar())}
          disabled={push.estado === "processando"}
          className="mt-3 min-h-11 w-full rounded-full border-floresta/20 text-floresta"
        >
          {push.estado === "ativado" ? (
            <>
              <BellOff className="mr-2 h-4 w-4" aria-hidden="true" />
              Desativar neste dispositivo
            </>
          ) : (
            <>
              <BellRing className="mr-2 h-4 w-4" aria-hidden="true" />
              Ativar notificações neste dispositivo
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
}
