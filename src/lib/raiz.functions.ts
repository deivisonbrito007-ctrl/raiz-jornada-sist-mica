import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMeuContexto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [perfil, papeis, pacotes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, email, created_at, meta_semanal")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("clientes_pacotes")
        .select("id, status_pagamento, created_at, pacotes(id, nome, descricao, tipo_cobranca)")
        .eq("cliente_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    const roles = (papeis.data ?? []).map((r) => r.role);
    return {
      perfil: perfil.data,
      papel: roles.includes("terapeuta") ? ("terapeuta" as const) : ("cliente" as const),
      pacotes: pacotes.data ?? [],
    };
  });

export const getMinhaBiblioteca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [eixos, conteudos, liberacoes, progresso] = await Promise.all([
      supabase.from("eixos").select("id, nome, descricao, icone, ordem").order("ordem"),
      supabase.from("conteudos").select("id, eixo_id, tipo, titulo, duracao_segundos, ordem").order("ordem"),
      supabase.from("liberacoes").select("eixo_id, conteudo_id, status").eq("cliente_id", userId),
      supabase.from("progresso").select("conteudo_id, status, concluido_em").eq("cliente_id", userId),
    ]);

    const libs = liberacoes.data ?? [];
    const feitos = new Set(
      (progresso.data ?? []).filter((p) => p.status === "concluido").map((p) => p.conteudo_id),
    );
    const conclusaoPorConteudo = new Map<string, string>();
    for (const p of progresso.data ?? []) {
      if (p.status === "concluido" && p.concluido_em) {
        conclusaoPorConteudo.set(p.conteudo_id, p.concluido_em);
      }
    }

    const eixosResult = (eixos.data ?? []).map((eixo) => {
      const doEixo = (conteudos.data ?? []).filter((c) => c.eixo_id === eixo.id);
      const liberado = libs.some(
        (l) =>
          l.status === "liberado" &&
          ((l.eixo_id === eixo.id && l.conteudo_id === null) ||
            doEixo.some((c) => c.id === l.conteudo_id)),
      );
      return {
        ...eixo,
        liberado,
        total: doEixo.length,
        concluidos: doEixo.filter((c) => feitos.has(c.id)).length,
        datasConclusao: doEixo
          .map((c) => conclusaoPorConteudo.get(c.id))
          .filter((d): d is string => Boolean(d)),
      };
    });

    const totalLiberado = eixosResult.filter((e) => e.liberado);
    const totalItens = totalLiberado.reduce((acc, e) => acc + e.total, 0);
    const totalConcluidos = totalLiberado.reduce((acc, e) => acc + e.concluidos, 0);

    return {
      eixos: eixosResult,
      resumo: {
        totalItens,
        totalConcluidos,
        percentual: totalItens === 0 ? 0 : Math.round((totalConcluidos / totalItens) * 100),
        emAndamento: totalLiberado.filter((e) => e.concluidos > 0 && e.concluidos < e.total).length,
        datasConclusao: (progresso.data ?? [])
          .filter((p) => p.concluido_em)
          .map((p) => p.concluido_em as string),
      },
    };
  });

export const getEixoTrilha = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ eixoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [eixo, conteudos, progresso] = await Promise.all([
      supabase.from("eixos").select("id, nome, descricao, icone").eq("id", data.eixoId).maybeSingle(),
      supabase
        .from("conteudos")
        .select("id, tipo, titulo, descricao, duracao_segundos, ordem")
        .eq("eixo_id", data.eixoId)
        .order("ordem"),
      supabase.from("progresso").select("conteudo_id, status").eq("cliente_id", userId),
    ]);

    const mapa = new Map((progresso.data ?? []).map((p) => [p.conteudo_id, p.status]));
    return {
      eixo: eixo.data,
      conteudos: (conteudos.data ?? []).map((c) => ({
        ...c,
        status: mapa.get(c.id) ?? ("nao_iniciado" as const),
      })),
    };
  });

export const getConteudo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conteudoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: conteudo, error } = await supabase
      .from("conteudos")
      .select("id, eixo_id, tipo, titulo, descricao, corpo_texto, storage_path, duracao_segundos, eixos(nome)")
      .eq("id", data.conteudoId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!conteudo) return { conteudo: null, url: null, status: "nao_iniciado" as const };

    let url: string | null = null;
    if (conteudo.storage_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const signed = await supabaseAdmin.storage
        .from("midias")
        .createSignedUrl(conteudo.storage_path, 60 * 60);
      url = signed.data?.signedUrl ?? null;
    }

    const { data: prog } = await supabase
      .from("progresso")
      .select("status")
      .eq("cliente_id", userId)
      .eq("conteudo_id", data.conteudoId)
      .maybeSingle();

    return { conteudo, url, status: prog?.status ?? ("nao_iniciado" as const) };
  });

export const marcarProgresso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        conteudoId: z.string().uuid(),
        status: z.enum(["nao_iniciado", "em_andamento", "concluido"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("progresso").upsert(
      {
        cliente_id: userId,
        conteudo_id: data.conteudoId,
        status: data.status,
        concluido_em: data.status === "concluido" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cliente_id,conteudo_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const definirMetaSemanal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ meta: z.number().int().min(1).max(14) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ meta_semanal: data.meta })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, meta: data.meta };
  });


export const salvarDiario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ texto: z.string().min(1).max(8000), conteudoId: z.string().uuid().nullable().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("diario").insert({
      cliente_id: userId,
      conteudo_id: data.conteudoId ?? null,
      texto: data.texto,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarDiario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("diario")
      .select("id, texto, created_at, conteudo_id, conteudos(titulo, eixos(nome))")
      .eq("cliente_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const listarNotificacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("notificacoes")
      .select("id, titulo, mensagem, lida, created_at")
      .eq("cliente_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return data ?? [];
  });

export const marcarNotificacoesLidas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("notificacoes").update({ lida: true }).eq("cliente_id", userId).eq("lida", false);
    return { ok: true };
  });

/* ---------- Painel do terapeuta ---------- */

export const adminResumo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: ehTerapeuta } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "terapeuta",
    });
    if (!ehTerapeuta) throw new Error("Acesso restrito");

    const [papeis, perfis, conteudos, liberacoes, progresso, pacotes, vinculos, eixos] =
      await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("id, nome, email, created_at").order("created_at"),
        supabase.from("conteudos").select("id, eixo_id, titulo, tipo, ordem"),
        supabase.from("liberacoes").select("cliente_id, eixo_id, conteudo_id, status"),
        supabase.from("progresso").select("cliente_id, conteudo_id, status, updated_at"),
        supabase.from("pacotes").select("id, nome, descricao, tipo_cobranca, preco_centavos, eixos_incluidos"),
        supabase.from("clientes_pacotes").select("id, cliente_id, pacote_id, status_pagamento, created_at"),
        supabase.from("eixos").select("id, nome, ordem").order("ordem"),
      ]);

    const clienteIds = new Set(
      (papeis.data ?? []).filter((p) => p.role === "cliente").map((p) => p.user_id),
    );
    const conteudosArr = conteudos.data ?? [];
    const libs = liberacoes.data ?? [];
    const progs = progresso.data ?? [];
    const eixosArr = eixos.data ?? [];

    const clientes = (perfis.data ?? [])
      .filter((p) => clienteIds.has(p.id))
      .map((p) => {
        const liberados = conteudosArr.filter((c) =>
          libs.some(
            (l) =>
              l.cliente_id === p.id &&
              l.status === "liberado" &&
              ((l.eixo_id === c.eixo_id && l.conteudo_id === null) || l.conteudo_id === c.id),
          ),
        );
        const concluidos = progs.filter(
          (pr) => pr.cliente_id === p.id && pr.status === "concluido" && liberados.some((c) => c.id === pr.conteudo_id),
        ).length;
        const datasConclusao = progs
          .filter((pr) => pr.cliente_id === p.id && pr.status === "concluido")
          .map((pr) => pr.updated_at);
        const ultima = progs

          .filter((pr) => pr.cliente_id === p.id)
          .map((pr) => pr.updated_at)
          .sort()
          .at(-1);
        const eixoAtual = eixosArr.find((e) =>
          liberados.some(
            (c) =>
              c.eixo_id === e.id &&
              !progs.some((pr) => pr.cliente_id === p.id && pr.conteudo_id === c.id && pr.status === "concluido"),
          ),
        );
        const vinculo = (vinculos.data ?? []).find((v) => v.cliente_id === p.id);
        return {
          ...p,
          totalLiberado: liberados.length,
          concluidos,
          percentual: liberados.length === 0 ? 0 : Math.round((concluidos / liberados.length) * 100),
          eixoAtual: eixoAtual?.nome ?? null,
          ultimaAtividade: ultima ?? null,
          pacote: (pacotes.data ?? []).find((pk) => pk.id === vinculo?.pacote_id)?.nome ?? null,
          statusPagamento: vinculo?.status_pagamento ?? null,
        };
      });

    const media =
      clientes.length === 0 ? 0 : Math.round(clientes.reduce((a, c) => a + c.percentual, 0) / clientes.length);

    return {
      clientes,
      eixos: eixosArr,
      pacotes: pacotes.data ?? [],
      vinculos: vinculos.data ?? [],
      metricas: {
        clientesAtivos: clientes.filter((c) => c.totalLiberado > 0).length,
        trilhasEmAndamento: clientes.filter((c) => c.percentual > 0 && c.percentual < 100).length,
        conclusaoMedia: media,
      },
    };
  });

export const adminGetCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clienteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ehTerapeuta } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "terapeuta",
    });
    if (!ehTerapeuta) throw new Error("Acesso restrito");

    const [perfil, eixos, conteudos, liberacoes, progresso, diario, vinculos, pacotes] = await Promise.all([
      supabase.from("profiles").select("id, nome, email, created_at").eq("id", data.clienteId).maybeSingle(),
      supabase.from("eixos").select("id, nome, icone, ordem").order("ordem"),
      supabase.from("conteudos").select("id, eixo_id, titulo, tipo, ordem").order("ordem"),
      supabase.from("liberacoes").select("id, eixo_id, conteudo_id, status, liberado_em").eq("cliente_id", data.clienteId),
      supabase.from("progresso").select("conteudo_id, status, concluido_em, updated_at").eq("cliente_id", data.clienteId),
      supabase
        .from("diario")
        .select("id, texto, created_at, conteudos(titulo)")
        .eq("cliente_id", data.clienteId)
        .order("created_at", { ascending: false }),
      supabase.from("clientes_pacotes").select("id, pacote_id, status_pagamento").eq("cliente_id", data.clienteId),
      supabase.from("pacotes").select("id, nome, eixos_incluidos"),
    ]);

    return {
      perfil: perfil.data,
      eixos: eixos.data ?? [],
      conteudos: conteudos.data ?? [],
      liberacoes: liberacoes.data ?? [],
      progresso: progresso.data ?? [],
      diario: diario.data ?? [],
      vinculos: vinculos.data ?? [],
      pacotes: pacotes.data ?? [],
    };
  });

export const adminDefinirLiberacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        clienteId: z.string().uuid(),
        eixoId: z.string().uuid().nullable().optional(),
        conteudoId: z.string().uuid().nullable().optional(),
        liberar: z.boolean(),
        titulo: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ehTerapeuta } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "terapeuta",
    });
    if (!ehTerapeuta) throw new Error("Acesso restrito");

    const alvo = supabase
      .from("liberacoes")
      .select("id")
      .eq("cliente_id", data.clienteId)
      .eq(data.conteudoId ? "conteudo_id" : "eixo_id", (data.conteudoId ?? data.eixoId) as string);
    const existente = await (data.conteudoId ? alvo : alvo.is("conteudo_id", null)).maybeSingle();

    if (!data.liberar) {
      if (existente.data) await supabase.from("liberacoes").delete().eq("id", existente.data.id);
      return { ok: true };
    }

    if (existente.data) {
      await supabase.from("liberacoes").update({ status: "liberado", liberado_em: new Date().toISOString() }).eq("id", existente.data.id);
    } else {
      const { error } = await supabase.from("liberacoes").insert({
        cliente_id: data.clienteId,
        eixo_id: data.conteudoId ? null : data.eixoId ?? null,
        conteudo_id: data.conteudoId ?? null,
        status: "liberado",
      });
      if (error) throw new Error(error.message);
    }

    await supabase.from("notificacoes").insert({
      cliente_id: data.clienteId,
      titulo: "Novo conteúdo liberado",
      mensagem: data.titulo
        ? `"${data.titulo}" já está disponível na sua biblioteca.`
        : "Há algo novo esperando por você na sua biblioteca.",
    });

    return { ok: true };
  });

export const adminSalvarConteudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        eixoId: z.string().uuid(),
        tipo: z.enum(["video", "audio", "exercicio", "texto", "tarefa"]),
        titulo: z.string().min(1).max(200),
        descricao: z.string().max(2000).default(""),
        corpoTexto: z.string().max(20000).nullable().optional(),
        storagePath: z.string().max(500).nullable().optional(),
        duracaoSegundos: z.number().int().min(0).default(0),
        ordem: z.number().int().min(0).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      eixo_id: data.eixoId,
      tipo: data.tipo,
      titulo: data.titulo,
      descricao: data.descricao,
      corpo_texto: data.corpoTexto ?? null,
      storage_path: data.storagePath ?? null,
      duracao_segundos: data.duracaoSegundos,
      ordem: data.ordem,
    };
    const query = data.id
      ? supabase.from("conteudos").update(payload).eq("id", data.id)
      : supabase.from("conteudos").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminApagarConteudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("conteudos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSalvarEixo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        nome: z.string().min(1).max(120),
        descricao: z.string().max(1000).default(""),
        icone: z.string().max(60).default("sprout"),
        ordem: z.number().int().min(0).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = { nome: data.nome, descricao: data.descricao, icone: data.icone, ordem: data.ordem };
    const query = data.id
      ? context.supabase.from("eixos").update(payload).eq("id", data.id)
      : context.supabase.from("eixos").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListarConteudos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [eixos, conteudos] = await Promise.all([
      context.supabase.from("eixos").select("id, nome, descricao, icone, ordem").order("ordem"),
      context.supabase
        .from("conteudos")
        .select("id, eixo_id, tipo, titulo, descricao, corpo_texto, storage_path, duracao_segundos, ordem")
        .order("ordem"),
    ]);
    return { eixos: eixos.data ?? [], conteudos: conteudos.data ?? [] };
  });

export const adminSalvarPacote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        nome: z.string().min(1).max(160),
        descricao: z.string().max(2000).default(""),
        eixosIncluidos: z.array(z.string().uuid()).default([]),
        tipoCobranca: z.enum(["pagamento_unico", "assinatura"]),
        precoCentavos: z.number().int().min(0).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      nome: data.nome,
      descricao: data.descricao,
      eixos_incluidos: data.eixosIncluidos,
      tipo_cobranca: data.tipoCobranca,
      preco_centavos: data.precoCentavos,
    };
    const query = data.id
      ? context.supabase.from("pacotes").update(payload).eq("id", data.id)
      : context.supabase.from("pacotes").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminVincularPacote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        clienteId: z.string().uuid(),
        pacoteId: z.string().uuid(),
        statusPagamento: z.enum(["pendente", "pago", "cancelado"]).default("pendente"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clientes_pacotes").insert({
      cliente_id: data.clienteId,
      pacote_id: data.pacoteId,
      status_pagamento: data.statusPagamento,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAtualizarPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ id: z.string().uuid(), statusPagamento: z.enum(["pendente", "pago", "cancelado"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clientes_pacotes")
      .update({ status_pagamento: data.statusPagamento })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
