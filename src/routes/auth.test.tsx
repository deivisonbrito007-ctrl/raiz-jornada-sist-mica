import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const navigate = vi.fn();
const search: { modo?: "entrar" | "cadastro"; next?: string } = {};

/* eslint-disable @typescript-eslint/no-explicit-any */
const auth = {
  getSession: vi.fn<() => Promise<any>>(),
  signInWithPassword: vi.fn<(args: any) => Promise<any>>(),
  signUp: vi.fn<(args: any) => Promise<any>>(),
};

const toastError = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => search,
  }),
  useNavigate: () => navigate,
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

const { Route } = await import("./auth");
const AuthPage = (Route as unknown as { component: () => React.ReactElement }).component;

async function preencher(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("E-mail"), "maria@raiz.app");
  await user.type(screen.getByLabelText("Senha"), "segredo123");
}

describe("fluxo de login /auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete search.modo;
    delete search.next;
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  });

  it("entra com e-mail e senha e redireciona para a triagem de papel", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(auth.signInWithPassword).toHaveBeenCalledWith({
        email: "maria@raiz.app",
        password: "segredo123",
      }),
    );
    expect(navigate).toHaveBeenCalledWith({ to: "/entrada", replace: true });
  });

  it("mostra erro e não redireciona quando as credenciais falham", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: new Error("Invalid login credentials") });
    const user = userEvent.setup();
    render(<AuthPage />);

    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Invalid login credentials"));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("cadastra cliente por padrão e pede confirmação de e-mail", async () => {
    search.modo = "cadastro";
    const user = userEvent.setup();
    render(<AuthPage />);

    await user.type(screen.getByLabelText("Como podemos te chamar?"), "Maria");
    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
    expect((auth.signUp.mock.calls[0] as any[])[0].options.data).toEqual({ nome: "Maria", papel: "cliente" });
    expect(await screen.findByRole("heading", { name: "Confirme seu e-mail" })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("cadastra terapeuta quando a opção de terapeuta é marcada", async () => {
    search.modo = "cadastro";
    auth.signUp.mockResolvedValue({ data: { session: { user: { id: "1" } } }, error: null });
    const user = userEvent.setup();
    render(<AuthPage />);

    await user.type(screen.getByLabelText("Como podemos te chamar?"), "Ana");
    await preencher(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
    expect((auth.signUp.mock.calls[0] as any[])[0].options.data).toEqual({ nome: "Ana", papel: "terapeuta" });
    expect(navigate).toHaveBeenCalledWith({ to: "/entrada", replace: true });
  });

  it("redireciona quem já tem sessão ativa sem preencher o formulário", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "1" } } } });
    render(<AuthPage />);

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: "/entrada", replace: true }),
    );
  });
});
