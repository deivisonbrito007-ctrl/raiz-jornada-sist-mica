import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  adminListarPedidosAcompanhamento,
  adminResponderPedidoAcompanhamento,
} from "@/lib/acompanhamento.functions";
import { STATUS_PEDIDO_LABEL, type StatusPedido } from "@/lib/modo-uso";
import { formatarData } from "@/lib/raiz-format";

/**
 * Fila de pessoas que usam o Raiz por conta própria e pediram acompanhamento.
 * Aceitar move a pessoa para o modo acompanhado, preservando o histórico dela.
 */
export function PedidosAcompanhamento() {
  const carregar = useServerFn(adminListarPedidosAcompanhamento);
  const responder = useServerFn(adminResponderPedidoAcompanhamento);
  const queryClient = useQueryClient();
  const [respostas, setRespostas] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-pedidos-acompanhamento"],
    queryFn: () => carregar(),
  });

  const mutResponder = useMutation({
    mutationFn: responder,
    onSuccess: (r) => {
      if (!r.ok) {
        toast.info("Este pedido já foi respondido.");
        return;
      }
      toast.success("Pedido respondido");
      void queryClient.invalidateQueries({ queryKey: ["admin-pedidos-acompanhamento"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-clientes"] });
    },
    onError: () => toast.error("Não foi possível responder agora"),
  });

  const abertos = (data ?? []).filter((p) => p.status === "aberta");
  const respondidos = (data ?? []).filter((p) => p.status !== "aberta").slice(0, 5);

  return (
    <section
      aria-labelledby="titulo-pedidos-acompanhamento"
      className="rounded-3xl border border-border bg-card p-5 shadow-organico"
    >
      <h2 id="titulo-pedidos-acompanhamento" className="font-display text-lg text-floresta">
        Pedidos de acompanhamento
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pessoas que usam por conta própria e querem seguir com o seu acompanhamento.
      </p>

      {isLoading && (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Carregando pedidos...
        </p>
      )}

      {!isLoading && abertos.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">Nenhum pedido aguardando resposta.</p>
      )}

      <ul className="mt-4 space-y-3">
        {abertos.map((p) => (
          <li key={p.id} className="rounded-2xl bg-secondary p-4">
            <p className="font-medium text-foreground">{p.nome || p.email}</p>
            <p className="text-xs text-muted-foreground">
              {p.email} · pedido em {formatarData(p.created_at)}
            </p>
            {p.mensagem && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">“{p.mensagem}”</p>
            )}
            <div className="mt-3 space-y-2">
              <label htmlFor={`resposta-${p.id}`} className="text-xs font-medium">
                Resposta (opcional)
              </label>
              <Textarea
                id={`resposta-${p.id}`}
                rows={2}
                value={respostas[p.id] ?? ""}
                onChange={(e) => setRespostas((r) => ({ ...r, [p.id]: e.target.value }))}
                className="rounded-2xl bg-card"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="min-h-11 rounded-full"
                  disabled={mutResponder.isPending}
                  onClick={() =>
                    mutResponder.mutate({
                      data: {
                        pedidoId: p.id,
                        decisao: "aceitar",
                        resposta: respostas[p.id] ?? "",
                      },
                    })
                  }
                >
                  Aceitar e acompanhar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 rounded-full"
                  disabled={mutResponder.isPending}
                  onClick={() =>
                    mutResponder.mutate({
                      data: {
                        pedidoId: p.id,
                        decisao: "recusar",
                        resposta: respostas[p.id] ?? "",
                      },
                    })
                  }
                >
                  Recusar
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {respondidos.length > 0 && (
        <ul className="mt-5 space-y-2">
          {respondidos.map((p) => (
            <li key={p.id} className="text-xs text-muted-foreground">
              {p.nome || p.email} ·{" "}
              {STATUS_PEDIDO_LABEL[p.status as StatusPedido] ?? p.status}
              {p.respondido_em ? ` em ${formatarData(p.respondido_em)}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
