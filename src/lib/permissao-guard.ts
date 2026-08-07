import { negarAcesso } from "./auditoria-acesso";
import { persistirAcessoNegado } from "./auditoria-negados.server";
import type { Permissao } from "./permissoes";

type ClientePode = {
  rpc: (fn: "pode", args: { _permissao: string }) => PromiseLike<{ data: unknown }>;
};

/** Confirma no servidor, via RPC protegida, que o usuário tem a permissão pedida. */
export async function garantirPermissao(
  supabase: ClientePode,
  userId: string,
  permissao: Permissao,
  acao: string,
  extras: { clienteAlvo?: string; tabela?: string; rota?: string } = {},
): Promise<void> {
  const { data } = await supabase.rpc("pode", { _permissao: permissao });
  if (data !== true) {
    // Registro persistente para a página de auditoria do painel.
    await persistirAcessoNegado({
      acao,
      userId,
      permissao,
      tipo: "permissao",
      ...(extras.clienteAlvo ? { alvoId: extras.clienteAlvo } : {}),
      ...(extras.rota ? { rota: extras.rota } : {}),
    });
    negarAcesso({
      acao,
      userId,
      ...(extras.clienteAlvo ? { clienteAlvo: extras.clienteAlvo } : {}),
      tabela: extras.tabela ?? permissao,
    });
  }
}

/** Versão booleana, para decidir se um bloco opcional de dados pode ser devolvido. */
export async function temPermissao(
  supabase: ClientePode,
  permissao: Permissao,
): Promise<boolean> {
  const { data } = await supabase.rpc("pode", { _permissao: permissao });
  return data === true;
}
