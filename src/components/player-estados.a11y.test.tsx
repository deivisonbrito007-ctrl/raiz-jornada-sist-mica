import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusMidiaBadge, type StatusMidia } from "./status-midia";
import { AvisoMidiaBloqueada } from "./aviso-midia-bloqueada";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: any) => (
    <a href="#trilha" {...rest}>
      {children}
    </a>
  ),
}));

function montarAviso(props: Partial<React.ComponentProps<typeof AvisoMidiaBloqueada>> = {}) {
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

/** Anel de foco visível declarado na própria classe do elemento. */
function temAnelDeFoco(el: HTMLElement) {
  return /focus-visible:ring-2/.test(el.className) && /focus-visible:ring-floresta/.test(el.className);
}

describe("acessibilidade dos selos de status do player", () => {
  const casos: [StatusMidia, string, RegExp][] = [
    ["liberada", "Mídia liberada", /reproduzir esta prática agora/i],
    ["expirada", "Acesso expirado", /link seguro venceu/i],
    ["revogada", "Acesso revogado", /recolheu esta prática/i],
    ["limitada", "Muitos pedidos", /vários links seguros/i],
  ];

  it.each(casos)("o selo %s é lido como status com rótulo e explicação", (status, rotulo, texto) => {
    render(<StatusMidiaBadge status={status} />);
    const selo = screen.getByRole("status");
    // o leitor de tela recebe situação + o que ela significa, não só a cor
    expect(selo).toHaveAccessibleName(new RegExp(`Status da mídia: ${rotulo}`));
    expect(selo.getAttribute("aria-label")).toMatch(texto);
    // e o texto continua visível para quem enxerga
    expect(selo).toHaveTextContent(rotulo);
  });

  it("o ícone do selo é decorativo e não polui a leitura", () => {
    render(<StatusMidiaBadge status="revogada" />);
    const selo = screen.getByRole("status");
    const icone = selo.querySelector("svg");
    expect(icone).not.toBeNull();
    expect(icone).toHaveAttribute("aria-hidden", "true");
  });

  it("o selo não entra na ordem de tabulação (é informação, não controle)", async () => {
    const user = userEvent.setup();
    render(
      <>
        <StatusMidiaBadge status="expirada" />
        <button type="button">Depois do selo</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Depois do selo" })).toHaveFocus();
  });
});

describe("acessibilidade do diálogo de bloqueio do player", () => {
  const motivos: [React.ComponentProps<typeof AvisoMidiaBloqueada>["motivo"], string, string][] = [
    ["validade", "O link seguro expirou", "Renovar acesso"],
    ["revogado", "Prática não está mais liberada", "Tentar novamente"],
    ["removido", "Esta prática foi removida", "Tentar novamente"],
    ["falha", "Não conseguimos renovar agora", "Tentar novamente"],
    ["limite", "Muitos pedidos em pouco tempo", "Tentar novamente"],
  ];

  it.each(motivos)("%s abre um alertdialog nomeado e com foco no botão", async (motivo, titulo, botao) => {
    montarAviso({ motivo });
    const dialogo = screen.getByRole("alertdialog");
    expect(dialogo).toHaveAccessibleName(titulo);
    expect(dialogo).toHaveAccessibleDescription();
    await waitFor(() => expect(screen.getByRole("button", { name: botao })).toHaveFocus());
  });

  it("o título do aviso é um cabeçalho de verdade, não texto solto", () => {
    montarAviso({ motivo: "removido" });
    expect(screen.getByRole("heading", { name: "Esta prática foi removida" })).toBeInTheDocument();
  });

  it("a caixa e todos os controles declaram anel de foco visível", () => {
    montarAviso({ motivo: "revogado", eixoId: "eixo-1" });
    expect(temAnelDeFoco(screen.getByRole("alertdialog"))).toBe(true);
    expect(temAnelDeFoco(screen.getByRole("button", { name: "Tentar novamente" }))).toBe(true);
    expect(temAnelDeFoco(screen.getByRole("link", { name: "Voltar à trilha" }))).toBe(true);
  });

  it("informa o caminho de saída por teclado dentro do próprio aviso", () => {
    montarAviso();
    expect(screen.getByText(/Pressione Esc/i)).toBeInTheDocument();
  });

  it("Esc sai do aviso a partir do botão e também a partir do link", async () => {
    const user = userEvent.setup();
    const onSair = vi.fn();
    montarAviso({ motivo: "revogado", eixoId: "eixo-1", onSair });
    await waitFor(() => expect(screen.getByRole("button", { name: "Tentar novamente" })).toHaveFocus());
    await user.keyboard("{Escape}");
    await user.tab();
    await user.keyboard("{Escape}");
    expect(onSair).toHaveBeenCalledTimes(2);
  });

  it("navega só por teclado do botão até o link e aciona a renovação com Enter", async () => {
    const user = userEvent.setup();
    const onRenovar = vi.fn();
    montarAviso({ motivo: "revogado", eixoId: "eixo-1", onRenovar });
    const botao = screen.getByRole("button", { name: "Tentar novamente" });
    await waitFor(() => expect(botao).toHaveFocus());
    await user.tab();
    expect(screen.getByRole("link", { name: "Voltar à trilha" })).toHaveFocus();
    await user.tab();
    expect(botao).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onRenovar).toHaveBeenCalledTimes(1);
  });
});

describe("acessibilidade do botão de nova tentativa em cada estado", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("em espera: focável, marcado como indisponível e explicado por texto ligado", async () => {
    montarAviso({ emEspera: true, esperaAte: Date.now() + 8000 });
    const botao = screen.getByRole("button", { name: "Renovar acesso" });
    await waitFor(() => expect(botao).toHaveFocus());
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).not.toHaveAttribute("disabled");
    const ajuda = document.getElementById(botao.getAttribute("aria-describedby")!);
    expect(ajuda?.textContent).toMatch(/Aguarde/i);
  });

  it("renovando: o diálogo fica aria-busy e o estado é anunciado", () => {
    montarAviso({ renovando: true });
    expect(screen.getByRole("alertdialog")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(/Renovando o acesso/i);
    expect(screen.getByRole("button", { name: "Renovando..." })).toBeInTheDocument();
  });

  it("a contagem é anunciada em marcos, sem falar a cada segundo", () => {
    montarAviso({ emEspera: true, esperaAte: Date.now() + 10000 });
    const vivo = screen.getByRole("status");
    expect(vivo).toHaveTextContent(/em espera: 10 segundos/i);
    // 9, 8, 7 e 6 segundos não são marcos: o anúncio fica curto
    act(() => vi.advanceTimersByTime(2000));
    expect(vivo).toHaveTextContent(/em espera\.$/i);
    act(() => vi.advanceTimersByTime(6000));
    expect(vivo).toHaveTextContent(/em espera: 2 segundos/i);
  });

  it("liberado: o anúncio confirma que o botão pode ser acionado", () => {
    montarAviso({ motivo: "limite" });
    expect(screen.getByRole("status")).toHaveTextContent(
      /Muitos pedidos\. Botão “Tentar novamente” disponível\./i,
    );
  });

  it("a região viva do estado fica só para leitores de tela", () => {
    montarAviso();
    const vivo = screen.getByRole("status");
    expect(vivo).toHaveClass("sr-only");
    expect(vivo).toHaveAttribute("aria-live", "polite");
    expect(vivo).toHaveAttribute("aria-atomic", "true");
  });
});
