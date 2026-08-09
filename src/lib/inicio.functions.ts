import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { garantirPermissao } from "./permissao-guard";

/**
 * Dados da aba "Início" do painel: tudo o que a terapeuta precisa ver primeiro.
 *
 * Uma consulta só, com o cliente da própria sessão (RLS vale), janelas de tempo
 * e limites aplicados aqui no servidor. Do diário vem apenas o fato de ter sido
 * compartilhado — nunca o texto.
 */
export const adminInicio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await garantirPermissao(supabase, userId, "ver_clientes", "adminInicio", {
      tabela: "clientes_acesso",
      rota: "/admin/inicio",
    });

    const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [
      acessos,
      perfis,
      atribuicoes,
      trilhas,
      revisoes,
      apoio,
      convites,
      etapas,
      praticas,
      compartilhados,
    ] = await Promise.all([
      supabase.from("clientes_acesso").select("user_id, terapeuta_id, status"),
      supabase.from("profiles").select("id, nome, email"),
      supabase
        .from("atribuicoes")
        .select(
          "id, cliente_id, terapeuta_id, trilha_id, objetivo, status, data_inicio, data_revisao, created_at, updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("trilhas").select("id, nome"),
      supabase
        .from("revisoes")
        .select("id, cliente_id, atribuicao_id, devolutiva, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("solicitacoes_apoio")
        .select("id, cliente_id, status, origem, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("convites_clientes")
        .select("id, email, nome, status, expira_em, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("atribuicao_etapas")
        .select("atribuicao_id, concluida_em")
        .not("concluida_em", "is", null)
        .gte("concluida_em", desde)
        .order("concluida_em", { ascending: false })
        .limit(100),
      supabase
        .from("progresso")
        .select("cliente_id, concluido_em")
        .eq("status", "concluido")
        .not("concluido_em", "is", null)
        .gte("concluido_em", desde)
        .order("concluido_em", { ascending: false })
        .limit(200),
      supabase
        .from("diario")
        .select("id, cliente_id, compartilhado_em")
        .eq("visibilidade", "compartilhado")
        .not("compartilhado_em", "is", null)
        .gte("compartilhado_em", desde)
        .order("compartilhado_em", { ascending: false })
        .limit(50),
    ]);

    const perfilPorId = new Map((perfis.data ?? []).map((p) => [p.id, p]));
    const clientes = (acessos.data ?? []).map((a) => {
      const perfil = perfilPorId.get(a.user_id);
      return {
        id: a.user_id,
        nome: perfil?.nome ?? "",
        email: perfil?.email ?? "",
        status: a.status as string,
      };
    });

    return {
      clientes,
      perfis: perfis.data ?? [],
      atribuicoes: atribuicoes.data ?? [],
      trilhas: trilhas.data ?? [],
      revisoes: revisoes.data ?? [],
      apoio: apoio.data ?? [],
      convites: convites.data ?? [],
      etapas: etapas.data ?? [],
      praticas: praticas.data ?? [],
      compartilhados: compartilhados.data ?? [],
    };
  });
