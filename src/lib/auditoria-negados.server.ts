/**
 * Persistência das tentativas negadas por permissão.
 *
 * Roda apenas no servidor e usa o cliente de serviço, porque quem foi
 * bloqueado — por definição — não tem permissão para gravar o registro.
 * Nunca guardamos conteúdo sensível: só quem, quando, qual ação e a permissão
 * que faltava.
 */

export type NegacaoPersistida = {
  acao: string;
  userId?: string | null;
  permissao?: string | null;
  tipo?: string;
  alvoId?: string | null;
  rota?: string | null;
  detalhes?: Record<string, unknown>;
};

/** Grava a tentativa negada. Nunca lança: falha de auditoria só vai para o log. */
export async function persistirAcessoNegado(registro: NegacaoPersistida): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let email = "";
    if (registro.userId) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", registro.userId)
        .maybeSingle();
      email = data?.email ?? "";
    }

    const { error } = await supabaseAdmin.from("auditoria_acessos_negados").insert({
      user_id: registro.userId ?? null,
      user_email: email,
      acao: registro.acao,
      permissao: registro.permissao ?? "",
      tipo: registro.tipo ?? "papel",
      alvo_id: registro.alvoId ?? null,
      rota: registro.rota ?? "",
      detalhes: registro.detalhes ?? {},
    });
    if (error) console.error("[auditoria:negado] falha ao gravar", registro.acao, error.message);
  } catch (e) {
    console.error("[auditoria:negado] erro inesperado", registro.acao, e);
  }
}
