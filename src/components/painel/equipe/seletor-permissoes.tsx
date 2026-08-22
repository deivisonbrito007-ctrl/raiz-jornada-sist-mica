import { Checkbox } from "@/components/ui/checkbox";
import {
  PERMISSAO_DESCRICAO,
  PERMISSAO_LABEL,
  PERMISSOES,
  PERMISSOES_SENSIVEIS,
  type Permissao,
} from "@/lib/permissoes";
import {
  FUNCAO_DESCRICAO,
  FUNCAO_LABEL,
  FUNCAO_PERMISSOES,
  FUNCAO_ESCOPO_PADRAO,
  FUNCOES_EQUIPE,
  ESCOPO_LABEL,
  ESCOPOS_EQUIPE,
  funcaoPersonalizada,
  type EscopoEquipe,
  type FuncaoEquipe,
} from "@/lib/equipe-funcoes";

export function SeletorFuncao({
  funcao,
  onEscolher,
  idPrefixo,
}: {
  funcao: FuncaoEquipe;
  onEscolher: (f: FuncaoEquipe, permissoes: Permissao[], escopo: EscopoEquipe) => void;
  idPrefixo: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs uppercase tracking-wider text-salvia">Função</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {FUNCOES_EQUIPE.map((f) => (
          <button
            key={f}
            id={`${idPrefixo}-funcao-${f}`}
            type="button"
            aria-pressed={funcao === f}
            onClick={() => onEscolher(f, [...FUNCAO_PERMISSOES[f]], FUNCAO_ESCOPO_PADRAO[f])}
            className={`rounded-2xl border p-3 text-left transition-colors ${
              funcao === f
                ? "border-salvia bg-salvia/10"
                : "border-border hover:border-salvia/60"
            }`}
          >
            <span className="block text-sm font-medium text-floresta">{FUNCAO_LABEL[f]}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {FUNCAO_DESCRICAO[f]}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SeletorEscopo({
  escopo,
  onChange,
  idPrefixo,
}: {
  escopo: EscopoEquipe;
  onChange: (e: EscopoEquipe) => void;
  idPrefixo: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs uppercase tracking-wider text-salvia">Abrangência</legend>
      <div className="flex flex-wrap gap-2">
        {ESCOPOS_EQUIPE.map((e) => (
          <button
            key={e}
            id={`${idPrefixo}-escopo-${e}`}
            type="button"
            aria-pressed={escopo === e}
            onClick={() => onChange(e)}
            className={`rounded-full border px-4 py-1.5 text-xs transition-colors ${
              escopo === e
                ? "border-floresta bg-floresta text-floresta-foreground"
                : "border-border text-muted-foreground hover:border-salvia"
            }`}
          >
            {ESCOPO_LABEL[e]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SeletorPermissoes({
  valor,
  onChange,
  idPrefixo,
  funcao,
}: {
  valor: Permissao[];
  onChange: (p: Permissao[]) => void;
  idPrefixo: string;
  funcao?: FuncaoEquipe;
}) {
  function alternar(p: Permissao, marcado: boolean) {
    onChange(marcado ? [...valor, p] : valor.filter((x) => x !== p));
  }

  return (
    <div className="space-y-3">
      {funcao && funcaoPersonalizada(funcao, valor) && (
        <p className="text-xs text-terracota">
          Permissões ajustadas manualmente — a função aparece como “personalizado”.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {PERMISSOES.map((p) => (
          <label
            key={p}
            htmlFor={`${idPrefixo}-${p}`}
            className="flex items-start gap-3 rounded-2xl bg-secondary p-3 text-sm"
          >
            <Checkbox
              id={`${idPrefixo}-${p}`}
              checked={valor.includes(p)}
              onCheckedChange={(v) => alternar(p, v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-floresta">
                {PERMISSAO_LABEL[p]}
                {PERMISSOES_SENSIVEIS.includes(p) && (
                  <span className="ml-2 rounded-full bg-terracota/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-terracota">
                    sensível
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {PERMISSAO_DESCRICAO[p]}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
