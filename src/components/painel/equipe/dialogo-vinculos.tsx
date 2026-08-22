import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ClienteVinculavel, MembroEquipe } from "./tipos";

export function DialogoVinculos({
  aberto,
  onAberto,
  membro,
  clientes,
  salvando = false,
  onSalvar,
}: {
  aberto: boolean;
  onAberto: (v: boolean) => void;
  membro: MembroEquipe | null;
  clientes: ClienteVinculavel[];
  salvando?: boolean;
  onSalvar: (ids: string[]) => void;
}) {
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (aberto) {
      setSelecionados(membro?.vinculosExplicitos ?? []);
      setBusca("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const termo = busca.trim().toLowerCase();
  const lista = clientes.filter(
    (c) =>
      !termo ||
      c.nome.toLowerCase().includes(termo) ||
      c.email.toLowerCase().includes(termo),
  );

  return (
    <Dialog open={aberto} onOpenChange={onAberto}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-floresta">
            Clientes de {membro?.nome || membro?.email}
          </DialogTitle>
          <DialogDescription>
            Os clientes que já têm esta pessoa como terapeuta responsável entram
            automaticamente. Marque aqui apenas as autorizações extras.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar cliente"
          className="rounded-full"
        />

        <div className="space-y-2">
          {lista.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </p>
          )}
          {lista.map((c) => {
            const responsavel = membro && c.terapeutaId === membro.userId;
            return (
              <label
                key={c.userId}
                htmlFor={`vinculo-${c.userId}`}
                className="flex items-center gap-3 rounded-2xl bg-secondary p-3 text-sm"
              >
                <Checkbox
                  id={`vinculo-${c.userId}`}
                  checked={responsavel || selecionados.includes(c.userId)}
                  disabled={Boolean(responsavel)}
                  onCheckedChange={(v) =>
                    setSelecionados((atual) =>
                      v === true
                        ? [...atual, c.userId]
                        : atual.filter((id) => id !== c.userId),
                    )
                  }
                />
                <span>
                  <span className="font-medium text-floresta">{c.nome || c.email}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.email}
                    {responsavel ? " · terapeuta responsável" : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onAberto(false)}>
            Fechar
          </Button>
          <Button
            className="rounded-full bg-salvia text-salvia-foreground hover:bg-salvia/90"
            disabled={salvando}
            onClick={() => onSalvar(selecionados)}
          >
            Salvar vínculos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
