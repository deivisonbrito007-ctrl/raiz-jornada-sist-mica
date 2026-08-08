import { createFileRoute } from "@tanstack/react-router";
import {
  decidirLembrete,
  chaveSemanaLocal,
  partesLocais,
  type PreferenciaLembretes,
  type TipoLembrete,
} from "@/lib/lembretes";

/**
 * Agendador dos lembretes de prática/reflexão.
 * Chamado a cada 30 minutos por cron; autentica pela chave pública do backend.
 */
export const Route = createFileRoute("/api/public/hooks/lembretes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const esperada =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        const recebida =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "") ??
          "";
        if (!esperada || recebida !== esperada) {
          return new Response(JSON.stringify({ error: "nao_autorizado" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { enviarPush } = await import("@/lib/push.server");
        const { enviarEmailLembrete } = await import("@/lib/email-lembrete.server");

        const agora = new Date();
        const { data: candidatos } = await supabaseAdmin
          .from("preferencias_lembretes")
          .select("*")
          .eq("ativo", true);

        const resultado = { avaliados: 0, enviados: 0, push: 0, email: 0 };

        for (const prefs of (candidatos ?? []) as (PreferenciaLembretes & { user_id: string })[]) {
          resultado.avaliados += 1;
          const userId = prefs.user_id;
          const partes = partesLocais(agora, prefs.fuso);
          if (partes.hora !== prefs.hora_local) continue;

          const semana = chaveSemanaLocal(partes);
          const [perfil, progresso, diario, enviados] = await Promise.all([
            supabaseAdmin
              .from("profiles")
              .select("nome, email, meta_semanal")
              .eq("id", userId)
              .maybeSingle(),
            supabaseAdmin
              .from("progresso")
              .select("conteudo_id, concluido_em")
              .eq("cliente_id", userId)
              .eq("status", "concluido"),
            supabaseAdmin.from("diario").select("conteudo_id").eq("cliente_id", userId),
            supabaseAdmin
              .from("lembretes_enviados")
              .select("tipo, created_at, chave_dedupe")
              .eq("user_id", userId)
              .gte("created_at", new Date(Date.parse(`${semana}T00:00:00Z`) - 86_400_000).toISOString()),
          ]);

          const datas = (progresso.data ?? [])
            .map((p) => p.concluido_em)
            .filter((d): d is string => Boolean(d));

          const inicioSemana = Date.parse(`${semana}T00:00:00Z`);
          const concluidasSemana = datas.filter((d) => Date.parse(d) >= inicioSemana).length;

          const comReflexao = new Set(
            (diario.data ?? []).map((d) => d.conteudo_id).filter(Boolean) as string[],
          );
          const reflexaoPendente = (progresso.data ?? []).some(
            (p) => p.concluido_em && !comReflexao.has(p.conteudo_id),
          );

          const registros = enviados.data ?? [];
          const tiposNaSemana = registros
            .filter((r) => r.chave_dedupe.endsWith(`:${semana}`))
            .map((r) => r.tipo as TipoLembrete);
          const enviadoHoje = registros.some(
            (r) => partesLocais(new Date(r.created_at), prefs.fuso).data === partes.data,
          );

          const lembrete = decidirLembrete(
            prefs,
            {
              nome: perfil.data?.nome ?? "",
              datasConclusao: datas,
              concluidasSemana,
              meta: perfil.data?.meta_semanal ?? 3,
              reflexaoPendente,
              tiposNaSemana,
              enviadoHoje,
            },
            agora,
            userId,
          );
          if (!lembrete) continue;

          // O registro com chave única é a trava anti-duplicidade.
          const { error: erroRegistro } = await supabaseAdmin.from("lembretes_enviados").insert({
            user_id: userId,
            tipo: lembrete.tipo,
            chave_dedupe: lembrete.chaveDedupe,
            canal: [prefs.canal_push ? "push" : null, prefs.canal_email ? "email" : null]
              .filter(Boolean)
              .join("+"),
          });
          if (erroRegistro) continue;

          resultado.enviados += 1;

          // Sempre aparece no sininho do app.
          await supabaseAdmin.from("notificacoes").insert({
            cliente_id: userId,
            titulo: lembrete.titulo,
            mensagem: lembrete.mensagem,
          });

          if (prefs.canal_push) {
            const { data: dispositivos } = await supabaseAdmin
              .from("dispositivos_push")
              .select("endpoint, p256dh, auth")
              .eq("user_id", userId);
            const r = await enviarPush(dispositivos ?? [], {
              titulo: lembrete.titulo,
              mensagem: lembrete.mensagem,
              destino: lembrete.destino,
              tipo: lembrete.tipo,
            });
            resultado.push += r.enviados;
            for (const endpoint of r.removidos) {
              await supabaseAdmin.from("dispositivos_push").delete().eq("endpoint", endpoint);
            }
          }

          if (prefs.canal_email && perfil.data?.email) {
            const ok = await enviarEmailLembrete(perfil.data.email, lembrete);
            if (ok) resultado.email += 1;
          }
        }

        return new Response(JSON.stringify(resultado), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

