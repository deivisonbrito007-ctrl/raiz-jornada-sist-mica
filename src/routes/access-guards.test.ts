/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";

const getSession = vi.fn<() => Promise<any>>();
const papeisPorUsuario = new Map<string, string[]>();
const usuarioAtual = { id: "" };

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  redirect: (opts: { to: string }) => Object.assign(new Error("redirect"), { redirect: opts }),
  Outlet: () => null,
  Link: () => null,
  useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession },
    rpc: async (fn: string) => {
      if (fn === "pode_administrar") {
        const papeis = papeisPorUsuario.get(usuarioAtual.id) ?? [];
        return { data: papeis.includes("terapeuta") || papeis.includes("admin"), error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: async (_coluna: string, userId: string) => ({
          data: (papeisPorUsuario.get(userId) ?? []).map((role) => ({ role })),
          error: null,
        }),
      }),
    }),
  },
}));

const { limparCacheAdmin } = await import("@/lib/acesso-admin");

const guardaAutenticado = (await import("./_authenticated/route")).Route as any;
const guardaAdmin = (await import("./_authenticated/admin")).Route as any;

function comUsuario(id: string | null) {
  usuarioAtual.id = id ?? "";
}

async function destinoDoRedirect(fn: () => Promise<unknown>) {
  try {
    await fn();
    return null;
  } catch (erro) {
    return (erro as { redirect?: { to: string } }).redirect?.to ?? null;
  }
}

describe("regras de acesso das rotas autenticadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    papeisPorUsuario.clear();
    comUsuario(null);
    limparCacheAdmin();
  });

  it("manda visitante sem sessão para /auth", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await destinoDoRedirect(() => guardaAutenticado.beforeLoad({}))).toBe("/auth");
  });

  it("manda para /auth quando a sessão está inválida", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: new Error("invalid token") });
    expect(await destinoDoRedirect(() => guardaAutenticado.beforeLoad({}))).toBe("/auth");
  });

  it("libera o acesso e expõe o usuário autenticado", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "cliente-1" } } }, error: null });
    await expect(guardaAutenticado.beforeLoad({})).resolves.toEqual({
      user: { id: "cliente-1" },
    });
  });

  it("bloqueia cliente no painel do terapeuta redirecionando para /app", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "cliente-1" } } }, error: null });
    comUsuario("cliente-1");
    papeisPorUsuario.set("cliente-1", ["cliente"]);
    expect(await destinoDoRedirect(() => guardaAdmin.beforeLoad({}))).toBe("/app");
  });

  it("bloqueia usuário sem nenhum papel no painel do terapeuta", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "sem-papel" } } }, error: null });
    comUsuario("sem-papel");
    expect(await destinoDoRedirect(() => guardaAdmin.beforeLoad({}))).toBe("/app");
  });

  it("manda visitante sem sessão do /admin para /auth", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await destinoDoRedirect(() => guardaAdmin.beforeLoad({}))).toBe("/auth");
  });

  it("permite terapeuta no painel do terapeuta", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "terapeuta-1" } } }, error: null });
    comUsuario("terapeuta-1");
    papeisPorUsuario.set("terapeuta-1", ["terapeuta"]);
    expect(await destinoDoRedirect(() => guardaAdmin.beforeLoad({}))).toBeNull();
  });
});
