import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, naoAutenticado } from "../supabase";

export default defineTool({
  name: "marcar_pratica",
  title: "Marcar prática",
  description:
    "Atualiza o status de uma prática (nao_iniciado, em_andamento ou concluido) para a pessoa autenticada.",
  inputSchema: {
    conteudoId: z.string().uuid().describe("ID da prática (conteúdo)."),
    status: z
      .enum(["nao_iniciado", "em_andamento", "concluido"])
      .describe("Novo status da prática."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ conteudoId, status }, ctx) => {
    if (!ctx.isAuthenticated()) return naoAutenticado();
    const supabase = supabaseForUser(ctx);
    const { error } = await supabase.from("progresso").upsert(
      {
        cliente_id: ctx.getUserId(),
        conteudo_id: conteudoId,
        status,
        concluido_em: status === "concluido" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cliente_id,conteudo_id" },
    );
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Prática marcada como ${status}.` }],
      structuredContent: { conteudoId, status },
    };
  },
});
