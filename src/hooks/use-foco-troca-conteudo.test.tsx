import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { useFocoTrocaConteudo } from "@/hooks/use-foco-troca-conteudo";
import { limparFocoPlayer } from "@/hooks/use-foco-player";
import { AvisoMidiaBloqueada, MotivoBloqueio } from "@/components/aviso-midia-bloqueada";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: any) => <a href="#" {...props}>{children}</a>,
}));

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Troca de conteúdo com o aviso do player aberto.
 *
 * Quando o cliente muda de prática enquanto o aviso de bloqueio está aberto (e
 * com o foco dentro dele), o aviso antigo é desmontado. O foco precisa voltar
 * para um ponto previsível da nova tela — o título da prática — e não para o
 * `body`, onde o teclado e o leitor de tela perderiam o contexto.
 */

interface TelaProps {
  conteudoId: string;
  motivo: MotivoBloqueio | null;
  pronto?: boolean;
}

function Tela({ conteudoId, motivo, pronto = true }: TelaProps) {
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  useFocoTrocaConteudo(conteudoId, {
    avisoAberto: Boolean(motivo),
    tituloRef,
    pronto,
  });
  return (
    <div>
      <h1 ref={tituloRef} tabIndex={-1}>
        Prática {conteudoId}
      </h1>
      <button data-foco-player="play" aria-label="Reproduzir" />
      {motivo && (
        <AvisoMidiaBloqueada
          motivo={motivo}
          renovando={false}
          emEspera={false}
          chave={conteudoId}
          onRenovar={() => {}}
        />
      )}
    </div>
  );
}

function Anfitriao({ inicial }: { inicial: TelaProps }) {
  const [props, setProps] = useState(inicial);
  return (
    <>
      <button onClick={() => setProps({ conteudoId: "c-2", motivo: null })}>trocar liberada</button>
      <button onClick={() => setProps({ conteudoId: "c-2", motivo: "revogado" })}>
        trocar bloqueada
      </button>
      <button onClick={() => setProps({ conteudoId: "c-2", motivo: null, pronto: false })}>
        trocar carregando
      </button>
      <button onClick={() => setProps({ ...props, pronto: true })}>terminar carregamento</button>
      <Tela {...props} />
    </>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("foco ao trocar de conteúdo com o aviso aberto", () => {
  it("devolve o foco ao título da nova prática quando o aviso é desmontado", async () => {
    render(<Anfitriao inicial={{ conteudoId: "c-1", motivo: "validade" }} />);

    // O aviso já toma o foco para o botão de renovar.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Renovar acesso/ })).toHaveFocus(),
    );

    await userEvent.click(screen.getByText("trocar liberada"));

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "Prática c-2" })).toHaveFocus(),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("deixa o aviso da nova prática cuidar do próprio foco quando ela também está bloqueada", async () => {
    render(<Anfitriao inicial={{ conteudoId: "c-1", motivo: "validade" }} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Renovar acesso/ })).toHaveFocus(),
    );

    await userEvent.click(screen.getByText("trocar bloqueada"));

    // O motivo mudou de "validade" para "revogado": o botão do novo aviso é o
    // ponto de foco, não o título.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Tentar novamente/ })).toHaveFocus(),
    );
    expect(screen.getByRole("heading", { level: 1, name: "Prática c-2" })).not.toHaveFocus();
  });

  it("reposiciona o foco quando a nova prática tem o mesmo motivo de bloqueio", async () => {
    const { rerender } = render(<Tela conteudoId="c-1" motivo="revogado" />);
    const botao = await screen.findByRole("button", { name: /Tentar novamente/ });
    await waitFor(() => expect(botao).toHaveFocus());

    (document.activeElement as HTMLElement).blur();
    rerender(<Tela conteudoId="c-2" motivo="revogado" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Tentar novamente/ })).toHaveFocus(),
    );
  });

  it("espera a nova prática carregar antes de mover o foco", async () => {
    render(<Anfitriao inicial={{ conteudoId: "c-1", motivo: "validade" }} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Renovar acesso/ })).toHaveFocus(),
    );

    await userEvent.click(screen.getByText("trocar carregando"));
    const titulo = screen.getByRole("heading", { level: 1, name: "Prática c-2" });
    expect(titulo).not.toHaveFocus();

    await userEvent.click(screen.getByText("terminar carregamento"));
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it("não mexe no foco quando o conteúdo não muda", async () => {
    render(<Tela conteudoId="c-1" motivo={null} />);
    const play = screen.getByRole("button", { name: "Reproduzir" });
    play.focus();
    await act(async () => {});
    expect(play).toHaveFocus();
  });

  it("descarta o ponto de foco guardado da prática anterior", async () => {
    window.sessionStorage.setItem("raiz:foco-player:c-1", "avancar15");
    const { rerender } = render(<Tela conteudoId="c-1" motivo="revogado" />);
    await screen.findByRole("alertdialog");

    rerender(<Tela conteudoId="c-2" motivo={null} />);

    await waitFor(() =>
      expect(window.sessionStorage.getItem("raiz:foco-player:c-1")).toBeNull(),
    );
  });

  it("limparFocoPlayer remove só a chave da prática informada", () => {
    window.sessionStorage.setItem("raiz:foco-player:c-1", "play");
    window.sessionStorage.setItem("raiz:foco-player:c-2", "play");
    limparFocoPlayer("c-1");
    expect(window.sessionStorage.getItem("raiz:foco-player:c-1")).toBeNull();
    expect(window.sessionStorage.getItem("raiz:foco-player:c-2")).toBe("play");
  });

  it("mantém o teclado utilizável depois da troca (Tab segue do título)", async () => {
    render(<Anfitriao inicial={{ conteudoId: "c-1", motivo: "validade" }} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Renovar acesso/ })).toHaveFocus(),
    );

    await userEvent.click(screen.getByText("trocar liberada"));
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "Prática c-2" })).toHaveFocus(),
    );

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Reproduzir" })).toHaveFocus();
  });
});
