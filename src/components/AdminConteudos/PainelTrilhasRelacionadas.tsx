import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminTrilhasDoConteudo } from "@/lib/raiz.functions";
import type { ConteudoAdmin } from "@/hooks/useConteudos";

/** Mostra em quais trilhas e planos o material está sendo usado. */
export function PainelTrilhasRelacionadas({
  conteudo,
  aberto,
  onFechar,
}: {
  conteudo: ConteudoAdmin | null;
  aberto: boolean;
  onFechar: () => void;
}) {
  const buscar = useServerFn(adminTrilhasDoConteudo);
  const { data, isLoading } = useQuery({
    queryKey: ["conteudo-trilhas", conteudo?.id],
    queryFn: () => buscar({ data: { id: conteudo!.id } }),
    enabled: aberto && Boolean(conteudo?.id),
  });

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-floresta">Trilhas relacionadas</DialogTitle>
          <DialogDescription>
            {conteudo ? `Onde “${conteudo.titulo}” está sendo usado hoje.` : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}

        {!isLoading && (data?.trilhas.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">
            Este material ainda não faz parte de nenhuma trilha.
          </p>
        )}

        <ul className="space-y-2">
          {(data?.trilhas ?? []).map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-floresta">{t.nome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t.status}
                  {t.copia ? " · usado como cópia editável" : " · etapa direta"}
                </p>
              </div>
              <Link
                to="/admin/trilhas"
                className="rounded-full bg-papel px-3 py-1 text-xs font-semibold text-floresta"
              >
                Abrir
              </Link>
            </li>
          ))}
        </ul>

        {data && (
          <p className="text-xs text-muted-foreground">
            {data.planos} etapa(s) em planos de acompanhamento usam este material.
            {data.planos > 0 &&
              " Por isso a exclusão definitiva fica bloqueada — prefira arquivar."}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
