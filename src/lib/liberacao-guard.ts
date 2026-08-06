import { negarAcesso, registrarAcessoNegado } from "./auditoria-acesso";

/** Cliente Supabase mínimo usado pela checagem (facilita testes). */
export type ClienteLiberacao = {
  from: (tabela: string) => {
    select: (cols: string) => {
      eq: (
        coluna: string,
        valor: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { id: string; eixo_id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  rpc: (
    fn: "conteudo_liberado",
    args: { _cliente_id: string; _conteudo_id: string; _eixo_id: string },
  ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
};

/**
 * Garante que o conteúdo está liberado para o cliente antes de persistir
 * qualquer evento (play/pause, progressão, conclusão).
 *
 * Dupla barreira: RLS de `conteudos` (leitura só do que está liberado) e a
 * função `conteudo_liberado`, que também respeita liberações agendadas
 * (`liberar_em` no futuro = ainda bloqueado).
 */
export async function garantirConteudoLiberado(
  supabase: ClienteLiberacao,
  userId: string,
  conteudoId: string,
  acao: string,
): Promise<{ conteudoId: string; eixoId: string }> {
  const { data: conteudo, error } = await supabase
    .from("conteudos")
    .select("id, eixo_id")
    .eq("id", conteudoId)
    .maybeSingle();

  if (error) {
    registrarAcessoNegado(
      { acao, userId, tabela: "conteudos", recurso: conteudoId },
      error,
    );
    throw new Error(error.message);
  }

  if (!conteudo) {
    negarAcesso(
      { acao, userId, tabela: "conteudos", recurso: conteudoId },
      "Conteúdo não liberado para este cliente",
    );
  }

  const { data: liberado, error: erroRpc } = await supabase.rpc("conteudo_liberado", {
    _cliente_id: userId,
    _conteudo_id: conteudo.id,
    _eixo_id: conteudo.eixo_id,
  });

  if (erroRpc) {
    registrarAcessoNegado(
      { acao, userId, tabela: "conteudo_liberado", recurso: conteudoId },
      erroRpc,
    );
    throw new Error(erroRpc.message);
  }

  if (!liberado) {
    negarAcesso(
      { acao, userId, tabela: "progresso", recurso: conteudoId },
      "Conteúdo não liberado para este cliente",
    );
  }

  return { conteudoId: conteudo.id, eixoId: conteudo.eixo_id };
}
