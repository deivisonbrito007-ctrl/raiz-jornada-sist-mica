import { MoreVertical, ShieldCheck, ShieldOff, Trash2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { formatarData } from "@/lib/raiz-format";
import { ESCOPO_LABEL, rotuloFuncao } from "@/lib/equipe-funcoes";
import { PERMISSAO_LABEL, type Permissao } from "@/lib/permissoes";
import { AvatarIniciais } from "./avatar-iniciais";
import type { MembroEquipe } from "./tipos";

function dataHora(valor: string | null) {
  if (!valor) return "sem registro";
  const d = new Date(valor);
  return `${formatarData(valor)} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function LinhaMembro({
  membro,
  souEu,
  onEditarFuncao,
  onVincular,
  onAlterarStatus,
  onRemover,
}: {
  membro: MembroEquipe;
  souEu: boolean;
  onEditarFuncao: () => void;
  onVincular: () => void;
  onAlterarStatus: (status: "ativo" | "suspenso") => void;
  onRemover: () => void;
}) {
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const suspenso = membro.status === "suspenso";

  return (
    <li
      className={`rounded-2xl border p-4 ${
        suspenso ? "border-terracota/30 bg-terracota/5" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <AvatarIniciais nome={membro.nome} email={membro.email} />
          <div className="min-w-0">
            <p className="font-medium text-floresta">
              {membro.nome || membro.email}
              {membro.principal && (
                <span className="ml-2 rounded-full bg-salvia/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-salvia">
                  conta principal
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">{membro.email}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-secondary px-2 py-0.5 text-floresta">
                {rotuloFuncao(membro.funcao, membro.permissoes)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 ${
                  suspenso
                    ? "bg-terracota/10 text-terracota"
                    : "bg-salvia/15 text-salvia"
                }`}
              >
                {suspenso ? "Suspenso" : "Ativo"}
              </span>
              <span className="text-muted-foreground">{ESCOPO_LABEL[membro.escopo]}</span>
              {membro.clientesVinculados !== null && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3 w-3" /> {membro.clientesVinculados} cliente(s)
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Último acesso: {dataHora(membro.ultimoAcesso)} · na equipe desde{" "}
              {formatarData(membro.desde)}
              {membro.convidadoEm ? ` · convite de ${formatarData(membro.convidadoEm)}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {membro.permissoes.length === 0
                ? "Sem permissões — não vê nada do painel."
                : membro.permissoes
                    .map((p) => PERMISSAO_LABEL[p as Permissao] ?? p)
                    .join(" · ")}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="rounded-full"
              aria-label={`Ações para ${membro.email}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl">
            <DropdownMenuItem onSelect={onEditarFuncao}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Editar função e permissões
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onVincular} disabled={membro.escopo === "todos"}>
              <Users className="mr-2 h-4 w-4" /> Vincular clientes
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {suspenso ? (
              <DropdownMenuItem onSelect={() => onAlterarStatus("ativo")}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Reativar acesso
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={() => onAlterarStatus("suspenso")}
                disabled={membro.principal || souEu}
                className="text-terracota"
              >
                <ShieldOff className="mr-2 h-4 w-4" /> Suspender acesso
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => setConfirmarRemocao(true)}
              disabled={membro.principal || souEu}
              className="text-terracota"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Remover da equipe
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmarRemocao} onOpenChange={setConfirmarRemocao}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-floresta">
              Remover {membro.nome || membro.email} da equipe?
            </AlertDialogTitle>
            <AlertDialogDescription>
              As permissões e os vínculos são apagados na hora e o painel dessa pessoa é
              bloqueado imediatamente. O histórico de auditoria é preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-terracota text-terracota-foreground hover:bg-terracota/90"
              onClick={onRemover}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
