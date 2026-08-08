import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ControlePermitido } from "@/components/permissao-ui";

type Props = {
  filtrando: boolean;
  onNova: () => void;
  podeCriar: boolean;
};

export function EmptyState({ filtrando, onNova, podeCriar }: Props) {
  return (
    <div className="rounded-3xl bg-papel p-10 text-center shadow-organico">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-salvia/20">
        <Sprout className="h-8 w-8 text-salvia" aria-hidden="true" />
      </div>
      <h2 className="mt-5 font-display text-2xl text-floresta">
        {filtrando ? "Nada por aqui com esses filtros" : "Sua biblioteca começa aqui"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {filtrando
          ? "Ajuste ou limpe os filtros para ver outras práticas da biblioteca."
          : "Crie a primeira prática de um eixo: um áudio guiado, um texto de apoio ou uma tarefa da semana. Nada fica visível ao cliente antes de você liberar."}
      </p>
      {!filtrando && podeCriar && (
        <ControlePermitido permissao="gerenciar_conteudos">
          <Button
            onClick={onNova}
            className="mt-6 min-h-11 rounded-full bg-terracota px-6 text-terracota-foreground hover:bg-terracota/90 focus-visible:ring-2 focus-visible:ring-floresta"
          >
            Nova prática
          </Button>
        </ControlePermitido>
      )}
    </div>
  );
}
