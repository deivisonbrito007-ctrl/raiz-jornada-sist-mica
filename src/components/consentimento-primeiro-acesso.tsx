import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { registrarConsentimentos } from "@/lib/trilhas.functions";
import {
  CONSENTIMENTOS,
  CONSENTIMENTO_LABEL,
  VERSAO_CONSENTIMENTO,
  type TipoConsentimento,
} from "@/lib/etapas";

/**
 * Primeiro acesso: aceite de termos, privacidade e natureza do acompanhamento.
 * Fica em tela até o aceite, porque tudo depois disso guarda registro pessoal.
 */
export function ConsentimentoPrimeiroAcesso({
  aceitos,
  aoAceitar,
}: {
  aceitos: string[];
  aoAceitar: () => void;
}) {
  const [marcados, setMarcados] = useState<TipoConsentimento[]>([]);
  const registrar = useServerFn(registrarConsentimentos);

  const mutacao = useMutation({
    mutationFn: registrar,
    onSuccess: () => {
      toast.success("Tudo certo. Bem-vinda ao seu espaço.");
      aoAceitar();
    },
    onError: () => toast.error("Não foi possível registrar o aceite agora."),
  });

  const faltando = CONSENTIMENTOS.filter((c) => !aceitos.includes(c));
  if (faltando.length === 0) return null;

  const completo = faltando.every((c) => marcados.includes(c));

  return (
    <section
      aria-labelledby="titulo-consentimento"
      className="rounded-3xl border border-border bg-card p-6 shadow-organico"
    >
      <h2 id="titulo-consentimento" className="font-display text-xl text-floresta">
        Antes de começar
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Este é um espaço de continuidade entre as sessões. Leia e confirme para seguir.
      </p>

      <ul className="mt-4 space-y-3">
        {faltando.map((tipo) => (
          <li key={tipo}>
            <label className="flex items-start gap-3 text-sm text-foreground">
              <Checkbox
                checked={marcados.includes(tipo)}
                onCheckedChange={(v) =>
                  setMarcados(
                    v === true ? [...marcados, tipo] : marcados.filter((m) => m !== tipo),
                  )
                }
              />
              <span>{CONSENTIMENTO_LABEL[tipo]}</span>
            </label>
          </li>
        ))}
      </ul>

      <Button
        className="mt-5 min-h-11 rounded-full"
        disabled={!completo || mutacao.isPending}
        onClick={() =>
          mutacao.mutate({ data: { tipos: faltando, versao: VERSAO_CONSENTIMENTO } })
        }
      >
        Confirmar e entrar
      </Button>
    </section>
  );
}
