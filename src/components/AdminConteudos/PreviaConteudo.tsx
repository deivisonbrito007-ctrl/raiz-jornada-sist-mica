import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminPreviaConteudo } from "@/lib/raiz.functions";
import { NIVEL_LABEL, TIPO_LABEL, formatarDuracao } from "@/lib/raiz-format";
import { mensagemPainel } from "@/lib/erro-permissao";
import type { ConteudoAdmin } from "@/hooks/useConteudos";

/** Pré-visualização de áudio, vídeo, PDF e texto de um material da biblioteca. */
export function PreviaConteudo({
  conteudo,
  aberto,
  onFechar,
}: {
  conteudo: ConteudoAdmin | null;
  aberto: boolean;
  onFechar: () => void;
}) {
  const previa = useServerFn(adminPreviaConteudo);
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let ativo = true;
    setUrl(null);
    setErro(null);
    if (!aberto || !conteudo?.storage_path) return;
    setCarregando(true);
    previa({ data: { id: conteudo.id } })
      .then((r) => {
        if (ativo) setUrl(r.url ?? null);
      })
      .catch((e) => {
        if (ativo) setErro(mensagemPainel(e));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [aberto, conteudo, previa]);

  if (!conteudo) return null;
  const tipo = conteudo.tipo;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-floresta">{conteudo.titulo}</DialogTitle>
          <DialogDescription>
            {TIPO_LABEL[tipo] ?? tipo} · {formatarDuracao(conteudo.duracao_segundos)} ·{" "}
            {NIVEL_LABEL[conteudo.nivel ?? "leve"]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm text-floresta">
          {conteudo.descricao && <p className="text-muted-foreground">{conteudo.descricao}</p>}

          {carregando && <p className="text-xs text-muted-foreground">Carregando mídia…</p>}
          {erro && <p className="text-xs text-destructive">{erro}</p>}

          {url && tipo === "audio" && (
            <audio controls src={url} className="w-full">
              <track kind="captions" />
            </audio>
          )}
          {url && tipo === "video" && (
            <video controls src={url} className="w-full rounded-xl bg-black">
              <track kind="captions" />
            </video>
          )}
          {url && !["audio", "video"].includes(tipo) && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-floresta"
            >
              Abrir arquivo em nova aba
            </a>
          )}

          {conteudo.corpo_texto && (
            <div className="whitespace-pre-wrap rounded-xl bg-secondary/60 p-4 text-sm">
              {conteudo.corpo_texto}
            </div>
          )}

          {conteudo.objetivo && (
            <Bloco titulo="Objetivo">{conteudo.objetivo}</Bloco>
          )}
          {conteudo.instrucoes && <Bloco titulo="Instruções">{conteudo.instrucoes}</Bloco>}
          {conteudo.perguntas_integracao && (
            <Bloco titulo="Perguntas de integração">{conteudo.perguntas_integracao}</Bloco>
          )}
          {conteudo.materiais && <Bloco titulo="Materiais necessários">{conteudo.materiais}</Bloco>}
          {conteudo.criterios_interrupcao && (
            <Bloco titulo="Orientações de pausa">{conteudo.criterios_interrupcao}</Bloco>
          )}
          {conteudo.sensibilidades && (
            <Bloco titulo="Possíveis sensibilidades">{conteudo.sensibilidades}</Bloco>
          )}
          {conteudo.transcricao && <Bloco titulo="Transcrição">{conteudo.transcricao}</Bloco>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-salvia">{titulo}</p>
      <p className="whitespace-pre-wrap text-sm">{children}</p>
    </div>
  );
}
