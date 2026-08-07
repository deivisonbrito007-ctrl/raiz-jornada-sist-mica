import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { negarAcesso } from "./auditoria-acesso";
import { PERMISSOES } from "./permissoes";

const permissaoSchema = z.enum(PERMISSOES);

async function garantirGerenciarEquipe(
  supabase: { rpc: (fn: "pode", args: { _permissao: string }) => PromiseLike<{ data: unknown }> },
  userId: string,
  acao: string,
) {
  const { data } = await supabase.rpc("pode", { _permissao: "gerenciar_equipe" });
  if (data !== true) negarAcesso({ acao, userId, tabela: "equipe_admins" });
}

export const equipeListar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeListar");

    const [admins, permissoes, convites, papeis, perfis] = await Promise.all([
      supabase.from("equipe_admins").select("user_id, created_at").order("created_at"),
      supabase.from("equipe_permissoes").select("user_id, permissao"),
      supabase
        .from("convites_equipe")
        .select("id, email, permissoes, status, created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("profiles").select("id, nome, email").order("nome"),
    ]);

    const perfilPorId = new Map((perfis.data ?? []).map((p) => [p.id, p]));
    const membros = (admins.data ?? []).map((a) => ({
      userId: a.user_id,
      nome: perfilPorId.get(a.user_id)?.nome ?? "",
      email: perfilPorId.get(a.user_id)?.email ?? "",
      desde: a.created_at,
      permissoes: (permissoes.data ?? [])
        .filter((p) => p.user_id === a.user_id)
        .map((p) => p.permissao),
    }));

    const terapeutas = (papeis.data ?? [])
      .filter((p) => p.role === "terapeuta")
      .map((p) => ({
        userId: p.user_id,
        nome: perfilPorId.get(p.user_id)?.nome ?? "",
        email: perfilPorId.get(p.user_id)?.email ?? "",
      }));

    const idsAdmin = new Set(membros.map((m) => m.userId));
    const idsTerapeuta = new Set(terapeutas.map((t) => t.userId));
    const candidatos = (perfis.data ?? [])
      .filter((p) => !idsAdmin.has(p.id) && !idsTerapeuta.has(p.id))
      .map((p) => ({ userId: p.id, nome: p.nome, email: p.email }));

    return { membros, terapeutas, convites: convites.data ?? [], candidatos };
  });

export const equipeConvidar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(200),
        permissoes: z.array(permissaoSchema).min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeConvidar");

    const email = data.email.trim().toLowerCase();
    const { data: existente } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existente) {
      return { ok: false, motivo: "conta_existente" as const, userId: existente.id };
    }

    const { error } = await supabase.from("convites_equipe").insert({
      email,
      permissoes: data.permissoes,
      criado_por: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const equipeCancelarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conviteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeCancelarConvite");
    const { error } = await supabase.from("convites_equipe").delete().eq("id", data.conviteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const equipeDefinirPermissoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        alvoId: z.string().uuid(),
        permissoes: z.array(permissaoSchema),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeDefinirPermissoes");

    const { data: ehTerapeuta } = await supabase.rpc("has_role", {
      _user_id: data.alvoId,
      _role: "terapeuta",
    });
    if (ehTerapeuta) {
      throw new Error("A terapeuta responsável já tem acesso total e não pode ser limitada.");
    }

    const { error: erroAdmin } = await supabase
      .from("equipe_admins")
      .upsert({ user_id: data.alvoId, criado_por: userId }, { onConflict: "user_id" });
    if (erroAdmin) throw new Error(erroAdmin.message);

    await supabase.from("equipe_permissoes").delete().eq("user_id", data.alvoId);
    if (data.permissoes.length > 0) {
      const { error } = await supabase
        .from("equipe_permissoes")
        .insert(data.permissoes.map((permissao) => ({ user_id: data.alvoId, permissao })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const equipeRemover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ alvoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeRemover");

    const { data: ehTerapeuta } = await supabase.rpc("has_role", {
      _user_id: data.alvoId,
      _role: "terapeuta",
    });
    if (ehTerapeuta) throw new Error("A terapeuta responsável não pode ser removida.");
    if (data.alvoId === userId) throw new Error("Você não pode remover o seu próprio acesso.");

    await supabase.from("equipe_permissoes").delete().eq("user_id", data.alvoId);
    const { error } = await supabase.from("equipe_admins").delete().eq("user_id", data.alvoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
