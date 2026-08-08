import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CONSULTA_MOVIMENTO_REDUZIDO } from "@/hooks/use-movimento-reduzido";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.ComponentProps<"a"> & { to?: string }) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
}));

const { AvisoMidiaBloqueada } = await import("./aviso-midia-bloqueada");

/** matchMedia fixo: só precisamos do valor inicial da preferência. */
function preferencia(reduzido: boolean) {
  const mq = {
    matches: reduzido,
    media: CONSULTA_MOVIMENTO_REDUZIDO,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null,
  };
  window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;
}

describe("prefer-reduced-motion nos diálogos de acessibilidade", () => {
  const original = window.matchMedia;
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  function renderizar() {
    return render(
      <AvisoMidiaBloqueada
        motivo="validade"
        renovando={false}
        emEspera={false}
        onRenovar={vi.fn()}
      />,
    );
  }

  it("por padrão o aviso entra animado", () => {
    preferencia(false);
    renderizar();
    const aviso = screen.getByRole("alertdialog");
    expect(aviso).toHaveAttribute("data-movimento-reduzido", "false");
    expect(aviso.className).toContain("animate-scale-in");
  });

  it("com movimento reduzido o aviso não recebe animação de entrada", () => {
    preferencia(true);
    renderizar();
    const aviso = screen.getByRole("alertdialog");
    expect(aviso).toHaveAttribute("data-movimento-reduzido", "true");
    expect(aviso.className).not.toContain("animate-scale-in");
  });

  it("rola suavemente até o aviso quando o movimento é permitido", () => {
    preferencia(false);
    renderizar();
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth", block: "center" }),
    );
  });

  it("rola sem suavização quando a pessoa pede menos movimento", () => {
    preferencia(true);
    renderizar();
    expect(scrollIntoView).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: "auto", block: "center" }),
    );
  });

  it("mantém foco, título, texto e anúncios idênticos nas duas preferências", () => {
    preferencia(true);
    const { unmount } = renderizar();
    const botaoReduzido = screen.getByRole("button", { name: /Renovar acesso/ });
    expect(botaoReduzido).toHaveFocus();
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName("O link seguro expirou");
    expect(screen.getByRole("status")).toHaveTextContent("Acesso expirado");
    unmount();

    preferencia(false);
    renderizar();
    expect(screen.getByRole("button", { name: /Renovar acesso/ })).toHaveFocus();
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName("O link seguro expirou");
    expect(screen.getByRole("status")).toHaveTextContent("Acesso expirado");
  });
});
