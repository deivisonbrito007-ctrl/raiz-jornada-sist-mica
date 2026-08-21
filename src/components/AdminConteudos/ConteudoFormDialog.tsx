import { lazy, Suspense, useEffect, useId, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CONTEUDO_STATUS_LABEL,
  NIVEL_LABEL,
  TIPOS_COM_MIDIA,
  TIPO_LABEL,
} from "@/lib/raiz-format";
// Editor de texto rico carregado sob demanda (mantém o pacote inicial leve).
const EditorTexto = lazy(() =>
  import("./EditorTexto").then((m) => ({ default: m.EditorTexto })),
);
import { UploadMidia } from "./UploadMidia";
import type {
  ConteudoNivel,
  ConteudoStatus,
  ConteudoTipo,
  EixoAdmin,
  PessoaResumo,
  SalvarConteudoEntrada,
} from "@/hooks/useConteudos";

export type FormularioConteudo = {
  id?: string;
  eixoId: string;
  tipo: ConteudoTipo;
  titulo: string;
  descricao: string;
  objetivo: string;
  instrucoes: string;
  perguntasIntegracao: string;
  materiais: string;
  sensibilidades: string;
  orientacoesPausa: string;
  transcricao: string;
  legendasPath: string;
  corpoTexto: string;
  storagePath: string;
  thumbnailPath: string;
  duracaoSegundos: number;
  ordem: number;
  nivel: ConteudoNivel;
  status: ConteudoStatus;
  versao: number;
  autorId: string;
  revisorId: string;
  dataRevisao: string;
};

export function formularioVazio(eixoId: string, ordem = 0): FormularioConteudo {
  return {
    eixoId,
    tipo: "audio",
    titulo: "",
    descricao: "",
    objetivo: "",
    instrucoes: "",
    perguntasIntegracao: "",
    materiais: "",
    sensibilidades: "",
    orientacoesPausa: "",
    transcricao: "",
    legendasPath: "",
    corpoTexto: "",
    storagePath: "",
    thumbnailPath: "",
    duracaoSegundos: 0,
    ordem,
    nivel: "leve",
    status: "rascunho",
    versao: 1,
    autorId: "",
    revisorId: "",
    dataRevisao: "",
  };
}

type Props = {
  form: FormularioConteudo | null;
  eixos: EixoAdmin[];
  pessoas?: PessoaResumo[];
  salvando: boolean;
  onFechar: () => void;
  onSalvar: (entrada: SalvarConteudoEntrada) => void | Promise<unknown>;
};

const CAMPO = "mt-1 min-h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-terracota";
const AREA = "mt-1 rounded-xl focus-visible:ring-2 focus-visible:ring-terracota";

export function ConteudoFormDialog({
  form,
  eixos,
  pessoas = [],
  salvando,
  onFechar,
  onSalvar,
}: Props) {
  const [estado, setEstado] = useState<FormularioConteudo | null>(form);
  const idBase = useId();

  useEffect(() => setEstado(form), [form]);

  if (!estado) {
    return (
      <Dialog open={false} onOpenChange={() => onFechar()}>
        <DialogContent />
      </Dialog>
    );
  }

  const atual = estado;
  const set = (patch: Partial<FormularioConteudo>) => setEstado({ ...atual, ...patch });
  const ehMidia = (TIPOS_COM_MIDIA as readonly string[]).includes(atual.tipo);
  const ehArquivo = atual.tipo === "pdf";
  const podeSalvar = atual.titulo.trim().length > 0 && !salvando;

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl bg-papel">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-floresta">
            {atual.id ? "Editar material" : "Novo material"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="identificacao">
          <TabsList className="flex-wrap">
            <TabsTrigger value="identificacao">Identificação</TabsTrigger>
            <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
            <TabsTrigger value="conducao">Condução</TabsTrigger>
            <TabsTrigger value="curadoria">Curadoria</TabsTrigger>
          </TabsList>

          {/* Identificação */}
          <TabsContent value="identificacao" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-floresta">
                Área relacionada (eixo)
                <Select value={atual.eixoId} onValueChange={(v) => set({ eixoId: v })}>
                  <SelectTrigger aria-label="Eixo da prática" className={CAMPO}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {eixos.map((e) => (
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
                  value={atual.tipo}
                  onValueChange={(v) => set({ tipo: v as ConteudoTipo })}
                >
                  <SelectTrigger aria-label="Tipo da prática" className={CAMPO}>
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

            <label className="block text-sm text-floresta" htmlFor={`${idBase}-titulo`}>
              Título
            </label>
            <Input
              id={`${idBase}-titulo`}
              value={atual.titulo}
              onChange={(e) => set({ titulo: e.target.value })}
              className={CAMPO}
            />

            <label className="block text-sm text-floresta" htmlFor={`${idBase}-descricao`}>
              Descrição
            </label>
            <Textarea
              id={`${idBase}-descricao`}
              value={atual.descricao}
              onChange={(e) => set({ descricao: e.target.value })}
              rows={3}
              className={AREA}
            />

            <label className="block text-sm text-floresta" htmlFor={`${idBase}-objetivo`}>
              Objetivo
            </label>
            <Textarea
              id={`${idBase}-objetivo`}
              value={atual.objetivo}
              onChange={(e) => set({ objetivo: e.target.value })}
              rows={2}
              placeholder="O que esta prática convida a acontecer?"
              className={AREA}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm text-floresta" htmlFor={`${idBase}-duracao`}>
                Duração (segundos)
                <Input
                  id={`${idBase}-duracao`}
                  type="number"
                  min={0}
                  value={atual.duracaoSegundos}
                  onChange={(e) => set({ duracaoSegundos: Number(e.target.value) || 0 })}
                  className={CAMPO}
                />
              </label>
              <label className="text-sm text-floresta">
                Nível de profundidade
                <Select
                  value={atual.nivel}
                  onValueChange={(v) => set({ nivel: v as ConteudoNivel })}
                >
                  <SelectTrigger aria-label="Nível de profundidade" className={CAMPO}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NIVEL_LABEL).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="text-sm text-floresta" htmlFor={`${idBase}-ordem`}>
                Ordem
                <Input
                  id={`${idBase}-ordem`}
                  type="number"
                  min={0}
                  value={atual.ordem}
                  onChange={(e) => set({ ordem: Number(e.target.value) || 0 })}
                  className={CAMPO}
                />
              </label>
            </div>
          </TabsContent>

          {/* Conteúdo principal / mídia */}
          <TabsContent value="conteudo" className="space-y-4">
            {(ehMidia || ehArquivo) && (
              <UploadMidia
                eixoId={atual.eixoId}
                variante="midia"
                accept={
                  atual.tipo === "video"
                    ? "video/*"
                    : ehArquivo
                      ? "application/pdf"
                      : "audio/*"
                }
                caminhoAtual={atual.storagePath || null}
                onEnviado={(caminho) => set({ storagePath: caminho })}
                onRemover={() => set({ storagePath: "" })}
              />
            )}

            <UploadMidia
              eixoId={atual.eixoId}
              variante="capa"
              accept="image/png,image/jpeg,image/webp"
              caminhoAtual={atual.thumbnailPath || null}
              onEnviado={(caminho) => set({ thumbnailPath: caminho })}
              onRemover={() => set({ thumbnailPath: "" })}
            />

            <div>
              <p className="text-sm text-floresta" id={`${idBase}-corpo`}>
                Conteúdo principal (texto da prática)
              </p>
              <div className="mt-1">
                <Suspense
                  fallback={
                    <div
                      className="h-40 animate-pulse rounded-2xl bg-secondary/60"
                      aria-label="Carregando editor de texto"
                      role="status"
                    />
                  }
                >
                  <EditorTexto
                    rotuloId={`${idBase}-corpo`}
                    valor={atual.corpoTexto}
                    onChange={(html) => set({ corpoTexto: html })}
                  />
                </Suspense>
              </div>
            </div>

            <label className="block text-sm text-floresta" htmlFor={`${idBase}-transcricao`}>
              Transcrição
            </label>
            <Textarea
              id={`${idBase}-transcricao`}
              value={atual.transcricao}
              onChange={(e) => set({ transcricao: e.target.value })}
              rows={4}
              className={AREA}
            />

            <label className="block text-sm text-floresta" htmlFor={`${idBase}-legendas`}>
              Legenda (caminho do arquivo .vtt, opcional)
            </label>
            <Input
              id={`${idBase}-legendas`}
              value={atual.legendasPath}
              onChange={(e) => set({ legendasPath: e.target.value })}
              className={CAMPO}
            />
          </TabsContent>

          {/* Condução */}
          <TabsContent value="conducao" className="space-y-4">
            <label className="block text-sm text-floresta" htmlFor={`${idBase}-instrucoes`}>
              Instruções de condução
            </label>
            <Textarea
              id={`${idBase}-instrucoes`}
              value={atual.instrucoes}
              onChange={(e) => set({ instrucoes: e.target.value })}
              rows={4}
              className={AREA}
            />

            <label className="block text-sm text-floresta" htmlFor={`${idBase}-perguntas`}>
              Perguntas de integração
            </label>
            <Textarea
              id={`${idBase}-perguntas`}
              value={atual.perguntasIntegracao}
              onChange={(e) => set({ perguntasIntegracao: e.target.value })}
              rows={3}
              placeholder="Uma pergunta por linha"
              className={AREA}
            />

            <label className="block text-sm text-floresta" htmlFor={`${idBase}-materiais`}>
              Materiais necessários
            </label>
            <Textarea
              id={`${idBase}-materiais`}
              value={atual.materiais}
              onChange={(e) => set({ materiais: e.target.value })}
              rows={2}
              className={AREA}
            />

            <label className="block text-sm text-floresta" htmlFor={`${idBase}-pausa`}>
              Orientações de pausa
            </label>
            <Textarea
              id={`${idBase}-pausa`}
              value={atual.orientacoesPausa}
              onChange={(e) => set({ orientacoesPausa: e.target.value })}
              rows={2}
              className={AREA}
            />

            <label className="block text-sm text-floresta" htmlFor={`${idBase}-sensibilidades`}>
              Possíveis sensibilidades
            </label>
            <Textarea
              id={`${idBase}-sensibilidades`}
              value={atual.sensibilidades}
              onChange={(e) => set({ sensibilidades: e.target.value })}
              rows={2}
              className={AREA}
            />
          </TabsContent>

          {/* Curadoria */}
          <TabsContent value="curadoria" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-floresta">
                Autor
                <Select
                  value={atual.autorId || "nenhum"}
                  onValueChange={(v) => set({ autorId: v === "nenhum" ? "" : v })}
                >
                  <SelectTrigger aria-label="Autor do material" className={CAMPO}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Eu mesma</SelectItem>
                    {pessoas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="text-sm text-floresta">
                Revisor
                <Select
                  value={atual.revisorId || "nenhum"}
                  onValueChange={(v) => set({ revisorId: v === "nenhum" ? "" : v })}
                >
                  <SelectTrigger aria-label="Revisor do material" className={CAMPO}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem revisor</SelectItem>
                    {pessoas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm text-floresta" htmlFor={`${idBase}-versao`}>
                Versão
                <Input
                  id={`${idBase}-versao`}
                  type="number"
                  min={1}
                  value={atual.versao}
                  onChange={(e) => set({ versao: Number(e.target.value) || 1 })}
                  className={CAMPO}
                />
              </label>
              <label className="text-sm text-floresta">
                Situação
                <Select
                  value={atual.status}
                  onValueChange={(v) => set({ status: v as ConteudoStatus })}
                >
                  <SelectTrigger aria-label="Situação do material" className={CAMPO}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTEUDO_STATUS_LABEL).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="text-sm text-floresta" htmlFor={`${idBase}-data-revisao`}>
                Data de revisão
                <Input
                  id={`${idBase}-data-revisao`}
                  type="date"
                  value={atual.dataRevisao}
                  onChange={(e) => set({ dataRevisao: e.target.value })}
                  className={CAMPO}
                />
              </label>
            </div>

            <p className="rounded-2xl bg-secondary/60 p-3 text-xs text-muted-foreground">
              Materiais só aparecem para quem pratica quando estão publicados. Ao arquivar, as
              versões anteriores e o histórico de quem já praticou são preservados.
            </p>
          </TabsContent>
        </Tabs>

        <Button
          type="button"
          onClick={() =>
            void onSalvar({
              ...(atual.id ? { id: atual.id } : {}),
              eixoId: atual.eixoId,
              tipo: atual.tipo,
              titulo: atual.titulo,
              descricao: atual.descricao,
              objetivo: atual.objetivo,
              instrucoes: atual.instrucoes,
              perguntasIntegracao: atual.perguntasIntegracao,
              materiais: atual.materiais,
              sensibilidades: atual.sensibilidades,
              orientacoesPausa: atual.orientacoesPausa,
              transcricao: atual.transcricao,
              legendasPath: atual.legendasPath || null,
              corpoTexto: atual.corpoTexto || null,
              storagePath: atual.storagePath || null,
              thumbnailPath: atual.thumbnailPath || null,
              duracaoSegundos: Number(atual.duracaoSegundos) || 0,
              ordem: Number(atual.ordem) || 0,
              nivel: atual.nivel,
              status: atual.status,
              versao: Number(atual.versao) || 1,
              autorId: atual.autorId || null,
              revisorId: atual.revisorId || null,
              dataRevisao: atual.dataRevisao || null,
            })
          }
          disabled={!podeSalvar}
          className="w-full rounded-full bg-terracota py-6 text-terracota-foreground hover:bg-terracota/90 focus-visible:ring-2 focus-visible:ring-floresta"
        >
          {salvando ? "Salvando..." : "Salvar material"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
