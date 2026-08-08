import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Mensagens e estados de UI dos avisos de bloqueio.
 *
 * Cada motivo (link expirado, prática removida da sequência, falha de conexão,
 * limite de pedidos) precisa ter título, explicação e rótulo de ação próprios —
 * e o selo de status precisa dizer a mesma coisa. Sem mistura de mensagens.
 */

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...props }: any) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
}));

const { AvisoMidiaBloqueada } = await import("@/components/aviso-midia-bloqueada");
const { StatusMidiaBadge } = await import("@/components/status-midia");

function montarAviso(props: Partial<Parameters<typeof AvisoMidiaBloqueada>[0]> = {}) {
  return render(
    <AvisoMidiaBloqueada
      motivo="validade"
      renovando={false}
      emEspera={false}
      onRenovar={vi.fn()}
      {...(props as any)}
    />,
  );
}

describe("mensagens do aviso de mídia bloqueada", () => {
  it("link expirado: explica a validade e oferece renovar o acesso", () => {
    montarAviso({ motivo: "validade" });
    expect(screen.getByRole("heading", { name: "O link seguro expirou" })).toBeInTheDocument();
    expect(screen.getByText(/tempo de validade por segurança/i)).toBeInTheDocument();
    expect(screen.getByText(/nenhum progresso foi perdido/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Renovar acesso" })).toBeEnabled();
    // nada de mensagem de revogação nem atalho para a trilha nesse caso
    expect(screen.queryByText(/não está mais liberada/i)).toBeNull();
    expect(screen.queryByRole("link", { name: "Voltar à trilha" })).toBeNull();
  });

  it("removida da sequência: avisa que o terapeuta recolheu e mostra volta à trilha", () => {
    montarAviso({ motivo: "revogado", eixoId: "e-1" });
    expect(
      screen.getByRole("heading", { name: "Prática não está mais liberada" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/recolheu o acesso a esta prática/i)).toBeInTheDocument();
    expect(screen.getByText(/O que você já praticou permanece salvo/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar à trilha" })).toBeInTheDocument();
    // o CTA de acesso deixa de prometer renovação: só uma nova tentativa
    expect(screen.queryByRole("button", { name: "Renovar acesso" })).toBeNull();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("falha de conexão: mensagem própria, sem afirmar que perdeu a liberação", () => {
    montarAviso({ motivo: "falha" });
    expect(
      screen.getByRole("heading", { name: "Não conseguimos renovar agora" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Aconteceu uma falha de conexão/i)).toBeInTheDocument();
    expect(screen.queryByText(/não está mais liberada/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("limite de pedidos: pede espera e o CTA fica desabilitado com contagem", () => {
    montarAviso({ motivo: "limite", emEspera: true, esperaAte: Date.now() + 8_000 });
    expect(
      screen.getByRole("heading", { name: "Muitos pedidos em pouco tempo" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/Aguarde \d+ segundos|Aguarde um instante/i)).toBeInTheDocument();
  });

  it("enquanto renova, o CTA sai do ar e vira estado de carregamento", () => {
    montarAviso({ motivo: "validade", renovando: true });
    expect(screen.queryByRole("button", { name: "Renovar acesso" })).toBeNull();
    expect(screen.getByRole("button", { name: "Renovando..." })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("alertdialog")).toHaveAttribute("aria-busy", "true");
  });
});

describe("selo de status da mídia", () => {
  const casos = [
    ["liberada", "Mídia liberada", "Você pode reproduzir esta prática agora."],
    ["expirada", "Acesso expirado", "O link seguro venceu, mas a prática continua liberada"],
    ["revogada", "Acesso revogado", "O terapeuta recolheu esta prática por enquanto."],
    ["limitada", "Muitos pedidos", "Aguarde um instante e tente de novo."],
  ] as const;

  it.each(casos)("%s mostra rótulo e descrição corretos", (status, rotulo, descricao) => {
    const { unmount } = render(<StatusMidiaBadge status={status} />);
    const selo = screen.getByRole("status");
    expect(selo).toHaveTextContent(rotulo);
    expect(selo.getAttribute("aria-label")).toContain(rotulo);
    expect(selo.getAttribute("aria-label")).toContain(descricao.slice(0, 20));
    unmount();
  });

  it("nunca mistura expirado com revogado", () => {
    render(<StatusMidiaBadge status="expirada" />);
    expect(screen.queryByText("Acesso revogado")).toBeNull();
  });
});
