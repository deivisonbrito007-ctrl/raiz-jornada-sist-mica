import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";

import { listarNotificacoes, marcarNotificacoesLidas } from "@/lib/raiz.functions";
import { CHAVES } from "@/lib/cache-chaves";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatarData } from "@/lib/raiz-format";

/** Sino de avisos do cliente: abre e marca como lidos na mesma ação. */
export function AvisosApp() {
  const queryClient = useQueryClient();
  const fetchNotificacoes = useServerFn(listarNotificacoes);
  const lerNotificacoes = useServerFn(marcarNotificacoesLidas);

  const { data: notificacoes } = useQuery({
    queryKey: CHAVES.notificacoes,
    queryFn: () => fetchNotificacoes(),
  });
  const lista = notificacoes ?? [];
  const naoLidas = lista.filter((n) => !n.lida).length;

  return (
    <Popover
      onOpenChange={(aberto) => {
        if (aberto && naoLidas > 0) {
          void lerNotificacoes().then(() =>
            queryClient.invalidateQueries({ queryKey: CHAVES.notificacoes }),
          );
        }
      }}
    >
      <PopoverTrigger
        aria-label={naoLidas > 0 ? `Recados (${naoLidas} não lidos)` : "Recados"}
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-floresta transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {naoLidas > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-terracota"
          />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-3xl">
        <p className="font-display text-lg text-floresta">Recados</p>
        {lista.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Nada novo por aqui. Quando houver algo do seu processo, aparece neste lugar.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {lista.slice(0, 8).map((n) => (
              <li key={n.id} className="rounded-2xl bg-secondary p-3">
                <p className="text-sm font-medium text-floresta">{n.titulo}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.mensagem}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatarData(n.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
