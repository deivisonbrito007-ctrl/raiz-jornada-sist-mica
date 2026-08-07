import { Check, Minus, Table2 } from "lucide-react";

import { PERMISSAO_DESCRICAO, PERMISSAO_LABEL, PERMISSOES, type Permissao } from "@/lib/permissoes";

export type LinhaMatriz = {
  id: string;
  nome: string;
  email: string;
  papel: "terapeuta" | "admin" | "convite";
  permissoes: readonly string[];
  total?: boolean;
};

const PAPEL_LABEL: Record<LinhaMatriz["papel"], string> = {
  terapeuta: "Terapeuta responsável",
  admin: "Admin",
  convite: "Convite pendente",
};

export function MatrizPermissoes({ linhas }: { linhas: LinhaMatriz[] }) {
  return (
    <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
      <h2 className="flex items-center gap-2 text-xl text-floresta">
        <Table2 className="h-5 w-5 text-salvia" /> Matriz de permissões
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Visão rápida de exatamente o que cada pessoa pode fazer no painel.
      </p>

      {linhas.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Ninguém na equipe ainda.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              Permissões concedidas a cada pessoa da equipe
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-card p-3 text-left align-bottom text-xs uppercase tracking-wider text-salvia"
                >
                  Pessoa
                </th>
                {PERMISSOES.map((p) => (
                  <th
                    key={p}
                    scope="col"
                    title={PERMISSAO_DESCRICAO[p]}
                    className="p-3 text-center align-bottom text-xs font-medium leading-tight text-muted-foreground"
                  >
                    {PERMISSAO_LABEL[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.papel}-${l.id}`} className="border-t border-border">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-[220px] bg-card p-3 text-left font-normal"
                  >
                    <span className="block truncate font-medium text-floresta">
                      {l.nome || l.email}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {l.email} · {PAPEL_LABEL[l.papel]}
                    </span>
                  </th>
                  {PERMISSOES.map((p) => {
                    const ativo = l.total === true || l.permissoes.includes(p);
                    return (
                      <td key={p} className="p-3 text-center">
                        <span
                          role="img"
                          aria-label={`${l.nome || l.email}: ${PERMISSAO_LABEL[p as Permissao]} — ${
                            ativo ? "permitido" : "não permitido"
                          }`}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                            ativo
                              ? "bg-salvia/20 text-salvia"
                              : "bg-muted text-muted-foreground/60"
                          }`}
                        >
                          {ativo ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Minus className="h-4 w-4" />
                          )}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
