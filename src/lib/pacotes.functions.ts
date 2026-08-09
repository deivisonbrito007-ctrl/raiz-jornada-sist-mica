import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { erroSeguro } from "./erro-permissao";
import { garantirPermissao } from "./permissao-guard";
import { atorAuditoria, registrarAuditoria } from "./auditoria-equipe";
import { normalizarModo } from "./modo-uso";

/* ------------------------------------------------------------------ cliente */

/**
 * Vitrine de quem usa o app por conta própria: pacotes disponíveis, o que cada
 * um abre (áreas e trilhas autoguiadas) e a situação dos pacotes já adquiridos.
 */
export const minhaVitrinePacotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [acesso, pacotes, meus, eixos, trilhas] = await Promise.all([
      supabase.from("clientes_acesso").select("modo, modo_desde").eq("user_id", userId).maybeSingle(),
      supabase
        .from("pacotes")
        .select(
          "id, nome, descricao, eixos_incluidos, trilhas_incluidas, tipo_cobranca, preco_centavos",
        )
        .order("preco_centavos"),
      supabase
        .from("clientes_pacotes")
        .select("id, pacote_id, status_pagamento, created_at")
        .eq("cliente_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("eixos").select("id, nome, ordem").order("ordem"),
      supabase
        .from("trilhas")
        .select("id, nome, resumo, objetivo, nivel, eixo_id, modos, status")
        .eq("status", "publicado"),
    ]);

    const erro = pacotes.error ?? meus.error ?? eixos.error ?? trilhas.error;
    if (erro) throw erroSeguro(erro);

    const autoguiadas = (trilhas.data ?? []).filter((t) => (t.modos ?? []).includes("autoguiado"));
    const nomeEixo = new Map((eixos.data ?? []).map((e) => [e.id, e.nome]));
    const meusPacotes = meus.data ?? [];
    const pagos = new Set(
      meusPacotes.filter((m) => m.status_pagamento === "pago").map((m) => m.pacote_id),
    );

    const catalogo = (pacotes.data ?? []).map((p) => {
      const trilhasDoPacote = autoguiadas.filter(
        (t) =>
          (p.trilhas_incluidas ?? []).includes(t.id) || (p.eixos_incluidos ?? []).includes(t.eixo_id),
      );
      const meu = meusPacotes.find((m) => m.pacote_id === p.id) ?? null;
      return {
        id: p.id,
        nome: p.nome,
        descricao: p.descricao,
        tipoCobranca: p.tipo_cobranca,
        precoCentavos: p.preco_centavos,
        areas: (p.eixos_incluidos ?? []).map((id) => nomeEixo.get(id) ?? "").filter(Boolean),
        trilhas: trilhasDoPacote.map((t) => ({
          id: t.id,
          nome: t.nome,
          resumo: t.resumo,
          nivel: t.nivel,
        })),
        situacao: meu ? meu.status_pagamento : null,
      };
    });

    return {
      modo: normalizarModo(acesso.data?.modo),
      temPacotePago: pagos.size > 0,
      pacotes: catalogo,
      // Amostra: trilhas autoguiadas publicadas que nenhum pacote meu abre ainda.
      trilhasAutoguiadas: autoguiadas.map((t) => ({
        id: t.id,
        nome: t.nome,
        resumo: t.resumo,
        objetivo: t.objetivo,
        nivel: t.nivel,
        areaNome: nomeEixo.get(t.eixo_id) ?? "",
      })),
    };
  });

/**
 * Registra a intenção de adquirir um pacote. Enquanto o checkout integrado não
 * está ligado, fica como pagamento pendente para a terapeuta confirmar.
 */
export const solicitarPacote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ pacoteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existente } = await supabase
      .from("clientes_pacotes")
      .select("id, status_pagamento")
      .eq("cliente_id", userId)
      .eq("pacote_id", data.pacoteId)
      .maybeSingle();

    if (existente) {
      return { ok: true as const, situacao: existente.status_pagamento };
    }

    const { error } = await supabase
      .from("clientes_pacotes")
      .insert({ cliente_id: userId, pacote_id: data.pacoteId, status_pagamento: "pendente" });
    if (error) throw erroSeguro(error);

    return { ok: true as const, situacao: "pendente" as const };
  });

/* ---------------------------------------------------------------- terapeuta */

export const adminListarAquisicoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_pacotes", "adminListarAquisicoes", {
      tabela: "clientes_pacotes",
      rota: "/admin/pacotes",
    });

    const [aquisicoes, perfis, pacotes] = await Promise.all([
      supabase
        .from("clientes_pacotes")
        .select("id, cliente_id, pacote_id, status_pagamento, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, nome, email"),
      supabase.from("pacotes").select("id, nome, preco_centavos"),
    ]);
    if (aquisicoes.error) throw erroSeguro(aquisicoes.error);

    const perfilPorId = new Map((perfis.data ?? []).map((p) => [p.id, p]));
    const pacotePorId = new Map((pacotes.data ?? []).map((p) => [p.id, p]));

    return (aquisicoes.data ?? []).map((a) => ({
      id: a.id,
      clienteId: a.cliente_id,
      nome: perfilPorId.get(a.cliente_id)?.nome ?? "",
      email: perfilPorId.get(a.cliente_id)?.email ?? "",
      pacoteNome: pacotePorId.get(a.pacote_id)?.nome ?? "",
      precoCentavos: pacotePorId.get(a.pacote_id)?.preco_centavos ?? 0,
      situacao: a.status_pagamento,
      criadoEm: a.created_at,
    }));
  });

export const adminRegistrarPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        aquisicaoId: z.string().uuid(),
        situacao: z.enum(["pendente", "pago", "cancelado"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_pacotes", "adminRegistrarPagamento", {
      tabela: "clientes_pacotes",
      rota: "/admin/pacotes",
    });

    const { data: aquisicao, error } = await supabase
      .from("clientes_pacotes")
      .update({ status_pagamento: data.situacao })
      .eq("id", data.aquisicaoId)
      .select("id, cliente_id, pacote_id")
      .maybeSingle();
    if (error) throw erroSeguro(error);
    if (!aquisicao) return { ok: false as const };

    if (data.situacao === "pago") {
      const { avisarCliente } = await import("./aviso-cliente.server");
      await avisarCliente({
        clienteId: aquisicao.cliente_id,
        titulo: "Seu pacote está ativo",
        mensagem: "As trilhas autoguiadas incluídas já estão abertas para você.",
        destino: "/app",
        chaveDedupe: `pacote-pago-${aquisicao.id}`,
      });
    }

    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: "pacote_pagamento_registrado",
      alvoTipo: "pacote",
      alvoId: aquisicao.pacote_id,
      detalhes: { clienteId: aquisicao.cliente_id, situacao: data.situacao },
    });

    return { ok: true as const };
  });
