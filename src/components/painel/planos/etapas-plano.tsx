import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatarDuracao } from "@/lib/raiz-format";
import type { EtapaEditavel } from "./tipos";

type Props = {
  etapas: EtapaEditavel[];
  aoMudar: (etapas: EtapaEditavel[]) => void;
};

/** Etapa 4 — personalização das etapas deste plano, sem alterar a trilha original. */
export function EtapasDoPlano({ etapas, aoMudar }: Props) {
  function atualizar(chave: string, mudanca: Partial<EtapaEditavel>) {
    aoMudar(etapas.map((e) => (e.chave === chave ? { ...e, ...mudanca } : e)));
  }

  function aoSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;
    const de = etapas.findIndex((e) => e.chave === active.id);
    const para = etapas.findIndex((e) => e.chave === over.id);
    if (de < 0 || para < 0) return;
    aoMudar(arrayMove(etapas, de, para));
  }

  function adicionarPersonalizada() {
    aoMudar([
      ...etapas,
      {
        chave: `nova-${Date.now()}`,
        conteudoId: null,
        titulo: "",
        descricao: "",
        duracaoSegundos: 0,
        obrigatoria: false,
        visivel: true,
        permiteRepetir: true,
        prazoDias: null,
        personalizada: true,
      },
    ]);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Escolha o que entra neste plano, a ordem e o que fica de fora. A trilha original não muda.
      </p>

      {etapas.length === 0 && (
        <p className="rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground">
          Esta trilha ainda não tem etapas. Você pode adicionar uma atividade combinada abaixo.
        </p>
      )}

      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={aoSoltar}
      >
        <SortableContext items={etapas.map((e) => e.chave)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {etapas.map((etapa, indice) => (
              <LinhaEtapa
                key={etapa.chave}
                etapa={etapa}
                indice={indice}
                atualizar={atualizar}
                remover={() => aoMudar(etapas.filter((e) => e.chave !== etapa.chave))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={adicionarPersonalizada}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Adicionar atividade personalizada
      </Button>
    </div>
  );
}

function LinhaEtapa({
  etapa,
  indice,
  atualizar,
  remover,
}: {
  etapa: EtapaEditavel;
  indice: number;
  atualizar: (chave: string, mudanca: Partial<EtapaEditavel>) => void;
  remover: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: etapa.chave,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-2xl border border-border bg-card p-4 ${isDragging ? "opacity-70" : ""} ${
        etapa.visivel ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-1 min-h-11 min-w-11 rounded-full text-muted-foreground hover:bg-secondary"
          aria-label={`Reordenar ${etapa.titulo || "atividade"} (posição ${indice + 1})`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="mx-auto h-4 w-4" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1 space-y-3">
          {etapa.personalizada ? (
            <div className="grid gap-3">
              <div>
                <Label htmlFor={`titulo-${etapa.chave}`}>Título da atividade</Label>
                <Input
                  id={`titulo-${etapa.chave}`}
                  value={etapa.titulo}
                  placeholder="Ex.: escrever três linhas antes de dormir"
                  onChange={(e) => atualizar(etapa.chave, { titulo: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`desc-${etapa.chave}`}>Orientação</Label>
                <Textarea
                  id={`desc-${etapa.chave}`}
                  rows={2}
                  value={etapa.descricao}
                  onChange={(e) => atualizar(etapa.chave, { descricao: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{etapa.titulo}</p>
              <p className="text-xs text-muted-foreground">
                {etapa.duracaoSegundos > 0
                  ? formatarDuracao(etapa.duracaoSegundos)
                  : "Sem duração definida"}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={etapa.obrigatoria}
                onChange={(e) => atualizar(etapa.chave, { obrigatoria: e.target.checked })}
              />
              Obrigatória
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={etapa.permiteRepetir}
                onChange={(e) => atualizar(etapa.chave, { permiteRepetir: e.target.checked })}
              />
              Pode repetir
            </label>
            <label className="flex items-center gap-2">
              Prazo
              <Input
                type="number"
                min={0}
                max={365}
                className="h-11 w-20"
                aria-label={`Prazo em dias para ${etapa.titulo || "atividade"}`}
                value={etapa.prazoDias ?? ""}
                onChange={(e) =>
                  atualizar(etapa.chave, {
                    prazoDias: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
              <span className="text-xs text-muted-foreground">dias após o início</span>
            </label>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 rounded-full px-3 text-xs"
            aria-pressed={!etapa.visivel}
            onClick={() => atualizar(etapa.chave, { visivel: !etapa.visivel })}
          >
            {etapa.visivel ? (
              <>
                <Eye className="h-4 w-4" aria-hidden="true" /> Visível
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4" aria-hidden="true" /> Oculta
              </>
            )}
          </Button>
          {etapa.personalizada && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-full px-3 text-xs text-terracota"
              onClick={remover}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Remover
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
