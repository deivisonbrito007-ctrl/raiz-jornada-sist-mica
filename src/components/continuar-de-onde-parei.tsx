import { Link } from "@tanstack/react-router";
import { PlayCircle } from "lucide-react";
import { formatarDuracao, TIPO_LABEL } from "@/lib/raiz-format";

export interface PraticaRetomada {
  id: string;
  eixoNome: string;
  tipo: string;
  titulo: string;
  duracaoSegundos: number;
  posicaoSegundos: number;
}

/**
 * Atalho na trilha para voltar direto à última prática deixada no meio.
 * Ao abrir, o player já retoma o ponto salvo e volta a tocar sozinho — inclusive
 * quando o acesso à mídia foi renovado depois de o link seguro expirar.
 */
export function ContinuarDeOndeParei({ pratica }: { pratica: PraticaRetomada }) {
  const restante = Math.max(0, pratica.duracaoSegundos - pratica.posicaoSegundos);
  return (
    <Link
      to="/app/conteudo/$conteudoId"
      params={{ conteudoId: pratica.id }}
      search={{ retomar: true }}
      aria-label={`Continuar de onde parei: ${pratica.titulo}, em ${formatarDuracao(pratica.posicaoSegundos)}`}
      className="mt-6 flex items-center gap-4 rounded-3xl border border-ocre/30 bg-ocre/10 p-5 transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-floresta focus-visible:ring-offset-2"
    >
      <span className="rounded-2xl bg-floresta p-3 text-floresta-foreground">
        <PlayCircle className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-wider text-salvia">
          Continuar de onde parei
        </span>
        <span className="mt-0.5 block truncate text-base text-floresta">{pratica.titulo}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {pratica.eixoNome} · {TIPO_LABEL[pratica.tipo] ?? pratica.tipo} · parou em{" "}
          {formatarDuracao(pratica.posicaoSegundos)}
          {pratica.duracaoSegundos ? ` · faltam ${formatarDuracao(restante)}` : ""}
        </span>
      </span>
    </Link>
  );
}
