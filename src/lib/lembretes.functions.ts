import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { erroSeguro } from "./erro-permissao";
import { atorAuditoria, registrarAuditoria } from "./auditoria-equipe";
import { garantirPermissao } from "./permissao-guard";
import { PREFERENCIA_PADRAO, type PreferenciaLembretes } from "./lembretes";

const preferenciaSchema = z.object({
  ativo: z.boolean(),
  canalPush: z.boolean(),
  canalEmail: z.boolean(),
  diaSemana: z.number().int().min(0).max(6),
  horaLocal: z.number().int().min(0).max(23),
  fuso: z.string().min(1).max(64),
  diasInatividade: z.number().int().min(1).max(30),
});

type EntradaPreferencia = z.infer<typeof preferenciaSchema>;

const paraLinha = (p: EntradaPreferencia, definidoPor: string) => ({
  ativo: p.ativo,
  canal_push: p.canalPush,
  canal_email: p.canalEmail,
  dia_semana: p.diaSemana,
  hora_local: p.horaLocal,
  fuso: p.fuso,
  dias_inatividade: p.diasInatividade,
  definido_por: definidoPor,
  updated_at: new Date().toISOString(),
});

/** Preferências do próprio cliente + dispositivos de push registrados. */
export const getMinhasPreferenciasLembretes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [prefs, dispositivos, enviados] = await Promise.all([
      supabase.from("preferencias_lembretes").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("dispositivos_push").select("id, endpoint, user_agent, created_at").eq("user_id", userId),
      supabase
        .from("lembretes_enviados")
        .select("tipo, canal, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return {
      preferencias: (prefs.data ?? { ...PREFERENCIA_PADRAO }) as PreferenciaLembretes,
      dispositivos: dispositivos.data ?? [],
      ultimos: enviados.data ?? [],
    };
  });

/** O cliente salva as próprias preferências — sempre vence a escolha dele. */
export const salvarMinhasPreferenciasLembretes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => preferenciaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("preferencias_lembretes")
      .upsert({ user_id: userId, ...paraLinha(data, "cliente") }, { onConflict: "user_id" });
    if (error) throw erroSeguro(error, "salvar preferências de lembretes");
    return { ok: true };
  });

/** Registra (ou atualiza) a inscrição de push deste navegador/dispositivo. */
export const registrarDispositivoPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        endpoint: z.string().url().max(600),
        p256dh: z.string().min(10).max(300),
        auth: z.string().min(4).max(300),
        userAgent: z.string().max(300).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Uma inscrição pertence a um usuário: se mudou de conta, o endpoint é reatribuído.
    await supabase.from("dispositivos_push").delete().eq("endpoint", data.endpoint);
    const { error } = await supabase.from("dispositivos_push").insert({
      user_id: userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      user_agent: data.userAgent,
    });
    if (error) throw erroSeguro(error, "registrar dispositivo de push");
    return { ok: true };
  });

/** Remove a inscrição deste dispositivo (cliente desativou as notificações). */
export const removerDispositivoPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().max(600) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("dispositivos_push")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", data.endpoint);
    if (error) throw erroSeguro(error, "remover dispositivo de push");
    return { ok: true };
  });

/** Painel do terapeuta: estado dos lembretes de um cliente. */
export const adminGetLembretesCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clienteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "ver_clientes", "admin_get_lembretes", {
      clienteAlvo: data.clienteId,
      rota: "/admin/cliente",
    });

    const [prefs, dispositivos, enviados] = await Promise.all([
      supabase
        .from("preferencias_lembretes")
        .select("*")
        .eq("user_id", data.clienteId)
        .maybeSingle(),
      supabase.from("dispositivos_push").select("id").eq("user_id", data.clienteId),
      supabase
        .from("lembretes_enviados")
        .select("tipo, canal, created_at")
        .eq("user_id", data.clienteId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return {
      preferencias: (prefs.data ?? null) as PreferenciaLembretes | null,
      dispositivosPush: (dispositivos.data ?? []).length,
      ultimos: enviados.data ?? [],
    };
  });

/** Painel do terapeuta: ativa/ajusta os lembretes sugeridos para o cliente. */
export const adminDefinirLembretesCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    preferenciaSchema.extend({ clienteId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "gerenciar_liberacoes", "admin_definir_lembretes", {
      clienteAlvo: data.clienteId,
      rota: "/admin/cliente",
    });

    const { clienteId, ...prefs } = data;
    const { error } = await supabase
      .from("preferencias_lembretes")
      .upsert({ user_id: clienteId, ...paraLinha(prefs, "terapeuta") }, { onConflict: "user_id" });
    if (error) throw erroSeguro(error, "definir lembretes do cliente");

    await registrarAuditoria(supabase, atorAuditoria(context), {
      acao: "lembretes_configurados",
      alvoTipo: "lembretes",
      alvoId: clienteId,
      detalhes: {
        ativo: prefs.ativo,
        dia_semana: prefs.diaSemana,
        hora_local: prefs.horaLocal,
        dias_inatividade: prefs.diasInatividade,
        canais: [prefs.canalPush ? "push" : null, prefs.canalEmail ? "email" : null].filter(
          Boolean,
        ),
      },
    });

    return { ok: true };
  });
