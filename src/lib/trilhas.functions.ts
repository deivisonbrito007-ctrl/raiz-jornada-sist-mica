import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { erroSeguro } from "./erro-permissao";
import { garantirPermissao } from "./permissao-guard";
import { atorAuditoria, registrarAuditoria } from "./auditoria-equipe";

/* ---------------------------------------------------------------- terapeuta */

export const adminListarTrilhas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_conteudos", "adminListarTrilhas", {
      tabela: "trilhas",
      rota: "/admin/trilhas",
    });

    const [trilhas, eixos, etapas] = await Promise.all([
      supabase
        .from("trilhas")
        .select(
          "id, eixo_id, nome, resumo, objetivo, nivel, status, versao, prerequisitos, alertas, orientacoes_pausa, ordem, updated_at",
        )
        .order("ordem")
        .order("created_at"),
      supabase.from("eixos").select("id, nome, ordem").order("ordem"),
      supabase
        .from("conteudos")
        .select(
          "id, trilha_id, eixo_id, tipo, tipo_etapa, titulo, descricao, corpo_texto, storage_path, duracao_segundos, ordem, obrigatoria, materiais, local_recomendado, sensibilidades, transcricao, criterios_interrupcao, permite_repetir",
        )
        .not("trilha_id", "is", null)
        .order("ordem"),
    ]);

    return {
      trilhas: trilhas.data ?? [],
      eixos: eixos.data ?? [],
      etapas: etapas.data ?? [],
    };
  });

export const adminSalvarTrilha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        eixoId: z.string().uuid(),
        nome: z.string().trim().min(2).max(160),
        resumo: z.string().max(1000).default(""),
        objetivo: z.string().max(1000).default(""),
        nivel: z.enum(["leve", "intermediario", "profundo"]),
        status: z.enum(["rascunho", "em_revisao", "publicado", "arquivado"]),
        prerequisitos: z.string().max(1000).default(""),
        alertas: z.string().max(1000).default(""),
        orientacoesPausa: z.string().max(1000).default(""),
        ordem: z.number().int().min(0).max(999).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_conteudos", "adminSalvarTrilha", {
      tabela: "trilhas",
      rota: "/admin/trilhas",
    });

    const linha = {
      eixo_id: data.eixoId,
      nome: data.nome,
      resumo: data.resumo,
      objetivo: data.objetivo,
      nivel: data.nivel,
      status: data.status,
      prerequisitos: data.prerequisitos,
      alertas: data.alertas,
      orientacoes_pausa: data.orientacoesPausa,
      ordem: data.ordem,
    };

    if (data.id) {
      const { error } = await supabase.from("trilhas").update(linha).eq("id", data.id);
      if (error) throw erroSeguro(error);
      await registrarAuditoria(supabase, atorAuditoria(context), {
        acao: "trilha_atualizada",
        alvoTipo: "trilha",
        alvoId: data.id,
        detalhes: { nome: data.nome, status: data.status },
      });
      return { ok: true, id: data.id };
    }

    const { data: criada, error } = await supabase
      .from("trilhas")
      .insert({ ...linha, autor_id: userId })
      .select("id")
      .single();
    if (error) throw erroSeguro(error);
    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: "trilha_criada",
      alvoTipo: "trilha",
      alvoId: criada.id,
      detalhes: { nome: data.nome, status: data.status },
    });
    return { ok: true, id: criada.id };
  });

export const adminDuplicarTrilha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ trilhaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_conteudos", "adminDuplicarTrilha", {
      tabela: "trilhas",
      rota: "/admin/trilhas",
    });

    const { data: original, error } = await supabase
      .from("trilhas")
      .select("*")
      .eq("id", data.trilhaId)
      .maybeSingle();
    if (error) throw erroSeguro(error);
    if (!original) throw new Error("Trilha não encontrada");

    const { data: nova, error: erroInsert } = await supabase
      .from("trilhas")
      .insert({
        eixo_id: original.eixo_id,
        nome: `${original.nome} (cópia)`,
        resumo: original.resumo,
        objetivo: original.objetivo,
        nivel: original.nivel,
        status: "rascunho",
        versao: original.versao + 1,
        autor_id: userId,
        prerequisitos: original.prerequisitos,
        alertas: original.alertas,
        orientacoes_pausa: original.orientacoes_pausa,
        ordem: original.ordem,
      })
      .select("id")
      .single();
    if (erroInsert) throw erroSeguro(erroInsert);

    const { data: etapas } = await supabase
      .from("conteudos")
      .select("*")
      .eq("trilha_id", data.trilhaId)
      .order("ordem");

    if (etapas && etapas.length > 0) {
      const { error: erroEtapas } = await supabase.from("conteudos").insert(
        etapas.map((e) => ({
          trilha_id: nova.id,
          eixo_id: e.eixo_id,
          tipo: e.tipo,
          tipo_etapa: e.tipo_etapa,
          titulo: e.titulo,
          descricao: e.descricao,
          corpo_texto: e.corpo_texto,
          storage_path: e.storage_path,
          thumbnail_path: e.thumbnail_path,
          duracao_segundos: e.duracao_segundos,
          ordem: e.ordem,
          obrigatoria: e.obrigatoria,
          materiais: e.materiais,
          local_recomendado: e.local_recomendado,
          sensibilidades: e.sensibilidades,
          transcricao: e.transcricao,
          criterios_interrupcao: e.criterios_interrupcao,
          permite_repetir: e.permite_repetir,
        })),
      );
      if (erroEtapas) throw erroSeguro(erroEtapas);
    }

    return { ok: true, id: nova.id };
  });

export const adminSalvarEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        trilhaId: z.string().uuid(),
        eixoId: z.string().uuid(),
        tipo: z.enum(["video", "audio", "exercicio", "texto", "tarefa"]),
        tipoEtapa: z.enum([
          "orientacao",
          "preparacao",
          "checkin_inicial",
          "compreensao",
          "aterramento",
          "meditacao",
          "movimento",
          "integracao",
          "acao",
          "checkout",
        ]),
        titulo: z.string().trim().min(2).max(200),
        descricao: z.string().max(2000).default(""),
        corpoTexto: z.string().max(20000).nullable().optional(),
        storagePath: z.string().max(500).nullable().optional(),
        duracaoSegundos: z.number().int().min(0).max(60 * 60 * 6).default(0),
        ordem: z.number().int().min(0).max(999).default(0),
        obrigatoria: z.boolean().default(true),
        materiais: z.string().max(1000).default(""),
        localRecomendado: z.string().max(500).default(""),
        sensibilidades: z.string().max(1000).default(""),
        transcricao: z.string().max(20000).default(""),
        criteriosInterrupcao: z.string().max(1000).default(""),
        permiteRepetir: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_conteudos", "adminSalvarEtapa", {
      tabela: "conteudos",
      rota: "/admin/trilhas",
    });

    const linha = {
      trilha_id: data.trilhaId,
      eixo_id: data.eixoId,
      tipo: data.tipo,
      tipo_etapa: data.tipoEtapa,
      titulo: data.titulo,
      descricao: data.descricao,
      corpo_texto: data.corpoTexto ?? null,
      storage_path: data.storagePath ?? null,
      duracao_segundos: data.duracaoSegundos,
      ordem: data.ordem,
      obrigatoria: data.obrigatoria,
      materiais: data.materiais,
      local_recomendado: data.localRecomendado,
      sensibilidades: data.sensibilidades,
      transcricao: data.transcricao,
      criterios_interrupcao: data.criteriosInterrupcao,
      permite_repetir: data.permiteRepetir,
    };

    if (data.id) {
      const { error } = await supabase.from("conteudos").update(linha).eq("id", data.id);
      if (error) throw erroSeguro(error);
      return { ok: true, id: data.id };
    }

    const { data: criada, error } = await supabase
      .from("conteudos")
      .insert(linha)
      .select("id")
      .single();
    if (error) throw erroSeguro(error);
    return { ok: true, id: criada.id };
  });

export const adminReordenarEtapas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        trilhaId: z.string().uuid(),
        ordens: z.array(z.object({ id: z.string().uuid(), ordem: z.number().int().min(0) })).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_conteudos", "adminReordenarEtapas", {
      tabela: "conteudos",
      rota: "/admin/trilhas",
    });

    for (const item of data.ordens) {
      const { error } = await supabase
        .from("conteudos")
        .update({ ordem: item.ordem })
        .eq("id", item.id)
        .eq("trilha_id", data.trilhaId);
      if (error) throw erroSeguro(error);
    }
    return { ok: true };
  });

export const adminApagarEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ etapaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_conteudos", "adminApagarEtapa", {
      tabela: "conteudos",
      rota: "/admin/trilhas",
    });
    const { error } = await supabase.from("conteudos").delete().eq("id", data.etapaId);
    if (error) throw erroSeguro(error);
    return { ok: true };
  });

export const adminListarClientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "ver_clientes", "adminListarClientes", {
      tabela: "clientes_acesso",
      rota: "/admin/clientes",
    });

    const [acessos, perfis, convites, atribuicoes, trilhas] = await Promise.all([
      supabase.from("clientes_acesso").select("user_id, terapeuta_id, telefone, observacoes, status"),
      supabase.from("profiles").select("id, nome, email, created_at").order("nome"),
      supabase
        .from("convites_clientes")
        .select("id, email, nome, telefone, status, token, expira_em, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("atribuicoes")
        .select(
          "id, trilha_id, cliente_id, objetivo, mensagem, frequencia, data_inicio, data_revisao, nivel, status, pode_sozinho, exige_acompanhamento, somente_em_sessao, observacoes, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("trilhas").select("id, nome, nivel, status, eixo_id"),
    ]);

    const perfilPorId = new Map((perfis.data ?? []).map((p) => [p.id, p]));
    const clientes = (acessos.data ?? []).map((a) => {
      const perfil = perfilPorId.get(a.user_id);
      return {
        id: a.user_id,
        nome: perfil?.nome ?? "",
        email: perfil?.email ?? "",
        telefone: a.telefone,
        observacoes: a.observacoes,
        status: a.status,
        desde: perfil?.created_at ?? null,
      };
    });

    return {
      clientes,
      convites: convites.data ?? [],
      atribuicoes: atribuicoes.data ?? [],
      trilhas: trilhas.data ?? [],
    };
  });

export const adminConvidarCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        nome: z.string().trim().max(160).default(""),
        telefone: z.string().trim().max(40).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "ver_clientes", "adminConvidarCliente", {
      tabela: "convites_clientes",
      rota: "/admin/clientes",
    });

    const { data: convite, error } = await supabase
      .from("convites_clientes")
      .insert({
        email: data.email.toLowerCase(),
        nome: data.nome,
        telefone: data.telefone,
        terapeuta_id: userId,
      })
      .select("id, token, email")
      .single();
    if (error) throw erroSeguro(error);

    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: "cliente_convidado",
      alvoTipo: "cliente",
      alvoId: convite.id,
      alvoEmail: convite.email,
      detalhes: {},
    });
    return { ok: true, token: convite.token };
  });

export const adminAtualizarCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        clienteId: z.string().uuid(),
        status: z.enum(["ativo", "pausado", "encerrado"]).optional(),
        telefone: z.string().trim().max(40).optional(),
        observacoes: z.string().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "ver_clientes", "adminAtualizarCliente", {
      clienteAlvo: data.clienteId,
      tabela: "clientes_acesso",
      rota: "/admin/clientes",
    });

    const { error } = await supabase.from("clientes_acesso").upsert(
      {
        user_id: data.clienteId,
        ...(data.status ? { status: data.status } : {}),
        ...(data.telefone === undefined ? {} : { telefone: data.telefone }),
        ...(data.observacoes === undefined ? {} : { observacoes: data.observacoes }),
      },
      { onConflict: "user_id" },
    );
    if (error) throw erroSeguro(error);

    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: "cliente_atualizado",
      alvoTipo: "cliente",
      alvoId: data.clienteId,
      detalhes: { status: data.status ?? null },
    });
    return { ok: true };
  });

export const adminAtribuirTrilha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        trilhaId: z.string().uuid(),
        clienteId: z.string().uuid(),
        objetivo: z.string().max(1000).default(""),
        mensagem: z.string().max(2000).default(""),
        frequencia: z.string().max(120).default(""),
        dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataRevisao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        nivel: z.enum(["leve", "intermediario", "profundo"]),
        podeSozinho: z.boolean().default(true),
        exigeAcompanhamento: z.boolean().default(false),
        somenteEmSessao: z.boolean().default(false),
        permiteRepetir: z.boolean().default(true),
        orientacoesEspeciais: z.string().max(2000).default(""),
        observacoes: z.string().max(2000).default(""),
        etapasObrigatorias: z.array(z.string().uuid()).max(200).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_liberacoes", "adminAtribuirTrilha", {
      clienteAlvo: data.clienteId,
      tabela: "atribuicoes",
      rota: "/admin/clientes",
    });

    const linha = {
      trilha_id: data.trilhaId,
      cliente_id: data.clienteId,
      terapeuta_id: userId,
      objetivo: data.objetivo,
      mensagem: data.mensagem,
      frequencia: data.frequencia,
      data_inicio: data.dataInicio,
      data_revisao: data.dataRevisao ?? null,
      nivel: data.nivel,
      pode_sozinho: data.podeSozinho,
      exige_acompanhamento: data.exigeAcompanhamento,
      somente_em_sessao: data.somenteEmSessao,
      permite_repetir: data.permiteRepetir,
      orientacoes_especiais: data.orientacoesEspeciais,
      observacoes: data.observacoes,
    };

    let atribuicaoId = data.id ?? null;
    if (atribuicaoId) {
      const { error } = await supabase.from("atribuicoes").update(linha).eq("id", atribuicaoId);
      if (error) throw erroSeguro(error);
    } else {
      const { data: criada, error } = await supabase
        .from("atribuicoes")
        .insert(linha)
        .select("id")
        .single();
      if (error) throw erroSeguro(error);
      atribuicaoId = criada.id;
    }

    const { data: etapas } = await supabase
      .from("conteudos")
      .select("id, ordem, obrigatoria")
      .eq("trilha_id", data.trilhaId)
      .order("ordem");

    if (etapas && etapas.length > 0) {
      const { error } = await supabase.from("atribuicao_etapas").upsert(
        etapas.map((e) => ({
          atribuicao_id: atribuicaoId as string,
          conteudo_id: e.id,
          ordem: e.ordem,
          obrigatoria:
            data.etapasObrigatorias.length > 0
              ? data.etapasObrigatorias.includes(e.id)
              : e.obrigatoria,
        })),
        { onConflict: "atribuicao_id,conteudo_id" },
      );
      if (error) throw erroSeguro(error);
    }

    const { data: trilha } = await supabase
      .from("trilhas")
      .select("nome")
      .eq("id", data.trilhaId)
      .maybeSingle();

    await supabase.from("notificacoes").insert({
      cliente_id: data.clienteId,
      titulo: "Nova trilha disponível",
      mensagem: `A trilha “${trilha?.nome ?? "sua nova trilha"}” já está no seu espaço.`,
    });

    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: data.id ? "atribuicao_atualizada" : "trilha_atribuida",
      alvoTipo: "atribuicao",
      alvoId: data.clienteId,
      detalhes: { trilha: trilha?.nome ?? "", nivel: data.nivel },
    });

    return { ok: true, id: atribuicaoId };
  });

export const adminDefinirStatusAtribuicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        atribuicaoId: z.string().uuid(),
        status: z.enum(["ativa", "pausada", "concluida", "encerrada"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(
      supabase,
      userId,
      "gerenciar_liberacoes",
      "adminDefinirStatusAtribuicao",
      { tabela: "atribuicoes", rota: "/admin/clientes" },
    );
    const { error } = await supabase
      .from("atribuicoes")
      .update({ status: data.status })
      .eq("id", data.atribuicaoId);
    if (error) throw erroSeguro(error);
    return { ok: true };
  });

export const adminAcompanhamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "ver_clientes", "adminAcompanhamento", {
      tabela: "checkins",
      rota: "/admin/acompanhamento",
    });

    const [checkins, apoio, perfis, revisoes, config] = await Promise.all([
      supabase
        .from("checkins")
        .select(
          "id, cliente_id, momento, emocao, intensidade, local_corpo, precisa_contato, intencao, aprendizado, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("solicitacoes_apoio")
        .select("id, cliente_id, mensagem, origem, intensidade, status, resposta, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("profiles").select("id, nome, email"),
      supabase
        .from("revisoes")
        .select("id, cliente_id, atribuicao_id, estado_atual, aprendizados, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("configuracoes_terapeuta")
        .select("terapeuta_id, prazo_resposta_horas, contatos_emergencia")
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      checkins: checkins.data ?? [],
      apoio: apoio.data ?? [],
      perfis: perfis.data ?? [],
      revisoes: revisoes.data ?? [],
      configuracoes: config.data,
    };
  });

export const adminResponderApoio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        solicitacaoId: z.string().uuid(),
        resposta: z.string().trim().min(1).max(4000),
        status: z.enum(["em_atendimento", "respondida", "encerrada"]).default("respondida"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "ver_clientes", "adminResponderApoio", {
      tabela: "solicitacoes_apoio",
      rota: "/admin/acompanhamento",
    });

    const { data: solicitacao, error } = await supabase
      .from("solicitacoes_apoio")
      .update({
        resposta: data.resposta,
        status: data.status,
        respondido_por: userId,
        respondido_em: new Date().toISOString(),
      })
      .eq("id", data.solicitacaoId)
      .select("cliente_id")
      .maybeSingle();
    if (error) throw erroSeguro(error);

    if (solicitacao?.cliente_id) {
      await supabase.from("notificacoes").insert({
        cliente_id: solicitacao.cliente_id,
        titulo: "Sua terapeuta respondeu",
        mensagem: "Há uma resposta ao seu pedido de apoio no seu espaço.",
      });
    }
    return { ok: true };
  });

export const adminSalvarConfiguracoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        prazoRespostaHoras: z.number().int().min(1).max(240),
        contatos: z
          .array(z.object({ nome: z.string().max(120), contato: z.string().max(120) }))
          .max(10)
          .default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("configuracoes_terapeuta").upsert(
      {
        terapeuta_id: userId,
        prazo_resposta_horas: data.prazoRespostaHoras,
        contatos_emergencia: data.contatos,
      },
      { onConflict: "terapeuta_id" },
    );
    if (error) throw erroSeguro(error);
    return { ok: true };
  });

/* ------------------------------------------------------------------ cliente */

export const getMinhaJornada = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [atribuicoes, progresso, checkins, apoio, config, consentimentos] = await Promise.all([
      supabase
        .from("atribuicoes")
        .select(
          "id, trilha_id, objetivo, mensagem, frequencia, data_inicio, data_revisao, nivel, status, pode_sozinho, exige_acompanhamento, somente_em_sessao, orientacoes_especiais, trilhas(id, nome, resumo, objetivo, nivel, alertas, orientacoes_pausa, eixo_id, eixos(nome))",
        )
        .eq("cliente_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("progresso")
        .select("conteudo_id, status, concluido_em, posicao_segundos")
        .eq("cliente_id", userId),
      supabase
        .from("checkins")
        .select("id, momento, emocao, intensidade, created_at, conteudo_id, atribuicao_id")
        .eq("cliente_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("solicitacoes_apoio")
        .select("id, mensagem, status, resposta, created_at, respondido_em")
        .eq("cliente_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("configuracoes_terapeuta")
        .select("prazo_resposta_horas, contatos_emergencia")
        .limit(1)
        .maybeSingle(),
      supabase.from("consentimentos").select("tipo, versao").eq("user_id", userId),
    ]);

    const trilhaIds = (atribuicoes.data ?? [])
      .map((a) => a.trilha_id)
      .filter((id): id is string => Boolean(id));

    const etapas = trilhaIds.length
      ? await supabase
          .from("conteudos")
          .select(
            "id, trilha_id, tipo, tipo_etapa, titulo, descricao, duracao_segundos, ordem, obrigatoria, materiais, local_recomendado, sensibilidades, criterios_interrupcao, permite_repetir, storage_path",
          )
          .in("trilha_id", trilhaIds)
          .order("ordem")
      : { data: [] as never[] };

    const statusPorConteudo = new Map(
      (progresso.data ?? []).map((p) => [p.conteudo_id, p.status as string]),
    );

    const trilhas = (atribuicoes.data ?? []).map((a) => {
      const minhasEtapas = (etapas.data ?? [])
        .filter((e) => e.trilha_id === a.trilha_id)
        .map((e) => ({
          id: e.id,
          tipo: e.tipo,
          tipoEtapa: e.tipo_etapa,
          titulo: e.titulo,
          descricao: e.descricao,
          duracaoSegundos: e.duracao_segundos,
          ordem: e.ordem,
          obrigatoria: e.obrigatoria,
          temMidia: Boolean(e.storage_path),
          status: statusPorConteudo.get(e.id) ?? "nao_iniciado",
        }));
      const concluidas = minhasEtapas.filter((e) => e.status === "concluido").length;
      const proxima = minhasEtapas.find((e) => e.status !== "concluido") ?? null;
      return {
        atribuicaoId: a.id,
        status: a.status,
        objetivo: a.objetivo,
        mensagem: a.mensagem,
        frequencia: a.frequencia,
        dataInicio: a.data_inicio,
        dataRevisao: a.data_revisao,
        nivel: a.nivel,
        podeSozinho: a.pode_sozinho,
        exigeAcompanhamento: a.exige_acompanhamento,
        somenteEmSessao: a.somente_em_sessao,
        orientacoesEspeciais: a.orientacoes_especiais,
        trilha: a.trilhas,
        etapas: minhasEtapas,
        total: minhasEtapas.length,
        concluidas,
        percentual: minhasEtapas.length
          ? Math.round((concluidas / minhasEtapas.length) * 100)
          : 0,
        proximaEtapaId: proxima?.id ?? null,
      };
    });

    return {
      trilhas,
      checkins: checkins.data ?? [],
      apoio: apoio.data ?? [],
      prazoRespostaHoras: config.data?.prazo_resposta_horas ?? 48,
      contatosEmergencia: (config.data?.contatos_emergencia ?? []) as {
        nome: string;
        contato: string;
      }[],
      consentimentos: (consentimentos.data ?? []).map((c) => c.tipo),
    };
  });

export const getMinhaEtapa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conteudoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: etapa, error } = await supabase
      .from("conteudos")
      .select(
        "id, trilha_id, eixo_id, tipo, tipo_etapa, titulo, descricao, corpo_texto, duracao_segundos, ordem, obrigatoria, materiais, local_recomendado, sensibilidades, transcricao, criterios_interrupcao, permite_repetir, storage_path, trilhas(id, nome, objetivo, alertas, orientacoes_pausa)",
      )
      .eq("id", data.conteudoId)
      .maybeSingle();
    if (error) throw erroSeguro(error);
    if (!etapa) return { etapa: null, atribuicao: null, status: "nao_iniciado" as const, proximaId: null, anteriorId: null };

    const [atribuicao, prog, irmas] = await Promise.all([
      supabase
        .from("atribuicoes")
        .select("id, objetivo, mensagem, status, nivel, exige_acompanhamento, somente_em_sessao")
        .eq("cliente_id", userId)
        .eq("trilha_id", etapa.trilha_id ?? "")
        .maybeSingle(),
      supabase
        .from("progresso")
        .select("status")
        .eq("cliente_id", userId)
        .eq("conteudo_id", data.conteudoId)
        .maybeSingle(),
      supabase
        .from("conteudos")
        .select("id, ordem, titulo")
        .eq("trilha_id", etapa.trilha_id ?? "")
        .order("ordem"),
    ]);

    const lista = irmas.data ?? [];
    const indice = lista.findIndex((c) => c.id === etapa.id);
    return {
      etapa,
      atribuicao: atribuicao.data,
      status: prog.data?.status ?? ("nao_iniciado" as const),
      proximaId: indice >= 0 ? (lista[indice + 1]?.id ?? null) : null,
      anteriorId: indice > 0 ? (lista[indice - 1]?.id ?? null) : null,
      totalEtapas: lista.length,
      posicaoEtapa: indice + 1,
    };
  });

export const registrarCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        atribuicaoId: z.string().uuid().nullable().optional(),
        conteudoId: z.string().uuid().nullable().optional(),
        momento: z.enum(["inicial", "final"]),
        emocao: z.string().max(80).default(""),
        intensidade: z.number().int().min(0).max(10),
        localCorpo: z.string().max(80).default(""),
        condicoesContinuar: z.boolean().default(true),
        intencao: z.string().max(1000).default(""),
        clareza: z.number().int().min(0).max(10).nullable().optional(),
        presenca: z.boolean().nullable().optional(),
        precisaContato: z.boolean().default(false),
        aprendizado: z.string().max(2000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("checkins").insert({
      cliente_id: userId,
      atribuicao_id: data.atribuicaoId ?? null,
      conteudo_id: data.conteudoId ?? null,
      momento: data.momento,
      emocao: data.emocao,
      intensidade: data.intensidade,
      local_corpo: data.localCorpo,
      condicoes_continuar: data.condicoesContinuar,
      intencao: data.intencao,
      clareza: data.clareza ?? null,
      presenca: data.presenca ?? null,
      precisa_contato: data.precisaContato,
      aprendizado: data.aprendizado,
    });
    if (error) throw erroSeguro(error);
    return { ok: true, intensidadeAlta: data.intensidade >= 8 };
  });

export const pedirApoio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        mensagem: z.string().trim().min(1).max(4000),
        atribuicaoId: z.string().uuid().nullable().optional(),
        origem: z.string().max(60).default("botao_apoio"),
        intensidade: z.number().int().min(0).max(10).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("solicitacoes_apoio").insert({
      cliente_id: userId,
      atribuicao_id: data.atribuicaoId ?? null,
      mensagem: data.mensagem,
      origem: data.origem,
      intensidade: data.intensidade ?? null,
    });
    if (error) throw erroSeguro(error);
    return { ok: true };
  });

export const salvarRegistroDiario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        texto: z.string().trim().min(1).max(8000),
        conteudoId: z.string().uuid().nullable().optional(),
        atribuicaoId: z.string().uuid().nullable().optional(),
        visibilidade: z.enum(["somente_eu", "compartilhado"]).default("somente_eu"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("diario").insert({
      cliente_id: userId,
      conteudo_id: data.conteudoId ?? null,
      atribuicao_id: data.atribuicaoId ?? null,
      texto: data.texto,
      visibilidade: data.visibilidade,
      compartilhado_em: data.visibilidade === "compartilhado" ? new Date().toISOString() : null,
    });
    if (error) throw erroSeguro(error);
    return { ok: true };
  });

export const definirVisibilidadeDiario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        registroId: z.string().uuid(),
        visibilidade: z.enum(["somente_eu", "compartilhado"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const agora = new Date().toISOString();
    const { error } = await supabase
      .from("diario")
      .update(
        data.visibilidade === "compartilhado"
          ? { visibilidade: "compartilhado", compartilhado_em: agora }
          : { visibilidade: "somente_eu", compartilhamento_revogado_em: agora },
      )
      .eq("id", data.registroId)
      .eq("cliente_id", userId);
    if (error) throw erroSeguro(error);
    return { ok: true };
  });

export const registrarConsentimentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        tipos: z.array(z.enum(["termos", "privacidade", "acompanhamento"])).min(1),
        versao: z.string().max(10).default("1"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("consentimentos").upsert(
      data.tipos.map((tipo) => ({ user_id: userId, tipo, versao: data.versao })),
      { onConflict: "user_id,tipo,versao" },
    );
    if (error) throw erroSeguro(error);
    return { ok: true };
  });

export const salvarRevisao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        atribuicaoId: z.string().uuid(),
        estadoInicial: z.string().max(2000).default(""),
        estadoAtual: z.string().max(2000).default(""),
        clareza: z.number().int().min(0).max(10).nullable().optional(),
        autonomia: z.number().int().min(0).max(10).nullable().optional(),
        acoes: z.string().max(2000).default(""),
        aprendizados: z.string().max(2000).default(""),
        precisaAcompanhamento: z.string().max(1000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("revisoes").insert({
      atribuicao_id: data.atribuicaoId,
      cliente_id: userId,
      estado_inicial: data.estadoInicial,
      estado_atual: data.estadoAtual,
      clareza: data.clareza ?? null,
      autonomia: data.autonomia ?? null,
      acoes: data.acoes,
      aprendizados: data.aprendizados,
      precisa_acompanhamento: data.precisaAcompanhamento,
    });
    if (error) throw erroSeguro(error);
    return { ok: true };
  });
