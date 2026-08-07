import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { adminResumo, adminSalvarPacote } from "@/lib/raiz.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COBRANCA_LABEL, formatarPreco } from "@/lib/raiz-format";
import { AvisoPermissao } from "@/components/aviso-permissao";
import { useMinhasPermissoes } from "@/hooks/use-minhas-permissoes";
import { notificarErro } from "@/lib/erro-permissao";

export const Route = createFileRoute("/_authenticated/admin/pacotes")({
  component: AdminPacotes,
});

type Formulario = {
  id?: string;
  nome: string;
  descricao: string;
  eixosIncluidos: string[];
  tipoCobranca: "pagamento_unico" | "assinatura";
  precoReais: string;
};

const vazio: Formulario = {
  nome: "",
  descricao: "",
  eixosIncluidos: [],
  tipoCobranca: "pagamento_unico",
  precoReais: "",
};

function AdminPacotes() {
  const queryClient = useQueryClient();
  const fetchResumo = useServerFn(adminResumo);
  const salvar = useServerFn(adminSalvarPacote);
  const perms = useMinhasPermissoes();
  const bloqueado = perms.bloqueado("gerenciar_pacotes");
  const { data, error, refetch } = useQuery({
    queryKey: ["admin-resumo"],
    queryFn: () => fetchResumo(),
    enabled: !bloqueado,
    retry: false,
  });
  const [form, setForm] = useState<Formulario | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function submeter() {
    if (!form || !form.nome.trim()) return;
    setEnviando(true);
    try {
      await salvar({
        data: {
          ...(form.id ? { id: form.id } : {}),
          nome: form.nome,
          descricao: form.descricao,
          eixosIncluidos: form.eixosIncluidos,
          tipoCobranca: form.tipoCobranca,
          precoCentavos: Math.round(Number(form.precoReais.replace(",", ".") || "0") * 100),
        },
      });
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["admin-resumo"] });
      toast.success("Pacote salvo");
    } catch (erro) {
      notificarErro(erro, "Não foi possível salvar o pacote");
    } finally {
      setEnviando(false);
    }
  }

  if (bloqueado) {
    return (
      <div>
        <h1 className="text-3xl text-floresta">Pacotes</h1>
        <div className="mt-6">
          <AvisoPermissao permissao="gerenciar_pacotes" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl text-floresta">Pacotes</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Defina jornadas e valores. O controle de pagamento é manual, por cliente.
          </p>
        </div>
        <Button
          onClick={() => setForm(vazio)}
          className="rounded-full bg-terracota px-6 text-terracota-foreground hover:bg-terracota/90"
        >
          <Plus className="mr-2 h-4 w-4" /> Novo pacote
        </Button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {(data?.pacotes ?? []).map((pacote) => (
          <article
            key={pacote.id}
            className="rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl text-floresta">{pacote.nome}</h2>
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-[11px] text-floresta">
                {COBRANCA_LABEL[pacote.tipo_cobranca] ?? pacote.tipo_cobranca}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{pacote.descricao}</p>
            <p className="mt-4 font-display text-3xl text-terracota">
              {formatarPreco(pacote.preco_centavos ?? 0)}
            </p>
            <p className="mt-2 text-xs text-salvia">
              {(pacote.eixos_incluidos ?? []).length} eixo(s) incluído(s)
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-full border-floresta/20 text-floresta"
              onClick={() =>
                setForm({
                  id: pacote.id,
                  nome: pacote.nome,
                  descricao: pacote.descricao ?? "",
                  eixosIncluidos: pacote.eixos_incluidos ?? [],
                  tipoCobranca: pacote.tipo_cobranca as Formulario["tipoCobranca"],
                  precoReais: ((pacote.preco_centavos ?? 0) / 100).toString(),
                })
              }
            >
              Editar
            </Button>
          </article>
        ))}
        {(data?.pacotes ?? []).length === 0 && (
          <p className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nenhum pacote criado ainda.
          </p>
        )}
      </div>

      <Dialog open={Boolean(form)} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-floresta">
              {form?.id ? "Editar pacote" : "Novo pacote"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <label className="block text-sm text-floresta">
                Nome
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="mt-1 rounded-xl"
                />
              </label>
              <label className="block text-sm text-floresta">
                Descrição
                <Textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={3}
                  className="mt-1 rounded-xl"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-floresta">
                  Cobrança
                  <Select
                    value={form.tipoCobranca}
                    onValueChange={(v) =>
                      setForm({ ...form, tipoCobranca: v as Formulario["tipoCobranca"] })
                    }
                  >
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(COBRANCA_LABEL).map(([valor, label]) => (
                        <SelectItem key={valor} value={valor}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="text-sm text-floresta">
                  Preço (R$)
                  <Input
                    value={form.precoReais}
                    onChange={(e) => setForm({ ...form, precoReais: e.target.value })}
                    placeholder="0,00"
                    className="mt-1 rounded-xl"
                  />
                </label>
              </div>

              <div>
                <p className="text-sm text-floresta">Eixos incluídos</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(data?.eixos ?? []).map((eixo) => (
                    <label
                      key={eixo.id}
                      className="flex items-center gap-2 text-sm text-foreground"
                    >
                      <Checkbox
                        checked={form.eixosIncluidos.includes(eixo.id)}
                        onCheckedChange={(marcado) =>
                          setForm({
                            ...form,
                            eixosIncluidos: marcado
                              ? [...form.eixosIncluidos, eixo.id]
                              : form.eixosIncluidos.filter((id) => id !== eixo.id),
                          })
                        }
                      />
                      {eixo.nome}
                    </label>
                  ))}
                </div>
              </div>

              <Button
                onClick={submeter}
                disabled={enviando || !form.nome.trim()}
                className="w-full rounded-full bg-terracota py-6 text-terracota-foreground hover:bg-terracota/90"
              >
                {enviando ? "Salvando..." : "Salvar pacote"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
