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
 * Confere se existe convite pendente para um e-mail antes de criar a conta.
 *
 * Responde só o mínimo (existe ou não, e o primeiro nome de quem convidou)
 * para a pessoa saber, ainda na tela, se vai entrar vinculada à terapeuta ou
 * se precisa pedir acompanhamento. Tem limite de uso por e-mail para não
 * servir de sonda de endereços.
 */
export const convitePendente = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { existe: false as const, terapeuta: null, limitado: false as const };
    }

    const { consumirLimite } = await import("@/lib/limite-uso.server");
    const { chaveLimitePorEmail } = await import("@/lib/cadastro.server");
    const limite = await consumirLimite(chaveLimitePorEmail(email), "convite_pendente", 10, 60);
    if (!limite.permitido) {
      return { existe: false as const, terapeuta: null, limitado: true as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: convite } = await supabaseAdmin
      .from("convites_clientes")
      .select("terapeuta_id")
      .eq("email", email)
      .eq("status", "pendente")
      .gt("expira_em", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!convite) return { existe: false as const, terapeuta: null, limitado: false as const };

    let terapeuta: string | null = null;
    if (convite.terapeuta_id) {
      const { data: perfil } = await supabaseAdmin
        .from("profiles")
        .select("nome")
        .eq("id", convite.terapeuta_id)
        .maybeSingle();
      terapeuta = (perfil?.nome ?? "").trim().split(/\s+/)[0] || null;
    }

    return { existe: true as const, terapeuta, limitado: false as const };
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
