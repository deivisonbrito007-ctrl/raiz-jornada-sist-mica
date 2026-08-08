import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { esperarSemViolacoes } from "@/test/axe";

/* eslint-disable @typescript-eslint/no-explicit-any */
const search: { modo?: "entrar" | "cadastro"; next?: string } = {};
const auth = {
  getSession: vi.fn<() => Promise<any>>(),
  signInWithPassword: vi.fn<(args: any) => Promise<any>>(),
  signUp: vi.fn<(args: any) => Promise<any>>(),
};
const estado = { existeTerapeuta: false };
const rpc = vi.fn(async (fn: string) =>
  fn === "existe_terapeuta"
    ? { data: estado.existeTerapeuta, error: null }
    : { data: null, error: null },
);

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => search,
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth, rpc } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { Route } = await import("./auth");
const AuthPage = (Route as unknown as { component: () => React.ReactElement }).component;

describe("axe-core — tela de entrada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    estado.existeTerapeuta = false;
    delete search.modo;
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  });

  it("login não tem violação de acessibilidade", async () => {
    render(<AuthPage />);
    await screen.findByRole("heading", { name: "Bem-vindo de volta" });
    await esperarSemViolacoes();
  });

  it("cadastro não tem violação de acessibilidade", async () => {
    search.modo = "cadastro";
    render(<AuthPage />);
    await screen.findByLabelText("E-mail");
    await esperarSemViolacoes();
  });

  it("mensagem de erro do login não tem violação de acessibilidade", async () => {
    const user = userEvent.setup();
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<AuthPage />);
    await screen.findByLabelText("E-mail");
    await user.type(screen.getByLabelText("E-mail"), "maria@raiz.app");
    await user.type(screen.getByLabelText("Senha"), "segredo123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await expect(esperarSemViolacoes()).resolves.toBeUndefined();
  });
});
