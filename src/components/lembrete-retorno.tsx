import { Link } from "@tanstack/react-router";
import { BellRing, Sprout } from "lucide-react";
import { avaliarLembrete, formatarData } from "@/lib/raiz-format";

type Sugestao = {
  id: string;
  titulo: string;
  eixoNome: string;
} | null;

export function LembreteRetorno({
  datas,
  streakSemanas = 0,
  sugestao = null,
}: {
  datas: string[];
  streakSemanas?: number;
  sugestao?: Sugestao;
}) {
  const lembrete = avaliarLembrete(datas, streakSemanas);
  if (!lembrete.ativo) return null;

  const urgente = lembrete.nivel === "pausa" || lembrete.nivel === "longa_pausa";

  return (
    <section
      className={`mt-6 rounded-3xl p-6 shadow-[var(--shadow-organico)] ${
        urgente ? "bg-terracota/10" : "bg-card"
      }`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`rounded-2xl p-3 ${
            urgente ? "bg-terracota/15 text-terracota" : "bg-salvia/15 text-salvia"
          }`}
        >
          {urgente ? <BellRing className="h-5 w-5" /> : <Sprout className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg text-floresta">{lembrete.titulo}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{lembrete.mensagem}</p>
          {lembrete.ultimaPratica && (
            <p className="mt-2 text-xs text-muted-foreground">
              Última prática concluída em {formatarData(lembrete.ultimaPratica)}.
            </p>
          )}
          {sugestao && (
            <Link
              to="/app/conteudo/$conteudoId"
              params={{ conteudoId: sugestao.id }}
              className={`mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition ${
                urgente
                  ? "bg-terracota text-terracota-foreground hover:bg-terracota/90"
                  : "bg-floresta text-floresta-foreground hover:bg-floresta/90"
              }`}
            >
              {lembrete.acao}: {sugestao.titulo}
            </Link>
          )}
          {sugestao && (
            <p className="mt-2 text-xs text-muted-foreground">Eixo {sugestao.eixoNome}</p>
          )}
        </div>
      </div>
    </section>
  );
}
