import { useRef, useState } from "react";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { mensagemPainel } from "@/lib/erro-permissao";
import { caminhoCapa, formatarTamanho } from "@/lib/thumbnail";

type Props = {
  eixoId: string;
  /** "midia" aceita vídeo/áudio; "capa" aceita imagens. */
  variante: "midia" | "capa";
  accept: string;
  caminhoAtual: string | null;
  onEnviado: (caminho: string) => void;
  onRemover: () => void;
};

/** Upload com nome, tamanho e barra de progresso, direto para o bucket privado. */
export function UploadMidia({
  eixoId,
  variante,
  accept,
  caminhoAtual,
  onEnviado,
  onRemover,
}: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const enviando = progresso !== null;
  const rotulo = variante === "capa" ? "imagem de capa" : "mídia";

  async function enviar(escolhido: File) {
    setArquivo(escolhido);
    setProgresso(5);
    const cronometro = window.setInterval(
      () => setProgresso((atual) => (atual === null ? atual : Math.min(atual + 12, 92))),
      180,
    );
    try {
      const caminho =
        variante === "capa"
          ? caminhoCapa(eixoId, escolhido.name)
          : `${eixoId}/${Date.now()}-${escolhido.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("midias").upload(caminho, escolhido, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw new Error(error.message);
      setProgresso(100);
      onEnviado(caminho);
      toast.success(variante === "capa" ? "Capa enviada" : "Mídia enviada");
    } catch (erro) {
      toast.error(mensagemPainel(erro));
      setArquivo(null);
    } finally {
      window.clearInterval(cronometro);
      window.setTimeout(() => setProgresso(null), 400);
    }
  }

  return (
    <div className="rounded-2xl bg-secondary p-4">
      <p className="text-sm font-medium text-floresta">
        {variante === "capa" ? "Imagem de capa" : "Mídia (privada)"}
      </p>
      <p className="mt-1 break-all text-xs text-muted-foreground">
        {caminhoAtual ?? `Nenhuma ${rotulo} enviada`}
      </p>

      {arquivo && (
        <p className="mt-2 text-xs text-floresta">
          {arquivo.name} · {formatarTamanho(arquivo.size)}
        </p>
      )}

      {enviando && (
        <div className="mt-2" aria-live="polite">
          <Progress value={progresso ?? 0} className="h-2 bg-ouro/25" />
          <p className="mt-1 text-[11px] text-muted-foreground">Enviando… {progresso}%</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="min-h-11 rounded-full bg-floresta px-4 text-xs font-medium text-floresta-foreground hover:bg-floresta/90 focus-visible:ring-2 focus-visible:ring-terracota"
        >
          {variante === "capa" ? (
            <ImageIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          ) : (
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {enviando ? "Enviando..." : `Enviar ${rotulo}`}
        </Button>
        {caminhoAtual && !enviando && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setArquivo(null);
              onRemover();
            }}
            className="min-h-11 rounded-full px-4 text-xs text-terracota focus-visible:ring-2 focus-visible:ring-terracota"
          >
            <X className="mr-1 h-4 w-4" aria-hidden="true" />
            Remover {rotulo}
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          aria-label={`Escolher ${rotulo}`}
          className="hidden"
          onChange={(e) => {
            const escolhido = e.target.files?.[0];
            if (escolhido) void enviar(escolhido);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
