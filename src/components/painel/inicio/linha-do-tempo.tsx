import { Link } from "@tanstack/react-router";
import type { Evento } from "@/lib/inicio-painel";
import { ROTULO_EVENTO } from "@/lib/inicio-painel";

/**
 * Linha do tempo do acompanhamento. Mostra o tipo do evento e quando — o texto
 * de diários nunca aparece aqui.
 */
export function LinhaDoTempo({ eventos }: { eventos: Evento[] }) {
  if (eventos.length === 0) {
    return (
      <p role="status" className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
        Ainda não há movimento para mostrar. Assim que alguém iniciar uma trilha ou concluir uma
        etapa, aparece aqui.
      </p>
    );
  }

  return (
    <ol className="relative space-y-3 border-l border-border pl-5">
      {eventos.map((e) => (
        <li key={e.id} className="relative">
          <span
            className="absolute -left-[1.42rem] top-2 size-2.5 rounded-full bg-salvia"
            aria-hidden="true"
          />
          <p className="text-xs uppercase tracking-wider text-salvia">{ROTULO_EVENTO[e.tipo]}</p>
          <p className="text-sm text-floresta">
            {e.clienteId ? (
              <Link
                to="/admin/cliente/$clienteId"
                params={{ clienteId: e.clienteId }}
                className="font-medium underline decoration-border underline-offset-4 hover:decoration-salvia"
              >
                {e.cliente}
              </Link>
            ) : (
              <span className="font-medium">{e.cliente}</span>
            )}{" "}
            <span className="text-muted-foreground">{e.descricao}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">{e.quando}</p>
        </li>
      ))}
    </ol>
  );
}
