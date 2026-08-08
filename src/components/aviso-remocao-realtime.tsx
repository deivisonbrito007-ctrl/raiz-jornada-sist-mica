import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  useSincronizarLiberacoes,
  type MudancaSincronia,
} from "@/hooks/use-sincronizar-liberacoes";

type Aviso = {
  titulo: string;
  mensagem: string;
  orientacao: string;
};

/**
 * Traduz a mudança que chegou em tempo real num aviso com orientação clara.
 * Só remoções geram aviso: uma liberação nova não precisa interromper ninguém.
 */
export function avisoDaMudanca(mudanca?: MudancaSincronia): Aviso | null {
  if (!mudanca) return null;
  if (mudanca.tipo === "removido") {
    return {
      titulo: "Uma prática foi removida",
      mensagem: "Seu terapeuta retirou uma prática do seu acervo, então ela não abre mais.",
      orientacao:
        "Volte à sua biblioteca para seguir pelas práticas que continuam disponíveis. Se você contava com essa prática, converse com seu terapeuta na próxima sessão.",
    };
  }
  if (mudanca.tipo === "sequencia-removida") {
    return {
      titulo: "Uma sequência foi removida",
      mensagem: "Um eixo inteiro saiu do seu percurso e as práticas dele foram recolhidas.",
      orientacao:
        "Abra sua biblioteca para ver o percurso atualizado. Seu progresso já registrado continua guardado.",
    };
  }
  if (mudanca.tipo === "liberacao-removida") {
    return {
      titulo: "Uma liberação foi retirada",
      mensagem: "O acesso a este conteúdo foi encerrado pelo seu terapeuta.",
      orientacao:
        "Nada do que você já praticou foi perdido. Siga pela biblioteca ou peça uma nova liberação ao seu terapeuta.",
    };
  }
  return null;
}

/**
 * Aviso acessível para remoções que chegam pelo Realtime.
 *
 * Fica montado no layout do cliente: em qualquer tela, ao terapeuta remover uma
 * prática, uma sequência ou uma liberação, a mudança é anunciada por leitor de
 * tela (região assertiva + foco no aviso) e explica o próximo passo.
 */
export function AvisoRemocaoRealtime() {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const caixaRef = useRef<HTMLDivElement | null>(null);

  useSincronizarLiberacoes((mudanca) => {
    const novo = avisoDaMudanca(mudanca);
    if (!novo) return;
    setAviso(novo);
    toast.info(novo.titulo, { description: novo.mensagem });
  });

  useEffect(() => {
    if (aviso) caixaRef.current?.focus();
  }, [aviso]);

  if (!aviso) return null;

  return (
    <div
      ref={caixaRef}
      role="alert"
      aria-live="assertive"
      aria-labelledby="aviso-remocao-titulo"
      aria-describedby="aviso-remocao-orientacao"
      tabIndex={-1}
      className="mx-auto mb-4 max-w-2xl rounded-2xl border border-terracota/40 bg-terracota/10 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 text-terracota" />
        <div className="space-y-2">
          <p id="aviso-remocao-titulo" className="font-display text-base text-floresta">
            {aviso.titulo}
          </p>
          <p className="text-sm text-floresta/80">{aviso.mensagem}</p>
          <p id="aviso-remocao-orientacao" className="text-sm text-muted-foreground">
            {aviso.orientacao}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              to="/app"
              onClick={() => setAviso(null)}
              className="rounded-full bg-floresta px-4 py-2 text-xs font-medium text-floresta-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
            >
              Ver minha biblioteca
            </Link>
            <button
              type="button"
              onClick={() => setAviso(null)}
              className="rounded-full px-4 py-2 text-xs font-medium text-floresta hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
            >
              Entendi, dispensar aviso
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
