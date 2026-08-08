import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvisoMidiaBloqueada } from "./aviso-midia-bloqueada";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Acessibilidade do aviso do player: o estado atual (expirado, revogado,
 * renovando, em espera) precisa chegar a quem usa leitor de tela por região
 * aria-live, e o botão de nova tentativa precisa continuar operável só pelo
 * teclado — inclusive durante a espera, quando ele fica focável e anunciado
 * como indisponível em vez de desaparecer da ordem de tabulação.
 */

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: any) => (
    <a href="#trilha" {...rest}>
      {children}
    </a>
  ),
}));

const onRenovar = vi.fn();

function montar(props: Partial<React.ComponentProps<typeof AvisoMidiaBloqueada>> = {}) {
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

/** Região viva com o estado da mídia (a que leitores de tela anunciam). */
function anuncio() {
  const regioes = screen.getAllByRole("status");
  return regioes.find((el) => el.getAttribute("aria-live") === "polite")!;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ------------------------------------------------------------------- aria-live

describe("mensagens em aria-live com o status do player", () => {
  it("anuncia o estado de link expirado e que o botão está disponível", () => {
    montar({ motivo: "validade" });
    const regiao = anuncio();
    expect(regiao).toHaveAttribute("aria-live", "polite");
    expect(regiao).toHaveAttribute("aria-atomic", "true");
    expect(regiao).toHaveTextContent("Acesso expirado");
    expect(regiao).toHaveTextContent(/Renovar acesso.*dispon/i);
  });

  it("anuncia o estado de acesso revogado", () => {
    montar({ motivo: "revogado", eixoId: "e-1" });
    expect(anuncio()).toHaveTextContent("Acesso revogado");
  });

  it("anuncia que a renovação está em andamento", () => {
    montar({ motivo: "validade", renovando: true });
    expect(anuncio()).toHaveTextContent(/Renovando o acesso/i);
  });

  it("anuncia a espera com os segundos restantes e atualiza em marcos", () => {
    vi.useFakeTimers();
    montar({ motivo: "revogado", emEspera: true, esperaAte: Date.now() + 10_000 });

    expect(anuncio()).toHaveTextContent(/em espera: 10 segundos/i);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(anuncio()).toHaveTextContent(/em espera: 5 segundos/i);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(anuncio()).toHaveTextContent(/em espera: 2 segundos/i);
  });

  it("volta a anunciar disponibilidade quando a espera termina", () => {
    const { rerender } = montar({
      motivo: "validade",
      emEspera: true,
      esperaAte: Date.now() + 3_000,
    });
    expect(anuncio()).toHaveTextContent(/em espera/i);

    rerender(
      <AvisoMidiaBloqueada
        motivo="validade"
        renovando={false}
        emEspera={false}
        esperaAte={null}
        onRenovar={onRenovar}
      />,
    );
    expect(anuncio()).toHaveTextContent(/dispon/i);
    expect(anuncio()).not.toHaveTextContent(/em espera/i);
  });

  it("a região viva é só para leitores de tela, sem duplicar texto na tela", () => {
    montar({ motivo: "revogado", eixoId: "e-1" });
    expect(anuncio()).toHaveClass("sr-only");
  });
});

// -------------------------------------------------------- teclado durante espera

describe("suporte a teclado no botão de nova tentativa durante a espera", () => {
  it("o botão segue na ordem de tabulação e recebe foco durante a espera", async () => {
    montar({ motivo: "revogado", eixoId: "e-1", emEspera: true, esperaAte: Date.now() + 6_000 });
    const botao = screen.getByRole("button", { name: "Tentar novamente" });

    await waitFor(() => expect(botao).toHaveFocus());
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).not.toHaveAttribute("disabled");
  });

  it("Tab continua circulando entre botão e link mesmo com o botão em espera", async () => {
    const usuario = userEvent.setup();
    montar({ motivo: "revogado", eixoId: "e-1", emEspera: true, esperaAte: Date.now() + 6_000 });
    const botao = screen.getByRole("button", { name: "Tentar novamente" });
    const link = screen.getByRole("link", { name: "Voltar à trilha" });

    await waitFor(() => expect(botao).toHaveFocus());
    await usuario.tab();
    expect(link).toHaveFocus();
    await usuario.tab();
    expect(botao).toHaveFocus();
  });

  it("Enter e Espaço no botão em espera não disparam nova tentativa", async () => {
    const usuario = userEvent.setup();
    montar({ motivo: "validade", emEspera: true, esperaAte: Date.now() + 6_000 });
    const botao = screen.getByRole("button", { name: "Renovar acesso" });

    await waitFor(() => expect(botao).toHaveFocus());
    await usuario.keyboard("{Enter}");
    await usuario.keyboard(" ");
    expect(onRenovar).not.toHaveBeenCalled();
  });

  it("Enter aciona a renovação assim que a espera termina", async () => {
    const usuario = userEvent.setup();
    const { rerender } = montar({
      motivo: "validade",
      emEspera: true,
      esperaAte: Date.now() + 2_000,
    });
    const botao = screen.getByRole("button", { name: "Renovar acesso" });
    await waitFor(() => expect(botao).toHaveFocus());

    rerender(
      <AvisoMidiaBloqueada
        motivo="validade"
        renovando={false}
        emEspera={false}
        esperaAte={null}
        onRenovar={onRenovar}
      />,
    );

    await usuario.keyboard("{Enter}");
    expect(onRenovar).toHaveBeenCalledTimes(1);
  });

  it("Espaço aciona a renovação quando o botão está liberado", async () => {
    const usuario = userEvent.setup();
    montar({ motivo: "revogado", eixoId: "e-1" });
    const botao = screen.getByRole("button", { name: "Tentar novamente" });

    await waitFor(() => expect(botao).toHaveFocus());
    await usuario.keyboard(" ");
    expect(onRenovar).toHaveBeenCalledTimes(1);
  });

  it("Esc continua devolvendo o foco para fora, mesmo durante a espera", async () => {
    const usuario = userEvent.setup();
    const onSair = vi.fn();
    montar({ motivo: "validade", emEspera: true, esperaAte: Date.now() + 6_000, onSair });

    await usuario.keyboard("{Escape}");
    expect(onSair).toHaveBeenCalled();
  });

  it("o botão em espera aponta para a explicação da contagem (aria-describedby)", async () => {
    montar({ motivo: "limite", emEspera: true, esperaAte: Date.now() + 8_000 });
    const botao = screen.getByRole("button", { name: "Tentar novamente" });
    const ajuda = document.getElementById(botao.getAttribute("aria-describedby")!);

    expect(ajuda).toHaveAttribute("aria-live", "polite");
    expect(ajuda).toHaveTextContent(/Aguarde 8 segundos/i);
  });
});
