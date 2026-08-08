import type { ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMinhasPermissoes } from "@/hooks/use-minhas-permissoes";
import { PERMISSAO_LABEL, type Permissao } from "@/lib/permissoes";

/** Mensagem padrão do bloqueio, sem revelar dados do registro. */
export function motivoSemPermissao(permissao: Permissao) {
  return `Você não tem a permissão “${PERMISSAO_LABEL[permissao]}”. Peça a um gestor da equipe.`;
}

type SePodeProps = {
  /** Permissão única exigida. */
  permissao?: Permissao;
  /** Exige ao menos uma da lista. */
  algumaDe?: Permissao[];
  /** Exige todas da lista. */
  todasDe?: Permissao[];
  children: ReactNode;
  /** O que mostrar quando não houver permissão (padrão: nada). */
  senao?: ReactNode;
  /** Enquanto o contexto carrega, esconde por padrão. */
  mostrarCarregando?: boolean;
};

/** Esconde a árvore quando o usuário não tem a permissão exigida. */
export function SePode({
  permissao,
  algumaDe,
  todasDe,
  children,
  senao = null,
  mostrarCarregando = false,
}: SePodeProps) {
  const { pode, podeAlguma, podeTodas, carregando } = useMinhasPermissoes();
  if (carregando && !mostrarCarregando) return null;

  const liberado =
    (permissao ? pode(permissao) : true) &&
    (algumaDe ? podeAlguma(algumaDe) : true) &&
    (todasDe ? podeTodas(todasDe) : true);

  return <>{liberado ? children : senao}</>;
}

type ControleProps = {
  permissao: Permissao;
  children: ReactElement<{ disabled?: boolean; "aria-disabled"?: boolean; title?: string }>;
  /** Texto alternativo do motivo. */
  motivo?: string;
};

/**
 * Desabilita o controle filho (botão, switch, input) quando falta permissão e
 * explica o motivo em tooltip + `title`, em vez de deixar o clique falhar.
 */
export function ControlePermitido({ permissao, children, motivo }: ControleProps) {
  const { pode, carregando } = useMinhasPermissoes();
  const liberado = pode(permissao);
  if (liberado || !isValidElement(children)) return <>{children}</>;

  const texto = motivo ?? (carregando ? "Verificando suas permissões…" : motivoSemPermissao(permissao));
  const bloqueado = cloneElement(children, {
    disabled: true,
    "aria-disabled": true,
    title: texto,
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-not-allowed">{bloqueado}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{texto}</TooltipContent>
    </Tooltip>
  );
}

/** Bloco de aviso para seções inteiras sem permissão. */
export function SecaoSemPermissao({
  permissao,
  titulo = "Seção restrita",
  className,
}: {
  permissao: Permissao;
  titulo?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground ${className ?? ""}`}
    >
      <Lock className="mt-0.5 size-4 shrink-0 text-salvia" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">{titulo}</p>
        <p>{motivoSemPermissao(permissao)}</p>
      </div>
    </div>
  );
}
