import { Clock, MessagesSquare } from "lucide-react";
import { formatarData } from "@/lib/raiz-format";

export type PedidoApoio = {
  id: string;
  mensagem: string;
  status: string;
  resposta: string | null;
  created_at: string;
};

/** Pedidos de apoio como conversa: sua mensagem e o retorno da terapeuta. */
export function ConversaApoio({
  pedidos,
  prazoRespostaHoras,
}: {
  pedidos: PedidoApoio[];
  prazoRespostaHoras: number;
}) {
  if (pedidos.length === 0) return null;

  return (
    <section
      aria-labelledby="titulo-apoio"
      className="rounded-[2rem] border border-border bg-card p-5"
    >
      <h2 id="titulo-apoio" className="flex items-center gap-2 font-display text-lg text-floresta">
        <MessagesSquare className="h-4 w-4 text-salvia" aria-hidden="true" />
        Seus pedidos de apoio
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        O retorno costuma vir em até {prazoRespostaHoras} horas.
      </p>

      <ul className="mt-4 space-y-5">
        {pedidos.map((p) => (
          <li key={p.id}>
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-secondary p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {p.mensagem}
              </p>
              <p className="mt-2 text-[0.68rem] text-muted-foreground">
                Você · {formatarData(p.created_at)}
              </p>
            </div>

            {p.resposta ? (
              <div className="mt-2 max-w-[85%] rounded-2xl rounded-bl-md bg-salvia/15 p-4">
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                  {p.resposta}
                </p>
                <p className="mt-2 text-[0.68rem] text-muted-foreground">Sua terapeuta</p>
              </div>
            ) : (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ocre/15 px-3 py-1 text-xs text-floresta">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Aguardando retorno
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
