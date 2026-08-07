import { Link } from "@tanstack/react-router";
import { ShieldAlert, LogIn, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  bloqueioDePermissao,
  classificarErroPermissao,
  type ErroPermissaoUI,
} from "@/lib/erro-permissao";
import type { Permissao } from "@/lib/permissoes";

type Props = {
  /** Permissão que falta (quando já sabemos antes de chamar o servidor). */
  permissao?: Permissao;
  /** Erro devolvido pelo servidor/banco. */
  erro?: unknown;
  /** Ação de recuperação opcional (ex.: tentar novamente). */
  onTentarNovamente?: () => void;
  compacto?: boolean;
};

function resolver({ permissao, erro }: Props): ErroPermissaoUI {
  if (erro) return classificarErroPermissao(erro);
  if (permissao) return bloqueioDePermissao(permissao);
  return {
    tipo: "permissao",
    titulo: "Acesso não liberado",
    mensagem: "Sua conta não tem acesso a este conteúdo.",
    orientacao: "Peça à terapeuta responsável para liberar esse acesso.",
    ehPermissao: true,
  };
}

/**
 * Aviso visível para bloqueios de permissão: em vez de a tela ficar vazia ou a
 * ação falhar em silêncio, explicamos o motivo e o próximo passo.
 */
export function AvisoPermissao(props: Props) {
  const info = resolver(props);
  const { onTentarNovamente, compacto } = props;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-3xl border border-terracota/30 bg-terracota/10 ${
        compacto ? "p-4" : "p-6 sm:p-8"
      }`}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-terracota" aria-hidden />
        <div className="space-y-2">
          <h2 className={`text-floresta ${compacto ? "text-base font-medium" : "text-xl"}`}>
            {info.titulo}
          </h2>
          <p className="text-sm text-foreground/80">{info.mensagem}</p>
          <p className="text-sm font-medium text-floresta">{info.orientacao}</p>

          <div className="flex flex-wrap gap-2 pt-2">
            {info.tipo === "sessao" ? (
              <Button asChild size="sm">
                <a href="/auth">
                  <LogIn className="mr-1.5 size-4" aria-hidden /> Entrar novamente
                </a>
              </Button>
            ) : null}
            {info.tipo === "escopo" ? (
              <Button asChild size="sm" variant="secondary">
                <Link to="/admin">
                  <ArrowLeft className="mr-1.5 size-4" aria-hidden /> Voltar aos clientes
                </Link>
              </Button>
            ) : null}
            {onTentarNovamente ? (
              <Button size="sm" variant="outline" onClick={onTentarNovamente}>
                <RefreshCw className="mr-1.5 size-4" aria-hidden /> Tentar novamente
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
