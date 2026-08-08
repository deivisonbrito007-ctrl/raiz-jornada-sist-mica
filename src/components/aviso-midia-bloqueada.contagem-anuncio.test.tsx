import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AvisoMidiaBloqueada } from "./aviso-midia-bloqueada";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...resto }: { children: React.ReactNode }) => <a {...resto}>{children}</a>,
}));

const AGORA = 1_700_000_000_000;

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

function statusTexto() {
  return screen.getByRole("status").textContent ?? "";
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("aria-live da contagem e da liberação no aviso do player", () => {
  it("usa uma região polite e atômica para o estado do botão", () => {
    montar();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  it("anuncia que o botão está disponível agora quando não há espera", () => {
    montar();
    expect(statusTexto()).toMatch(/Acesso expirado/i);
    expect(statusTexto()).toMatch(/disponível agora/i);
  });

  it("anuncia a renovação em andamento", () => {
    montar({ renovando: true });
    expect(statusTexto()).toMatch(/Renovando o acesso/i);
  });

  it("anuncia marcos de 5 em 5 segundos durante a espera longa", () => {
    montar({ emEspera: true, esperaAte: AGORA + 20_000 });
    expect(statusTexto()).toMatch(/em espera: 20 segundos/i);

    act(() => {
      vi.setSystemTime(AGORA + 5_000);
      vi.advanceTimersByTime(500);
    });
    expect(statusTexto()).toMatch(/em espera: 15 segundos/i);

    // segundo "quebrado": mantém o texto curto, sem falar a cada segundo
    act(() => {
      vi.setSystemTime(AGORA + 6_000);
      vi.advanceTimersByTime(500);
    });
    expect(statusTexto()).not.toMatch(/14 segundos/i);
    expect(statusTexto()).toMatch(/em espera\./i);
  });

  it("anuncia cada segundo nos últimos cinco da contagem", () => {
    montar({ emEspera: true, esperaAte: AGORA + 5_000 });
    for (const restante of [4, 3, 2, 1]) {
      act(() => {
        vi.setSystemTime(AGORA + (5 - restante) * 1000);
        vi.advanceTimersByTime(500);
      });
      expect(statusTexto()).toMatch(new RegExp(`em espera: ${restante} segundos?`, "i"));
    }
  });

  it("usa singular no último segundo", () => {
    montar({ emEspera: true, esperaAte: AGORA + 1_000 });
    expect(statusTexto()).toMatch(/em espera: 1 segundo\./i);
  });

  it("volta a anunciar disponibilidade quando a espera termina", () => {
    const { rerender } = montar({ emEspera: true, esperaAte: AGORA + 3_000 });
    expect(statusTexto()).toMatch(/em espera: 3 segundos/i);

    rerender(
      <AvisoMidiaBloqueada
        motivo="validade"
        renovando={false}
        emEspera={false}
        onRenovar={() => {}}
      />,
    );
    expect(statusTexto()).toMatch(/Botão “Renovar acesso” disponível agora/i);
  });
});
