import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pedirApoio } from "@/lib/trilhas.functions";

type Props = {
  atribuicaoId?: string | null;
  origem?: string;
  intensidade?: number | null;
  prazoRespostaHoras: number;
  contatos: { nome: string; contato: string }[];
  rotulo?: string;
};

/**
 * "Preciso de apoio": pedido acolhedor com aviso claro de que não é canal de
 * emergência e com o prazo de resposta combinado pela terapeuta.
 */
export function PedirApoio({
  atribuicaoId = null,
  origem = "botao_apoio",
  intensidade = null,
  prazoRespostaHoras,
  contatos,
  rotulo = "Preciso de apoio",
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const enviar = useServerFn(pedirApoio);

  const mutacao = useMutation({
    mutationFn: enviar,
    onSuccess: () => {
      toast.success("Pedido enviado. Você receberá um retorno aqui mesmo.");
      setMensagem("");
      setAberto(false);
    },
    onError: () => toast.error("Não foi possível enviar agora. Tente novamente."),
  });

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="min-h-11 rounded-full"
        onClick={() => setAberto(true)}
      >
        <LifeBuoy className="h-4 w-4" />
        {rotulo}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">Pedir apoio</DialogTitle>
          </DialogHeader>

          <div className="rounded-2xl bg-secondary p-4 text-sm text-foreground">
            <p className="font-medium">Este canal não é atendimento de emergência.</p>
            <p className="mt-1 text-muted-foreground">
              A resposta chega em até {prazoRespostaHoras} horas. Se você estiver em risco imediato,
              procure ajuda presencial agora.
            </p>
            {contatos.length > 0 && (
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {contatos.map((c) => (
                  <li key={`${c.nome}-${c.contato}`}>
                    {c.nome}: {c.contato}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form
            className="space-y-3"
            onSubmit={(evento) => {
              evento.preventDefault();
              if (!mensagem.trim()) return;
              mutacao.mutate({
                data: {
                  mensagem,
                  atribuicaoId,
                  origem,
                  intensidade,
                },
              });
            }}
          >
            <div>
              <Label htmlFor="apoio-mensagem">O que você quer contar?</Label>
              <Textarea
                id="apoio-mensagem"
                rows={5}
                required
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Escreva com as suas palavras. Não precisa organizar nada."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 rounded-full"
                onClick={() => setAberto(false)}
              >
                Agora não
              </Button>
              <Button type="submit" className="min-h-11 rounded-full" disabled={mutacao.isPending}>
                Enviar pedido
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
