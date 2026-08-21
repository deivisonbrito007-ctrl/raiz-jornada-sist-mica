import { createServerFn } from "@tanstack/react-start";
import { erroSeguro } from "./erro-permissao";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { auditarResultado, negarAcesso, registrarAcessoNegado } from "./auditoria-acesso";
import { atorAuditoria, registrarAuditoria } from "./auditoria-equipe";
import { garantirConteudoLiberado } from "./liberacao-guard";
import { garantirPermissao, temPermissao } from "./permissao-guard";
import { normalizarModo } from "./modo-uso";

export const getMeuContexto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [perfil, papeis, pacotes, permissoes, acesso] = await Promise.all([
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
      supabase.from("equipe_permissoes").select("permissao").eq("user_id", userId),
      supabase
        .from("clientes_acesso")
        .select("modo, modo_desde, terapeuta_id, status")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const roles = (papeis.data ?? []).map((r) => r.role);
    const ehTerapeuta = roles.includes("terapeuta");
    const minhasPermissoes = (permissoes.data ?? []).map((p) => p.permissao);
    return {
      perfil: perfil.data,
      papel: ehTerapeuta ? ("terapeuta" as const) : ("cliente" as const),
      permissoes: minhasPermissoes,
      podeAdministrar: ehTerapeuta || minhasPermissoes.length > 0,
      pacotes: pacotes.data ?? [],
      modo: normalizarModo(acesso.data?.modo),
      modoDesde: acesso.data?.modo_desde ?? null,
      temTerapeuta: Boolean(acesso.data?.terapeuta_id),
      acessoStatus: acesso.data?.status ?? null,
    };
  });



export const getMinhaBiblioteca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [eixos, conteudos, liberacoes, progresso] = await Promise.all([
      supabase.from("eixos").select("id, nome, descricao, icone, ordem").order("ordem"),
      supabase
        .from("conteudos")
        .select("id, eixo_id, tipo, titulo, duracao_segundos, ordem")
        .order("ordem"),
      supabase
        .from("liberacoes")
        .select("eixo_id, conteudo_id, status, liberar_em")
        .eq("cliente_id", userId),
      supabase
        .from("progresso")
        .select("conteudo_id, status, concluido_em, posicao_segundos, posicao_atualizada_em")
        .eq("cliente_id", userId),
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
      const agora = Date.now();
      const doEixoLibs = libs.filter(
        (l) =>
          l.status === "liberado" &&
          ((l.eixo_id === eixo.id && l.conteudo_id === null) ||
            doEixo.some((c) => c.id === l.conteudo_id)),
      );
      const liberado = doEixoLibs.some(
        (l) => !l.liberar_em || new Date(l.liberar_em).getTime() <= agora,
      );
      const abreEm = liberado
        ? null
        : (doEixoLibs
            .map((l) => l.liberar_em)
            .filter((d): d is string => Boolean(d))
            .sort()[0] ?? null);
      return {
        ...eixo,
        liberado,
        abreEm,
        total: doEixo.length,
        concluidos: doEixo.filter((c) => feitos.has(c.id)).length,
        datasConclusao: doEixo
          .map((c) => conclusaoPorConteudo.get(c.id))
          .filter((d): d is string => Boolean(d)),
      };
    });

    const statusPorConteudo = new Map<string, string>();
    for (const p of progresso.data ?? []) statusPorConteudo.set(p.conteudo_id, p.status);

    const praticas = eixosResult
      .filter((e) => e.liberado)
      .flatMap((eixo) =>
        (conteudos.data ?? [])
          .filter((c) => c.eixo_id === eixo.id)
          .map((c) => ({
            id: c.id,
            eixoId: eixo.id,
            eixoNome: eixo.nome,
            tipo: c.tipo,
            titulo: c.titulo,
            duracaoSegundos: c.duracao_segundos,
            status: statusPorConteudo.get(c.id) ?? "nao_iniciado",
          })),
      );

    const totalLiberado = eixosResult.filter((e) => e.liberado);
    const totalItens = totalLiberado.reduce((acc, e) => acc + e.total, 0);
    const totalConcluidos = totalLiberado.reduce((acc, e) => acc + e.concluidos, 0);

    // Última prática deixada no meio (com ponto salvo) que ainda está liberada:
    // alimenta o botão "Continuar de onde parei" na trilha.
    const idsLiberados = new Set(praticas.map((p) => p.id));
    const retomar =
      (progresso.data ?? [])
        .filter(
          (p) =>
            p.status !== "concluido" &&
            (p.posicao_segundos ?? 0) > 0 &&
            idsLiberados.has(p.conteudo_id),
        )
        .sort((a, b) =>
          String(b.posicao_atualizada_em ?? "").localeCompare(String(a.posicao_atualizada_em ?? "")),
        )
        .map((p) => {
          const pratica = praticas.find((x) => x.id === p.conteudo_id)!;
          return {
            id: pratica.id,
            eixoId: pratica.eixoId,
            eixoNome: pratica.eixoNome,
            tipo: pratica.tipo,
            titulo: pratica.titulo,
            duracaoSegundos: pratica.duracaoSegundos,
            posicaoSegundos: p.posicao_segundos ?? 0,
            atualizadoEm: p.posicao_atualizada_em,
          };
        })[0] ?? null;

    return {
      eixos: eixosResult,
      praticas,
      retomar,
      resumo: {
        totalItens,
        totalConcluidos,
        percentual: totalItens === 0 ? 0 : Math.round((totalConcluidos / totalItens) * 100),
        emAndamento: totalLiberado.filter((e) => e.concluidos > 0 && e.concluidos < e.total).length,
        datasConclusao: (progresso.data ?? [])
          .filter((p) => p.concluido_em)
          .map((p) => p.concluido_em as string),
        conclusoes: (progresso.data ?? [])
          .filter((p) => p.status === "concluido" && p.concluido_em)
          .map((p) => {
            const conteudo = (conteudos.data ?? []).find((c) => c.id === p.conteudo_id);
            const eixo = (eixos.data ?? []).find((e) => e.id === conteudo?.eixo_id);
            return {
              titulo: conteudo?.titulo ?? "Prática",
              eixoNome: eixo?.nome ?? "",
              tipo: conteudo?.tipo ?? "",
              duracaoSegundos: conteudo?.duracao_segundos ?? 0,
              concluidoEm: p.concluido_em as string,
            };
          }),
      },
    };
  });

/**
 * Histórico da pessoa, trilha por trilha: o que está liberado, o que ela
 * concluiu (com data) e as reflexões do diário ligadas a cada prática.
 *
 * A RLS já limita `conteudos` ao que está liberado para quem pede (função
 * `conteudo_liberado`, que também respeita liberações agendadas), então aqui
 * basta agrupar e cruzar com progresso e diário do próprio usuário.
 */
export const getMeuHistorico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [eixos, conteudos, progresso, diario] = await Promise.all([
      supabase.from("eixos").select("id, nome, descricao, icone, ordem").order("ordem"),
      supabase
        .from("conteudos")
        .select("id, eixo_id, tipo, titulo, duracao_segundos, ordem")
        .order("ordem"),
      supabase
        .from("progresso")
        .select("conteudo_id, status, concluido_em, updated_at")
        .eq("cliente_id", userId),
      supabase
        .from("diario")
        .select("id, texto, created_at, conteudo_id")
        .eq("cliente_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    const progressoPorConteudo = new Map(
      (progresso.data ?? []).map((p) => [p.conteudo_id, p]),
    );
    const reflexoesPorConteudo = new Map<string, { id: string; texto: string; criadoEm: string }[]>();
    const reflexoesGerais: { id: string; texto: string; criadoEm: string }[] = [];
    for (const entrada of diario.data ?? []) {
      const item = { id: entrada.id, texto: entrada.texto, criadoEm: entrada.created_at };
      if (!entrada.conteudo_id) {
        reflexoesGerais.push(item);
        continue;
      }
      const lista = reflexoesPorConteudo.get(entrada.conteudo_id) ?? [];
      lista.push(item);
      reflexoesPorConteudo.set(entrada.conteudo_id, lista);
    }

    const trilhas = (eixos.data ?? [])
      .map((eixo) => {
        const praticas = (conteudos.data ?? [])
          .filter((c) => c.eixo_id === eixo.id)
          .map((c) => {
            const p = progressoPorConteudo.get(c.id);
            return {
              id: c.id,
              tipo: c.tipo,
              titulo: c.titulo,
              duracaoSegundos: c.duracao_segundos,
              status: p?.status ?? ("nao_iniciado" as const),
              concluidoEm: p?.status === "concluido" ? (p.concluido_em ?? null) : null,
              atualizadoEm: p?.updated_at ?? null,
              reflexoes: reflexoesPorConteudo.get(c.id) ?? [],
            };
          });
        return {
          id: eixo.id,
          nome: eixo.nome,
          descricao: eixo.descricao,
          icone: eixo.icone,
          total: praticas.length,
          concluidos: praticas.filter((p) => p.status === "concluido").length,
          praticas,
        };
      })
      .filter((t) => t.total > 0);

    const totalItens = trilhas.reduce((soma, t) => soma + t.total, 0);
    const totalConcluidos = trilhas.reduce((soma, t) => soma + t.concluidos, 0);
    const datasConclusao = trilhas
      .flatMap((t) => t.praticas.map((p) => p.concluidoEm))
      .filter((d): d is string => Boolean(d))
      .sort();

    return {
      trilhas,
      reflexoesGerais,
      resumo: {
        totalItens,
        totalConcluidos,
        percentual: totalItens === 0 ? 0 : Math.round((totalConcluidos / totalItens) * 100),
        totalReflexoes: (diario.data ?? []).length,
        ultimaConclusao: datasConclusao.at(-1) ?? null,
      },
    };
  });


export const getEixoTrilha = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ eixoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [eixo, conteudos, progresso] = await Promise.all([
      supabase
        .from("eixos")
        .select("id, nome, descricao, icone")
        .eq("id", data.eixoId)
        .maybeSingle(),
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
      .select(
        "id, eixo_id, tipo, titulo, descricao, corpo_texto, storage_path, duracao_segundos, eixos(nome)",
      )
      .eq("id", data.conteudoId)
      .maybeSingle();

    if (error) {
      registrarAcessoNegado(
        { acao: "getConteudo", userId, tabela: "conteudos", recurso: data.conteudoId },
        error,
      );
      throw erroSeguro(error);
    }
    if (!conteudo)
      return {
        conteudo: null,
        url: null,
        urlExpiraEm: null,
        status: "nao_iniciado" as const,
        limitado: false,
        esperarSegundos: 0,
      };

    let url: string | null = null;
    let urlExpiraEm: string | null = null;
    let limitado = false;
    let esperarSegundos = 0;
    const VALIDADE_SEGUNDOS = 60 * 60;
    if (conteudo.storage_path) {
      // Proteção contra abuso: no máximo 5 links assinados por minuto por pessoa.
      const { consumirLimite } = await import("./limite-uso.server");
      const limite = await consumirLimite(userId, "midia:url-assinada");
      if (!limite.permitido) {
        limitado = true;
        esperarSegundos = limite.esperarSegundos;
        registrarAcessoNegado({
          acao: "getConteudo:limiteExcedido",
          userId,
          tabela: "storage.midias",
          recurso: data.conteudoId,
        });
        const { persistirAcessoNegado } = await import("./auditoria-negados.server");
        void persistirAcessoNegado({
          acao: "getConteudo:limiteExcedido",
          userId,
          tipo: "limite",
          alvoId: data.conteudoId,
          rota: "/app/conteudo/$conteudoId",
          detalhes: { usados: limite.usados, limite: limite.limite, esperarSegundos },
        });
      } else {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const signed = auditarResultado(
          await supabaseAdmin.storage
            .from("midias")
            .createSignedUrl(conteudo.storage_path, VALIDADE_SEGUNDOS),
          {
            acao: "getConteudo:signedUrl",
            userId,
            tabela: "storage.midias",
            recurso: conteudo.storage_path,
          },
        );
        url = signed.data?.signedUrl ?? null;
        if (url) urlExpiraEm = new Date(Date.now() + VALIDADE_SEGUNDOS * 1000).toISOString();
      }
    }


    const { data: prog } = await supabase
      .from("progresso")
      .select("status, posicao_segundos, estava_tocando, posicao_atualizada_em")
      .eq("cliente_id", userId)
      .eq("conteudo_id", data.conteudoId)
      .maybeSingle();

    return {
      conteudo,
      url,
      urlExpiraEm,
      status: prog?.status ?? ("nao_iniciado" as const),
      posicaoSegundos: prog?.posicao_segundos ?? 0,
      estavaTocando: prog?.estava_tocando ?? false,
      posicaoAtualizadaEm: prog?.posicao_atualizada_em ?? null,
      limitado,
      esperarSegundos,
    };


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
    await garantirConteudoLiberado(supabase, userId, data.conteudoId, "marcarProgresso");
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
    if (error) throw erroSeguro(error);
    return { ok: true };
  });

/**
 * Guarda no backend o ponto exato da reprodução (e se estava tocando), para a
 * pessoa retomar de onde parou mesmo depois de fechar o app ou recarregar.
 */
export const salvarPosicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        conteudoId: z.string().uuid(),
        posicaoSegundos: z.number().finite().min(0).max(60 * 60 * 12),
        tocando: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirConteudoLiberado(supabase, userId, data.conteudoId, "salvarPosicao");

    const { data: atual } = await supabase
      .from("progresso")
      .select("status")
      .eq("cliente_id", userId)
      .eq("conteudo_id", data.conteudoId)
      .maybeSingle();

    const { error } = await supabase.from("progresso").upsert(
      {
        cliente_id: userId,
        conteudo_id: data.conteudoId,
        // nunca rebaixa uma prática já concluída ao salvar a posição
        status: atual?.status === "concluido" ? "concluido" : "em_andamento",
        posicao_segundos: Math.floor(data.posicaoSegundos),
        estava_tocando: data.tocando ?? false,
        posicao_atualizada_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cliente_id,conteudo_id" },
    );
    if (error) throw erroSeguro(error);
    return { ok: true, posicaoSegundos: Math.floor(data.posicaoSegundos) };
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
    if (error) throw erroSeguro(error);
    return { ok: true, meta: data.meta };
  });

export const salvarDiario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        texto: z.string().min(1).max(8000),
        conteudoId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("diario").insert({
      cliente_id: userId,
      conteudo_id: data.conteudoId ?? null,
      texto: data.texto,
    });
    if (error) throw erroSeguro(error);
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
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("cliente_id", userId)
      .eq("lida", false);
    return { ok: true };
  });

/* ---------- Painel do terapeuta ---------- */

export const adminResumo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "ver_clientes", "adminResumo", {
      tabela: "user_roles",
    });

    const [papeis, perfis, conteudos, liberacoes, progresso, pacotes, vinculos, eixos] =
      await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("id, nome, email, created_at").order("created_at"),
        supabase.from("conteudos").select("id, eixo_id, titulo, tipo, ordem"),
        supabase.from("liberacoes").select("cliente_id, eixo_id, conteudo_id, status, liberar_em"),
        supabase.from("progresso").select("cliente_id, conteudo_id, status, updated_at"),
        supabase
          .from("pacotes")
          .select("id, nome, descricao, tipo_cobranca, preco_centavos, eixos_incluidos"),
        supabase
          .from("clientes_pacotes")
          .select("id, cliente_id, pacote_id, status_pagamento, created_at"),
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
              (!l.liberar_em || new Date(l.liberar_em) <= new Date()) &&
              ((l.eixo_id === c.eixo_id && l.conteudo_id === null) || l.conteudo_id === c.id),
          ),
        );
        const concluidos = progs.filter(
          (pr) =>
            pr.cliente_id === p.id &&
            pr.status === "concluido" &&
            liberados.some((c) => c.id === pr.conteudo_id),
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
              !progs.some(
                (pr) =>
                  pr.cliente_id === p.id && pr.conteudo_id === c.id && pr.status === "concluido",
              ),
          ),
        );
        const vinculo = (vinculos.data ?? []).find((v) => v.cliente_id === p.id);
        return {
          ...p,
          totalLiberado: liberados.length,
          concluidos,
          percentual:
            liberados.length === 0 ? 0 : Math.round((concluidos / liberados.length) * 100),
          eixoAtual: eixoAtual?.nome ?? null,
          ultimaAtividade: ultima ?? null,
          pacote: (pacotes.data ?? []).find((pk) => pk.id === vinculo?.pacote_id)?.nome ?? null,
          statusPagamento: vinculo?.status_pagamento ?? null,
          datasConclusao,
        };
      });

    const media =
      clientes.length === 0
        ? 0
        : Math.round(clientes.reduce((a, c) => a + c.percentual, 0) / clientes.length);

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
    await garantirPermissao(supabase, userId, "ver_clientes", "adminGetCliente", {
      clienteAlvo: data.clienteId,
      tabela: "profiles",
    });
    const podeVerDiario = await temPermissao(supabase, "ver_diario");

    const [perfil, eixos, conteudos, liberacoes, progresso, diario, vinculos, pacotes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, nome, email, created_at")
          .eq("id", data.clienteId)
          .maybeSingle(),
        supabase.from("eixos").select("id, nome, icone, ordem").order("ordem"),
        supabase.from("conteudos").select("id, eixo_id, titulo, tipo, ordem").order("ordem"),
        supabase
          .from("liberacoes")
          .select("id, eixo_id, conteudo_id, status, liberado_em, liberar_em")
          .eq("cliente_id", data.clienteId),
        supabase
          .from("progresso")
          .select("conteudo_id, status, concluido_em, updated_at")
          .eq("cliente_id", data.clienteId),
        supabase
          .from("diario")
          .select("id, texto, created_at, conteudos(titulo)")
          .eq("cliente_id", data.clienteId)
          .order("created_at", { ascending: false }),
        supabase
          .from("clientes_pacotes")
          .select("id, pacote_id, status_pagamento")
          .eq("cliente_id", data.clienteId),
        supabase.from("pacotes").select("id, nome, eixos_incluidos"),
      ]);

    return {
      perfil: perfil.data,
      eixos: eixos.data ?? [],
      conteudos: conteudos.data ?? [],
      liberacoes: liberacoes.data ?? [],
      progresso: progresso.data ?? [],
      diario: podeVerDiario ? (diario.data ?? []) : [],
      podeVerDiario,
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
        liberarEm: z.string().datetime().nullable().optional(),
        titulo: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_liberacoes", "adminDefinirLiberacao", {
      clienteAlvo: data.clienteId,
      tabela: "liberacoes",
    });

    const alvo = supabase
      .from("liberacoes")
      .select("id")
      .eq("cliente_id", data.clienteId)
      .eq(data.conteudoId ? "conteudo_id" : "eixo_id", (data.conteudoId ?? data.eixoId) as string);
    const existente = await (data.conteudoId ? alvo : alvo.is("conteudo_id", null)).maybeSingle();

    const alvoAuditoria = {
      alvoTipo: "liberacao" as const,
      alvoId: data.clienteId,
      detalhes: {
        titulo: data.titulo ?? "",
        conteudoId: data.conteudoId ?? null,
        eixoId: data.eixoId ?? null,
      },
    };

    if (!data.liberar) {
      // mantém a linha e marca como bloqueada: assim o cliente recebe o evento
      // de tempo real (eventos de exclusão não chegam com RLS ativa)
      if (existente.data)
        await supabase
          .from("liberacoes")
          .update({ status: "bloqueado", liberar_em: null })
          .eq("id", existente.data.id);
      await registrarAuditoria(supabase, atorAuditoria(context), {
        acao: "liberacao_revogada",
        ...alvoAuditoria,
      });
      return { ok: true };
    }

    if (existente.data) {
      await supabase
        .from("liberacoes")
        .update({
          status: "liberado",
          liberado_em: new Date().toISOString(),
          liberar_em: data.liberarEm ?? null,
        })
        .eq("id", existente.data.id);
    } else {
      const { error } = await supabase.from("liberacoes").insert({
        cliente_id: data.clienteId,
        eixo_id: data.conteudoId ? null : (data.eixoId ?? null),
        conteudo_id: data.conteudoId ?? null,
        status: "liberado",
        liberar_em: data.liberarEm ?? null,
      });
      if (error) throw erroSeguro(error);
    }

    const agendadoParaFuturo = Boolean(data.liberarEm && new Date(data.liberarEm) > new Date());
    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: agendadoParaFuturo ? "liberacao_agendada" : "conteudo_liberado",
      ...alvoAuditoria,
      detalhes: { ...alvoAuditoria.detalhes, agendadoPara: data.liberarEm ?? "" },
    });
    if (agendadoParaFuturo) return { ok: true, agendado: true };

    await supabase.from("notificacoes").insert({
      cliente_id: data.clienteId,
      titulo: "Novo conteúdo liberado",
      mensagem: data.titulo
        ? `"${data.titulo}" já está disponível na sua biblioteca.`
        : "Há algo novo esperando por você na sua biblioteca.",
    });

    return { ok: true };
  });

export const CONTEUDO_TIPOS = [
  "video",
  "audio",
  "meditacao",
  "aterramento",
  "movimento_sistemico",
  "exercicio",
  "texto",
  "texto_educativo",
  "diario_integracao",
  "pergunta_reflexiva",
  "checkin",
  "checkout",
  "acao_alinhada",
  "pratica_semanal",
  "tarefa",
  "pdf",
] as const;

export const adminSalvarConteudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        eixoId: z.string().uuid(),
        tipo: z.enum(CONTEUDO_TIPOS),
        titulo: z.string().trim().min(1).max(200),
        descricao: z.string().max(2000).default(""),
        objetivo: z.string().max(2000).default(""),
        instrucoes: z.string().max(20000).default(""),
        perguntasIntegracao: z.string().max(4000).default(""),
        materiais: z.string().max(2000).default(""),
        sensibilidades: z.string().max(2000).default(""),
        orientacoesPausa: z.string().max(2000).default(""),
        transcricao: z.string().max(40000).default(""),
        legendasPath: z.string().max(500).nullable().optional(),
        corpoTexto: z.string().max(20000).nullable().optional(),
        storagePath: z.string().max(500).nullable().optional(),
        thumbnailPath: z.string().max(500).nullable().optional(),
        duracaoSegundos: z.number().int().min(0).default(0),
        ordem: z.number().int().min(0).default(0),
        nivel: z.enum(["leve", "intermediario", "profundo"]).default("leve"),
        status: z.enum(["rascunho", "em_revisao", "publicado", "arquivado"]).default("rascunho"),
        versao: z.number().int().min(1).max(999).default(1),
        autorId: z.string().uuid().nullable().optional(),
        revisorId: z.string().uuid().nullable().optional(),
        dataRevisao: z.string().max(20).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_conteudos", "adminSalvarConteudo", {
      tabela: "conteudos",
    });
    const payload = {
      eixo_id: data.eixoId,
      tipo: data.tipo,
      titulo: data.titulo,
      descricao: data.descricao,
      objetivo: data.objetivo,
      instrucoes: data.instrucoes,
      perguntas_integracao: data.perguntasIntegracao,
      materiais: data.materiais,
      sensibilidades: data.sensibilidades,
      criterios_interrupcao: data.orientacoesPausa,
      transcricao: data.transcricao,
      legendas_path: data.legendasPath || null,
      corpo_texto: data.corpoTexto ?? null,
      storage_path: data.storagePath ?? null,
      thumbnail_path: data.thumbnailPath ?? null,
      duracao_segundos: data.duracaoSegundos,
      ordem: data.ordem,
      nivel: data.nivel,
      status: data.status,
      versao: data.versao,
      autor_id: data.autorId ?? userId,
      revisor_id: data.revisorId ?? null,
      data_revisao: data.dataRevisao || null,
    };
    const query = data.id
      ? supabase.from("conteudos").update(payload).eq("id", data.id)
      : supabase.from("conteudos").insert(payload);
    const { error } = await query;
    if (error) throw erroSeguro(error);
    return { ok: true };
  });

/**
 * Exclusão definitiva só quando o conteúdo não está em nenhuma trilha nem em
 * plano de cliente. Nos demais casos o caminho é arquivar, preservando o
 * histórico de quem já praticou.
 */
export const adminApagarConteudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await garantirPermissao(
      supabase,
      context.userId,
      "gerenciar_conteudos",
      "adminApagarConteudo",
      { tabela: "conteudos" },
    );

    const [copias, planos, progresso] = await Promise.all([
      supabase
        .from("conteudos")
        .select("id", { count: "exact", head: true })
        .eq("conteudo_origem_id", data.id)
        .not("trilha_id", "is", null),
      supabase
        .from("atribuicao_etapas")
        .select("id", { count: "exact", head: true })
        .eq("conteudo_id", data.id),
      supabase
        .from("progresso")
        .select("id", { count: "exact", head: true })
        .eq("conteudo_id", data.id),
    ]);

    const { data: proprio } = await supabase
      .from("conteudos")
      .select("trilha_id")
      .eq("id", data.id)
      .maybeSingle();

    const emUso =
      Boolean(proprio?.trilha_id) ||
      (copias.count ?? 0) > 0 ||
      (planos.count ?? 0) > 0 ||
      (progresso.count ?? 0) > 0;

    if (emUso) {
      return {
        ok: false as const,
        motivo: "em_uso" as const,
        mensagem:
          "Este conteúdo está em uso em uma trilha ou plano ativo. Arquive-o para preservar o histórico das pessoas que já praticaram.",
      };
    }

    const { error } = await supabase.from("conteudos").delete().eq("id", data.id);
    if (error) throw erroSeguro(error);
    return { ok: true as const };
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
    await garantirPermissao(
      context.supabase,
      context.userId,
      "gerenciar_conteudos",
      "adminSalvarEixo",
      { tabela: "eixos" },
    );
    const payload = {
      nome: data.nome,
      descricao: data.descricao,
      icone: data.icone,
      ordem: data.ordem,
    };
    const query = data.id
      ? context.supabase.from("eixos").update(payload).eq("id", data.id)
      : context.supabase.from("eixos").insert(payload);
    const { error } = await query;
    if (error) throw erroSeguro(error);
    return { ok: true };
  });

export const adminListarConteudos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirPermissao(
      context.supabase,
      context.userId,
      "gerenciar_conteudos",
      "adminListarConteudos",
      { tabela: "conteudos" },
    );
    const [eixos, conteudos, trilhas, perfis] = await Promise.all([
      context.supabase.from("eixos").select("id, nome, descricao, icone, ordem").order("ordem"),
      context.supabase
        .from("conteudos")
        .select(
          "id, eixo_id, tipo, titulo, descricao, objetivo, instrucoes, perguntas_integracao, corpo_texto, storage_path, thumbnail_path, legendas_path, transcricao, materiais, sensibilidades, criterios_interrupcao, duracao_segundos, ordem, nivel, status, versao, autor_id, revisor_id, data_revisao, updated_at, created_at, trilha_id, conteudo_origem_id",
        )
        .order("ordem"),
      context.supabase.from("trilhas").select("id, nome, status, eixo_id").order("nome"),
      context.supabase.from("profiles").select("id, nome, email"),
    ]);
    return {
      eixos: eixos.data ?? [],
      conteudos: conteudos.data ?? [],
      trilhas: trilhas.data ?? [],
      pessoas: perfis.data ?? [],
    };
  });

/** Trilhas que usam o conteúdo (como etapa direta ou como cópia editável). */
export const adminTrilhasDoConteudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_conteudos", "adminTrilhasDoConteudo", {
      tabela: "conteudos",
    });

    const { data: etapas, error } = await supabase
      .from("conteudos")
      .select("id, titulo, trilha_id, conteudo_origem_id, trilhas(id, nome, status)")
      .or(`id.eq.${data.id},conteudo_origem_id.eq.${data.id}`)
      .not("trilha_id", "is", null);
    if (error) throw erroSeguro(error);

    const mapa = new Map<string, { id: string; nome: string; status: string; copia: boolean }>();
    for (const etapa of etapas ?? []) {
      const trilha = (etapa as { trilhas?: { id: string; nome: string; status: string } | null })
        .trilhas;
      if (!trilha) continue;
      if (!mapa.has(trilha.id)) {
        mapa.set(trilha.id, { ...trilha, copia: etapa.id !== data.id });
      }
    }

    const { count } = await supabase
      .from("atribuicao_etapas")
      .select("id", { count: "exact", head: true })
      .in("conteudo_id", [data.id, ...(etapas ?? []).map((e) => e.id)]);

    return { trilhas: [...mapa.values()], planos: count ?? 0 };
  });

/** Cópia editável em rascunho, preservando o original como origem. */
export const adminDuplicarConteudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_conteudos", "adminDuplicarConteudo", {
      tabela: "conteudos",
    });

    const { data: original, error: erroLeitura } = await supabase
      .from("conteudos")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (erroLeitura) throw erroSeguro(erroLeitura);
    if (!original) throw new Error("Conteúdo não encontrado.");

    const {
      id: _id,
      created_at: _criado,
      updated_at: _atualizado,
      ...resto
    } = original as Record<string, unknown> & { id: string };

    const copia = {
      ...resto,
      titulo: `${original.titulo} (cópia)`,
      status: "rascunho",
      versao: 1,
      trilha_id: null,
      autor_id: userId,
      revisor_id: null,
      conteudo_origem_id: original.id,
    } as never;

    const { data: criado, error } = await supabase
      .from("conteudos")
      .insert(copia)
      .select("id")
      .single();
    if (error) throw erroSeguro(error);

    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: "conteudo_duplicado",
      alvoTipo: "conteudo",
      alvoId: criado.id,
      detalhes: { origem: original.id, titulo: original.titulo },
    });

    return { ok: true, id: criado.id };
  });

/** Envia para revisão, publica, arquiva ou volta para rascunho. */
export const adminMudarStatusConteudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        status: z.enum(["rascunho", "em_revisao", "publicado", "arquivado"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_conteudos", "adminMudarStatusConteudo", {
      tabela: "conteudos",
    });

    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "publicado") patch["revisor_id"] = userId;
    if (data.status === "em_revisao") patch["data_revisao"] = new Date().toISOString().slice(0, 10);

    const { error } = await supabase
      .from("conteudos")
      .update(patch as never)
      .in("id", data.ids);
    if (error) throw erroSeguro(error);

    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao:
        data.status === "publicado"
          ? "conteudo_publicado"
          : data.status === "arquivado"
            ? "conteudo_arquivado"
            : "conteudo_status_alterado",
      alvoTipo: "conteudo",
      alvoId: data.ids[0] ?? null,
      detalhes: { status: data.status, quantidade: data.ids.length },
    });

    return { ok: true, quantidade: data.ids.length };
  });

/** URL assinada de curta duração para pré-visualizar a mídia no painel. */
export const adminPreviaConteudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ caminho: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_conteudos", "adminPreviaConteudo", {
      tabela: "conteudos",
    });
    const { data: assinado, error } = await supabase.storage
      .from("midias")
      .createSignedUrl(data.caminho, 900);
    if (error) throw erroSeguro(error);
    return { url: assinado?.signedUrl ?? null };
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
    await garantirPermissao(
      context.supabase,
      context.userId,
      "gerenciar_pacotes",
      "adminSalvarPacote",
      { tabela: "pacotes" },
    );
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
    if (error) throw erroSeguro(error);
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
    await garantirPermissao(
      context.supabase,
      context.userId,
      "gerenciar_pacotes",
      "adminVincularPacote",
      { clienteAlvo: data.clienteId, tabela: "clientes_pacotes" },
    );
    const { error } = await context.supabase.from("clientes_pacotes").insert({
      cliente_id: data.clienteId,
      pacote_id: data.pacoteId,
      status_pagamento: data.statusPagamento,
    });
    if (error) throw erroSeguro(error);
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
    await garantirPermissao(
      context.supabase,
      context.userId,
      "gerenciar_pacotes",
      "adminAtualizarPagamento",
      { tabela: "clientes_pacotes" },
    );
    const { error } = await context.supabase
      .from("clientes_pacotes")
      .update({ status_pagamento: data.statusPagamento })
      .eq("id", data.id);
    if (error) throw erroSeguro(error);
    return { ok: true };
  });
