import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { gravarIntencaoLogin, lerIntencaoLogin } from "@/lib/intencao-login";

/* eslint-disable @typescript-eslint/no-explicit-any */
const signInWithOAuth = vi.fn<(...args: any[]) => Promise<any>>();
const toastError = vi.fn();

vi.mock("@/integrations/lovable", () => ({
  lovable: { auth: { signInWithOAuth: (...args: any[]) => signInWithOAuth(...args) } },
}));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

const { BotaoGoogle } = await import("./botao-google");

describe("entrada com Google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    signInWithOAuth.mockResolvedValue({ redirected: true });
  });

  it("guarda destino, caminho e papel antes de sair para o Google", async () => {
    const user = userEvent.setup();
    render(<BotaoGoogle destino="/convite/abc" caminho="acompanhado" papel="cliente" />);

    await user.click(screen.getByRole("button", { name: /Continuar com Google/i }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    expect(signInWithOAuth).toHaveBeenCalledWith("google", {
      redirect_uri: window.location.origin,
    });
    expect(lerIntencaoLogin()).toEqual({
      destino: "/convite/abc",
      caminho: "acompanhado",
      papel: "cliente",
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("terapeuta nunca sai com pedido de acompanhamento guardado", async () => {
    const user = userEvent.setup();
    render(<BotaoGoogle caminho="acompanhado" papel="terapeuta" />);

    await user.click(screen.getByRole("button", { name: /Continuar com Google/i }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    expect(lerIntencaoLogin()).toEqual({ destino: null, caminho: null, papel: "terapeuta" });
  });

  it("descarta destino externo em vez de guardá-lo", async () => {
    const user = userEvent.setup();
    render(<BotaoGoogle destino="//site-externo.com" caminho="autoguiado" />);

    await user.click(screen.getByRole("button", { name: /Continuar com Google/i }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    expect(lerIntencaoLogin().destino).toBeNull();
    expect(lerIntencaoLogin().caminho).toBe("autoguiado");
  });

  it("quando o Google falha, avisa em português e não deixa intenção órfã", async () => {
    signInWithOAuth.mockRejectedValue(new Error("Failed to fetch"));
    const user = userEvent.setup();
    render(<BotaoGoogle destino="/entrada" caminho="autoguiado" />);

    await user.click(screen.getByRole("button", { name: /Continuar com Google/i }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.",
      ),
    );
    expect(lerIntencaoLogin()).toEqual({ destino: null, caminho: null, papel: null });
    expect(screen.getByRole("button", { name: /Continuar com Google/i })).toBeEnabled();
  });

  it("trata erro devolvido no resultado, sem exceção", async () => {
    signInWithOAuth.mockResolvedValue({ error: new Error("popup_closed") });
    const user = userEvent.setup();
    render(<BotaoGoogle caminho="autoguiado" />);

    await user.click(screen.getByRole("button", { name: /Continuar com Google/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(lerIntencaoLogin()).toEqual({ destino: null, caminho: null, papel: null });
  });

  it("reescreve a intenção de uma tentativa anterior", async () => {
    gravarIntencaoLogin({ destino: "/convite/antigo", caminho: "acompanhado", papel: "cliente" });
    const user = userEvent.setup();
    render(<BotaoGoogle caminho="autoguiado" papel="cliente" />);

    await user.click(screen.getByRole("button", { name: /Continuar com Google/i }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    expect(lerIntencaoLogin()).toEqual({
      destino: null,
      caminho: "autoguiado",
      papel: "cliente",
    });
  });
});
