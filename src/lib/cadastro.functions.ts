import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Diz apenas se já existe algum terapeuta cadastrado (usado na tela de
 * cadastro para esconder a opção "sou terapeuta").
 *
 * Roda no servidor porque a função de banco `existe_terapeuta()` não é mais
 * executável sem login: nada do schema fica exposto para visitantes.
 */
export const existeTerapeuta = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("existe_terapeuta");
  // Falha fechado: na dúvida, esconde a opção de terapeuta.
  if (error) return { existe: true };
  return { existe: data !== false };
});

/**
 * Aplica o jeito de caminhar escolhido antes de entrar com o Google. No
 * cadastro por e-mail isso já é resolvido no banco pelos metadados da conta;
 * pelo Google não há metadados, então acertamos aqui, no primeiro login.
 *
 * Quem escolheu acompanhamento e ainda não tem terapeuta ganha um pedido
 * registrado — a conta segue autoguiada para não ficar sem acesso enquanto a
 * terapeuta não responde.
 */
export const aplicarCaminhoEntrada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ caminho: z.enum(["acompanhado", "autoguiado"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.caminho !== "acompanhado") return { ok: true as const, pedido: false };

    const { data: acesso } = await supabase
      .from("clientes_acesso")
      .select("modo, terapeuta_id")
      .eq("user_id", userId)
      .maybeSingle();

    // Já é acompanhada: nada a fazer.
    if (!acesso || acesso.terapeuta_id || acesso.modo !== "autoguiado") {
      return { ok: true as const, pedido: false };
    }

    const { data: abertos } = await supabase
      .from("solicitacoes_acompanhamento")
      .select("id")
      .eq("cliente_id", userId)
      .eq("status", "aberta")
      .limit(1);
    if ((abertos ?? []).length > 0) return { ok: true as const, pedido: false };

    const { error } = await supabase.from("solicitacoes_acompanhamento").insert({
      cliente_id: userId,
      mensagem: "Pedido criado na entrada: escolheu seguir com acompanhamento.",
    });
    if (error) return { ok: false as const, pedido: false };

    return { ok: true as const, pedido: true };
  });
