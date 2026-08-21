import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { gravarIntencaoLogin, lerIntencaoLogin } from "@/lib/intencao-login";

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

  it("limpa a intenção guardada quando a pessoa entra por e-mail e senha", async () => {
    gravarIntencaoLogin({ destino: "/convite/1", caminho: "acompanhado", papel: "cliente" });
    const user = userEvent.setup();
    render(<AuthPage />);

    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(auth.signInWithPassword).toHaveBeenCalled());
    expect(lerIntencaoLogin()).toEqual({ destino: null, caminho: null, papel: null });
  });
});

describe("conferência de convite no cadastro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    estado.existeTerapeuta = true;
    search.modo = "cadastro";
    delete search.caminho;
    delete search.next;
    auth.getUser.mockResolvedValue({ data: { user: null } });
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    convitePendenteMock.mockResolvedValue({ existe: false, terapeuta: null, limitado: false });
    window.sessionStorage.clear();
  });

  async function irParaDadosComAcompanhamento(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByText("Sou cliente de uma terapeuta"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText("Como podemos te chamar?"), "Bia");
    await preencher(user);
  }

  it("anuncia o convite encontrado e só cria a conta no segundo passo", async () => {
    convitePendenteMock.mockResolvedValue({ existe: true, terapeuta: "Ana", limitado: false });
    const user = userEvent.setup();
    render(<AuthPage />);

    await irParaDadosComAcompanhamento(user);
    await user.click(screen.getByRole("button", { name: "Conferir convite e continuar" }));

    expect(convitePendenteMock).toHaveBeenCalledWith({ data: { email: "maria@raiz.app" } });
    expect(await screen.findByText(/Encontramos um convite para este e-mail de Ana/i)).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
    expect((auth.signUp.mock.calls[0] as any[])[0].options.data).toEqual({
      nome: "Bia",
      papel: "cliente",
      caminho_entrada: "convite",
    });
  });

  it("não trava o cadastro quando a conferência falha", async () => {
    convitePendenteMock.mockRejectedValue(new Error("rede fora"));
    const user = userEvent.setup();
    render(<AuthPage />);

    await irParaDadosComAcompanhamento(user);
    await user.click(screen.getByRole("button", { name: "Conferir convite e continuar" }));

    expect(await screen.findByText(/Não encontramos convite para este e-mail/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
  });

  it("não trava o cadastro quando o limite por e-mail é atingido", async () => {
    convitePendenteMock.mockResolvedValue({ existe: false, terapeuta: null, limitado: true });
    const user = userEvent.setup();
    render(<AuthPage />);

    await irParaDadosComAcompanhamento(user);
    await user.click(screen.getByRole("button", { name: "Conferir convite e continuar" }));

    expect(await screen.findByText(/Não encontramos convite para este e-mail/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalled());
    expect((auth.signUp.mock.calls[0] as any[])[0].options.data.caminho_entrada).toBe("convite");
  });
});

describe("troca de passo e de escolha no cadastro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    estado.existeTerapeuta = true;
    search.modo = "cadastro";
    delete search.caminho;
    delete search.next;
    auth.getUser.mockResolvedValue({ data: { user: null } });
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    convitePendenteMock.mockResolvedValue({ existe: false, terapeuta: null, limitado: false });
    window.sessionStorage.clear();
  });

  it("o Google aparece só depois da escolha", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    expect(screen.queryByRole("button", { name: /Google/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("button", { name: /Continuar com Google/i })).toBeInTheDocument();
  });

  it("volta para a escolha pelo atalho 'trocar' sem perder os dados", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    await user.click(screen.getByText("Quero começar por conta própria"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText("Como podemos te chamar?"), "Bia");

    await user.click(screen.getByRole("button", { name: "trocar" }));
    expect(screen.getByText("Como você vai usar o Raiz?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByLabelText("Como podemos te chamar?")).toHaveValue("Bia");
  });

  it("volta para a escolha pelo botão do rodapé do passo 2", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: /Voltar para a escolha/i }));

    expect(screen.getByText("Como você vai usar o Raiz?")).toBeInTheDocument();
  });

  it("trocar de escolha invalida a conferência de convite anterior", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    await user.click(screen.getByText("Sou cliente de uma terapeuta"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await preencher(user);
    await user.type(screen.getByLabelText("Como podemos te chamar?"), "Bia");
    await user.click(screen.getByRole("button", { name: "Conferir convite e continuar" }));
    expect(await screen.findByText(/Não encontramos convite/i)).toBeInTheDocument();

    // Troca para autoguiado: o aviso e a conferência somem.
    await user.click(screen.getByRole("button", { name: "trocar" }));
    await user.click(screen.getByText("Quero começar por conta própria"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.queryByText(/Não encontramos convite/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeInTheDocument();

    // Volta para acompanhamento: precisa conferir de novo antes de criar.
    await user.click(screen.getByRole("button", { name: "trocar" }));
    await user.click(screen.getByText("Sou cliente de uma terapeuta"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(
      screen.getByRole("button", { name: "Conferir convite e continuar" }),
    ).toBeInTheDocument();
  });

  it("trocar a aba leva o estado para a URL", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    await user.click(screen.getByRole("tab", { name: "Entrar" }));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/auth", replace: true }),
    );
    const chamada = (navigate.mock.calls.at(-1) as any[])[0];
    expect(chamada.search({ modo: "cadastro" })).toEqual({ modo: "entrar" });
  });

  it("quem chega com a escolha na URL já entra nos dados com o resumo à vista", async () => {
    search.caminho = "acompanhado";
    const user = userEvent.setup();
    render(<AuthPage />);

    expect(screen.getByLabelText("Como podemos te chamar?")).toBeInTheDocument();
    expect(screen.getByText("Com acompanhamento")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "trocar" }));
    expect(screen.getByText("Sua escolha")).toBeInTheDocument();
  });
});
