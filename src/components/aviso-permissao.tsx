import { AlertTriangle } from "lucide-react";
import {
  MENSAGEM_FALHA_GENERICA,
  ORIENTACAO_ACESSO_RESTRITO,
  ehErroPermissao,
  mensagemPainel,
} from "@/lib/erro-permissao";

type Props = {
  erro?: unknown;
  /** Texto alternativo quando não há erro técnico (checagem proativa). */
  mensagem?: string;
  className?: string;
};

/**
 * Aviso padronizado de ação bloqueada por permissão.
 * Não revela se o registro existe — apenas orienta o próximo passo.
 */
export function AvisoPermissao({ erro, mensagem, className }: Props) {
  const texto = mensagem
    ? mensagem
    : erro === undefined
      ? ORIENTACAO_ACESSO_RESTRITO
      : mensagemPainel(erro, MENSAGEM_FALHA_GENERICA);
  const restrito = mensagem ? true : erro === undefined || ehErroPermissao(erro);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground ${className ?? ""}`}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {restrito ? "Ação não permitida" : "Não foi possível concluir"}
        </p>
        <p>{texto}</p>
      </div>
    </div>
  );
}
