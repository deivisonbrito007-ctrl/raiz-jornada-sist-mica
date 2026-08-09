import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { HeartHandshake } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminAcompanhamento,
  adminResponderApoio,
  adminSalvarConfiguracoes,
} from "@/lib/trilhas.functions";
import { formatarData } from "@/lib/raiz-format";

/**
 * Pedidos de apoio, check-ins recentes e prazo de resposta.
 *
 * Mostra apenas o que o cliente escreveu ou registrou: nada aqui interpreta
 * emoção nem gera alerta clínico automático.
 */
export function ApoioEConfiguracoes() {
  const queryClient = useQueryClient();
  const carregar = useServerFn(adminAcompanhamento);
  const responder = useServerFn(adminResponderApoio);
  const salvarConfig = useServerFn(adminSalvarConfiguracoes);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-acompanhamento"],
    queryFn: () => carregar(),
  });
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["admin-acompanhamento"] });

  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [prazo, setPrazo] = useState<number | null>(null);

  const mutResponder = useMutation({
    mutationFn: responder,
    onSuccess: () => {
      toast.success("Resposta enviada");
      void invalidar();
    },
    onError: () => toast.error("Não foi possível responder agora"),
  });

  const mutConfig = useMutation({
    mutationFn: salvarConfig,
    onSuccess: () => {
      toast.success("Configuração salva");
      void invalidar();
    },
  });

  const nome = (id: string) =>
    (data?.perfis ?? []).find((p) => p.id === id)?.nome ||
    (data?.perfis ?? []).find((p) => p.id === id)?.email ||
    "Cliente";

  const prazoAtual = prazo ?? data?.configuracoes?.prazo_resposta_horas ?? 48;

  return (
    <div className="space-y-6">
      {isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando registros...
        </p>
      )}

      <div className="rounded-3xl border border-border bg-card p-5 shadow-organico">
        <h2 className="font-display text-lg text-floresta">Pedidos de apoio</h2>
        {(data?.apoio ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum pedido em aberto.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(data?.apoio ?? []).map((s) => (
              <li key={s.id} className="rounded-2xl bg-secondary p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {nome(s.cliente_id)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatarData(s.created_at)} · {s.status}
                      {s.intensidade !== null
                        ? ` · o cliente relatou ${s.intensidade} de 10`
                        : ""}
                    </p>
                  </div>
                  <HeartHandshake className="h-5 w-5 shrink-0 text-terracota" aria-hidden />
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-foreground">{s.mensagem}</p>
                {s.resposta ? (
                  <p className="mt-2 rounded-xl bg-card p-3 text-sm text-muted-foreground">
                    Resposta enviada: {s.resposta}
                  </p>
                ) : (
                  <form
                    className="mt-3 space-y-2"
                    onSubmit={(evento) => {
                      evento.preventDefault();
                      const texto = respostas[s.id] ?? "";
                      if (!texto.trim()) return;
                      mutResponder.mutate({
                        data: { solicitacaoId: s.id, resposta: texto, status: "respondida" },
                      });
                    }}
                  >
                    <Label htmlFor={`resposta-${s.id}`}>Resposta</Label>
                    <Textarea
                      id={`resposta-${s.id}`}
                      rows={3}
                      value={respostas[s.id] ?? ""}
                      onChange={(e) => setRespostas({ ...respostas, [s.id]: e.target.value })}
                    />
                    <Button type="submit" className="min-h-11 rounded-full">
                      Enviar resposta
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-organico">
        <h2 className="font-display text-lg text-floresta">Registros recentes dos clientes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Autorrelatos de check-in e check-out, na linguagem de quem escreveu.
        </p>
        {(data?.checkins ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum registro por enquanto.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {(data?.checkins ?? []).slice(0, 30).map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{nome(c.cliente_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.momento === "inicial" ? "Check-in" : "Check-out"} · {c.emocao || "sem nome"}{" "}
                    · {c.local_corpo || "corpo não indicado"} · {formatarData(c.created_at)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-card px-3 py-1 text-xs font-medium text-foreground">
                  relatou {c.intensidade}/10
                  {c.precisa_contato ? " · pediu contato" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-organico">
        <h2 className="font-display text-lg text-floresta">Prazo de resposta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Este prazo aparece para o cliente quando ele pede apoio.
        </p>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(evento) => {
            evento.preventDefault();
            mutConfig.mutate({
              data: {
                prazoRespostaHoras: prazoAtual,
                contatos: (data?.configuracoes?.contatos_emergencia ?? []) as {
                  nome: string;
                  contato: string;
                }[],
              },
            });
          }}
        >
          <div>
            <Label htmlFor="prazo">Horas para responder</Label>
            <Input
              id="prazo"
              type="number"
              min={1}
              max={240}
              className="w-32"
              value={prazoAtual}
              onChange={(e) => setPrazo(Number(e.target.value))}
            />
          </div>
          <Button type="submit" className="min-h-11 rounded-full">
            Salvar
          </Button>
        </form>
      </div>
    </div>
  );
}
