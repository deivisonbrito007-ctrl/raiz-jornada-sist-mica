import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  GripVertical,
  Headphones,
  ListChecks,
  Pencil,
  Sprout,
  Trash2,
  Video,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SePode } from "@/components/permissao-ui";
import { TIPO_LABEL, formatarDuracao } from "@/lib/raiz-format";
import { urlThumbnail, urlThumbnailEmCache } from "@/lib/thumbnail";
import { cn } from "@/lib/utils";
import type { ConteudoAdmin } from "@/hooks/useConteudos";

const ICONE_TIPO = {
  video: Video,
  audio: Headphones,
  texto: FileText,
  exercicio: ListChecks,
  tarefa: Sprout,
} as const;

type Props = {
  conteudo: ConteudoAdmin;
  selecionado: boolean;
  onSelecionar: (marcado: boolean) => void;
  onEditar: () => void;
  onExcluir: () => void;
  onMover?: (direcao: -1 | 1) => void;
  arrastavel?: boolean;
};

export function ConteudoCard({
  conteudo,
  selecionado,
  onSelecionar,
  onEditar,
  onExcluir,
  onMover,
  arrastavel = true,
}: Props) {
  const [capa, setCapa] = useState<string | null>(() =>
    conteudo.thumbnail_path ? urlThumbnailEmCache(conteudo.thumbnail_path) : null,
  );
  const Icone = ICONE_TIPO[conteudo.tipo] ?? FileText;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: conteudo.id,
    disabled: !arrastavel,
  });

  useEffect(() => {
    let ativo = true;
    if (!conteudo.thumbnail_path) {
      setCapa(null);
      return;
    }
    void urlThumbnail(conteudo.thumbnail_path).then((url) => {
      if (ativo) setCapa(url);
    });
    return () => {
      ativo = false;
    };
  }, [conteudo.thumbnail_path]);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl bg-papel p-3 shadow-organico",
        selecionado && "ring-2 ring-terracota",
        isDragging && "opacity-70",
      )}
    >
      <Checkbox
        checked={selecionado}
        onCheckedChange={(marcado) => onSelecionar(marcado === true)}
        aria-label={`Selecionar prática ${conteudo.titulo}`}
        className="focus-visible:ring-2 focus-visible:ring-terracota"
      />

      {arrastavel && (
        <button
          type="button"
          aria-label={`Arrastar para reordenar ${conteudo.titulo}`}
          className="inline-flex h-11 w-8 cursor-grab items-center justify-center rounded-lg text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
        {capa ? (
          <img
            src={capa}
            alt={`Capa da prática ${conteudo.titulo}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icone className="h-5 w-5 text-salvia" aria-hidden="true" />
            <span className="sr-only">
              Sem capa · {TIPO_LABEL[conteudo.tipo] ?? conteudo.tipo}
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-medium text-floresta">{conteudo.titulo}</p>
        <p className="text-[11px] text-muted-foreground">
          {TIPO_LABEL[conteudo.tipo] ?? conteudo.tipo} ·{" "}
          {formatarDuracao(conteudo.duracao_segundos)} · ordem {conteudo.ordem}
        </p>
        {conteudo.storage_path && (
          <span className="mt-1 inline-block rounded-full bg-salvia/20 px-2 py-0.5 text-[10px] font-semibold text-floresta">
            mídia enviada
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {onMover && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMover(-1)}
              aria-label={`Mover ${conteudo.titulo} para cima`}
              className="min-h-11 min-w-11 rounded-full focus-visible:ring-2 focus-visible:ring-terracota"
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMover(1)}
              aria-label={`Mover ${conteudo.titulo} para baixo`}
              className="min-h-11 min-w-11 rounded-full focus-visible:ring-2 focus-visible:ring-terracota"
            >
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </>
        )}
        <SePode permissao="gerenciar_conteudos">
          <Button
            type="button"
            variant="ghost"
            onClick={onEditar}
            className="min-h-11 rounded-full px-3 text-xs text-floresta focus-visible:ring-2 focus-visible:ring-terracota"
          >
            <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
            Editar
          </Button>
        </SePode>
        <SePode permissao="gerenciar_conteudos">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onExcluir}
            aria-label={`Excluir prática ${conteudo.titulo}`}
            className="min-h-11 min-w-11 rounded-full text-destructive focus-visible:ring-2 focus-visible:ring-terracota"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </SePode>
      </div>
    </li>
  );
}
