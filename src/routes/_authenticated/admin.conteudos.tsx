import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import {
  adminApagarConteudo,
  adminListarConteudos,
  adminSalvarConteudo,
} from "@/lib/raiz.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TIPO_LABEL, formatarDuracao } from "@/lib/raiz-format";

export const Route = createFileRoute("/_authenticated/admin/conteudos")({
  component: AdminConteudos,
});

type Tipo = "video" | "audio" | "exercicio" | "texto" | "tarefa";

type Formulario = {
  id?: string;
  eixoId: string;
  tipo: Tipo;
  titulo: string;
  descricao: string;
  corpoTexto: string;
  storagePath: string;
  duracaoSegundos: number;
  ordem: number;
};

const vazio = (eixoId: string): Formulario => ({
  eixoId,
  tipo: "audio",
  titulo: "",
  descricao: "",
  corpoTexto: "",
  storagePath: "",
  duracaoSegundos: 0,
  ordem: 0,
});

function AdminConteudos() {
  const queryClient = useQueryClient();
  const fetchTudo = useServerFn(adminListarConteudos);
  const salvar = useServerFn(adminSalvarConteudo);
  const apagar = useServerFn(adminApagarConteudo);

  const { data } = useQuery({ queryKey: ["admin-conteudos"], queryFn: () => fetchTudo() });
  const [form, setForm] = useState<Formulario | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [subindo, setSubindo] = useState(false);

  function recarregar() {
    queryClient.invalidateQueries({ queryKey: ["admin-conteudos"] });
    queryClient.invalidateQueries({ queryKey: ["admin-resumo"] });
  }

  async function enviarArquivo(arquivo: File) {
    if (!form) return;
    setSubindo(true);
    try {
      const caminho = `${form.eixoId}/${Date.now()}-${arquivo.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("midias").upload(caminho, arquivo, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw new Error(error.message);
      setForm({ ...form, storagePath: caminho });
      toast.success("Mídia enviada");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha no envio");
    } finally {
      setSubindo(false);
    }
  }

  async function submeter() {
    if (!form || !form.titulo.trim()) return;
    setEnviando(true);
    try {
      await salvar({
        data: {
          ...(form.id ? { id: form.id } : {}),
          eixoId: form.eixoId,
          tipo: form.tipo,
          titulo: form.titulo,
          descricao: form.descricao,
          corpoTexto: form.corpoTexto || null,
          storagePath: form.storagePath || null,
          duracaoSegundos: Number(form.duracaoSegundos) || 0,
          ordem: Number(form.ordem) || 0,
        },
      });
      setForm(null);
      recarregar();
      toast.success("Conteúdo salvo");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl text-floresta">Conteúdos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Organize as práticas de cada eixo. Nada fica visível antes de você liberar.
          </p>
        </div>
        <Button
          onClick={() => setForm(vazio(data?.eixos[0]?.id ?? ""))}
          disabled={!data?.eixos.length}
          className="rounded-full bg-terracota px-6 text-terracota-foreground hover:bg-terracota/90"
        >
          <Plus className="mr-2 h-4 w-4" /> Nova prática
        </Button>
      </div>

      <div className="mt-8 space-y-6">
        {(data?.eixos ?? []).map((eixo) => {
          const conteudos = (data?.conteudos ?? []).filter((c) => c.eixo_id === eixo.id);
          return (
            <section key={eixo.id} className="rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
              <h2 className="text-xl text-floresta">{eixo.nome}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{eixo.descricao}</p>
              <ul className="mt-4 space-y-2">
                {conteudos.map((conteudo) => (
                  <li
                    key={conteudo.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-floresta">{conteudo.titulo}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {TIPO_LABEL[conteudo.tipo] ?? conteudo.tipo} ·{" "}
                        {formatarDuracao(conteudo.duracao_segundos)} · ordem {conteudo.ordem}
                        {conteudo.storage_path ? " · mídia enviada" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full border-floresta/20 text-floresta"
                        onClick={() =>
                          setForm({
                            id: conteudo.id,
                            eixoId: conteudo.eixo_id,
                            tipo: conteudo.tipo as Tipo,
                            titulo: conteudo.titulo,
                            descricao: conteudo.descricao ?? "",
                            corpoTexto: conteudo.corpo_texto ?? "",
                            storagePath: conteudo.storage_path ?? "",
                            duracaoSegundos: conteudo.duracao_segundos ?? 0,
                            ordem: conteudo.ordem ?? 0,
                          })
                        }
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full text-destructive"
                        onClick={async () => {
                          await apagar({ data: { id: conteudo.id } });
                          recarregar();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
                {conteudos.length === 0 && (
                  <li className="text-xs text-muted-foreground">Nenhuma prática ainda.</li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

      <Dialog open={Boolean(form)} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-floresta">
              {form?.id ? "Editar prática" : "Nova prática"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-floresta">
                  Eixo
                  <Select
                    value={form.eixoId}
                    onValueChange={(v) => setForm({ ...form, eixoId: v })}
                  >
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(data?.eixos ?? []).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="text-sm text-floresta">
                  Tipo
                  <Select
                    value={form.tipo}
                    onValueChange={(v) => setForm({ ...form, tipo: v as Tipo })}
                  >
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_LABEL).map(([valor, label]) => (
                        <SelectItem key={valor} value={valor}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <label className="block text-sm text-floresta">
                Título
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
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

              {(form.tipo === "video" || form.tipo === "audio") && (
                <div className="rounded-2xl bg-secondary p-4">
                  <p className="text-sm font-medium text-floresta">Mídia (privada)</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.storagePath || "Nenhum arquivo enviado"}
                  </p>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-floresta px-4 py-2 text-xs font-medium text-floresta-foreground">
                    <Upload className="h-4 w-4" />
                    {subindo ? "Enviando..." : "Enviar arquivo"}
                    <input
                      type="file"
                      accept={form.tipo === "video" ? "video/*" : "audio/*"}
                      className="hidden"
                      onChange={(e) => {
                        const arquivo = e.target.files?.[0];
                        if (arquivo) void enviarArquivo(arquivo);
                      }}
                    />
                  </label>
                </div>
              )}

              {form.tipo !== "video" && form.tipo !== "audio" && (
                <label className="block text-sm text-floresta">
                  Corpo do texto / instruções
                  <Textarea
                    value={form.corpoTexto}
                    onChange={(e) => setForm({ ...form, corpoTexto: e.target.value })}
                    rows={8}
                    className="mt-1 rounded-xl"
                  />
                </label>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-floresta">
                  Duração (segundos)
                  <Input
                    type="number"
                    value={form.duracaoSegundos}
                    onChange={(e) => setForm({ ...form, duracaoSegundos: Number(e.target.value) })}
                    className="mt-1 rounded-xl"
                  />
                </label>
                <label className="text-sm text-floresta">
                  Ordem
                  <Input
                    type="number"
                    value={form.ordem}
                    onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })}
                    className="mt-1 rounded-xl"
                  />
                </label>
              </div>

              <Button
                onClick={submeter}
                disabled={enviando || !form.titulo.trim()}
                className="w-full rounded-full bg-terracota py-6 text-terracota-foreground hover:bg-terracota/90"
              >
                {enviando ? "Salvando..." : "Salvar prática"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
