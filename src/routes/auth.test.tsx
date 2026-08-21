import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const navigate = vi.fn();
const search: {
  modo?: "entrar" | "cadastro";
  caminho?: "acompanhado" | "autoguiado";
  next?: string;
} = {};

/* eslint-disable @typescript-eslint/no-explicit-any */
const auth = {
  getSession: vi.fn<() => Promise<any>>(),
  getUser: vi.fn<() => Promise<any>>(),
  signInWithPassword: vi.fn<(args: any) => Promise<any>>(),
  signUp: vi.fn<(args: any) => Promise<any>>(),
  resetPasswordForEmail: vi.fn<(email: string, opts: any) => Promise<any>>(),
  resend: vi.fn<(args: any) => Promise<any>>(),
};

const toastError = vi.fn();
/** controla o retorno de existe_terapeuta() no servidor */
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
  useNavigate: () => navigate,
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth, rpc } }));
vi.mock("@/integrations/lovable", () => ({
  lovable: { auth: { signInWithOAuth: vi.fn(async () => ({ redirected: true })) } },
}));
const convitePendenteMock = vi.fn<
  (args: { data: { email: string } }) => Promise<{
    existe: boolean;
    terapeuta: string | null;
    limitado: boolean;
  }>
>();
vi.mock("@/lib/cadastro.functions", () => ({
  existeTerapeuta: async () => ({ existe: estado.existeTerapeuta }),
  convitePendente: (args: { data: { email: string } }) => convitePendenteMock(args),
}));
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
    estado.existeTerapeuta = false;
    delete search.modo;
    delete search.caminho;
    delete search.next;
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.getUser.mockResolvedValue({ data: { user: null } });
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    auth.resend.mockResolvedValue({ error: null });
    convitePendenteMock.mockResolvedValue({ existe: false, terapeuta: null, limitado: false });
    window.sessionStorage.clear();
  });

  it("entra com e-mail e senha e redireciona para a triagem de papel", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Entrar"}));

    await waitFor(() =>
      expect(auth.signInWithPassword).toHaveBeenCalledWith({
        email: "maria@raiz.app",
        password: "segredo123",
      }),
    );
    expect(navigate).toHaveBeenCalledWith({ to: "/entrada", replace: true });
  });

  it("mostra mensagem em português quando as credenciais falham", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: new Error("Invalid login credentials") });
    const user = userEvent.setup();
    render(<AuthPage />);

    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Entrar"}));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("E-mail ou senha não conferem. Confira e tente de novo."),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("permite mostrar e ocultar a senha", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text");
  });

  it("envia o link de recuperação de senha para a rota /reset-password", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    await user.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
    await user.type(screen.getByLabelText("E-mail"), "maria@raiz.app");
    await user.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));

    await waitFor(() =>
      expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("maria@raiz.app", {
        redirectTo: `${window.location.origin}/reset-password`,
      }),
    );
    expect(await screen.findByText(/link de redefinição já está a caminho/i)).toBeInTheDocument();
  });

  it("escolhe o caminho antes dos dados e pede confirmação de e-mail", async () => {
    search.modo = "cadastro";
    const user = userEvent.setup();
    render(<AuthPage />);

    // Passo 1: a escolha do jeito de caminhar vem primeiro.
    expect(screen.getByText("Como você vai usar o Raiz?")).toBeInTheDocument();
    await user.click(screen.getByText("Quero começar por conta própria"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.type(screen.getByLabelText("Como podemos te chamar?"), "Maria");
    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
    expect((auth.signUp.mock.calls[0] as any[])[0].options.data).toEqual({
      nome: "Maria",
      papel: "cliente",
      caminho_entrada: "propria",
    });
    expect(await screen.findByRole("heading", { name: "Confirme seu e-mail" })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("cadastra terapeuta quando o cartão de terapeuta é escolhido", async () => {
    search.modo = "cadastro";
    auth.signUp.mockResolvedValue({ data: { session: { user: { id: "1" } } }, error: null });
    const user = userEvent.setup();
    render(<AuthPage />);

    await waitFor(() => expect(screen.getByText("Sou a terapeuta responsável")).toBeInTheDocument());
    await user.click(screen.getByText("Sou a terapeuta responsável"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText("Como podemos te chamar?"), "Ana");
    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
    expect((auth.signUp.mock.calls[0] as any[])[0].options.data).toEqual({
      nome: "Ana",
      papel: "terapeuta",
      caminho_entrada: "terapeuta",
    });
    expect(navigate).toHaveBeenCalledWith({ to: "/entrada", replace: true });
  });

  it("confere convite antes de criar conta com acompanhamento", async () => {
    search.modo = "cadastro";
    convitePendenteMock.mockResolvedValue({ existe: false, terapeuta: null, limitado: false });
    const user = userEvent.setup();
    render(<AuthPage />);

    await user.click(screen.getByText("Sou cliente de uma terapeuta"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText("Como podemos te chamar?"), "Bia");
    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Conferir convite e continuar" }));

    expect(await screen.findByText(/Não encontramos convite para este e-mail/i)).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
    expect((auth.signUp.mock.calls[0] as any[])[0].options.data.caminho_entrada).toBe("convite");
  });

  it("redireciona quem já tem sessão ativa sem preencher o formulário", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "1" } } });
    render(<AuthPage />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/entrada", replace: true }));
  });
});
