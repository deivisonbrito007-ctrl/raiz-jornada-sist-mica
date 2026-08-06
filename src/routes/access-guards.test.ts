/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn<() => Promise<any>>();
const papeisPorUsuario = new Map<string, string[]>();

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
    auth: { getUser },
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

const guardaAutenticado = (await import("./_authenticated/route")).Route as any;
const guardaAdmin = (await import("./_authenticated/admin")).Route as any;

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
  });

  it("manda visitante sem sessão para /auth", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await destinoDoRedirect(() => guardaAutenticado.beforeLoad({}))).toBe("/auth");
  });

  it("manda para /auth quando a sessão está inválida", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });
    expect(await destinoDoRedirect(() => guardaAutenticado.beforeLoad({}))).toBe("/auth");
  });

  it("libera o acesso e expõe o usuário autenticado", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "cliente-1" } }, error: null });
    await expect(guardaAutenticado.beforeLoad({})).resolves.toEqual({
      user: { id: "cliente-1" },
    });
  });

  it("bloqueia cliente no painel do terapeuta redirecionando para /app", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "cliente-1" } }, error: null });
    papeisPorUsuario.set("cliente-1", ["cliente"]);
    expect(await destinoDoRedirect(() => guardaAdmin.beforeLoad({}))).toBe("/app");
  });

  it("bloqueia usuário sem nenhum papel no painel do terapeuta", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sem-papel" } }, error: null });
    expect(await destinoDoRedirect(() => guardaAdmin.beforeLoad({}))).toBe("/app");
  });

  it("manda visitante sem sessão do /admin para /auth", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await destinoDoRedirect(() => guardaAdmin.beforeLoad({}))).toBe("/auth");
  });

  it("permite terapeuta no painel do terapeuta", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "terapeuta-1" } }, error: null });
    papeisPorUsuario.set("terapeuta-1", ["terapeuta"]);
    expect(await destinoDoRedirect(() => guardaAdmin.beforeLoad({}))).toBeNull();
  });
});
