import { auth, defineMcp } from "@lovable.dev/mcp-js";
import minhaBiblioteca from "./tools/minha-biblioteca";
import marcarPratica from "./tools/marcar-pratica";
import listarDiario from "./tools/listar-diario";
import criarEntradaDiario from "./tools/criar-entrada-diario";
import meuProgresso from "./tools/meu-progresso";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "raiz-jornada-sistemica",
  title: "Raiz: Jornada Sistêmica",
  version: "0.1.0",
  instructions:
    "Ferramentas da jornada terapêutica sistêmica Raiz. Use minha_biblioteca para ver eixos e práticas liberadas, meu_progresso para sequência e meta semanal, marcar_pratica para atualizar o status de uma prática, e listar_diario / criar_entrada_diario para o diário privado. Todas as ferramentas operam apenas nos dados da pessoa autenticada.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [minhaBiblioteca, meuProgresso, marcarPratica, listarDiario, criarEntradaDiario] as unknown as Parameters<
    typeof defineMcp
  >[0]["tools"],
});
