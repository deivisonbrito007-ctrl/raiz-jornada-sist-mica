import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EixoAdmin } from "@/hooks/useConteudos";

type Props = {
  quantidade: number;
  eixos: EixoAdmin[];
  ocupado: boolean;
  onExcluir: () => void;
  onMoverParaEixo: (eixoId: string) => void;
  onLimpar: () => void;
};

/** Aparece quando há práticas selecionadas nos cards. */
export function BatchActionsToolbar({
  quantidade,
  eixos,
  ocupado,
  onExcluir,
  onMoverParaEixo,
  onLimpar,
}: Props) {
  if (quantidade === 0) return null;

  return (
    <div
      role="region"
      aria-label="Ações em lote"
      className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-2xl bg-floresta px-4 py-3 text-floresta-foreground shadow-organico"
    >
      <p className="text-sm font-medium" aria-live="polite">
        {quantidade} selecionada(s)
      </p>

      <Button
        type="button"
        onClick={onExcluir}
        disabled={ocupado}
        className="min-h-11 rounded-full bg-terracota px-4 text-xs text-terracota-foreground hover:bg-terracota/90 focus-visible:ring-2 focus-visible:ring-ouro"
      >
        <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
        Excluir selecionados
      </Button>

      <Select disabled={ocupado} onValueChange={onMoverParaEixo}>
        <SelectTrigger
          aria-label="Mover selecionados para eixo"
          className="min-h-11 w-56 rounded-full bg-papel text-floresta focus-visible:ring-2 focus-visible:ring-ouro"
        >
          <SelectValue placeholder="Mover para eixo" />
        </SelectTrigger>
        <SelectContent>
          {eixos.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="ghost"
        onClick={onLimpar}
        className="min-h-11 rounded-full px-3 text-xs text-floresta-foreground hover:bg-floresta-foreground/10 focus-visible:ring-2 focus-visible:ring-ouro"
      >
        <X className="mr-1 h-4 w-4" aria-hidden="true" />
        Limpar seleção
      </Button>
    </div>
  );
}
