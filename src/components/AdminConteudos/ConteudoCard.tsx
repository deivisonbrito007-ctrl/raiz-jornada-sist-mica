import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  GitBranch,
  GripVertical,
  Pencil,
  Send,
  Trash2,
  Upload,
  Archive,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SePode } from "@/components/permissao-ui";
import { NIVEL_LABEL, TIPO_LABEL, formatarData, formatarDuracao } from "@/lib/raiz-format";
import { urlThumbnail, urlThumbnailEmCache } from "@/lib/thumbnail";
import { cn } from "@/lib/utils";
import type { ConteudoAdmin, ConteudoStatus } from "@/hooks/useConteudos";
import { iconeDoTipo } from "./icones-tipo";
import { BadgeStatus } from "./BadgeStatus";

type Props = {
  conteudo: ConteudoAdmin;
  selecionado: boolean;
  onSelecionar: (marcado: boolean) => void;
  onEditar: () => void;
  onExcluir: () => void;
  onMover?: (direcao: -1 | 1) => void;
  arrastavel?: boolean;
  eixoNome?: string;
  autorNome?: string;
  revisorNome?: string;
  trilhasUsando?: number;
  onDuplicar?: () => void;
  onVisualizar?: () => void;
  onVerTrilhas?: () => void;
  onStatus?: (status: ConteudoStatus) => void;
};

export function ConteudoCard({
  conteudo,
  selecionado,
  onSelecionar,
  onEditar,
  onExcluir,
  onMover,
  arrastavel = true,
  eixoNome,
  autorNome,
  revisorNome,
  trilhasUsando,
  onDuplicar,
  onVisualizar,
  onVerTrilhas,
  onStatus,
}: Props) {
  const [capa, setCapa] = useState<string | null>(() =>
    conteudo.thumbnail_path ? urlThumbnailEmCache(conteudo.thumbnail_path) : null,
  );
  const Icone = iconeDoTipo(conteudo.tipo);
  const status = conteudo.status ?? "publicado";

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
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-display text-sm font-medium text-floresta">
            {conteudo.titulo}
          </p>
          <BadgeStatus status={status} />
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            v{conteudo.versao ?? 1}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {TIPO_LABEL[conteudo.tipo] ?? conteudo.tipo}
          {eixoNome ? ` · ${eixoNome}` : ""} · {formatarDuracao(conteudo.duracao_segundos)} ·{" "}
          {NIVEL_LABEL[conteudo.nivel ?? "leve"]}
          {typeof trilhasUsando === "number"
            ? ` · ${trilhasUsando} trilha(s)`
            : ""}{" "}
          · ordem {conteudo.ordem}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Autor: {autorNome ?? "—"} · Revisor: {revisorNome ?? "—"} · Atualizado em{" "}
          {formatarData(conteudo.updated_at)}
        </p>
        {conteudo.storage_path && (
          <span className="mt-1 inline-block rounded-full bg-salvia/20 px-2 py-0.5 text-[10px] font-semibold text-floresta">
            mídia enviada
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
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

        {onVisualizar && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onVisualizar}
            aria-label={`Visualizar ${conteudo.titulo}`}
            className="min-h-11 min-w-11 rounded-full text-floresta focus-visible:ring-2 focus-visible:ring-terracota"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        {onVerTrilhas && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onVerTrilhas}
            aria-label={`Ver trilhas que usam ${conteudo.titulo}`}
            className="min-h-11 min-w-11 rounded-full text-floresta focus-visible:ring-2 focus-visible:ring-terracota"
          >
            <GitBranch className="h-4 w-4" aria-hidden="true" />
          </Button>
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

        {onDuplicar && (
          <SePode permissao="gerenciar_conteudos">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDuplicar}
              aria-label={`Duplicar ${conteudo.titulo}`}
              className="min-h-11 min-w-11 rounded-full text-floresta focus-visible:ring-2 focus-visible:ring-terracota"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          </SePode>
        )}

        {onStatus && status !== "publicado" && (
          <SePode permissao="gerenciar_conteudos">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onStatus(status === "em_revisao" ? "publicado" : "em_revisao")}
              aria-label={
                status === "em_revisao"
                  ? `Publicar ${conteudo.titulo}`
                  : `Enviar ${conteudo.titulo} para revisão`
              }
              className="min-h-11 min-w-11 rounded-full text-floresta focus-visible:ring-2 focus-visible:ring-terracota"
            >
              {status === "em_revisao" ? (
                <Upload className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </SePode>
        )}

        {onStatus && (
          <SePode permissao="gerenciar_conteudos">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onStatus(status === "arquivado" ? "rascunho" : "arquivado")}
              aria-label={
                status === "arquivado"
                  ? `Reativar ${conteudo.titulo}`
                  : `Arquivar ${conteudo.titulo}`
              }
              className="min-h-11 min-w-11 rounded-full text-floresta focus-visible:ring-2 focus-visible:ring-terracota"
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
            </Button>
          </SePode>
        )}

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
