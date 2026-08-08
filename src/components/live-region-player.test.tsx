import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { CONSULTA_MOVIMENTO_REDUZIDO } from "@/hooks/use-movimento-reduzido";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.ComponentProps<"a"> & { to?: string }) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
}));

const { AvisoMidiaBloqueada } = await import("./aviso-midia-bloqueada");
const { StatusMidiaBadge } = await import("./status-midia");

const AGORA = 1_770_000_000_000;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  const mq = {
    matches: false,
    media: CONSULTA_MOVIMENTO_REDUZIDO,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null,
  };
  window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;
});

/** Texto que o leitor de tela recebe da região com role="status". */
function textoDoStatus() {
  return screen.getByRole("status").textContent?.replace(/\s+/g, " ").trim() ?? "";
}

/** Texto da região assertiva (role="alert") do aviso. */
function textoDoAlerta() {
  return screen.getByRole("alert").textContent?.replace(/\s+/g, " ").trim() ?? "";
}

describe("ARIA live region — selos de status da mídia", () => {
  it("anuncia o selo de mídia liberada com rótulo e explicação", () => {
    render(<StatusMidiaBadge status="liberada" />);
    const selo = screen.getByRole("status");
    expect(selo).toHaveAccessibleName(
      "Status da mídia: Mídia liberada. Você pode reproduzir esta prática agora.",
    );
    expect(selo).toHaveTextContent("Mídia liberada");
  });

  it("anuncia o selo de acesso expirado explicando que a prática segue liberada", () => {
    render(<StatusMidiaBadge status="expirada" />);
    expect(screen.getByRole("status")).toHaveAccessibleName(
      "Status da mídia: Acesso expirado. O link seguro venceu, mas a prática continua liberada para você.",
    );
  });

  it("anuncia o selo de acesso revogado", () => {
    render(<StatusMidiaBadge status="revogada" />);
    expect(screen.getByRole("status")).toHaveAccessibleName(
      "Status da mídia: Acesso revogado. O terapeuta recolheu esta prática por enquanto.",
    );
  });

  it("anuncia o selo de muitos pedidos orientando a esperar", () => {
    render(<StatusMidiaBadge status="limitada" />);
    expect(screen.getByRole("status")).toHaveAccessibleName(
      /Status da mídia: Muitos pedidos\. Você pediu vários links seguros em pouco tempo/,
    );
  });

  it("atualiza o texto anunciado quando o status muda no player", () => {
    const { rerender } = render(<StatusMidiaBadge status="liberada" />);
    expect(screen.getByRole("status")).toHaveAccessibleName(/Mídia liberada/);
    rerender(<StatusMidiaBadge status="expirada" />);
    expect(screen.getByRole("status")).toHaveAccessibleName(/Acesso expirado/);
    rerender(<StatusMidiaBadge status="revogada" />);
    expect(screen.getByRole("status")).toHaveAccessibleName(/Acesso revogado/);
  });
});

describe("ARIA live region — diálogo de bloqueio", () => {
  function renderizar(props: Partial<React.ComponentProps<typeof AvisoMidiaBloqueada>> = {}) {
    return render(
      <AvisoMidiaBloqueada
        motivo="validade"
        renovando={false}
        emEspera={false}
        onRenovar={vi.fn()}
        {...props}
      />,
    );
  }

  it("usa região assertiva e atômica para a mudança que acabou de acontecer", () => {
    renderizar();
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveAttribute("aria-live", "assertive");
    expect(alerta).toHaveAttribute("aria-atomic", "true");
    expect(alerta).toHaveClass("sr-only");
  });

  it("anuncia a expiração do link seguro e a interrupção da reprodução", () => {
    renderizar({ motivo: "validade" });
    expect(textoDoAlerta()).toBe(
      "O link seguro desta prática expirou. A reprodução foi interrompida.",
    );
  });

  it("anuncia a revogação feita pelo terapeuta", () => {
    renderizar({ motivo: "revogado" });
    expect(textoDoAlerta()).toBe(
      "O terapeuta recolheu o acesso agora. A reprodução foi interrompida.",
    );
  });

  it("anuncia a remoção da prática", () => {
    renderizar({ motivo: "removido" });
    expect(textoDoAlerta()).toBe(
      "Esta prática foi removida pelo terapeuta. A reprodução foi interrompida.",
    );
  });

  it("anuncia falha de verificação e limite de pedidos", () => {
    const { unmount } = renderizar({ motivo: "falha" });
    expect(textoDoAlerta()).toBe("Não conseguimos verificar o acesso a esta prática agora.");
    unmount();
    renderizar({ motivo: "limite" });
    expect(textoDoAlerta()).toBe(
      "Muitos pedidos de acesso em pouco tempo. Aguarde para tentar de novo.",
    );
  });

  it("troca o anúncio assertivo quando o motivo do bloqueio muda", () => {
    const { rerender } = renderizar({ motivo: "validade" });
    expect(textoDoAlerta()).toContain("O link seguro desta prática expirou");
    rerender(
      <AvisoMidiaBloqueada
        motivo="revogado"
        renovando={false}
        emEspera={false}
        onRenovar={vi.fn()}
      />,
    );
    expect(textoDoAlerta()).toContain("O terapeuta recolheu o acesso agora");
  });

  it("descreve o estado atual da mídia em região polida e atômica", () => {
    renderizar({ motivo: "revogado" });
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(textoDoStatus()).toBe("Acesso revogado. Botão “Tentar novamente” disponível.");
  });
});

describe("ARIA live region — botão de nova tentativa", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(AGORA);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderizarEspera(segundos: number) {
    return render(
      <AvisoMidiaBloqueada
        motivo="validade"
        renovando={false}
        emEspera
        esperaAte={AGORA + segundos * 1000}
        onRenovar={vi.fn()}
      />,
    );
  }

  /** Avança o relógio e os intervalos da contagem juntos. */
  function avancar(ms: number) {
    act(() => {
      vi.setSystemTime(Date.now() + ms);
      vi.advanceTimersByTime(ms);
    });
  }

  it("anuncia que o acesso está sendo renovado", () => {
    render(
      <AvisoMidiaBloqueada motivo="validade" renovando emEspera={false} onRenovar={vi.fn()} />,
    );
    expect(textoDoStatus()).toBe("Acesso expirado. Renovando o acesso.");
    expect(screen.getByRole("button", { name: "Renovando..." })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("anuncia o botão em espera com os segundos nos marcos (10, 5, 3, 2, 1)", () => {
    renderizarEspera(10);
    expect(textoDoStatus()).toBe(
      "Acesso expirado. Botão “Renovar acesso” em espera: 10 segundos.",
    );
    avancar(5000);
    expect(textoDoStatus()).toBe("Acesso expirado. Botão “Renovar acesso” em espera: 5 segundos.");
    avancar(2000);
    expect(textoDoStatus()).toBe("Acesso expirado. Botão “Renovar acesso” em espera: 3 segundos.");
    avancar(1000);
    expect(textoDoStatus()).toBe("Acesso expirado. Botão “Renovar acesso” em espera: 2 segundos.");
    avancar(1000);
    expect(textoDoStatus()).toBe("Acesso expirado. Botão “Renovar acesso” em espera: 1 segundo.");
  });

  it("não repete os segundos fora dos marcos, evitando fala a cada segundo", () => {
    renderizarEspera(9);
    expect(textoDoStatus()).toBe("Acesso expirado. Botão “Renovar acesso” em espera.");
    avancar(1000); // 8s
    expect(textoDoStatus()).toBe("Acesso expirado. Botão “Renovar acesso” em espera.");
    avancar(1000); // 7s
    expect(textoDoStatus()).toBe("Acesso expirado. Botão “Renovar acesso” em espera.");
    avancar(2000); // 5s → marco
    expect(textoDoStatus()).toBe("Acesso expirado. Botão “Renovar acesso” em espera: 5 segundos.");
  });

  it("anuncia que o botão voltou a ficar disponível ao fim da espera", () => {
    const { rerender } = renderizarEspera(2);
    expect(textoDoStatus()).toContain("em espera: 2 segundos.");
    avancar(2000);
    rerender(
      <AvisoMidiaBloqueada
        motivo="validade"
        renovando={false}
        emEspera={false}
        esperaAte={null}
        onRenovar={vi.fn()}
      />,
    );
    expect(textoDoStatus()).toBe("Acesso expirado. Botão “Renovar acesso” disponível.");
    expect(screen.getByRole("button", { name: "Renovar acesso" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });

  it("descreve na ajuda ligada ao botão o que acontece em cada situação", () => {
    const { rerender, unmount } = renderizarEspera(6);
    const botao = screen.getByRole("button", { name: "Renovar acesso" });
    const ajuda = document.getElementById(botao.getAttribute("aria-describedby")!)!;
    expect(ajuda).toHaveAttribute("aria-live", "polite");
    expect(ajuda.textContent).toContain("Aguarde 6 segundos antes de tentar de novo");

    rerender(
      <AvisoMidiaBloqueada motivo="validade" renovando emEspera={false} onRenovar={vi.fn()} />,
    );
    expect(ajuda.textContent).toContain("pedindo um novo link seguro ao servidor");
    unmount();

    render(
      <AvisoMidiaBloqueada
        motivo="revogado"
        renovando={false}
        emEspera={false}
        onRenovar={vi.fn()}
      />,
    );
    const ajudaLivre = document.getElementById(
      screen.getByRole("button", { name: "Tentar novamente" }).getAttribute("aria-describedby")!,
    )!;
    expect(ajudaLivre.textContent).toContain("Ao acionar “Tentar novamente”");
  });
});
