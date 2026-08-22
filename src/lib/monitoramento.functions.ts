import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { erroSeguro } from "./erro-permissao";
import { garantirPermissao } from "./permissao-guard";
import { atorAuditoria, registrarAuditoria } from "./auditoria-equipe";
import type { LinhaMonitoramento } from "./monitoramento";
import type { StatusAtribuicao } from "./etapas";

const ROTA = "/admin/monitoramento";

function maiorData(...valores: (string | null | undefined)[]): string | null {
  let melhor: string | null = null;
  for (const v of valores) {
    if (!v) continue;
    if (!melhor || Date.parse(v) > Date.parse(melhor)) melhor = v;
  }
  return melhor;
}

/** Indicadores e listagem dos planos que já foram liberados ao cliente. */
export const adminMonitoramentoResumo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "ver_clientes", "adminMonitoramentoResumo", {
      tabela: "atribuicoes",
      rota: ROTA,
    });

    const { data: planos, error } = await supabase
      .from("atribuicoes")
      .select(
        "id, cliente_id, terapeuta_id, trilha_id, objetivo, status, data_inicio, data_revisao, liberar_em, updated_at, trilhas(id, nome)",
      )
      .neq("status", "rascunho")
      .order("updated_at", { ascending: false });
    if (error) throw erroSeguro(error);

    const ids = (planos ?? []).map((p) => p.id);
    const clientes = Array.from(new Set((planos ?? []).map((p) => p.cliente_id)));
    const pessoas = new Set<string>(clientes);
    for (const p of planos ?? []) if (p.terapeuta_id) pessoas.add(p.terapeuta_id);

    const vazio = { data: [] as never[] };

    const [etapas, conteudos, checkins, revisoes, apoio, perfis] = await Promise.all([
      ids.length
        ? supabase
            .from("atribuicao_etapas")
            .select(
              "id, atribuicao_id, conteudo_id, ordem, visivel, concluida_em, titulo_personalizado",
            )
            .in("atribuicao_id", ids)
            .order("ordem")
        : Promise.resolve(vazio),
      supabase.from("conteudos").select("id, titulo").not("trilha_id", "is", null),
      ids.length
        ? supabase
            .from("checkins")
            .select("id, atribuicao_id, created_at")
            .in("atribuicao_id", ids)
            .order("created_at", { ascending: false })
            .limit(1000)
        : Promise.resolve(vazio),
      ids.length
        ? supabase
            .from("revisoes")
            .select("id, atribuicao_id, devolutiva, created_at")
            .in("atribuicao_id", ids)
            .order("created_at", { ascending: false })
        : Promise.resolve(vazio),
      clientes.length
        ? supabase
            .from("solicitacoes_apoio")
            .select("id, cliente_id, atribuicao_id, status")
            .in("cliente_id", clientes)
            .in("status", ["aberta", "em_atendimento"])
        : Promise.resolve(vazio),
      pessoas.size
        ? supabase
            .from("profiles")
            .select("id, nome, email")
            .in("id", Array.from(pessoas))
        : Promise.resolve(vazio),
    ]);

    const tituloConteudo = new Map(
      (conteudos.data ?? []).map((c) => [c.id, c.titulo as string] as const),
    );
    const nomeDe = (id: string | null) => {
      if (!id) return "—";
      const p = (perfis.data ?? []).find((x) => x.id === id);
      return p?.nome || p?.email || "—";
    };
    const emailDe = (id: string) =>
      (perfis.data ?? []).find((x) => x.id === id)?.email ?? "";

    const linhas: LinhaMonitoramento[] = (planos ?? []).map((p) => {
      const doPlano = (etapas.data ?? []).filter((e) => e.atribuicao_id === p.id);
      const visiveis = doPlano.filter((e) => e.visivel);
      const concluidas = visiveis.filter((e) => e.concluida_em);
      const ultima = [...concluidas].sort(
        (a, b) => Date.parse(b.concluida_em!) - Date.parse(a.concluida_em!),
      )[0];
      const revisoesDoPlano = (revisoes.data ?? []).filter((r) => r.atribuicao_id === p.id);
      const ultimoCheckin = (checkins.data ?? []).find((c) => c.atribuicao_id === p.id);

      return {
        atribuicaoId: p.id,
        clienteId: p.cliente_id,
        cliente: nomeDe(p.cliente_id),
        email: emailDe(p.cliente_id),
        trilhaId: p.trilha_id,
        trilha: p.trilhas?.nome ?? "Trilha",
        terapeutaId: p.terapeuta_id,
        terapeuta: nomeDe(p.terapeuta_id),
        status: p.status as StatusAtribuicao,
        objetivo: p.objetivo ?? "",
        data_inicio: p.data_inicio,
        data_revisao: p.data_revisao,
        liberar_em: p.liberar_em,
        totalEtapas: visiveis.length,
        concluidas: concluidas.length,
        ultimaEtapa: ultima
          ? ultima.titulo_personalizado ||
            (ultima.conteudo_id ? tituloConteudo.get(ultima.conteudo_id) ?? null : null)
          : null,
        ultimaAtividade: maiorData(
          ultima?.concluida_em,
          ultimoCheckin?.created_at,
          revisoesDoPlano[0]?.created_at,
        ),
        concluidoEm: p.status === "concluido" ? p.updated_at : null,
        apoioAberto: (apoio.data ?? []).filter(
          (s) => s.cliente_id === p.cliente_id && (!s.atribuicao_id || s.atribuicao_id === p.id),
        ).length,
        revisaoSemDevolutiva: revisoesDoPlano.some((r) => !(r.devolutiva ?? "").trim()),
      };
    });

    const terapeutas = Array.from(
      new Map(
        linhas
          .filter((l) => l.terapeutaId)
          .map((l) => [l.terapeutaId as string, l.terapeuta] as const),
      ),
    ).map(([id, nome]) => ({ id, nome }));

    const trilhas = Array.from(
      new Map(linhas.map((l) => [l.trilhaId, l.trilha] as const)),
    ).map(([id, nome]) => ({ id, nome }));

    return { linhas, terapeutas, trilhas };
  });

/** Tudo o que a terapeuta precisa ver sobre um plano em curso. */
export const adminMonitoramentoPlano = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ atribuicaoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "ver_clientes", "adminMonitoramentoPlano", {
      tabela: "atribuicoes",
      rota: ROTA,
    });

    const { data: plano, error } = await supabase
      .from("atribuicoes")
      .select(
        "id, cliente_id, terapeuta_id, trilha_id, objetivo, motivo_indicacao, mensagem, audio_path, orientacoes_especiais, frequencia, data_inicio, data_revisao, liberar_em, liberada_em, lembretes_ativos, nivel, pode_sozinho, exige_acompanhamento, somente_em_sessao, permite_repetir, observacoes, status, created_at, updated_at, trilhas(id, nome, resumo, objetivo, nivel, orientacoes_pausa)",
      )
      .eq("id", data.atribuicaoId)
      .maybeSingle();
    if (error) throw erroSeguro(error);
    if (!plano) throw new Error("Plano não encontrado");

    const podeVerDiario = await supabase.rpc("pode", { _permissao: "ver_registros" });

    const [etapas, conteudos, checkins, revisoes, apoio, perfis, diario] = await Promise.all([
      supabase
        .from("atribuicao_etapas")
        .select(
          "id, conteudo_id, ordem, obrigatoria, visivel, permite_repetir, prazo_dias, titulo_personalizado, descricao_personalizada, concluida_em",
        )
        .eq("atribuicao_id", data.atribuicaoId)
        .order("ordem"),
      supabase
        .from("conteudos")
        .select("id, titulo, descricao, tipo, tipo_etapa, duracao_segundos")
        .eq("trilha_id", plano.trilha_id),
      supabase
        .from("checkins")
        .select(
          "id, conteudo_id, momento, emocao, intensidade, local_corpo, intencao, clareza, presenca, precisa_contato, aprendizado, created_at",
        )
        .eq("atribuicao_id", data.atribuicaoId)
        .order("created_at", { ascending: false }),
      supabase
        .from("revisoes")
        .select(
          "id, estado_inicial, estado_atual, clareza, autonomia, acoes, aprendizados, precisa_acompanhamento, devolutiva, created_at",
        )
        .eq("atribuicao_id", data.atribuicaoId)
        .order("created_at", { ascending: false }),
      supabase
        .from("solicitacoes_apoio")
        .select("id, mensagem, origem, intensidade, status, resposta, respondido_em, created_at")
        .eq("cliente_id", plano.cliente_id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", [plano.cliente_id, plano.terapeuta_id].filter(Boolean) as string[]),
      podeVerDiario.data
        ? supabase
            .from("diario")
            .select("id, texto, conteudo_id, created_at, compartilhado_em")
            .eq("cliente_id", plano.cliente_id)
            .eq("visibilidade", "compartilhado")
            .is("compartilhamento_revogado_em", null)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    return {
      plano,
      etapas: etapas.data ?? [],
      conteudos: conteudos.data ?? [],
      checkins: checkins.data ?? [],
      revisoes: revisoes.data ?? [],
      apoio: apoio.data ?? [],
      perfis: perfis.data ?? [],
      registrosCompartilhados: diario.data ?? [],
      podeVerDiario: Boolean(podeVerDiario.data),
    };
  });

async function permitirAcao(
  supabase: Parameters<typeof garantirPermissao>[0],
  userId: string,
  acao: string,
) {
  await garantirPermissao(supabase, userId, "criar_planos", acao, {
    tabela: "atribuicoes",
    rota: ROTA,
  });
}

/** Nova orientação (texto e/ou áudio) para o plano em curso. */
export const adminEnviarOrientacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        atribuicaoId: z.string().uuid(),
        mensagem: z.string().trim().max(4000).default(""),
        audioPath: z.string().trim().max(500).nullable().default(null),
        avisarCliente: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await permitirAcao(supabase, userId, "adminEnviarOrientacao");

    const { data: atualizado, error } = await supabase
      .from("atribuicoes")
      .update({ mensagem: data.mensagem, audio_path: data.audioPath })
      .eq("id", data.atribuicaoId)
      .select("cliente_id")
      .maybeSingle();
    if (error) throw erroSeguro(error);

    if (data.avisarCliente && atualizado?.cliente_id) {
      await supabase.from("notificacoes").insert({
        cliente_id: atualizado.cliente_id,
        titulo: "Nova orientação no seu plano",
        mensagem: "Sua terapeuta deixou uma orientação para esta trilha.",
      });
    }

    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: "orientacao_enviada",
      alvoTipo: "atribuicao",
      alvoId: data.atribuicaoId,
      detalhes: { com_audio: Boolean(data.audioPath) },
    });
    return { ok: true };
  });

/** Ajusta a data da próxima revisão. */
export const adminAlterarPrazoRevisao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        atribuicaoId: z.string().uuid(),
        dataRevisao: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await permitirAcao(supabase, userId, "adminAlterarPrazoRevisao");

    const { error } = await supabase
      .from("atribuicoes")
      .update({ data_revisao: data.dataRevisao })
      .eq("id", data.atribuicaoId);
    if (error) throw erroSeguro(error);

    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: "prazo_revisao_alterado",
      alvoTipo: "atribuicao",
      alvoId: data.atribuicaoId,
      detalhes: { data_revisao: data.dataRevisao },
    });
    return { ok: true };
  });

/** Torna visível a próxima etapa ainda oculta do plano. */
export const adminLiberarProximaEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        atribuicaoId: z.string().uuid(),
        etapaId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await permitirAcao(supabase, userId, "adminLiberarProximaEtapa");

    let etapaId = data.etapaId;
    if (!etapaId) {
      const { data: ocultas, error } = await supabase
        .from("atribuicao_etapas")
        .select("id, ordem")
        .eq("atribuicao_id", data.atribuicaoId)
        .eq("visivel", false)
        .order("ordem")
        .limit(1);
      if (error) throw erroSeguro(error);
      etapaId = ocultas?.[0]?.id;
    }
    if (!etapaId) return { ok: false as const, motivo: "sem_etapa_oculta" as const };

    const { error: erroUpdate } = await supabase
      .from("atribuicao_etapas")
      .update({ visivel: true })
      .eq("id", etapaId)
      .eq("atribuicao_id", data.atribuicaoId);
    if (erroUpdate) throw erroSeguro(erroUpdate);

    const { data: plano } = await supabase
      .from("atribuicoes")
      .select("cliente_id")
      .eq("id", data.atribuicaoId)
      .maybeSingle();
    if (plano?.cliente_id) {
      await supabase.from("notificacoes").insert({
        cliente_id: plano.cliente_id,
        titulo: "Uma nova etapa está disponível",
        mensagem: "Sua terapeuta liberou a próxima etapa da sua trilha.",
      });
    }

    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: "etapa_liberada",
      alvoTipo: "atribuicao",
      alvoId: data.atribuicaoId,
      detalhes: { etapa_id: etapaId },
    });
    return { ok: true as const, etapaId };
  });

/** Registra a devolutiva da terapeuta e move o plano de status. */
export const adminMarcarRevisao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        atribuicaoId: z.string().uuid(),
        devolutiva: z.string().trim().max(4000).default(""),
        proximaRevisao: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .default(null),
        status: z
          .enum(["em_andamento", "aguardando_revisao", "pausado", "concluido", "encerrado"])
          .default("em_andamento"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await permitirAcao(supabase, userId, "adminMarcarRevisao");

    const { data: plano, error } = await supabase
      .from("atribuicoes")
      .select("cliente_id")
      .eq("id", data.atribuicaoId)
      .maybeSingle();
    if (error) throw erroSeguro(error);
    if (!plano) throw new Error("Plano não encontrado");

    const { data: existente } = await supabase
      .from("revisoes")
      .select("id, devolutiva")
      .eq("atribuicao_id", data.atribuicaoId)
      .order("created_at", { ascending: false })
      .limit(1);

    const alvo = existente?.[0];
    if (alvo && !(alvo.devolutiva ?? "").trim()) {
      const { error: erroUpdate } = await supabase
        .from("revisoes")
        .update({ devolutiva: data.devolutiva })
        .eq("id", alvo.id);
      if (erroUpdate) throw erroSeguro(erroUpdate);
    } else {
      const { error: erroInsert } = await supabase.from("revisoes").insert({
        atribuicao_id: data.atribuicaoId,
        cliente_id: plano.cliente_id,
        devolutiva: data.devolutiva,
      });
      if (erroInsert) throw erroSeguro(erroInsert);
    }

    const { error: erroPlano } = await supabase
      .from("atribuicoes")
      .update({ status: data.status, data_revisao: data.proximaRevisao })
      .eq("id", data.atribuicaoId);
    if (erroPlano) throw erroSeguro(erroPlano);

    if (data.devolutiva.trim()) {
      await supabase.from("notificacoes").insert({
        cliente_id: plano.cliente_id,
        titulo: "Devolutiva da sua terapeuta",
        mensagem: "Há uma devolutiva sobre a sua trilha no seu espaço.",
      });
    }

    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: "revisao_marcada",
      alvoTipo: "atribuicao",
      alvoId: data.atribuicaoId,
      detalhes: { status: data.status, proxima_revisao: data.proximaRevisao },
    });
    return { ok: true };
  });
