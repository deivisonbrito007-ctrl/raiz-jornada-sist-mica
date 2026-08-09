import { Link } from "@tanstack/react-router";
import type { ItemAgenda } from "@/lib/inicio-painel";

/** Agenda de revisões: no celular vira cartão; no desktop, tabela. */
export function AgendaRevisoes({ itens }: { itens: ItemAgenda[] }) {
  if (itens.length === 0) {
    return (
      <p role="status" className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
        Nenhuma revisão marcada. Ao criar um plano de acompanhamento você pode definir a data da
        revisão — ela aparece aqui.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {itens.map((i) => (
        <li
          key={i.id}
          className="rounded-2xl bg-secondary/60 p-4 md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto_auto] md:items-center md:gap-4"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-floresta">{i.cliente}</p>
            <p className="truncate text-xs text-muted-foreground">{i.trilha}</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground md:mt-0 md:line-clamp-2">{i.objetivo}</p>
          <div className="mt-2 text-xs md:mt-0 md:text-right">
            <p className={i.atrasada ? "font-medium text-terracota" : "text-floresta"}>
              {i.atrasada ? `Revisão era ${i.data}` : `Revisão ${i.data}`}
            </p>
            <p className="text-muted-foreground">Responsável: {i.responsavel}</p>
          </div>
          <Link
            to="/admin/cliente/$clienteId"
            params={{ clienteId: i.clienteId }}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-card px-4 text-sm font-medium text-floresta shadow-[var(--shadow-organico)] hover:bg-card/80 md:mt-0"
          >
            Abrir acompanhamento
          </Link>
        </li>
      ))}
    </ul>
  );
}
