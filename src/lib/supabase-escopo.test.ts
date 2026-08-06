import { describe, expect, it, beforeEach } from "vitest";

/**
 * Escopo de dados em chamadas Supabase FORA do React (queries/serviços).
 *
 * Um cliente PostgREST falso aplica as mesmas políticas de RLS do banco:
 * - progresso/diário/liberações/notificações: cliente_id = auth.uid() OU terapeuta
 * - profiles: id = auth.uid() OU terapeuta
 * - eixos/conteudos: leitura por autenticado (conteúdo só se liberado)
 *
 * Os serviços abaixo reproduzem as consultas usadas pelas server functions
 * (getMeuContexto/getMinhaBiblioteca/getMeuDiario/adminGetCliente) para
 * garantir que, mesmo sem componentes e mesmo em sequências de navegação,
 * nenhuma linha fora do escopo é retornada.
 */

const CLIENTE_A = "11111111-1111-4111-8111-111111111111";
const CLIENTE_B = "22222222-2222-4222-8222-222222222222";
const TERAPEUTA = "33333333-3333-4333-8333-333333333333";

const PAPEIS: Record<string, "cliente" | "terapeuta"> = {
  [CLIENTE_A]: "cliente",
  [CLIENTE_B]: "cliente",
  [TERAPEUTA]: "terapeuta",
};

type Linha = Record<string, unknown>;

const BANCO: Record<string, Linha[]> = {
  profiles: [
    { id: CLIENTE_A, nome: "Ana", email: "ana@ex.com", meta_semanal: 3 },
    { id: CLIENTE_B, nome: "Bruno", email: "bruno@ex.com", meta_semanal: 4 },
    { id: TERAPEUTA, nome: "Terapeuta", email: "t@ex.com", meta_semanal: 5 },
  ],
  user_roles: [
    { user_id: CLIENTE_A, role: "cliente" },
    { user_id: CLIENTE_B, role: "cliente" },
    { user_id: TERAPEUTA, role: "terapeuta" },
  ],
  eixos: [
    { id: "eixo-pai", nome: "Pai", ordem: 1 },
    { id: "eixo-mae", nome: "Mãe", ordem: 2 },
  ],
  conteudos: [
    { id: "c1", eixo_id: "eixo-pai", titulo: "Carta ao pai", ordem: 1 },
    { id: "c2", eixo_id: "eixo-mae", titulo: "Diálogo com a mãe", ordem: 2 },
  ],
  liberacoes: [
    { cliente_id: CLIENTE_A, conteudo_id: "c1", eixo_id: "eixo-pai", status: "liberado" },
    { cliente_id: CLIENTE_B, conteudo_id: "c2", eixo_id: "eixo-mae", status: "liberado" },
  ],
  progresso: [
    { cliente_id: CLIENTE_A, conteudo_id: "c1", status: "concluido", concluido_em: "2026-08-05T11:00:00.000Z" },
    { cliente_id: CLIENTE_B, conteudo_id: "c2", status: "concluido", concluido_em: "2026-08-05T12:00:00.000Z" },
  ],
  diario: [
    { id: "d1", cliente_id: CLIENTE_A, texto: "Reflexão da Ana" },
    { id: "d2", cliente_id: CLIENTE_B, texto: "Reflexão do Bruno" },
  ],
  notificacoes: [
    { id: "n1", cliente_id: CLIENTE_A, titulo: "Novo conteúdo" },
    { id: "n2", cliente_id: CLIENTE_B, titulo: "Novo conteúdo" },
  ],
};

const TABELAS_DO_CLIENTE = ["liberacoes", "progresso", "diario", "notificacoes"] as const;

const consultas: { tabela: string; userId: string }[] = [];

/** Cliente PostgREST falso que aplica RLS no servidor, não no filtro do app. */
function fakeSupabase(userId: string) {
  const papel = PAPEIS[userId];
  return {
    from(tabela: string) {
      consultas.push({ tabela, userId });
      let linhas = (BANCO[tabela] ?? []).map((l) => ({ ...l }));

      // RLS aplicada antes de qualquer filtro do aplicativo
      if ((TABELAS_DO_CLIENTE as readonly string[]).includes(tabela) && papel !== "terapeuta") {
        linhas = linhas.filter((l) => l["cliente_id"] === userId);
      }
      if (tabela === "profiles" && papel !== "terapeuta") {
        linhas = linhas.filter((l) => l["id"] === userId);
      }
      if (tabela === "user_roles" && papel !== "terapeuta") {
        linhas = linhas.filter((l) => l["user_id"] === userId);
      }
      if (tabela === "conteudos" && papel !== "terapeuta") {
        const liberados = new Set(
          (BANCO["liberacoes"] ?? [])
            .filter((l) => l["cliente_id"] === userId && l["status"] === "liberado")
            .map((l) => l["conteudo_id"]),
        );
        linhas = linhas.filter((l) => liberados.has(l["id"]));
      }

      const api = {
        select: () => api,
        order: () => api,
        eq(coluna: string, valor: unknown) {
          linhas = linhas.filter((l) => l[coluna] === valor);
          return api;
        },
        then(resolve: (r: { data: Linha[]; error: null }) => unknown) {
          return Promise.resolve(resolve({ data: linhas, error: null }));
        },
        maybeSingle: async () => ({ data: linhas[0] ?? null, error: null }),
        async insert(valores: Linha) {
          const alvo = valores["cliente_id"] ?? valores["id"];
          if (papel !== "terapeuta" && alvo !== userId) {
            return { data: null, error: { message: "new row violates row-level security policy" } };
          }
          BANCO[tabela]!.push({ ...valores });
          return { data: [valores], error: null };
        },
      };
      return api;
    },
  };
}

// ---- serviços (sem React) ----

async function servicoMeuContexto(userId: string) {
  const supabase = fakeSupabase(userId);
  const perfil = await supabase.from("profiles").select().eq("id", userId).maybeSingle();
  const papeis = await supabase.from("user_roles").select().eq("user_id", userId);
  return { perfil: perfil.data, papeis: papeis.data.map((r) => r["role"]) };
}

async function servicoMinhaBiblioteca(userId: string) {
  const supabase = fakeSupabase(userId);
  const conteudos = await supabase.from("conteudos").select().order();
  const liberacoes = await supabase.from("liberacoes").select().eq("cliente_id", userId);
  const progresso = await supabase.from("progresso").select().eq("cliente_id", userId);
  return { conteudos: conteudos.data, liberacoes: liberacoes.data, progresso: progresso.data };
}

/** Serviço "descuidado": esqueceu o filtro por cliente_id — RLS ainda protege. */
async function servicoSemFiltro(userId: string, tabela: string) {
  const supabase = fakeSupabase(userId);
  const r = await supabase.from(tabela).select();
  return r.data;
}

async function servicoDiario(userId: string, clienteId = userId) {
  const supabase = fakeSupabase(userId);
  const r = await supabase.from("diario").select().eq("cliente_id", clienteId);
  return r.data.map((l) => l["texto"]);
}

async function servicoAdminCliente(userId: string, clienteId: string) {
  if (PAPEIS[userId] !== "terapeuta") throw new Error("Acesso restrito");
  const supabase = fakeSupabase(userId);
  const progresso = await supabase.from("progresso").select().eq("cliente_id", clienteId);
  const diario = await supabase.from("diario").select().eq("cliente_id", clienteId);
  return { progresso: progresso.data, diario: diario.data.map((l) => l["texto"]) };
}

describe("escopo de dados em chamadas Supabase fora do React", () => {
  beforeEach(() => {
    consultas.length = 0;
  });

  it("contexto do cliente traz apenas o próprio perfil e papel", async () => {
    const a = await servicoMeuContexto(CLIENTE_A);
    expect(a.perfil).toMatchObject({ id: CLIENTE_A, nome: "Ana" });
    expect(a.papeis).toEqual(["cliente"]);

    const b = await servicoMeuContexto(CLIENTE_B);
    expect(b.perfil).toMatchObject({ id: CLIENTE_B });
    expect(b.perfil).not.toMatchObject({ nome: "Ana" });
  });

  it("biblioteca traz somente liberações, progresso e conteúdos do próprio usuário", async () => {
    const a = await servicoMinhaBiblioteca(CLIENTE_A);
    expect(a.liberacoes.every((l) => l["cliente_id"] === CLIENTE_A)).toBe(true);
    expect(a.progresso.every((p) => p["cliente_id"] === CLIENTE_A)).toBe(true);
    expect(a.conteudos.map((c) => c["id"])).toEqual(["c1"]);

    const b = await servicoMinhaBiblioteca(CLIENTE_B);
    expect(b.conteudos.map((c) => c["id"])).toEqual(["c2"]);
  });

  it("serviço que esquece o filtro por cliente_id ainda não vaza dados (RLS)", async () => {
    for (const tabela of TABELAS_DO_CLIENTE) {
      const linhas = await servicoSemFiltro(CLIENTE_A, tabela);
      expect(linhas.length).toBeGreaterThan(0);
      expect(linhas.every((l) => l["cliente_id"] === CLIENTE_A)).toBe(true);
    }
    const perfis = await servicoSemFiltro(CLIENTE_A, "profiles");
    expect(perfis.map((p) => p["id"])).toEqual([CLIENTE_A]);
  });

  it("cliente que passa o id de outro cliente recebe conjunto vazio", async () => {
    expect(await servicoDiario(CLIENTE_A, CLIENTE_B)).toEqual([]);
    expect(await servicoDiario(CLIENTE_A)).toEqual(["Reflexão da Ana"]);
    await expect(servicoAdminCliente(CLIENTE_A, CLIENTE_B)).rejects.toThrow("Acesso restrito");
  });

  it("escopo se mantém em uma sequência de navegação entre páginas", async () => {
    // /app -> /app/diario -> /app/progresso, sempre como CLIENTE_A
    const rotas = [
      () => servicoMinhaBiblioteca(CLIENTE_A),
      () => servicoDiario(CLIENTE_A),
      () => servicoMeuContexto(CLIENTE_A),
      () => servicoSemFiltro(CLIENTE_A, "progresso"),
    ];
    for (const chamada of rotas) await chamada();

    const linhasVistas = consultas.filter((c) => c.userId !== CLIENTE_A);
    expect(linhasVistas).toEqual([]);
    // nenhuma consulta da sequência retorna linhas do CLIENTE_B
    const diario = await servicoDiario(CLIENTE_A);
    expect(diario).not.toContain("Reflexão do Bruno");
  });

  it("terapeuta navegando entre clientes recebe um escopo por vez", async () => {
    const b = await servicoAdminCliente(TERAPEUTA, CLIENTE_B);
    expect(b.diario).toEqual(["Reflexão do Bruno"]);
    expect(b.progresso.every((p) => p["cliente_id"] === CLIENTE_B)).toBe(true);

    const a = await servicoAdminCliente(TERAPEUTA, CLIENTE_A);
    expect(a.diario).toEqual(["Reflexão da Ana"]);
    expect(a.progresso.some((p) => p["cliente_id"] === CLIENTE_B)).toBe(false);

    const bDeNovo = await servicoAdminCliente(TERAPEUTA, CLIENTE_B);
    expect(bDeNovo.diario).toEqual(["Reflexão do Bruno"]);
  });

  it("escrita em nome de outro cliente é rejeitada pela política de RLS", async () => {
    const supabase = fakeSupabase(CLIENTE_A);
    const proibido = await supabase
      .from("diario")
      .insert({ cliente_id: CLIENTE_B, texto: "invasão" });
    expect(proibido.error?.message).toMatch(/row-level security/);

    const permitido = await supabase
      .from("diario")
      .insert({ id: "d3", cliente_id: CLIENTE_A, texto: "minha nota" });
    expect(permitido.error).toBeNull();
    expect(await servicoDiario(CLIENTE_B)).toEqual(["Reflexão do Bruno"]);
  });
});
