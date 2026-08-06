import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, naoAutenticado } from "../supabase";

export default defineTool({
  name: "criar_entrada_diario",
  title: "Criar entrada no diário",
  description: "Cria uma nova entrada no diário privado da pessoa autenticada.",
  inputSchema: {
    texto: z.string().trim().min(1).describe("Texto da reflexão."),
    conteudoId: z
      .string()
      .uuid()
      .describe("ID da prática relacionada, quando a reflexão vier de uma prática.")
      .optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ texto, conteudoId }, ctx) => {
    if (!ctx.isAuthenticated()) return naoAutenticado();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("diario")
      .insert({ cliente_id: ctx.getUserId(), texto, conteudo_id: conteudoId ?? null })
      .select("id, created_at");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: "Entrada registrada no diário." }],
      structuredContent: { entrada: data?.[0] },
    };
  },
});
