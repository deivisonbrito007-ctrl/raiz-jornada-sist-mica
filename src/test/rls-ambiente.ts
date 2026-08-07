import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Utilitários para os testes de RLS que batem no banco real.
 * Cria usuários de verdade (service role), semeia dados de múltiplos
 * clientes e devolve clientes autenticados para cada um deles.
 */

export const urlSupabase = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
export const chavePublica =
  process.env["SUPABASE_PUBLISHABLE_KEY"] ??
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
  process.env["VITE_SUPABASE_ANON_KEY"] ??
  "";
export const chaveServico = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

export const rlsConfigurado = Boolean(urlSupabase && chavePublica && chaveServico);

export function clienteAnonimo(): SupabaseClient {
  return createClient(urlSupabase, chavePublica, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

export function clienteAdmin(): SupabaseClient {
  return createClient(urlSupabase, chaveServico, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

export type UsuarioTeste = {
  id: string;
  email: string;
  senha: string;
  db: SupabaseClient;
};

const SENHA = "Raiz#Teste-2026!rls";

export async function criarUsuario(admin: SupabaseClient, apelido: string): Promise<UsuarioTeste> {
  const email = `rls-${apelido}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@raiz-teste.dev`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
    user_metadata: { nome: `RLS ${apelido}` },
  });
  if (error || !data.user) throw new Error(`falha ao criar usuário: ${error?.message}`);

  const db = clienteAnonimo();
  const entrada = await db.auth.signInWithPassword({ email, password: SENHA });
  if (entrada.error) throw new Error(`falha no login: ${entrada.error.message}`);

  return { id: data.user.id, email, senha: SENHA, db };
}

export async function removerUsuario(admin: SupabaseClient, id: string) {
  await admin.from("diario").delete().eq("cliente_id", id);
  await admin.from("progresso").delete().eq("cliente_id", id);
  await admin.from("liberacoes").delete().eq("cliente_id", id);
  await admin.from("notificacoes").delete().eq("cliente_id", id);
  await admin.from("clientes_pacotes").delete().eq("cliente_id", id);
  await admin.from("user_roles").delete().eq("user_id", id);
  await admin.from("equipe_permissoes").delete().eq("user_id", id);
  await admin.from("equipe_admins").delete().eq("user_id", id);
  await admin.from("profiles").delete().eq("id", id);
  await admin.auth.admin.deleteUser(id);
}

export async function tornarTerapeuta(admin: SupabaseClient, id: string) {
  await admin.from("user_roles").delete().eq("user_id", id);
  const { error } = await admin.from("user_roles").insert({ user_id: id, role: "terapeuta" });
  if (error) throw new Error(`falha ao promover terapeuta: ${error.message}`);
}
