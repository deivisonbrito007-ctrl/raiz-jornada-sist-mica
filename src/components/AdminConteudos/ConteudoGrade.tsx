import { useEffect, useState } from "react";
import { Archive, Copy, Eye, GitBranch, Pencil } from "lucide-react";
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
  conteudos: ConteudoAdmin[];
  selecionados: string[];
  eixoNome: (id: string) => string;
  nomePessoa: (id?: string | null) => string;
  trilhasUsando: (id: string) => number;
  onSelecionar: (id: string, marcado: boolean) => void;
  onEditar: (c: ConteudoAdmin) => void;
  onDuplicar: (c: ConteudoAdmin) => void;
  onVisualizar: (c: ConteudoAdmin) => void;
  onVerTrilhas: (c: ConteudoAdmin) => void;
  onStatus: (c: ConteudoAdmin, status: ConteudoStatus) => void;
};

/** Visualização em grade da biblioteca de materiais. */
export function ConteudoGrade({
  conteudos,
  selecionados,
  eixoNome,
  nomePessoa,
  trilhasUsando,
  onSelecionar,
  onEditar,
  onDuplicar,
  onVisualizar,
  onVerTrilhas,
  onStatus,
}: Props) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {conteudos.map((c) => (
        <Cartao
          key={c.id}
          conteudo={c}
          selecionado={selecionados.includes(c.id)}
          eixoNome={eixoNome(c.eixo_id)}
          autor={nomePessoa(c.autor_id)}
          revisor={nomePessoa(c.revisor_id)}
          trilhas={trilhasUsando(c.id)}
          onSelecionar={(m) => onSelecionar(c.id, m)}
          onEditar={() => onEditar(c)}
          onDuplicar={() => onDuplicar(c)}
          onVisualizar={() => onVisualizar(c)}
          onVerTrilhas={() => onVerTrilhas(c)}
          onStatus={(s) => onStatus(c, s)}
        />
      ))}
    </ul>
  );
}

function Cartao({
  conteudo,
  selecionado,
  eixoNome,
  autor,
  revisor,
  trilhas,
  onSelecionar,
  onEditar,
  onDuplicar,
  onVisualizar,
  onVerTrilhas,
  onStatus,
}: {
  conteudo: ConteudoAdmin;
  selecionado: boolean;
  eixoNome: string;
  autor: string;
  revisor: string;
  trilhas: number;
  onSelecionar: (marcado: boolean) => void;
  onEditar: () => void;
  onDuplicar: () => void;
  onVisualizar: () => void;
  onVerTrilhas: () => void;
  onStatus: (status: ConteudoStatus) => void;
}) {
  const [capa, setCapa] = useState<string | null>(() =>
    conteudo.thumbnail_path ? urlThumbnailEmCache(conteudo.thumbnail_path) : null,
  );
  const Icone = iconeDoTipo(conteudo.tipo);
  const status = conteudo.status ?? "publicado";

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
      className={cn(
        "flex flex-col overflow-hidden rounded-3xl bg-papel shadow-organico",
        selecionado && "ring-2 ring-terracota",
      )}
    >
      <div className="relative h-32 bg-secondary">
        {capa ? (
          <img
            src={capa}
            alt={`Capa da prática ${conteudo.titulo}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icone className="h-7 w-7 text-salvia" aria-hidden="true" />
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-papel/90 p-1">
          <Checkbox
            checked={selecionado}
            onCheckedChange={(m) => onSelecionar(m === true)}
            aria-label={`Selecionar prática ${conteudo.titulo}`}
          />
        </div>
        <div className="absolute right-3 top-3">
          <BadgeStatus status={status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="font-display text-sm font-medium text-floresta">{conteudo.titulo}</p>
        <p className="text-[11px] text-muted-foreground">
          {TIPO_LABEL[conteudo.tipo] ?? conteudo.tipo} · {eixoNome} ·{" "}
          {formatarDuracao(conteudo.duracao_segundos)} · {NIVEL_LABEL[conteudo.nivel ?? "leve"]}
        </p>
        <p className="text-[11px] text-muted-foreground">
          v{conteudo.versao ?? 1} · {trilhas} trilha(s) · atualizado em{" "}
          {formatarData(conteudo.updated_at)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Autor: {autor} · Revisor: {revisor}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-1 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onVisualizar}
            aria-label={`Visualizar ${conteudo.titulo}`}
            className="min-h-11 min-w-11 rounded-full text-floresta"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onVerTrilhas}
            aria-label={`Ver trilhas que usam ${conteudo.titulo}`}
            className="min-h-11 min-w-11 rounded-full text-floresta"
          >
            <GitBranch className="h-4 w-4" aria-hidden="true" />
          </Button>
          <SePode permissao="gerenciar_conteudos">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onEditar}
              aria-label={`Editar ${conteudo.titulo}`}
              className="min-h-11 min-w-11 rounded-full text-floresta"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
          </SePode>
          <SePode permissao="gerenciar_conteudos">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDuplicar}
              aria-label={`Duplicar ${conteudo.titulo}`}
              className="min-h-11 min-w-11 rounded-full text-floresta"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          </SePode>
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
              className="min-h-11 min-w-11 rounded-full text-floresta"
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
            </Button>
          </SePode>
        </div>
      </div>
    </li>
  );
}
