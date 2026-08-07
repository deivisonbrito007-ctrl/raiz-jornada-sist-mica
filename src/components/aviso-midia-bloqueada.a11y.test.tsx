import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvisoMidiaBloqueada } from "./aviso-midia-bloqueada";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: any) => <a href="#trilha" {...rest}>{children}</a>,
}));

function montar(props: Partial<React.ComponentProps<typeof AvisoMidiaBloqueada>> = {}) {
  return render(
    <AvisoMidiaBloqueada
      motivo="validade"
      renovando={false}
      emEspera={false}
      onRenovar={() => {}}
      {...props}
    />,
  );
}

describe("acessibilidade do aviso de mídia bloqueada", () => {
  it("é anunciado como diálogo de alerta com título e descrição ligados", () => {
    montar();
    const dialogo = screen.getByRole("alertdialog");
    expect(dialogo).toHaveAccessibleName("O link seguro expirou");
    expect(dialogo).toHaveAccessibleDescription(/link de reprodução/i);
  });

  it("move o foco para o botão de renovar assim que aparece", async () => {
    montar();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Renovar acesso" })).toHaveFocus(),
    );
  });

  it("foca o próprio diálogo quando o botão está em espera", async () => {
    montar({ emEspera: true, esperaAte: Date.now() + 5000 });
    await waitFor(() => expect(screen.getByRole("alertdialog")).toHaveFocus());
  });

  it("mantém o Tab circulando entre os controles do aviso", async () => {
    const user = userEvent.setup();
    montar({ motivo: "revogado", eixoId: "eixo-1" });
    const botao = screen.getByRole("button", { name: "Tentar novamente" });
    const link = screen.getByRole("link", { name: "Voltar à trilha" });
    await waitFor(() => expect(botao).toHaveFocus());
    await user.tab();
    expect(link).toHaveFocus();
    await user.tab();
    expect(botao).toHaveFocus();
    await user.tab({ shift: true });
    expect(link).toHaveFocus();
  });

  it("Esc devolve o foco para fora do aviso", async () => {
    const user = userEvent.setup();
    const onSair = vi.fn();
    montar({ onSair });
    await user.keyboard("{Escape}");
    expect(onSair).toHaveBeenCalled();
  });

  it("marca o aviso como ocupado e descreve a espera durante a renovação", () => {
    const { unmount } = montar({ renovando: true });
    expect(screen.getByRole("alertdialog")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/pedindo um novo link seguro/i)).toBeInTheDocument();
    unmount();
    montar({ emEspera: true, esperaAte: Date.now() + 4000 });
    expect(screen.getByText(/Aguarde .*segundos/i)).toBeInTheDocument();
  });
});
