import { useEffect, useId, useState } from "react";
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
import { TIPO_LABEL } from "@/lib/raiz-format";
import { EditorTexto } from "./EditorTexto";
import { UploadMidia } from "./UploadMidia";
import type { ConteudoTipo, EixoAdmin, SalvarConteudoEntrada } from "@/hooks/useConteudos";

export type FormularioConteudo = {
  id?: string;
  eixoId: string;
  tipo: ConteudoTipo;
  titulo: string;
  descricao: string;
  corpoTexto: string;
  storagePath: string;
  thumbnailPath: string;
  duracaoSegundos: number;
  ordem: number;
};

export function formularioVazio(eixoId: string, ordem = 0): FormularioConteudo {
  return {
    eixoId,
    tipo: "audio",
    titulo: "",
    descricao: "",
    corpoTexto: "",
    storagePath: "",
    thumbnailPath: "",
    duracaoSegundos: 0,
    ordem,
  };
}

type Props = {
  form: FormularioConteudo | null;
  eixos: EixoAdmin[];
  salvando: boolean;
  onFechar: () => void;
  onSalvar: (entrada: SalvarConteudoEntrada) => void | Promise<unknown>;
};

export function ConteudoFormDialog({ form, eixos, salvando, onFechar, onSalvar }: Props) {
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

  const ehMidia = estado.tipo === "video" || estado.tipo === "audio";
  const podeSalvar = estado.titulo.trim().length > 0 && !salvando;

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl bg-papel">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-floresta">
            {estado.id ? "Editar prática" : "Nova prática"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-floresta">
              Eixo
              <Select
                value={estado.eixoId}
                onValueChange={(v) => setEstado({ ...estado, eixoId: v })}
              >
                <SelectTrigger
                  aria-label="Eixo da prática"
                  className="mt-1 min-h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-terracota"
                >
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
                value={estado.tipo}
                onValueChange={(v) => setEstado({ ...estado, tipo: v as ConteudoTipo })}
              >
                <SelectTrigger
                  aria-label="Tipo da prática"
                  className="mt-1 min-h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-terracota"
                >
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
            value={estado.titulo}
            onChange={(e) => setEstado({ ...estado, titulo: e.target.value })}
            className="mt-1 min-h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-terracota"
          />

          <label className="block text-sm text-floresta" htmlFor={`${idBase}-descricao`}>
            Descrição
          </label>
          <Textarea
            id={`${idBase}-descricao`}
            value={estado.descricao}
            onChange={(e) => setEstado({ ...estado, descricao: e.target.value })}
            rows={3}
            className="mt-1 rounded-xl focus-visible:ring-2 focus-visible:ring-terracota"
          />

          {ehMidia && (
            <UploadMidia
              eixoId={estado.eixoId}
              variante="midia"
              accept={estado.tipo === "video" ? "video/*" : "audio/*"}
              caminhoAtual={estado.storagePath || null}
              onEnviado={(caminho) => setEstado({ ...estado, storagePath: caminho })}
              onRemover={() => setEstado({ ...estado, storagePath: "" })}
            />
          )}

          <UploadMidia
            eixoId={estado.eixoId}
            variante="capa"
            accept="image/png,image/jpeg,image/webp"
            caminhoAtual={estado.thumbnailPath || null}
            onEnviado={(caminho) => setEstado({ ...estado, thumbnailPath: caminho })}
            onRemover={() => setEstado({ ...estado, thumbnailPath: "" })}
          />

          {!ehMidia && (
            <div>
              <p className="text-sm text-floresta" id={`${idBase}-corpo`}>
                Corpo do texto / instruções
              </p>
              <div className="mt-1">
                <EditorTexto
                  rotuloId={`${idBase}-corpo`}
                  valor={estado.corpoTexto}
                  onChange={(html) => setEstado({ ...estado, corpoTexto: html })}
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-floresta" htmlFor={`${idBase}-duracao`}>
              Duração (segundos)
              <Input
                id={`${idBase}-duracao`}
                type="number"
                min={0}
                value={estado.duracaoSegundos}
                onChange={(e) =>
                  setEstado({ ...estado, duracaoSegundos: Number(e.target.value) || 0 })
                }
                className="mt-1 min-h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-terracota"
              />
            </label>
            <label className="text-sm text-floresta" htmlFor={`${idBase}-ordem`}>
              Ordem
              <Input
                id={`${idBase}-ordem`}
                type="number"
                min={0}
                value={estado.ordem}
                onChange={(e) => setEstado({ ...estado, ordem: Number(e.target.value) || 0 })}
                className="mt-1 min-h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-terracota"
              />
            </label>
          </div>

          <Button
            type="button"
            onClick={() =>
              void onSalvar({
                ...(estado.id ? { id: estado.id } : {}),
                eixoId: estado.eixoId,
                tipo: estado.tipo,
                titulo: estado.titulo,
                descricao: estado.descricao,
                corpoTexto: estado.corpoTexto || null,
                storagePath: estado.storagePath || null,
                thumbnailPath: estado.thumbnailPath || null,
                duracaoSegundos: Number(estado.duracaoSegundos) || 0,
                ordem: Number(estado.ordem) || 0,
              })
            }
            disabled={!podeSalvar}
            className="w-full rounded-full bg-terracota py-6 text-terracota-foreground hover:bg-terracota/90 focus-visible:ring-2 focus-visible:ring-floresta"
          >
            {salvando ? "Salvando..." : "Salvar prática"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
