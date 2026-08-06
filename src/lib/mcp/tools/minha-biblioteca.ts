import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, naoAutenticado } from "../supabase";

export default defineTool({
  name: "minha_biblioteca",
  title: "Minha biblioteca",
  description:
    "Lista os eixos liberados para a pessoa autenticada e as práticas de cada eixo, com status de conclusão.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return naoAutenticado();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const [eixos, conteudos, liberacoes, progresso] = await Promise.all([
      supabase.from("eixos").select("id, nome, descricao, ordem").order("ordem"),
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
        .select("conteudo_id, status, concluido_em")
        .eq("cliente_id", userId),
    ]);

    const erro = eixos.error ?? conteudos.error ?? liberacoes.error ?? progresso.error;
    if (erro) return { content: [{ type: "text", text: erro.message }], isError: true };

    const agora = Date.now();
    const libs = liberacoes.data ?? [];
    const statusPorConteudo = new Map((progresso.data ?? []).map((p) => [p.conteudo_id, p.status]));

    const resultado = (eixos.data ?? []).map((eixo) => {
      const doEixo = (conteudos.data ?? []).filter((c) => c.eixo_id === eixo.id);
      const doEixoLibs = libs.filter(
        (l) =>
          l.status === "liberado" &&
          ((l.eixo_id === eixo.id && l.conteudo_id === null) ||
            doEixo.some((c) => c.id === l.conteudo_id)),
      );
      const liberado = doEixoLibs.some(
        (l) => !l.liberar_em || new Date(l.liberar_em).getTime() <= agora,
      );
      return {
        eixo: eixo.nome,
        eixoId: eixo.id,
        liberado,
        praticas: liberado
          ? doEixo.map((c) => ({
              id: c.id,
              titulo: c.titulo,
              tipo: c.tipo,
              duracaoSegundos: c.duracao_segundos,
              status: statusPorConteudo.get(c.id) ?? "nao_iniciado",
            }))
          : [],
      };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }],
      structuredContent: { eixos: resultado },
    };
  },
});
