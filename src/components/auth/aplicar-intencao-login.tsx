import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { aplicarCaminhoEntrada } from "@/lib/cadastro.functions";
import { lerIntencaoLogin, limparIntencaoLogin } from "@/lib/intencao-login";

/**
 * Fecha o ciclo da entrada com Google: quando a sessão aparece, aplica o jeito
 * de caminhar escolhido e leva a pessoa ao destino que ela tentou abrir antes
 * de fazer login. Não renderiza nada.
 */
export function AplicarIntencaoLogin() {
  const navigate = useNavigate();
  const aplicar = useServerFn(aplicarCaminhoEntrada);
  const jaTratou = useRef(false);

  useEffect(() => {
    async function tratar() {
      if (jaTratou.current) return;
      const { destino, caminho } = lerIntencaoLogin();
      if (!destino && !caminho) return;

      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      jaTratou.current = true;
      limparIntencaoLogin();

      if (caminho) {
        try {
          await aplicar({ data: { caminho } });
        } catch {
          // Não bloqueia a entrada: a pessoa pode pedir acompanhamento no painel.
        }
      }
      navigate({ to: destino ?? "/entrada", replace: true });
    }

    void tratar();
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_IN") void tratar();
    });
    return () => data.subscription.unsubscribe();
  }, [aplicar, navigate]);

  return null;
}
