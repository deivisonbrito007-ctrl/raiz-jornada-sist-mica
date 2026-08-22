import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  /** monta os dados do relatório só quando a pessoa pede */
  aoGerar: () => Promise<void>;
  pronto: boolean;
};

/** Relatório em PDF para levar à sessão. */
export function BlocoRelatorio({ aoGerar, pronto }: Props) {
  const [gerando, setGerando] = useState(false);

  async function baixar() {
    setGerando(true);
    try {
      await aoGerar();
      toast.success("Relatório gerado. Verifique seus downloads.");
    } catch {
      toast.error("Não foi possível gerar o relatório agora.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <section
      aria-labelledby="titulo-relatorio"
      className="mt-3 w-full rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)] sm:p-6"
    >
      <h2 id="titulo-relatorio" className="font-display text-xl text-floresta">
        Meu relatório
      </h2>
      <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
        Um PDF com seu progresso por eixo e suas reflexões — bom para levar à sessão ou guardar
        como memória do processo.
      </p>
      <button
        type="button"
        onClick={baixar}
        disabled={gerando || !pronto}
        className="mt-4 inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-full bg-floresta px-5 py-2 text-center text-sm leading-snug text-floresta-foreground transition hover:bg-floresta/90 disabled:opacity-60"
      >
        {gerando ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileDown className="h-4 w-4" aria-hidden="true" />
        )}
        {gerando ? "Gerando relatório..." : "Baixar relatório em PDF"}
      </button>
    </section>
  );
}
