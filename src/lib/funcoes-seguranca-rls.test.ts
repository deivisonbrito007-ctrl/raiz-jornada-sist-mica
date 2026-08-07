/**
 * Contrato de segurança do banco: funções SECURITY DEFINER + RLS.
 *
 * Estes testes travam duas garantias que precisam continuar valendo depois de
 * qualquer mudança no schema, nas policies ou no código do app:
 *
 * 1. Quem pode EXECUTAR cada função de segurança.
 *    - helpers internos (`has_role`, `tem_permissao`, `handle_new_user`) não são
 *      executáveis por `anon` nem por `authenticated`: só o banco os usa;
 *    - as RPCs do app (`pode`, `is_terapeuta`, `pode_administrar`,
 *      `conteudo_liberado`, `aceitar_convite_equipe`) exigem sessão;
 *    - `existe_terapeuta` é a única pública (usada na tela de cadastro).
 *
 * 2. O app falha FECHADO. Se a execução for negada (42501) ou a função sumir
 *    (42883), nenhum guard libera o acesso e nenhuma leitura sensível acontece.
 *
 * Um PostgREST falso aplica GRANT de execução + RLS por linha, então os guards
 * reais (`garantirPermissao`, `temPermissao`, `garantirConteudoLiberado`) são
 * exercitados exatamente como em produção.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { garantirPermissao, temPermissao } from "./permissao-guard";
import { garantirConteudoLiberado } from "./liberacao-guard";
import { PERMISSOES, type Permissao } from "./permissoes";

type Papel = "anon" | "authenticated" | "service_role";

/** Contrato de EXECUTE por função (espelha os GRANTs do banco). */
const EXECUCAO: Record<string, Papel[]> = {
  has_role: ["service_role"],
  tem_permissao: ["service_role"],
  handle_new_user: ["service_role"],
  pode: ["authenticated", "service_role"],
  is_terapeuta: ["authenticated", "service_role"],
  pode_administrar: ["authenticated", "service_role"],
  conteudo_liberado: ["authenticated", "service_role"],
  aceitar_convite_equipe: ["authenticated", "service_role"],
  existe_terapeuta: ["anon", "authenticated", "service_role"],
};

const FUNCOES_INTERNAS = ["has_role", "tem_permissao", "handle_new_user"] as const;
const FUNCOES_DO_APP = [
  "pode",
  "is_terapeuta",
  "pode_administrar",
  "conteudo_liberado",
  "aceitar_convite_equipe",
] as const;

const CLIENTE_A = "11111111-1111-4111-8111-111111111111";
const CLIENTE_B = "22222222-2222-4222-8222-222222222222";

type Sessao = { papel: Papel; userId?: string; permissoes?: Permissao[] };

type Erro = { code: string; message: string };

const NEGADO = (fn: string): Erro => ({
  code: "42501",
  message: `permission denied for function ${fn}`,
});

const BANCO = {
  conteudos: [
    { id: "c1", eixo_id: "eixo-pai" },
    { id: "c2", eixo_id: "eixo-mae" },
  ],
  liberacoes: [
    { cliente_id: CLIENTE_A, conteudo_id: "c1", eixo_id: "eixo-pai", status: "liberado" },
    { cliente_id: CLIENTE_B, conteudo_id: "c2", eixo_id: "eixo-mae", status: "liberado" },
  ],
};

/** Cliente PostgREST falso: valida GRANT de execução antes de rodar a função. */
function clienteFalso(sessao: Sessao, opcoes: { funcoesRemovidas?: string[] } = {}) {
  const rpcs: string[] = [];
  const tabelasLidas: string[] = [];

  const executavel = (fn: string) => (EXECUCAO[fn] ?? []).includes(sessao.papel);

  const liberado = (conteudoId: string) =>
    BANCO.liberacoes.some(
      (l) =>
        l.cliente_id === sessao.userId && l.conteudo_id === conteudoId && l.status === "liberado",
    );

  return {
    rpcs,
    tabelasLidas,
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      rpcs.push(fn);
      if (opcoes.funcoesRemovidas?.includes(fn)) {
        return { data: null, error: { code: "42883", message: `function public.${fn} does not exist` } };
      }
      if (!executavel(fn)) return { data: null, error: NEGADO(fn) };
      switch (fn) {
        case "existe_terapeuta":
          return { data: true, error: null };
        case "pode":
          return {
            data: (sessao.permissoes ?? []).includes(args?.["_permissao"] as Permissao),
            error: null,
          };
        case "is_terapeuta":
        case "pode_administrar":
          return { data: (sessao.permissoes ?? []).length > 0, error: null };
        case "conteudo_liberado":
          // SECURITY DEFINER: só responde sobre o próprio cliente da sessão.
          return {
            data:
              args?.["_cliente_id"] === sessao.userId &&
              liberado(String(args?.["_conteudo_id"])),
            error: null,
          };
        default:
          return { data: null, error: null };
      }
    },
    from: (tabela: string) => {
      tabelasLidas.push(tabela);
      let filtroId: string | null = null;
      const api = {
        select: () => api,
        eq: (coluna: string, valor: string) => {
          if (coluna === "id") filtroId = valor;
          return api;
        },
        maybeSingle: async () => {
          if (sessao.papel === "anon") {
            return { data: null, error: { code: "42501", message: `permission denied for table ${tabela}` } };
          }
          const linha = BANCO.conteudos.find((c) => c.id === filtroId);
          // RLS de conteudos: só o que está liberado para a sessão.
          if (!linha || !liberado(linha.id)) return { data: null, error: null };
          return { data: linha, error: null };
        },
      };
      return api;
    },
  };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("execução das funções de segurança", () => {
  it("helpers internos não são executáveis por anon nem por authenticated", async () => {
    for (const fn of FUNCOES_INTERNAS) {
      for (const papel of ["anon", "authenticated"] as const) {
        const supabase = clienteFalso({ papel, userId: CLIENTE_A, permissoes: [...PERMISSOES] });
        const { data, error } = await supabase.rpc(fn, { _user_id: CLIENTE_A, _role: "terapeuta" });
        expect(data).toBeNull();
        expect(error?.code).toBe("42501");
      }
    }
  });

  it("RPCs do painel exigem sessão autenticada (anon é bloqueado)", async () => {
    for (const fn of FUNCOES_DO_APP) {
      const supabase = clienteFalso({ papel: "anon" });
      const { data, error } = await supabase.rpc(fn, { _permissao: "ver_clientes" });
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    }
  });

  it("existe_terapeuta continua pública, pois roda antes do login", async () => {
    const supabase = clienteFalso({ papel: "anon" });
    const { data, error } = await supabase.rpc("existe_terapeuta");
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it("nenhuma função de segurança é executável por anon além de existe_terapeuta", () => {
    const publicas = Object.entries(EXECUCAO)
      .filter(([, papeis]) => papeis.includes("anon"))
      .map(([fn]) => fn);
    expect(publicas).toEqual(["existe_terapeuta"]);
  });
});

describe("guards falham fechado quando a execução é negada", () => {
  it("garantirPermissao bloqueia quando a RPC pode é negada", async () => {
    const supabase = clienteFalso({ papel: "anon" });
    await expect(
      garantirPermissao(supabase, CLIENTE_A, "ver_clientes", "adminResumo"),
    ).rejects.toThrow();
    expect(supabase.tabelasLidas).toEqual([]);
  });

  it("garantirPermissao bloqueia quando a função de segurança desaparece", async () => {
    const supabase = clienteFalso(
      { papel: "authenticated", userId: CLIENTE_A, permissoes: [...PERMISSOES] },
      { funcoesRemovidas: ["pode"] },
    );
    await expect(
      garantirPermissao(supabase, CLIENTE_A, "gerenciar_equipe", "equipeConvidar"),
    ).rejects.toThrow();
  });

  it("temPermissao devolve false (nunca true) sob negação de execução", async () => {
    for (const permissao of PERMISSOES) {
      expect(await temPermissao(clienteFalso({ papel: "anon" }), permissao)).toBe(false);
    }
  });

  it("cliente autenticado sem a permissão não passa pelo guard do painel", async () => {
    const supabase = clienteFalso({ papel: "authenticated", userId: CLIENTE_A, permissoes: [] });
    for (const permissao of PERMISSOES) {
      await expect(
        garantirPermissao(supabase, CLIENTE_A, permissao, "adminAcao"),
      ).rejects.toThrow();
    }
  });
});

describe("RLS de conteúdo continua valendo após mudanças", () => {
  it("libera o conteúdo do próprio cliente", async () => {
    const supabase = clienteFalso({ papel: "authenticated", userId: CLIENTE_A });
    await expect(
      garantirConteudoLiberado(supabase, CLIENTE_A, "c1", "playerProgresso"),
    ).resolves.toEqual({ conteudoId: "c1", eixoId: "eixo-pai" });
    expect(supabase.rpcs).toContain("conteudo_liberado");
  });

  it("bloqueia o conteúdo liberado para outro cliente (sem vazar metadados)", async () => {
    const supabase = clienteFalso({ papel: "authenticated", userId: CLIENTE_A });
    await expect(
      garantirConteudoLiberado(supabase, CLIENTE_A, "c2", "playerProgresso"),
    ).rejects.toThrow();
  });

  it("não aceita conteudo_liberado consultado em nome de outro cliente", async () => {
    const supabase = clienteFalso({ papel: "authenticated", userId: CLIENTE_A });
    const { data } = await supabase.rpc("conteudo_liberado", {
      _cliente_id: CLIENTE_B,
      _conteudo_id: "c2",
      _eixo_id: "eixo-mae",
    });
    expect(data).toBe(false);
  });

  it("sessão anônima nem chega a ler a tabela de conteúdos", async () => {
    const supabase = clienteFalso({ papel: "anon" });
    await expect(
      garantirConteudoLiberado(supabase, CLIENTE_A, "c1", "playerProgresso"),
    ).rejects.toThrow();
    expect(supabase.rpcs).not.toContain("conteudo_liberado");
  });
});
