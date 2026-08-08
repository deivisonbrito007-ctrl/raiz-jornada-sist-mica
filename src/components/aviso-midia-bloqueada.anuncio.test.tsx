import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AvisoMidiaBloqueada } from "./aviso-midia-bloqueada";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...resto }: { children: React.ReactNode }) => <a {...resto}>{children}</a>,
}));

function montar(motivo: "validade" | "revogado" | "removido" = "validade") {
  return render(
    <AvisoMidiaBloqueada
      motivo={motivo}
      renovando={false}
      emEspera={false}
      onRenovar={() => {}}
    />,
  );
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("anúncio acessível de expiração e remoção", () => {
  it("move o foco para o alerta assim que ele aparece", async () => {
    montar("validade");
    const botao = screen.getByRole("button", { name: "Renovar acesso" });
    await waitFor(() => expect(botao).toHaveFocus());
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("anuncia a expiração do link em uma região aria-live assertiva", async () => {
    montar("validade");
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveAttribute("aria-live", "assertive");
    await waitFor(() => expect(alerta.textContent).toMatch(/link seguro desta prática expirou/i));
    expect(alerta.textContent).toMatch(/reprodução foi interrompida/i);
  });

  it("anuncia a remoção da prática com texto próprio", async () => {
    montar("removido");
    const alerta = screen.getByRole("alert");
    await waitFor(() => expect(alerta.textContent).toMatch(/foi removida pelo terapeuta/i));
    expect(screen.getByRole("heading", { name: "Esta prática foi removida" })).toBeInTheDocument();
  });

  it("troca o anúncio (e refaz o foco) quando o motivo muda de expirado para removido", async () => {
    const { rerender } = montar("validade");
    const alerta = screen.getByRole("alert");
    await waitFor(() => expect(alerta.textContent).toMatch(/expirou/i));

    rerender(
      <AvisoMidiaBloqueada motivo="removido" renovando={false} emEspera={false} onRenovar={() => {}} />,
    );

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/foi removida/i));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Tentar novamente" })).toHaveFocus(),
    );
  });

  it("mantém a região de estado (polite) separada do anúncio assertivo", () => {
    montar("revogado");
    const estado = screen.getByRole("status");
    expect(estado).toHaveAttribute("aria-live", "polite");
    expect(estado.textContent).toMatch(/Acesso revogado/i);
    expect(screen.getByRole("alert")).not.toBe(estado);
  });

  it("rola o aviso até a vista para quem enxerga acompanhar a mudança", async () => {
    montar("removido");
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  });
});
