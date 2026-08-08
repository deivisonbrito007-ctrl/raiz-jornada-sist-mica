import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { AvisoMidiaBloqueada } from "./aviso-midia-bloqueada";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: any) => (
    <a href="#trilha" {...rest}>
      {children}
    </a>
  ),
}));

const INICIO = new Date("2026-02-01T12:00:00Z").getTime();

function montar(props: Partial<React.ComponentProps<typeof AvisoMidiaBloqueada>> = {}) {
  return render(
    <AvisoMidiaBloqueada
      motivo="validade"
      renovando={false}
      emEspera
      esperaAte={INICIO + 10_000}
      onRenovar={() => {}}
      {...props}
    />,
  );
}

/** Texto de ajuda ligado ao botão — é onde a contagem aparece na tela. */
function ajuda() {
  const botao = screen.getByRole("button");
  return document.getElementById(botao.getAttribute("aria-describedby")!)!;
}

describe("contagem regressiva do player com timers falsos", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(INICIO);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("mostra os segundos restantes e diminui conforme o tempo avança", () => {
    montar();
    expect(ajuda()).toHaveTextContent(/Aguarde 10 segundos/i);
    act(() => vi.advanceTimersByTime(4_000));
    expect(ajuda()).toHaveTextContent(/Aguarde 6 segundos/i);
    act(() => vi.advanceTimersByTime(5_000));
    expect(ajuda()).toHaveTextContent(/Aguarde 1 segundos?/i);
  });

  it("nunca conta abaixo de zero, mesmo avançando muito além da espera", () => {
    montar();
    act(() => vi.advanceTimersByTime(60_000));
    expect(ajuda()).toHaveTextContent(/Aguarde um instante/i);
    expect(ajuda().textContent).not.toMatch(/-\d/);
  });

  it("o botão só volta a acionar quando o pai encerra a espera", () => {
    const onRenovar = vi.fn();
    const { rerender } = montar({ onRenovar });
    const botao = screen.getByRole("button", { name: "Renovar acesso" });
    act(() => vi.advanceTimersByTime(9_000));
    botao.click();
    expect(onRenovar).not.toHaveBeenCalled();
    expect(botao).toHaveAttribute("aria-disabled", "true");

    act(() => vi.advanceTimersByTime(2_000));
    rerender(
      <AvisoMidiaBloqueada
        motivo="validade"
        renovando={false}
        emEspera={false}
        esperaAte={null}
        onRenovar={onRenovar}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-disabled", "false");
    screen.getByRole("button").click();
    expect(onRenovar).toHaveBeenCalledTimes(1);
  });

  it("uma nova espera reinicia a contagem do zero", () => {
    const { rerender } = montar();
    act(() => vi.advanceTimersByTime(8_000));
    expect(ajuda()).toHaveTextContent(/Aguarde 2 segundos/i);

    const agora = Date.now();
    rerender(
      <AvisoMidiaBloqueada
        motivo="validade"
        renovando={false}
        emEspera
        esperaAte={agora + 30_000}
        onRenovar={() => {}}
      />,
    );
    expect(ajuda()).toHaveTextContent(/Aguarde 30 segundos/i);
  });

  it("sem espera ativa o texto não conta nada e o tempo passando não muda a tela", () => {
    montar({ emEspera: false, esperaAte: null });
    const antes = ajuda().textContent;
    act(() => vi.advanceTimersByTime(30_000));
    expect(ajuda().textContent).toBe(antes);
    expect(ajuda().textContent).not.toMatch(/Aguarde/i);
  });
});

describe("troca rápida de telas durante a espera", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(INICIO);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sair do player durante a espera não deixa a contagem atualizando nada", () => {
    const erros = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = montar();
    act(() => vi.advanceTimersByTime(2_000));
    unmount();
    // o tempo continua correndo, mas não há mais tela para atualizar
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(erros).not.toHaveBeenCalled();
    erros.mockRestore();
  });

  it("voltar ao player no meio da espera retoma a contagem no ponto certo", () => {
    const { unmount } = montar();
    act(() => vi.advanceTimersByTime(3_000));
    unmount();
    // navegou para a trilha e ficou 4 segundos fora
    act(() => vi.advanceTimersByTime(4_000));
    montar();
    expect(ajuda()).toHaveTextContent(/Aguarde 3 segundos/i);
  });

  it("voltar depois da espera terminar mostra o botão pronto, sem contagem antiga", () => {
    const { unmount } = montar();
    unmount();
    act(() => vi.advanceTimersByTime(15_000));
    montar({ emEspera: false, esperaAte: null });
    expect(ajuda()).toHaveTextContent(/Ao acionar “Renovar acesso”/i);
    expect(ajuda().textContent).not.toMatch(/Aguarde/i);
    expect(screen.getByRole("button")).toHaveAttribute("aria-disabled", "false");
  });

  it("idas e vindas repetidas não duplicam avisos nem estragam a contagem", () => {
    const erros = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 5; i++) {
      const { unmount } = montar();
      act(() => vi.advanceTimersByTime(500));
      unmount();
    }
    montar();
    // uma única caixa de aviso e um único anúncio na tela, com o tempo certo
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(ajuda()).toHaveTextContent(/Aguarde 8 segundos/i);
    expect(erros).not.toHaveBeenCalled();
    erros.mockRestore();
  });

  it("mudar o motivo do bloqueio no meio da espera mantém a contagem e refoca o botão", async () => {
    const { rerender } = montar();
    act(() => vi.advanceTimersByTime(6_000));
    rerender(
      <AvisoMidiaBloqueada
        motivo="limite"
        renovando={false}
        emEspera
        esperaAte={INICIO + 10_000}
        onRenovar={() => {}}
      />,
    );
    const botao = screen.getByRole("button", { name: "Tentar novamente" });
    await waitFor(() => expect(botao).toHaveFocus());
    expect(ajuda()).toHaveTextContent(/Aguarde 4 segundos/i);
    expect(screen.getByRole("status")).toHaveTextContent(/Muitos pedidos/i);
  });

  it("a espera não se perde ao alternar para o estado de renovando e voltar", () => {
    const { rerender } = montar();
    act(() => vi.advanceTimersByTime(2_000));
    rerender(
      <AvisoMidiaBloqueada
        motivo="validade"
        renovando
        emEspera
        esperaAte={INICIO + 10_000}
        onRenovar={() => {}}
      />,
    );
    expect(ajuda()).toHaveTextContent(/Estamos pedindo um novo link seguro/i);
    rerender(
      <AvisoMidiaBloqueada
        motivo="validade"
        renovando={false}
        emEspera
        esperaAte={INICIO + 10_000}
        onRenovar={() => {}}
      />,
    );
    expect(ajuda()).toHaveTextContent(/Aguarde 8 segundos/i);
  });
});
