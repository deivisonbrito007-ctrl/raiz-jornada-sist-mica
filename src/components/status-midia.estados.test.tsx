import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Estados visíveis da mídia no player: "Mídia liberada", "Acesso expirado" e
 * "Acesso revogado".
 *
 * O cliente precisa saber, num relance, se pode tocar a prática, se apenas o
 * link seguro venceu (progresso intacto, dá para renovar) ou se o terapeuta
 * recolheu o acesso. Quando o botão de nova tentativa entra em espera, a
 * contagem regressiva tem de ser visível e o botão só voltar a funcionar
 * quando o tempo terminar.
 */

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...props }: any) => (
    <a
      href={
        typeof to === "string" && params?.eixoId ? to.replace("$eixoId", params.eixoId) : "#"
      }
      {...props}
    >
      {children}
    </a>
  ),
}));

const { StatusMidiaBadge } = await import("@/components/status-midia");
const { AvisoMidiaBloqueada } = await import("@/components/aviso-midia-bloqueada");

const onRenovar = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

function bloqueio(props: Partial<React.ComponentProps<typeof AvisoMidiaBloqueada>> = {}) {
  return render(
    <AvisoMidiaBloqueada
      motivo="validade"
      renovando={false}
      emEspera={false}
      onRenovar={onRenovar}
      {...props}
    />,
  );
}

// -------------------------------------------------------------- selo de status

describe("selo de status da mídia no player", () => {
  it("mostra “Mídia liberada” quando a prática pode ser reproduzida", () => {
    render(<StatusMidiaBadge status="liberada" />);
    const selo = screen.getByRole("status");
    expect(selo).toHaveTextContent("Mídia liberada");
    expect(selo).toHaveAccessibleName(
      "Status da mídia: Mídia liberada. Você pode reproduzir esta prática agora.",
    );
  });

  it("mostra “Acesso expirado” explicando que a prática segue liberada", () => {
    render(<StatusMidiaBadge status="expirada" />);
    const selo = screen.getByRole("status");
    expect(selo).toHaveTextContent("Acesso expirado");
    expect(selo).toHaveAccessibleName(/o link seguro venceu/i);
    expect(selo).toHaveAccessibleName(/continua liberada/i);
  });

  it("mostra “Acesso revogado” quando o terapeuta recolhe a prática", () => {
    render(<StatusMidiaBadge status="revogada" />);
    const selo = screen.getByRole("status");
    expect(selo).toHaveTextContent("Acesso revogado");
    expect(selo).toHaveAccessibleName(/recolheu esta prática/i);
  });

  it("cada estado tem rótulo próprio, sem repetir a mensagem de outro", () => {
    const rotulos = (["liberada", "expirada", "revogada", "limitada"] as const).map((status) => {
      const { unmount } = render(<StatusMidiaBadge status={status} />);
      const texto = screen.getByRole("status").textContent ?? "";
      unmount();
      return texto.trim();
    });
    expect(new Set(rotulos).size).toBe(4);
    expect(rotulos).toContain("Mídia liberada");
    expect(rotulos).toContain("Acesso expirado");
    expect(rotulos).toContain("Acesso revogado");
  });
});

// ------------------------------------------------------- aviso: link expirado

describe("aviso de link expirado (Acesso expirado)", () => {
  it("explica a expiração, garante o progresso salvo e oferece “Renovar acesso” ativo", () => {
    bloqueio({ motivo: "validade" });

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "O link seguro expirou" })).toBeInTheDocument();
    expect(screen.getByText(/nenhum progresso foi perdido/i)).toBeInTheDocument();

    const botao = screen.getByRole("button", { name: "Renovar acesso" });
    expect(botao).toBeEnabled();
  });

  it("aciona a renovação ao clicar no botão", async () => {
    const usuario = userEvent.setup();
    bloqueio({ motivo: "validade" });

    await usuario.click(screen.getByRole("button", { name: "Renovar acesso" }));
    expect(onRenovar).toHaveBeenCalledTimes(1);
  });

  it("desabilita o botão e mostra “Renovando...” durante o pedido", () => {
    bloqueio({ motivo: "validade", renovando: true });

    const botao = screen.getByRole("button", { name: "Renovando..." });
    expect(botao).toBeDisabled();
    expect(screen.getByRole("alertdialog")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/pedindo um novo link seguro/i)).toBeInTheDocument();
  });
});

// ----------------------------------------------------- aviso: acesso revogado

describe("aviso de acesso revogado (Acesso revogado)", () => {
  it("informa o recolhimento pelo terapeuta e mantém o progresso já feito", () => {
    bloqueio({ motivo: "revogado", eixoId: "e-1" });

    expect(
      screen.getByRole("heading", { name: "Prática não está mais liberada" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/recolheu o acesso a esta prática/i)).toBeInTheDocument();
    expect(screen.getByText(/permanece salvo/i)).toBeInTheDocument();
  });

  it("oferece “Tentar novamente” e a saída para a trilha do eixo", () => {
    bloqueio({ motivo: "revogado", eixoId: "e-1" });

    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Voltar à trilha" })).toHaveAttribute(
      "href",
      "/app/eixo/e-1",
    );
  });

  it("não mostra o texto de link expirado quando o motivo é revogação", () => {
    bloqueio({ motivo: "revogado", eixoId: "e-1" });

    expect(screen.queryByText("O link seguro expirou")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Renovar acesso" })).not.toBeInTheDocument();
  });
});

// -------------------------------------------- contagem regressiva e habilitação

describe("contagem regressiva e habilitação do botão", () => {
  it("mostra os segundos restantes e mantém o botão desabilitado durante a espera", () => {
    vi.useFakeTimers();
    bloqueio({ motivo: "revogado", emEspera: true, esperaAte: Date.now() + 10_000 });

    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeDisabled();
    expect(screen.getByText(/Aguarde 10 segundos antes de tentar de novo/i)).toBeInTheDocument();
  });

  it("atualiza a contagem conforme o tempo passa", () => {
    vi.useFakeTimers();
    bloqueio({ motivo: "validade", emEspera: true, esperaAte: Date.now() + 10_000 });

    expect(screen.getByText(/Aguarde 10 segundos/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.getByText(/Aguarde 6 segundos/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText(/Aguarde 3 segundos/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Renovar acesso" })).toBeDisabled();
  });

  it("ao terminar a contagem, a mensagem deixa de citar segundos", () => {
    vi.useFakeTimers();
    bloqueio({ motivo: "validade", emEspera: true, esperaAte: Date.now() + 3_000 });

    act(() => {
      vi.advanceTimersByTime(3_500);
    });
    expect(screen.queryByText(/Aguarde \d+ segundos/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Aguarde um instante antes de tentar de novo/i)).toBeInTheDocument();
  });

  it("habilita o botão de novo quando a espera termina", async () => {
    const { rerender } = bloqueio({
      motivo: "validade",
      emEspera: true,
      esperaAte: Date.now() + 2_000,
    });
    expect(screen.getByRole("button", { name: "Renovar acesso" })).toBeDisabled();

    // o player libera a espera quando o tempo passa
    rerender(
      <AvisoMidiaBloqueada
        motivo="validade"
        renovando={false}
        emEspera={false}
        esperaAte={null}
        onRenovar={onRenovar}
      />,
    );

    const botao = screen.getByRole("button", { name: "Renovar acesso" });
    expect(botao).toBeEnabled();
    await userEvent.click(botao);
    expect(onRenovar).toHaveBeenCalledTimes(1);
  });

  it("não dispara renovação com clique enquanto o botão está em espera", async () => {
    const usuario = userEvent.setup();
    bloqueio({ motivo: "revogado", emEspera: true, esperaAte: Date.now() + 5_000 });

    await usuario.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRenovar).not.toHaveBeenCalled();
  });

  it("a mensagem da espera é anunciada por leitores de tela (aria-live)", () => {
    bloqueio({ motivo: "limite", emEspera: true, esperaAte: Date.now() + 8_000 });

    const ajuda = screen.getByText(/Aguarde 8 segundos/i);
    expect(ajuda).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toHaveAttribute(
      "aria-describedby",
      ajuda.id,
    );
  });
});
