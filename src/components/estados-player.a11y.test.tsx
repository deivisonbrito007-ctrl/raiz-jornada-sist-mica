import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";

/**
 * Estados sem mídia tocando (sem arquivo enviado e falha de carregamento):
 * nome acessível, anúncio do estado do player, foco e caminhos de teclado.
 */

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
    <a href={typeof to === "string" ? to : "#"} {...(props as Record<string, unknown>)}>
      {children as React.ReactNode}
    </a>
  ),
}));

const { AvisoSemMidia } = await import("@/components/aviso-sem-midia");
const { AvisoFalhaCarregamento } = await import("@/components/aviso-falha-carregamento");

describe("estado: mídia ainda não enviada", () => {
  it("é uma região nomeada e anuncia o player indisponível", async () => {
    render(<AvisoSemMidia eixoId="e-1" carregando={false} onVerificar={() => {}} />);
    const regiao = screen.getByRole("region", { name: "A mídia ainda não foi enviada" });
    expect(regiao.getAttribute("aria-busy")).toBe("false");
    expect(screen.getByRole("status").textContent).toContain("Player indisponível");
    expect(await axe(regiao)).toHaveNoViolations();
  });

  it("dá caminho de teclado para verificar de novo, diário e trilha", async () => {
    const onVerificar = vi.fn();
    render(<AvisoSemMidia eixoId="e-1" carregando={false} onVerificar={onVerificar} />);
    await userEvent.tab();
    const botao = screen.getByRole("button", { name: "Verificar de novo" });
    expect(document.activeElement).toBe(botao);
    await userEvent.keyboard("{Enter}");
    expect(onVerificar).toHaveBeenCalledTimes(1);

    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Ir ao diário" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Voltar à trilha" }));
  });

  it("marca a verificação em andamento para leitores de tela", () => {
    render(<AvisoSemMidia carregando onVerificar={() => {}} />);
    expect(screen.getByRole("region").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("button", { name: "Verificando..." }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("Verificando");
  });
});

describe("estado: falha ao carregar a prática", () => {
  it("é um alerta nomeado, sem violações de acessibilidade", async () => {
    render(<AvisoFalhaCarregamento carregando={false} onTentar={() => {}} />);
    const alerta = screen.getByRole("alert", { name: "Não conseguimos carregar esta prática" });
    expect(await axe(alerta)).toHaveNoViolations();
  });

  it("põe o foco no botão de nova tentativa e mantém saída por teclado", async () => {
    const onTentar = vi.fn();
    render(<AvisoFalhaCarregamento carregando={false} onTentar={onTentar} />);
    const botao = screen.getByRole("button", { name: "Tentar de novo" });
    await waitFor(() => expect(document.activeElement).toBe(botao));
    await userEvent.keyboard("{Enter}");
    expect(onTentar).toHaveBeenCalledTimes(1);

    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Voltar à trilha" }));
  });

  it("anuncia a nova tentativa em andamento", () => {
    render(<AvisoFalhaCarregamento carregando onTentar={() => {}} />);
    expect(screen.getByRole("alert").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("Tentando carregar");
  });
});
