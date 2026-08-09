import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { erroSeguro } from "./erro-permissao";
import { garantirPermissao } from "./permissao-guard";
import { atorAuditoria, registrarAuditoria } from "./auditoria-equipe";
import { normalizarModo } from "./modo-uso";

/* ------------------------------------------------------------------ cliente */

/** Pedidos que a própria pessoa fez para passar a ser acompanhada. */
export const meusPedidosAcompanhamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("solicitacoes_acompanhamento")
      .select("id, mensagem, status, resposta, respondido_em, created_at")
      .eq("cliente_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw erroSeguro(error);
    return data ?? [];
  });

export const pedirAcompanhamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ mensagem: z.string().trim().max(2000).default("") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: acesso } = await supabase
      .from("clientes_acesso")
      .select("modo")
      .eq("user_id", userId)
      .maybeSingle();

    if (normalizarModo(acesso?.modo) !== "autoguiado") {
      return { ok: false as const, motivo: "ja_acompanhado" as const };
    }

    const { data: abertos } = await supabase
      .from("solicitacoes_acompanhamento")
      .select("id")
      .eq("cliente_id", userId)
      .eq("status", "aberta")
      .limit(1);

    if ((abertos ?? []).length > 0) {
      return { ok: false as const, motivo: "pedido_em_aberto" as const };
    }

    const { error } = await supabase
      .from("solicitacoes_acompanhamento")
      .insert({ cliente_id: userId, mensagem: data.mensagem });
    if (error) throw erroSeguro(error);

    return { ok: true as const };
  });

/* ---------------------------------------------------------------- terapeuta */

export const adminListarPedidosAcompanhamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(
      supabase,
      userId,
      "ver_clientes",
      "adminListarPedidosAcompanhamento",
      { tabela: "solicitacoes_acompanhamento", rota: "/admin/clientes" },
    );

    const [pedidos, perfis] = await Promise.all([
      supabase
        .from("solicitacoes_acompanhamento")
        .select("id, cliente_id, mensagem, status, resposta, respondido_em, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, nome, email"),
    ]);
    if (pedidos.error) throw erroSeguro(pedidos.error);

    const perfilPorId = new Map((perfis.data ?? []).map((p) => [p.id, p]));
    return (pedidos.data ?? []).map((p) => ({
      ...p,
      nome: perfilPorId.get(p.cliente_id)?.nome ?? "",
      email: perfilPorId.get(p.cliente_id)?.email ?? "",
    }));
  });

export const adminResponderPedidoAcompanhamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        pedidoId: z.string().uuid(),
        decisao: z.enum(["aceitar", "recusar"]),
        resposta: z.string().trim().max(2000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(
      supabase,
      userId,
      "ver_clientes",
      "adminResponderPedidoAcompanhamento",
      { tabela: "solicitacoes_acompanhamento", rota: "/admin/clientes" },
    );

    const { data: pedido, error: erroBusca } = await supabase
      .from("solicitacoes_acompanhamento")
      .select("id, cliente_id, status")
      .eq("id", data.pedidoId)
      .maybeSingle();
    if (erroBusca) throw erroSeguro(erroBusca);
    if (!pedido) return { ok: false as const, motivo: "inexistente" as const };
    if (pedido.status !== "aberta") return { ok: false as const, motivo: "ja_respondido" as const };

    const aceitar = data.decisao === "aceitar";

    if (aceitar) {
      // Vira acompanhada mantendo todo o histórico autoguiado.
      const { error } = await supabase
        .from("clientes_acesso")
        .update({
          modo: "acompanhado",
          modo_desde: new Date().toISOString(),
          terapeuta_id: userId,
          status: "ativo",
        })
        .eq("user_id", pedido.cliente_id);
      if (error) throw erroSeguro(error);
    }

    const { error: erroPedido } = await supabase
      .from("solicitacoes_acompanhamento")
      .update({
        status: aceitar ? "aceita" : "recusada",
        resposta: data.resposta,
        respondido_por: userId,
        respondido_em: new Date().toISOString(),
      })
      .eq("id", pedido.id);
    if (erroPedido) throw erroSeguro(erroPedido);

    const { avisarCliente } = await import("./aviso-cliente.server");
    await avisarCliente({
      clienteId: pedido.cliente_id,
      titulo: aceitar ? "Seu acompanhamento começou" : "Sobre o seu pedido de acompanhamento",
      mensagem: aceitar
        ? "A terapeuta aceitou acompanhar o seu processo. Abra o app para ver os próximos passos."
        : data.resposta || "A terapeuta respondeu ao seu pedido. Abra o app para ler.",
      destino: "/app",
      chaveDedupe: `pedido-acomp-${pedido.id}-${aceitar ? "aceito" : "recusado"}`,
    });

    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: aceitar ? "acompanhamento_aceito" : "acompanhamento_recusado",
      alvoTipo: "cliente",
      alvoId: pedido.cliente_id,
      detalhes: { pedidoId: pedido.id },
    });

    return { ok: true as const };
  });

/** Volta alguém para o uso por conta própria (fim do acompanhamento). */
export const adminTornarAutoguiado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ clienteId: z.string().uuid(), motivo: z.string().trim().max(500).default("") })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "ver_clientes", "adminTornarAutoguiado", {
      clienteAlvo: data.clienteId,
      tabela: "clientes_acesso",
      rota: "/admin/clientes",
    });

    const { error } = await supabase
      .from("clientes_acesso")
      .update({ modo: "autoguiado", modo_desde: new Date().toISOString(), terapeuta_id: null })
      .eq("user_id", data.clienteId);
    if (error) throw erroSeguro(error);

    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: "modo_alterado",
      alvoTipo: "cliente",
      alvoId: data.clienteId,
      detalhes: { modo: "autoguiado", motivo: data.motivo },
    });

    return { ok: true as const };
  });
