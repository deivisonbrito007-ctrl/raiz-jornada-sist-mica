/**
 * Proteção contra abuso na geração de URLs assinadas.
 *
 * O backend não tem um recurso pronto de rate limiting, então usamos uma
 * contagem no banco: cada pedido vira uma linha em `limites_uso` e a função
 * `consumir_limite` (SECURITY DEFINER, executável só pelo service_role) conta
 * quantos pedidos ocorreram na janela e decide se o próximo passa.
 *
 * Consequências desta escolha:
 * - o limite valia por usuário e por ação, independente de instância/servidor;
 * - custa uma escrita por pedido permitido;
 * - se a checagem falhar (banco indisponível), liberamos o pedido — a mídia
 *   continua protegida por RLS e pela checagem de liberação; o limite é só
 *   defesa contra rajadas.
 */

export const LIMITE_MIDIA_POR_MINUTO = 5;
export const JANELA_MIDIA_SEGUNDOS = 60;

export type ResultadoLimite = {
  permitido: boolean;
  /** segundos até a próxima tentativa ser aceita (0 quando permitido) */
  esperarSegundos: number;
  usados: number;
  limite: number;
};

/** Consome uma unidade do limite do usuário para a ação informada. */
export async function consumirLimite(
  userId: string,
  acao: string,
  limite = LIMITE_MIDIA_POR_MINUTO,
  janelaSegundos = JANELA_MIDIA_SEGUNDOS,
): Promise<ResultadoLimite> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("consumir_limite", {
      _user_id: userId,
      _acao: acao,
      _limite: limite,
      _janela_segundos: janelaSegundos,
    });

    if (error) {
      console.error("[limite-uso] falha ao consultar limite", acao, error.message);
      return { permitido: true, esperarSegundos: 0, usados: 0, limite };
    }

    const r = (data ?? {}) as {
      permitido?: boolean;
      usados?: number;
      limite?: number;
      liberar_em?: string | null;
    };

    if (r.permitido === false) {
      const alvo = r.liberar_em ? new Date(r.liberar_em).getTime() : Date.now() + janelaSegundos * 1000;
      const restante = Math.max(1, Math.ceil((alvo - Date.now()) / 1000));
      return {
        permitido: false,
        esperarSegundos: Math.min(restante, janelaSegundos),
        usados: r.usados ?? limite,
        limite: r.limite ?? limite,
      };
    }

    return {
      permitido: true,
      esperarSegundos: 0,
      usados: r.usados ?? 0,
      limite: r.limite ?? limite,
    };
  } catch (e) {
    console.error("[limite-uso] erro inesperado", acao, e);
    return { permitido: true, esperarSegundos: 0, usados: 0, limite };
  }
}
