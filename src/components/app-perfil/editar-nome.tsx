import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHAVES } from "@/lib/cache-chaves";
import { atualizarMeuNome } from "@/lib/raiz.functions";
import { validarNome } from "@/lib/perfil-cliente";

type Props = { nome?: string | null; email?: string | null };

/** Nome editável ali mesmo; e-mail em leitura, com o porquê explicado. */
export function EditarNome({ nome, email }: Props) {
  const queryClient = useQueryClient();
  const salvar = useServerFn(atualizarMeuNome);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nome ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");

  const mutacao = useMutation({
    mutationFn: (novo: string) => salvar({ data: { nome: novo } }),
    onSuccess: async () => {
      setEditando(false);
      setAviso("Nome atualizado.");
      toast.success("Nome atualizado.");
      await queryClient.invalidateQueries({ queryKey: CHAVES.contexto });
    },
    onError: () => toast.error("Não foi possível salvar seu nome agora."),
  });

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const check = validarNome(valor);
    if (!check.ok) {
      setErro(check.erro);
      return;
    }
    setErro(null);
    mutacao.mutate(check.nome);
  }

  return (
    <section
      aria-labelledby="titulo-meus-dados"
      className="mt-4 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="titulo-meus-dados" className="font-display text-xl text-floresta">
          Meus dados
        </h2>
        {!editando && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setValor(nome ?? "");
              setErro(null);
              setEditando(true);
            }}
            className="min-h-11 rounded-full text-floresta"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            <span>Editar</span>
          </Button>
        )}
      </div>

      {editando ? (
        <form onSubmit={enviar} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="perfil-nome" className="text-xs uppercase tracking-wider text-salvia">
              Como você quer ser chamada
            </Label>
            <Input
              id="perfil-nome"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              maxLength={80}
              autoFocus
              aria-invalid={Boolean(erro)}
              aria-describedby={erro ? "perfil-nome-erro" : undefined}
              className="mt-1 min-h-11 rounded-2xl"
            />
            {erro && (
              <p id="perfil-nome-erro" className="mt-1 text-xs text-terracota">
                {erro}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={mutacao.isPending}
              className="min-h-11 rounded-full bg-floresta text-floresta-foreground"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>{mutacao.isPending ? "Salvando..." : "Salvar"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditando(false);
                setErro(null);
              }}
              className="min-h-11 rounded-full"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span>Cancelar</span>
            </Button>
          </div>
        </form>
      ) : (
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-salvia">Nome</dt>
            <dd className="mt-0.5 text-base text-floresta">{nome || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-salvia">E-mail</dt>
            <dd className="mt-0.5 text-base text-floresta">{email || "—"}</dd>
            <p className="mt-1 text-xs text-muted-foreground">
              O e-mail é a chave da sua conta e do seu acesso às trilhas. Para trocá-lo, fale com
              quem acompanha você.
            </p>
          </div>
        </dl>
      )}

      <p aria-live="polite" className="sr-only">
        {aviso}
      </p>
    </section>
  );
}
