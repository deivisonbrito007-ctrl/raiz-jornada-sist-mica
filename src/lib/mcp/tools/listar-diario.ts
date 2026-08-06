import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, naoAutenticado } from "../supabase";

export default defineTool({
  name: "listar_diario",
  title: "Listar diário",
  description: "Lista as entradas mais recentes do diário privado da pessoa autenticada.",
  inputSchema: {
    limite: z.number().int().describe("Quantidade de entradas a retornar (máximo 50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limite }, ctx) => {
    if (!ctx.isAuthenticated()) return naoAutenticado();
    const quantidade = Math.min(Math.max(limite ?? 20, 1), 50);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("diario")
      .select("id, texto, created_at, conteudo_id")
      .eq("cliente_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(quantidade);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { entradas: data ?? [] },
    };
  },
});
