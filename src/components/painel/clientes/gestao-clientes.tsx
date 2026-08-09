import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminAtualizarCliente,
  adminConvidarCliente,
  adminListarClientes,
} from "@/lib/trilhas.functions";
import { adminTornarAutoguiado } from "@/lib/acompanhamento.functions";
import { MODO_LABEL, MODOS_USO, type ModoUso } from "@/lib/modo-uso";
import { formatarData } from "@/lib/raiz-format";
import { PedidosAcompanhamento } from "@/components/painel/pedidos-acompanhamento";

/** Cadastro e vínculo das pessoas acompanhadas — sem tocar nos planos. */
export function GestaoClientes() {
  const queryClient = useQueryClient();
  const carregar = useServerFn(adminListarClientes);
  const convidar = useServerFn(adminConvidarCliente);
  const atualizar = useServerFn(adminAtualizarCliente);
  const tornarAutoguiado = useServerFn(adminTornarAutoguiado);

  const { data, isLoading } = useQuery({ queryKey: ["admin-clientes"], queryFn: () => carregar() });
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["admin-clientes"] });

  const [convite, setConvite] = useState({ email: "", nome: "", telefone: "" });
  const [modoFiltro, setModoFiltro] = useState<"todos" | ModoUso>("todos");

  const mutConvidar = useMutation({
    mutationFn: convidar,
    onSuccess: () => {
      toast.success("Convite criado");
      setConvite({ email: "", nome: "", telefone: "" });
      void invalidar();
    },
    onError: () => toast.error("Não foi possível criar o convite"),
  });

  const mutAtualizar = useMutation({
    mutationFn: atualizar,
    onSuccess: () => {
      toast.success("Cadastro atualizado");
      void invalidar();
    },
  });

  const mutTornarAutoguiado = useMutation({
    mutationFn: tornarAutoguiado,
    onSuccess: () => {
      toast.success("Acompanhamento encerrado. A pessoa segue por conta própria.");
      void invalidar();
      void queryClient.invalidateQueries({ queryKey: ["admin-pedidos-acompanhamento"] });
    },
    onError: () => toast.error("Não foi possível alterar o modo de uso"),
  });

  const todosClientes = data?.clientes ?? [];
  const contagemModo = (modo: ModoUso) => todosClientes.filter((c) => c.modo === modo).length;
  const clientesVisiveis =
    modoFiltro === "todos" ? todosClientes : todosClientes.filter((c) => c.modo === modoFiltro);

  return (
    <section className="mt-10 space-y-8">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-organico">
        <h2 className="font-display text-lg text-floresta">Convidar cliente</h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            mutConvidar.mutate({ data: convite });
          }}
        >
          <div className="sm:col-span-2">
            <Label htmlFor="convite-email">E-mail</Label>
            <Input
              id="convite-email"
              type="email"
              required
              value={convite.email}
              onChange={(e) => setConvite({ ...convite, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="convite-nome">Nome</Label>
            <Input
              id="convite-nome"
              value={convite.nome}
              onChange={(e) => setConvite({ ...convite, nome: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="convite-telefone">Telefone</Label>
            <Input
              id="convite-telefone"
              value={convite.telefone}
              onChange={(e) => setConvite({ ...convite, telefone: e.target.value })}
            />
          </div>
          <div className="sm:col-span-4">
            <Button type="submit" className="min-h-11 rounded-full" disabled={mutConvidar.isPending}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Criar convite
            </Button>
          </div>
        </form>

        {(data?.convites ?? []).length > 0 && (
          <ul className="mt-5 space-y-2">
            {(data?.convites ?? []).slice(0, 8).map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{c.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.status === "pendente" ? "Aguardando primeiro acesso" : "Convite aceito"} ·
                    criado em {formatarData(c.created_at)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 shrink-0 rounded-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      `${window.location.origin}/auth?convite=${c.token}`,
                    );
                    toast.success("Link do convite copiado");
                  }}
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copiar link
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PedidosAcompanhamento />

      <div role="group" aria-label="Filtrar clientes por modo de uso" className="flex flex-wrap gap-2">
        {(["todos", ...MODOS_USO] as const).map((valor) => {
          const ativo = modoFiltro === valor;
          const rotulo =
            valor === "todos"
              ? `Todos (${todosClientes.length})`
              : `${MODO_LABEL[valor]} (${contagemModo(valor)})`;
          return (
            <button
              key={valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => setModoFiltro(valor)}
              className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${
                ativo
                  ? "border-floresta bg-floresta text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              {rotulo}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando cadastros...
        </p>
      )}

      {!isLoading && todosClientes.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Nenhum cliente vinculado ainda</p>
          <p className="mt-1">
            Envie um convite acima. O vínculo é criado quando a pessoa entra pela primeira vez. Quem
            se cadastra por conta própria aparece como “{MODO_LABEL.autoguiado}”.
          </p>
        </div>
      )}

      <ul className="space-y-4">
        {clientesVisiveis.map((cliente) => (
          <li key={cliente.id} className="rounded-3xl border border-border bg-card p-5 shadow-organico">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <h3 className="truncate font-display text-lg text-floresta">
                  {cliente.nome || cliente.email}
                </h3>
                <p className="truncate text-sm text-muted-foreground">{cliente.email}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={`rounded-full px-3 py-1 font-medium ${
                      cliente.modo === "acompanhado"
                        ? "bg-secondary text-floresta"
                        : "bg-terracota/10 text-terracota"
                    }`}
                  >
                    {MODO_LABEL[cliente.modo]}
                  </span>
                  <span>Acesso {cliente.status}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <select
                  aria-label={`Status do acesso de ${cliente.nome || cliente.email}`}
                  className="min-h-11 rounded-full border border-border bg-card px-3 text-sm"
                  value={cliente.status}
                  onChange={(e) =>
                    mutAtualizar.mutate({
                      data: {
                        clienteId: cliente.id,
                        status: e.target.value as "ativo" | "pausado" | "encerrado",
                      },
                    })
                  }
                >
                  <option value="ativo">Ativo</option>
                  <option value="pausado">Pausado</option>
                  <option value="encerrado">Encerrado</option>
                </select>
                {cliente.modo === "acompanhado" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 rounded-full"
                    disabled={mutTornarAutoguiado.isPending}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Encerrar o acompanhamento de ${cliente.nome || cliente.email}? A pessoa passa a usar por conta própria e mantém o histórico.`,
                        )
                      )
                        return;
                      mutTornarAutoguiado.mutate({ data: { clienteId: cliente.id, motivo: "" } });
                    }}
                  >
                    Encerrar acompanhamento
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor={`obs-${cliente.id}`}>Observações internas</Label>
              <Textarea
                id={`obs-${cliente.id}`}
                rows={2}
                defaultValue={cliente.observacoes}
                onBlur={(e) =>
                  e.target.value !== cliente.observacoes &&
                  mutAtualizar.mutate({
                    data: { clienteId: cliente.id, observacoes: e.target.value },
                  })
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
