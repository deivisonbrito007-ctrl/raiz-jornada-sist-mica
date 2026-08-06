import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DIAS_SEMANA_CURTO,
  TIPO_LABEL,
  formatarDuracao,
  type ColunaMapaCalor,
} from "@/lib/raiz-format";

export const NIVEIS_MAPA_CALOR = [
  "bg-secondary",
  "bg-salvia/25",
  "bg-salvia/50",
  "bg-salvia/75",
  "bg-floresta",
];

export function MapaCalor({ colunas }: { colunas: ColunaMapaCalor[] }) {
  return (
    <div className="mt-6 overflow-x-auto">
      <div className="flex gap-2">
        <div className="flex flex-col gap-1 pt-4">
          {DIAS_SEMANA_CURTO.map((dia, indice) => (
            <span
              key={indice}
              className="flex h-4 items-center text-[9px] leading-none text-muted-foreground"
            >
              {dia}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          {colunas.map((coluna) => (
            <div key={coluna.inicio} className="flex flex-col gap-1">
              <span className="h-4 text-[9px] leading-4 text-muted-foreground">
                {coluna.labelMes}
              </span>
              {coluna.dias.map((dia) => {
                const classes = `h-4 w-4 rounded-[5px] ${
                  dia.futuro ? "bg-secondary/40" : NIVEIS_MAPA_CALOR[dia.nivel]
                } ${dia.hoje ? "ring-2 ring-terracota/60" : ""}`;
                if (dia.futuro || dia.total === 0) {
                  return (
                    <span
                      key={dia.data}
                      title={dia.futuro ? dia.label : `${dia.label} — nenhuma prática`}
                      className={classes}
                    />
                  );
                }
                return (
                  <Popover key={dia.data}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label={`${dia.label} — ${dia.total} prática${dia.total === 1 ? "" : "s"}`}
                        className={`${classes} transition hover:ring-2 hover:ring-floresta/40`}
                      />
                    </PopoverTrigger>
                    <PopoverContent align="center" className="w-64 rounded-2xl p-4">
                      <p className="text-sm text-floresta">{dia.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {dia.total} prática{dia.total === 1 ? "" : "s"}
                        {dia.totalSegundos > 0
                          ? ` · ${formatarDuracao(dia.totalSegundos)} registrados`
                          : ""}
                      </p>
                      <ul className="mt-3 space-y-2">
                        {dia.itens.map((item, indice) => (
                          <li key={`${item.titulo}-${indice}`} className="text-xs">
                            <span className="text-foreground">{item.titulo}</span>
                            <span className="block text-muted-foreground">
                              {item.eixoNome}
                              {item.eixoNome && " · "}
                              {TIPO_LABEL[item.tipo] ?? item.tipo}
                              {item.duracaoSegundos
                                ? ` · ${formatarDuracao(item.duracaoSegundos)}`
                                : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
