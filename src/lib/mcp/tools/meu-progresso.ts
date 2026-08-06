import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, naoAutenticado } from "../supabase";
import { calcularStreak, avaliarMetaSemanal, avaliarLembrete } from "@/lib/raiz-format";

export default defineTool({
  name: "meu_progresso",
  title: "Meu progresso",
  description:
    "Resume o progresso da pessoa autenticada: práticas concluídas, sequência de semanas, meta semanal e tempo sem praticar.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return naoAutenticado();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const [perfil, progresso] = await Promise.all([
      supabase.from("profiles").select("nome, meta_semanal").eq("id", userId).maybeSingle(),
      supabase.from("progresso").select("status, concluido_em").eq("cliente_id", userId),
    ]);
    const erro = perfil.error ?? progresso.error;
    if (erro) return { content: [{ type: "text", text: erro.message }], isError: true };

    const datas = (progresso.data ?? [])
      .filter((p) => p.status === "concluido" && p.concluido_em)
      .map((p) => p.concluido_em as string);
    const metaSemanal = perfil.data?.meta_semanal ?? 3;
    const meta = avaliarMetaSemanal(datas, metaSemanal);
    const lembrete = avaliarLembrete(datas, calcularStreak(datas));

    const resumo = {
      nome: perfil.data?.nome ?? null,
      praticasConcluidas: datas.length,
      streakSemanas: calcularStreak(datas),
      metaSemanal,
      concluidasNestaSemana: meta.concluidasSemana,
      percentualDaMeta: meta.percentual,
      mensagemMeta: meta.mensagem,
      diasSemPratica: lembrete.diasSemPratica,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(resumo, null, 2) }],
      structuredContent: resumo,
    };
  },
});
