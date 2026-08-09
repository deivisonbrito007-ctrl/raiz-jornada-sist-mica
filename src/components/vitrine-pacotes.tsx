import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  meusPedidosAcompanhamento,
  pedirAcompanhamento,
} from "@/lib/acompanhamento.functions";
import { minhaVitrinePacotes, solicitarPacote } from "@/lib/pacotes.functions";
import {
  mensagemAcessoAutoguiado,
  podePedirAcompanhamento,
  STATUS_PEDIDO_LABEL,
  type StatusPedido,
} from "@/lib/modo-uso";
import { NIVEL_LABEL } from "@/lib/raiz-format";

function preco(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Bloco de quem usa o Raiz por conta própria: pacotes disponíveis, o que cada um
 * abre e o pedido de acompanhamento da terapeuta.
 */
export function VitrinePacotes() {
  const buscarVitrine = useServerFn(minhaVitrinePacotes);
  const buscarPedidos = useServerFn(meusPedidosAcompanhamento);
  const enviarPedido = useServerFn(pedirAcompanhamento);
  const pedirPacote = useServerFn(solicitarPacote);
  const queryClient = useQueryClient();

  const [mensagem, setMensagem] = useState("");
  const [formAberto, setFormAberto] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["vitrine-pacotes"],
    queryFn: () => buscarVitrine(),
  });
  const { data: pedidos } = useQuery({
    queryKey: ["meus-pedidos-acompanhamento"],
    queryFn: () => buscarPedidos(),
  });

  const aquisicao = useMutation({
    mutationFn: (pacoteId: string) => pedirPacote({ data: { pacoteId } }),
    onSuccess: () => {
      toast.success("Pedido registrado. A terapeuta confirma o pagamento e o acesso abre.");
      void queryClient.invalidateQueries({ queryKey: ["vitrine-pacotes"] });
    },
    onError: () => toast.error("Não foi possível registrar seu pedido agora."),
  });

  const acompanhamento = useMutation({
    mutationFn: () => enviarPedido({ data: { mensagem } }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.info(
          r.motivo === "pedido_em_aberto"
            ? "Você já tem um pedido aguardando resposta."
            : "Você já é acompanhada pela terapeuta.",
        );
        return;
      }
      toast.success("Pedido enviado. A terapeuta responde por aqui.");
      setMensagem("");
      setFormAberto(false);
      void queryClient.invalidateQueries({ queryKey: ["meus-pedidos-acompanhamento"] });
    },
    onError: () => toast.error("Não foi possível enviar seu pedido agora."),
  });

  if (isLoading) return <Skeleton className="mt-6 h-40 rounded-3xl" />;
  if (!data) return null;

  const ultimoPedido = pedidos?.[0] ?? null;
  const podePedir = podePedirAcompanhamento(data.modo, pedidos ?? []);

  return (
    <section aria-labelledby="titulo-vitrine" className="mt-8 space-y-4">
      <div className="rounded-3xl bg-secondary/50 p-5">
        <h2 id="titulo-vitrine" className="text-xl text-floresta">
          Seu acesso
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {mensagemAcessoAutoguiado(data.temPacotePago)}
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {data.pacotes.map((p) => (
          <li
            key={p.id}
            className="flex flex-col rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg text-floresta">{p.nome}</h3>
              <span className="shrink-0 text-sm font-semibold text-terracota">
                {preco(p.precoCentavos)}
                {p.tipoCobranca === "assinatura" ? "/mês" : ""}
              </span>
            </div>
            {p.descricao && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.descricao}</p>
            )}
            {p.areas.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">Áreas: {p.areas.join(", ")}</p>
            )}
            {p.trilhas.length > 0 && (
              <ul className="mt-3 space-y-1">
                {p.trilhas.map((t) => (
                  <li key={t.id} className="text-xs text-muted-foreground">
                    · {t.nome}
                    <span className="text-muted-foreground/70">
                      {" "}
                      ({NIVEL_LABEL[t.nivel] ?? t.nivel})
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex-1" />
            {p.situacao === "pago" ? (
              <p className="text-sm font-medium text-salvia">Ativo — trilhas abertas</p>
            ) : p.situacao === "pendente" ? (
              <p className="text-sm text-muted-foreground">
                Pagamento em confirmação pela terapeuta.
              </p>
            ) : (
              <Button
                type="button"
                onClick={() => aquisicao.mutate(p.id)}
                disabled={aquisicao.isPending}
                className="min-h-11 w-full rounded-full bg-terracota text-terracota-foreground hover:bg-terracota/90"
              >
                Quero este pacote
              </Button>
            )}
          </li>
        ))}
        {data.pacotes.length === 0 && (
          <li className="rounded-2xl bg-secondary/50 p-6 text-center text-sm text-muted-foreground sm:col-span-2">
            Os pacotes estão sendo preparados. Volte em breve.
          </li>
        )}
      </ul>

      <div className="rounded-3xl border border-dashed border-border p-5">
        <h3 className="text-lg text-floresta">Quero acompanhamento da terapeuta</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          No uso por conta própria não existe canal de apoio individual. Se sentir que precisa de
          acompanhamento, envie um pedido — a terapeuta avalia e responde por aqui.
        </p>

        {ultimoPedido && (
          <p className="mt-3 text-sm text-muted-foreground">
            Último pedido:{" "}
            <strong className="text-foreground">
              {STATUS_PEDIDO_LABEL[ultimoPedido.status as StatusPedido] ?? ultimoPedido.status}
            </strong>
            {ultimoPedido.resposta ? ` — “${ultimoPedido.resposta}”` : ""}
          </p>
        )}

        {podePedir &&
          (formAberto ? (
            <div className="mt-4 space-y-3">
              <label htmlFor="mensagem-acompanhamento" className="text-sm font-medium">
                Conte, em poucas linhas, o que você busca
              </label>
              <Textarea
                id="mensagem-acompanhamento"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={4}
                className="rounded-2xl"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => acompanhamento.mutate()}
                  disabled={acompanhamento.isPending}
                  className="min-h-11 rounded-full bg-terracota text-terracota-foreground hover:bg-terracota/90"
                >
                  Enviar pedido
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setFormAberto(false)}
                  className="min-h-11 rounded-full"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormAberto(true)}
              className="mt-4 min-h-11 rounded-full"
            >
              Pedir acompanhamento
            </Button>
          ))}
      </div>
    </section>
  );
}
