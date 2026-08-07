import { createServerFn } from "@tanstack/react-start";
import { erroSeguro } from "./erro-permissao";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { garantirPermissao } from "./permissao-guard";
import { PERMISSOES } from "./permissoes";
import { atorAuditoria as ator, registrarAuditoria } from "./auditoria-equipe";

const permissaoSchema = z.enum(PERMISSOES);

async function garantirGerenciarEquipe(
  supabase: Parameters<typeof garantirPermissao>[0],
  userId: string,
  acao: string,
) {
  await garantirPermissao(supabase, userId, "gerenciar_equipe", acao, {
    tabela: "equipe_admins",
  });
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
    if (error) throw erroSeguro(error);

    await registrarAuditoria(supabase, ator(context), {
      acao: "convite_criado",
      alvoTipo: "convite",
      alvoEmail: email,
      detalhes: { permissoes: data.permissoes },
    });
    return { ok: true as const };
  });

export const equipeCancelarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conviteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeCancelarConvite");
    const { data: convite } = await supabase
      .from("convites_equipe")
      .select("email")
      .eq("id", data.conviteId)
      .maybeSingle();
    const { error } = await supabase.from("convites_equipe").delete().eq("id", data.conviteId);
    if (error) throw erroSeguro(error);

    await registrarAuditoria(supabase, ator(context), {
      acao: "convite_cancelado",
      alvoTipo: "convite",
      alvoId: data.conviteId,
      alvoEmail: convite?.email ?? null,
    });
    return { ok: true };
  });

export const equipeAtualizarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        conviteId: z.string().uuid(),
        permissoes: z.array(permissaoSchema).min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeAtualizarConvite");

    const { data: convite } = await supabase
      .from("convites_equipe")
      .select("email, status")
      .eq("id", data.conviteId)
      .maybeSingle();
    if (!convite || convite.status !== "pendente") {
      return { ok: false as const, motivo: "convite_indisponivel" as const };
    }

    const { error } = await supabase
      .from("convites_equipe")
      .update({ permissoes: data.permissoes })
      .eq("id", data.conviteId)
      .eq("status", "pendente");
    if (error) throw erroSeguro(error);

    await registrarAuditoria(supabase, ator(context), {
      acao: "convite_permissoes_atualizadas",
      alvoTipo: "convite",
      alvoId: data.conviteId,
      alvoEmail: convite.email,
      detalhes: { permissoes: data.permissoes },
    });
    return { ok: true as const };
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

    const { data: ehTerapeuta } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("user_id", data.alvoId)
      .eq("role", "terapeuta")
      .maybeSingle();
    if (ehTerapeuta) {
      throw new Error("A terapeuta responsável já tem acesso total e não pode ser limitada.");
    }

    const { data: anteriores } = await supabase
      .from("equipe_permissoes")
      .select("permissao")
      .eq("user_id", data.alvoId);

    const { error: erroAdmin } = await supabase
      .from("equipe_admins")
      .upsert({ user_id: data.alvoId, criado_por: userId }, { onConflict: "user_id" });
    if (erroAdmin) throw erroSeguro(erroAdmin);

    await supabase.from("equipe_permissoes").delete().eq("user_id", data.alvoId);
    if (data.permissoes.length > 0) {
      const { error } = await supabase
        .from("equipe_permissoes")
        .insert(data.permissoes.map((permissao) => ({ user_id: data.alvoId, permissao })));
      if (error) throw erroSeguro(error);
    }

    const { data: perfilAlvo } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", data.alvoId)
      .maybeSingle();

    await registrarAuditoria(supabase, ator(context), {
      acao: data.permissoes.length === 0 ? "permissoes_revogadas" : "permissoes_definidas",
      alvoTipo: "equipe",
      alvoId: data.alvoId,
      alvoEmail: perfilAlvo?.email ?? null,
      detalhes: {
        permissoes: data.permissoes,
        anteriores: (anteriores ?? []).map((p) => p.permissao),
      },
    });
    return { ok: true };
  });

export const equipeRemover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ alvoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeRemover");

    const { data: ehTerapeuta } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("user_id", data.alvoId)
      .eq("role", "terapeuta")
      .maybeSingle();
    if (ehTerapeuta) throw new Error("A terapeuta responsável não pode ser removida.");
    if (data.alvoId === userId) throw new Error("Você não pode remover o seu próprio acesso.");

    const { data: perfilAlvo } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", data.alvoId)
      .maybeSingle();

    await supabase.from("equipe_permissoes").delete().eq("user_id", data.alvoId);
    const { error } = await supabase.from("equipe_admins").delete().eq("user_id", data.alvoId);
    if (error) throw erroSeguro(error);

    await registrarAuditoria(supabase, ator(context), {
      acao: "admin_removido",
      alvoTipo: "equipe",
      alvoId: data.alvoId,
      alvoEmail: perfilAlvo?.email ?? null,
    });
    return { ok: true };
  });

export const equipeAuditoria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeAuditoria");

    const { data, error } = await supabase
      .from("auditoria_equipe")
      .select("id, acao, alvo_tipo, alvo_id, alvo_email, detalhes, ator_email, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw erroSeguro(error);

    return {
      registros: (data ?? []).map((r) => {
        const det = (r.detalhes ?? {}) as {
          permissoes?: string[];
          anteriores?: string[];
          titulo?: string;
          agendadoPara?: string;
        };
        return {
          id: r.id,
          acao: r.acao,
          alvoTipo: r.alvo_tipo,
          alvoId: r.alvo_id,
          alvoEmail: r.alvo_email,
          permissoes: det.permissoes ?? [],
          anteriores: det.anteriores ?? [],
          titulo: det.titulo ?? "",
          agendadoPara: det.agendadoPara ?? "",
          atorEmail: r.ator_email,
          quando: r.created_at,
        };
      }),
    };
  });

/** Tentativas negadas por permissão — visível a quem gerencia a equipe. */
export const equipeAcessosNegados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeAcessosNegados");

    const { data, error } = await supabase
      .from("auditoria_acessos_negados")
      .select("id, user_id, user_email, acao, permissao, tipo, alvo_id, rota, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw erroSeguro(error);

    return {
      registros: (data ?? []).map((r) => ({
        id: r.id,
        userId: r.user_id,
        userEmail: r.user_email,
        acao: r.acao,
        permissao: r.permissao,
        tipo: r.tipo,
        alvoId: r.alvo_id,
        rota: r.rota,
        quando: r.created_at,
      })),
    };
  });
