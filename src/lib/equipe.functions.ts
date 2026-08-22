import { createServerFn } from "@tanstack/react-start";
import { erroSeguro } from "./erro-permissao";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { garantirPermissao } from "./permissao-guard";
import { PERMISSOES } from "./permissoes";
import { FUNCOES_EQUIPE, ESCOPOS_EQUIPE, STATUS_EQUIPE } from "./equipe-funcoes";
import { atorAuditoria as ator, registrarAuditoria } from "./auditoria-equipe";

const permissaoSchema = z.enum(PERMISSOES);
const funcaoSchema = z.enum(FUNCOES_EQUIPE);
const escopoSchema = z.enum(ESCOPOS_EQUIPE);
const statusSchema = z.enum(STATUS_EQUIPE);

async function garantirGerenciarEquipe(
  supabase: Parameters<typeof garantirPermissao>[0],
  userId: string,
  acao: string,
) {
  await garantirPermissao(supabase, userId, "gerenciar_equipe", acao, {
    tabela: "equipe_membros",
  });
}

/** Último acesso real vem do sistema de autenticação, nunca do cliente. */
async function ultimosAcessos(ids: string[]): Promise<Record<string, string | null>> {
  if (ids.length === 0) return {};
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mapa: Record<string, string | null> = {};
    for (const id of ids) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      mapa[id] = data?.user?.last_sign_in_at ?? null;
    }
    return mapa;
  } catch (e) {
    console.error("[equipe] falha ao ler último acesso", e);
    return {};
  }
}

export const equipeListar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeListar");

    const [membrosRes, permissoes, convites, papeis, perfis, vinculos, clientes] =
      await Promise.all([
        supabase
          .from("equipe_membros")
          .select("user_id, funcao, status, escopo, principal, convidado_em, created_at")
          .order("created_at"),
        supabase.from("equipe_permissoes").select("user_id, permissao"),
        supabase
          .from("convites_equipe")
          .select("id, email, permissoes, funcao, escopo, status, created_at, reenviado_em")
          .eq("status", "pendente")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("id, nome, email").order("nome"),
        supabase.from("equipe_clientes").select("user_id, cliente_id"),
        supabase.from("clientes_acesso").select("user_id, terapeuta_id"),
      ]);

    const perfilPorId = new Map((perfis.data ?? []).map((p) => [p.id, p]));
    const linhas = membrosRes.data ?? [];
    const acessos = await ultimosAcessos(linhas.map((m) => m.user_id));

    const membros = linhas.map((m) => {
      const vinculadosExplicitos = (vinculos.data ?? []).filter((v) => v.user_id === m.user_id);
      const responsavelPor = (clientes.data ?? []).filter((c) => c.terapeuta_id === m.user_id);
      const idsVinculados = new Set([
        ...vinculadosExplicitos.map((v) => v.cliente_id),
        ...responsavelPor.map((c) => c.user_id),
      ]);
      return {
        userId: m.user_id,
        nome: perfilPorId.get(m.user_id)?.nome ?? "",
        email: perfilPorId.get(m.user_id)?.email ?? "",
        funcao: m.funcao,
        status: m.status,
        escopo: m.escopo,
        principal: m.principal,
        desde: m.created_at,
        convidadoEm: m.convidado_em,
        ultimoAcesso: acessos[m.user_id] ?? null,
        clientesVinculados: m.escopo === "todos" ? null : idsVinculados.size,
        vinculosExplicitos: vinculadosExplicitos.map((v) => v.cliente_id),
        permissoes: (permissoes.data ?? [])
          .filter((p) => p.user_id === m.user_id)
          .map((p) => p.permissao),
      };
    });

    const terapeutas = (papeis.data ?? [])
      .filter((p) => p.role === "terapeuta")
      .map((p) => p.user_id);

    const idsEquipe = new Set(membros.map((m) => m.userId));
    const candidatos = (perfis.data ?? [])
      .filter((p) => !idsEquipe.has(p.id))
      .map((p) => ({ userId: p.id, nome: p.nome, email: p.email }));

    const listaClientes = (clientes.data ?? []).map((c) => ({
      userId: c.user_id,
      nome: perfilPorId.get(c.user_id)?.nome ?? "",
      email: perfilPorId.get(c.user_id)?.email ?? "",
      terapeutaId: c.terapeuta_id,
    }));

    return {
      membros,
      terapeutas,
      convites: convites.data ?? [],
      candidatos,
      clientes: listaClientes,
      meuId: userId,
    };
  });

export const equipeConvidar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(200),
        funcao: funcaoSchema,
        escopo: escopoSchema,
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
      funcao: data.funcao,
      escopo: data.escopo,
      criado_por: userId,
    });
    if (error) throw erroSeguro(error);

    await registrarAuditoria(supabase, ator(context), {
      acao: "convite_criado",
      alvoTipo: "convite",
      alvoEmail: email,
      detalhes: { permissoes: data.permissoes, funcao: data.funcao, escopo: data.escopo },
    });
    return { ok: true as const };
  });

export const equipeReenviarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conviteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeReenviarConvite");

    const { data: convite } = await supabase
      .from("convites_equipe")
      .select("email, status")
      .eq("id", data.conviteId)
      .maybeSingle();
    if (!convite || convite.status !== "pendente") {
      return { ok: false as const, motivo: "convite_indisponivel" as const };
    }

    const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("convites_equipe")
      .update({ reenviado_em: new Date().toISOString(), expira_em: expira })
      .eq("id", data.conviteId)
      .eq("status", "pendente");
    if (error) throw erroSeguro(error);

    await registrarAuditoria(supabase, ator(context), {
      acao: "convite_reenviado",
      alvoTipo: "convite",
      alvoId: data.conviteId,
      alvoEmail: convite.email,
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
        funcao: funcaoSchema,
        escopo: escopoSchema,
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
      .update({ permissoes: data.permissoes, funcao: data.funcao, escopo: data.escopo })
      .eq("id", data.conviteId)
      .eq("status", "pendente");
    if (error) throw erroSeguro(error);

    await registrarAuditoria(supabase, ator(context), {
      acao: "convite_permissoes_atualizadas",
      alvoTipo: "convite",
      alvoId: data.conviteId,
      alvoEmail: convite.email,
      detalhes: { permissoes: data.permissoes, funcao: data.funcao, escopo: data.escopo },
    });
    return { ok: true as const };
  });

/** Cria ou atualiza o integrante: função, abrangência e permissões finais. */
export const equipeDefinirFuncao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        alvoId: z.string().uuid(),
        funcao: funcaoSchema,
        escopo: escopoSchema,
        permissoes: z.array(permissaoSchema),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeDefinirFuncao");

    const { data: membro } = await supabase
      .from("equipe_membros")
      .select("funcao, escopo, principal")
      .eq("user_id", data.alvoId)
      .maybeSingle();

    if (membro?.principal && (data.funcao !== "administrador" || data.escopo !== "todos")) {
      throw new Error("A conta principal precisa continuar como administradora de tudo.");
    }

    const { data: anteriores } = await supabase
      .from("equipe_permissoes")
      .select("permissao")
      .eq("user_id", data.alvoId);

    const { error: erroMembro } = await supabase.from("equipe_membros").upsert(
      {
        user_id: data.alvoId,
        funcao: data.funcao,
        escopo: data.escopo,
        status: "ativo" as const,
        criado_por: userId,
      },
      { onConflict: "user_id" },
    );
    if (erroMembro) throw erroSeguro(erroMembro);

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
      acao: membro && membro.funcao !== data.funcao ? "funcao_alterada" : "permissoes_definidas",
      alvoTipo: "equipe",
      alvoId: data.alvoId,
      alvoEmail: perfilAlvo?.email ?? null,
      detalhes: {
        funcao: data.funcao,
        funcaoAnterior: membro?.funcao ?? null,
        escopo: data.escopo,
        permissoes: data.permissoes,
        anteriores: (anteriores ?? []).map((p) => p.permissao),
      },
    });
    return { ok: true };
  });

/** Compatibilidade: apenas troca as permissões, mantendo a função atual. */
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

    const { data: membro } = await supabase
      .from("equipe_membros")
      .select("principal")
      .eq("user_id", data.alvoId)
      .maybeSingle();
    if (membro?.principal) {
      throw new Error("A conta principal tem acesso total e não pode ser limitada.");
    }

    const { data: anteriores } = await supabase
      .from("equipe_permissoes")
      .select("permissao")
      .eq("user_id", data.alvoId);

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

/** Vínculos específicos de clientes para quem tem abrangência limitada. */
export const equipeVincularClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        alvoId: z.string().uuid(),
        clientes: z.array(z.string().uuid()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeVincularClientes");

    const { data: anteriores } = await supabase
      .from("equipe_clientes")
      .select("cliente_id")
      .eq("user_id", data.alvoId);

    await supabase.from("equipe_clientes").delete().eq("user_id", data.alvoId);
    if (data.clientes.length > 0) {
      const { error } = await supabase.from("equipe_clientes").insert(
        data.clientes.map((cliente_id) => ({
          user_id: data.alvoId,
          cliente_id,
          criado_por: userId,
        })),
      );
      if (error) throw erroSeguro(error);
    }

    const { data: perfilAlvo } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", data.alvoId)
      .maybeSingle();

    await registrarAuditoria(supabase, ator(context), {
      acao: "vinculos_alterados",
      alvoTipo: "equipe",
      alvoId: data.alvoId,
      alvoEmail: perfilAlvo?.email ?? null,
      detalhes: {
        clientes: data.clientes,
        anteriores: (anteriores ?? []).map((v) => v.cliente_id),
      },
    });
    return { ok: true };
  });

export const equipeAlterarStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ alvoId: z.string().uuid(), status: statusSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeAlterarStatus");

    if (data.alvoId === userId && data.status === "suspenso") {
      throw new Error("Você não pode suspender o seu próprio acesso.");
    }

    const { error } = await supabase
      .from("equipe_membros")
      .update({ status: data.status })
      .eq("user_id", data.alvoId);
    if (error) throw erroSeguro(error);

    const { data: perfilAlvo } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", data.alvoId)
      .maybeSingle();

    await registrarAuditoria(supabase, ator(context), {
      acao: data.status === "suspenso" ? "acesso_suspenso" : "acesso_reativado",
      alvoTipo: "equipe",
      alvoId: data.alvoId,
      alvoEmail: perfilAlvo?.email ?? null,
    });
    return { ok: true };
  });

export const equipeRemover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ alvoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirGerenciarEquipe(supabase, userId, "equipeRemover");

    const { data: membro } = await supabase
      .from("equipe_membros")
      .select("principal")
      .eq("user_id", data.alvoId)
      .maybeSingle();
    if (membro?.principal) throw new Error("A conta principal não pode ser removida.");
    if (data.alvoId === userId) throw new Error("Você não pode remover o seu próprio acesso.");

    const { data: perfilAlvo } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", data.alvoId)
      .maybeSingle();

    await supabase.from("equipe_permissoes").delete().eq("user_id", data.alvoId);
    await supabase.from("equipe_clientes").delete().eq("user_id", data.alvoId);
    const { error } = await supabase.from("equipe_membros").delete().eq("user_id", data.alvoId);
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
    await garantirPermissao(supabase, userId, "ver_auditoria", "equipeAuditoria", {
      tabela: "auditoria_equipe",
    });

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
          funcao?: string;
          funcaoAnterior?: string;
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
          funcao: det.funcao ?? "",
          funcaoAnterior: det.funcaoAnterior ?? "",
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
    await garantirPermissao(supabase, userId, "ver_auditoria", "equipeAcessosNegados", {
      tabela: "auditoria_acessos_negados",
    });

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
