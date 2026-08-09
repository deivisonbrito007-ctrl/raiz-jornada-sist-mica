import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Send, Sprout } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  adminAtribuirTrilha,
  adminAtualizarCliente,
  adminConvidarCliente,
  adminDefinirStatusAtribuicao,
  adminListarClientes,
} from "@/lib/trilhas.functions";
import {
  FREQUENCIAS,
  NIVEIS,
  NIVEL_LABEL,
  STATUS_ATRIBUICAO,
  STATUS_ATRIBUICAO_LABEL,
  type Nivel,
  type StatusAtribuicao,
} from "@/lib/etapas";
import { formatarData } from "@/lib/raiz-format";
import { PedidosAcompanhamento } from "@/components/painel/pedidos-acompanhamento";
import { adminTornarAutoguiado } from "@/lib/acompanhamento.functions";
import { MODO_LABEL, MODOS_USO, type ModoUso } from "@/lib/modo-uso";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes e atribuições — Raiz" },
      {
        name: "description",
        content:
          "Convide clientes, defina o vínculo de acompanhamento e atribua trilhas com objetivo, frequência e nível.",
      },
      { property: "og:title", content: "Clientes e atribuições — Raiz" },
      {
        property: "og:description",
        content: "Gestão de clientes e atribuição de trilhas no acompanhamento Raiz.",
      },
    ],
  }),
  component: AdminClientes,
});

const campoClasse =
  "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground";

type FormAtribuicao = {
  clienteId: string;
  clienteNome: string;
  trilhaId: string;
  objetivo: string;
  mensagem: string;
  frequencia: string;
  dataInicio: string;
  dataRevisao: string;
  nivel: Nivel;
  podeSozinho: boolean;
  exigeAcompanhamento: boolean;
  somenteEmSessao: boolean;
  orientacoesEspeciais: string;
};

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function AdminClientes() {
  const queryClient = useQueryClient();
  const carregar = useServerFn(adminListarClientes);
  const convidar = useServerFn(adminConvidarCliente);
  const atualizar = useServerFn(adminAtualizarCliente);
  const atribuir = useServerFn(adminAtribuirTrilha);
  const definirStatus = useServerFn(adminDefinirStatusAtribuicao);

  const { data, isLoading } = useQuery({ queryKey: ["admin-clientes"], queryFn: () => carregar() });
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["admin-clientes"] });

  const [convite, setConvite] = useState({ email: "", nome: "", telefone: "" });
  const [form, setForm] = useState<FormAtribuicao | null>(null);
  const [modoFiltro, setModoFiltro] = useState<"todos" | ModoUso>("todos");
  const tornarAutoguiado = useServerFn(adminTornarAutoguiado);

  const mutTornarAutoguiado = useMutation({
    mutationFn: tornarAutoguiado,
    onSuccess: () => {
      toast.success("Acompanhamento encerrado. A pessoa segue por conta própria.");
      void invalidar();
      void queryClient.invalidateQueries({ queryKey: ["admin-pedidos-acompanhamento"] });
    },
    onError: () => toast.error("Não foi possível alterar o modo de uso"),
  });


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

  const mutAtribuir = useMutation({
    mutationFn: atribuir,
    onSuccess: () => {
      toast.success("Trilha atribuída");
      setForm(null);
      void invalidar();
    },
    onError: () => toast.error("Não foi possível atribuir a trilha"),
  });

  const mutStatus = useMutation({
    mutationFn: definirStatus,
    onSuccess: () => {
      toast.success("Status atualizado");
      void invalidar();
    },
  });

  const trilhasPublicadas = (data?.trilhas ?? []).filter((t) => t.status === "publicado");
  const todosClientes = data?.clientes ?? [];
  const contagemModo = (modo: ModoUso) => todosClientes.filter((c) => c.modo === modo).length;
  const clientesVisiveis =
    modoFiltro === "todos" ? todosClientes : todosClientes.filter((c) => c.modo === modoFiltro);

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-display text-2xl text-floresta">Clientes e atribuições</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Convide, acompanhe e defina qual trilha cada pessoa percorre entre as sessões.
        </p>
      </header>

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
              <Send className="h-4 w-4" />
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
                  <Copy className="h-4 w-4" />
                  Copiar link
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PedidosAcompanhamento />

      <div
        role="group"
        aria-label="Filtrar clientes por modo de uso"
        className="flex flex-wrap gap-2"
      >
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
          Carregando clientes...
        </p>
      )}

      {!isLoading && todosClientes.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Nenhum cliente vinculado ainda</p>
          <p className="mt-1">
            Envie um convite acima. O vínculo é criado automaticamente quando a pessoa entra pela
            primeira vez. Quem se cadastra por conta própria aparece aqui como “
            {MODO_LABEL.autoguiado}”.
          </p>
        </div>
      )}

      {!isLoading && todosClientes.length > 0 && clientesVisiveis.length === 0 && (
        <p className="rounded-2xl bg-secondary/50 p-6 text-sm text-muted-foreground">
          Nenhuma pessoa neste modo de uso.
        </p>
      )}

      <ul className="space-y-4">
        {clientesVisiveis.map((cliente) => {
          const atribuicoes = (data?.atribuicoes ?? []).filter((a) => a.cliente_id === cliente.id);
          return (
            <li
              key={cliente.id}
              className="rounded-3xl border border-border bg-card p-5 shadow-organico"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg text-floresta">
                    {cliente.nome || cliente.email}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">{cliente.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Acesso {cliente.status} · {atribuicoes.length} trilha(s) atribuída(s)
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
                  <Button
                    className="min-h-11 rounded-full"
                    onClick={() =>
                      setForm({
                        clienteId: cliente.id,
                        clienteNome: cliente.nome || cliente.email,
                        trilhaId: trilhasPublicadas[0]?.id ?? "",
                        objetivo: "",
                        mensagem: "",
                        frequencia: FREQUENCIAS[0],
                        dataInicio: hoje(),
                        dataRevisao: "",
                        nivel: "leve",
                        podeSozinho: true,
                        exigeAcompanhamento: false,
                        somenteEmSessao: false,
                        orientacoesEspeciais: "",
                      })
                    }
                  >
                    <Sprout className="h-4 w-4" />
                    Atribuir trilha
                  </Button>
                </div>
              </div>

              {atribuicoes.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {atribuicoes.map((a) => (
                    <li
                      key={a.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {(data?.trilhas ?? []).find((t) => t.id === a.trilha_id)?.nome ??
                            "Trilha"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {NIVEL_LABEL[a.nivel as Nivel]} · início {formatarData(a.data_inicio)}
                          {a.data_revisao ? ` · revisão ${formatarData(a.data_revisao)}` : ""}
                        </p>
                      </div>
                      <select
                        aria-label="Status da atribuição"
                        className="min-h-11 shrink-0 rounded-full border border-border bg-card px-3 text-sm"
                        value={a.status}
                        onChange={(e) =>
                          mutStatus.mutate({
                            data: {
                              atribuicaoId: a.id,
                              status: e.target.value as StatusAtribuicao,
                            },
                          })
                        }
                      >
                        {STATUS_ATRIBUICAO.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_ATRIBUICAO_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              )}

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
          );
        })}
      </ul>

      <Dialog open={Boolean(form)} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              Atribuir trilha {form ? `para ${form.clienteNome}` : ""}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <form
              className="space-y-4"
              onSubmit={(evento) => {
                evento.preventDefault();
                if (!form.trilhaId) {
                  toast.error("Publique uma trilha antes de atribuir");
                  return;
                }
                mutAtribuir.mutate({
                  data: {
                    trilhaId: form.trilhaId,
                    clienteId: form.clienteId,
                    objetivo: form.objetivo,
                    mensagem: form.mensagem,
                    frequencia: form.frequencia,
                    dataInicio: form.dataInicio,
                    dataRevisao: form.dataRevisao || null,
                    nivel: form.nivel,
                    podeSozinho: form.podeSozinho,
                    exigeAcompanhamento: form.exigeAcompanhamento,
                    somenteEmSessao: form.somenteEmSessao,
                    permiteRepetir: true,
                    orientacoesEspeciais: form.orientacoesEspeciais,
                    observacoes: "",
                    etapasObrigatorias: [],
                  },
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="atrib-trilha">Trilha publicada</Label>
                  <select
                    id="atrib-trilha"
                    className={campoClasse}
                    value={form.trilhaId}
                    onChange={(e) => setForm({ ...form, trilhaId: e.target.value })}
                  >
                    {trilhasPublicadas.length === 0 && <option value="">Nenhuma publicada</option>}
                    {trilhasPublicadas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="atrib-nivel">Nível para esta pessoa</Label>
                  <select
                    id="atrib-nivel"
                    className={campoClasse}
                    value={form.nivel}
                    onChange={(e) => setForm({ ...form, nivel: e.target.value as Nivel })}
                  >
                    {NIVEIS.map((n) => (
                      <option key={n} value={n}>
                        {NIVEL_LABEL[n]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="atrib-inicio">Início</Label>
                  <Input
                    id="atrib-inicio"
                    type="date"
                    value={form.dataInicio}
                    onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="atrib-revisao">Revisão prevista</Label>
                  <Input
                    id="atrib-revisao"
                    type="date"
                    value={form.dataRevisao}
                    onChange={(e) => setForm({ ...form, dataRevisao: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="atrib-frequencia">Frequência sugerida</Label>
                  <select
                    id="atrib-frequencia"
                    className={campoClasse}
                    value={form.frequencia}
                    onChange={(e) => setForm({ ...form, frequencia: e.target.value })}
                  >
                    {FREQUENCIAS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="atrib-objetivo">Objetivo personalizado</Label>
                <Textarea
                  id="atrib-objetivo"
                  rows={2}
                  value={form.objetivo}
                  onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="atrib-mensagem">Mensagem de orientação</Label>
                <Textarea
                  id="atrib-mensagem"
                  rows={3}
                  value={form.mensagem}
                  onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="atrib-especiais">Orientações especiais</Label>
                <Textarea
                  id="atrib-especiais"
                  rows={2}
                  value={form.orientacoesEspeciais}
                  onChange={(e) => setForm({ ...form, orientacoesEspeciais: e.target.value })}
                />
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={form.podeSozinho}
                    onCheckedChange={(v) => setForm({ ...form, podeSozinho: v === true })}
                  />
                  Pode ser feita sozinha
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={form.exigeAcompanhamento}
                    onCheckedChange={(v) => setForm({ ...form, exigeAcompanhamento: v === true })}
                  />
                  Exige acompanhamento
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={form.somenteEmSessao}
                    onCheckedChange={(v) => setForm({ ...form, somenteEmSessao: v === true })}
                  />
                  Somente em sessão
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 rounded-full"
                  onClick={() => setForm(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="min-h-11 rounded-full"
                  disabled={mutAtribuir.isPending}
                >
                  Atribuir trilha
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
