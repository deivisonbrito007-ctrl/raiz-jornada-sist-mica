import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useFocoPlayer } from "./use-foco-player";

function Player({ bloqueado, liberado }: { bloqueado: boolean; liberado: boolean }) {
  useFocoPlayer("c1", { bloqueado, liberado });
  return (
    <div>
      {liberado && !bloqueado && (
        <>
          <button data-foco-player="voltar15" aria-label="Voltar 15 segundos" />
          <button data-foco-player="play" aria-label="Reproduzir" />
          <button data-foco-player="avancar15" aria-label="Avançar 15 segundos" />
        </>
      )}
      {bloqueado && <button aria-label="Renovar acesso" />}
    </div>
  );
}

describe("restauração de foco do player", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("volta o foco ao controle usado antes do bloqueio", async () => {
    const tela = render(<Player bloqueado={false} liberado />);
    const play = screen.getByLabelText("Reproduzir");
    await act(async () => play.focus());

    await act(async () => {
      tela.rerender(<Player bloqueado liberado={false} />);
    });
    expect(screen.queryByLabelText("Reproduzir")).toBeNull();

    await act(async () => {
      tela.rerender(<Player bloqueado={false} liberado />);
    });
    expect(document.activeElement).toBe(screen.getByLabelText("Reproduzir"));
  });

  it("mantém o controle específico (avançar 15s) ao liberar de novo", async () => {
    const tela = render(<Player bloqueado={false} liberado />);
    await act(async () => screen.getByLabelText("Avançar 15 segundos").focus());
    await act(async () => tela.rerender(<Player bloqueado liberado={false} />));
    await act(async () => tela.rerender(<Player bloqueado={false} liberado />));
    expect(document.activeElement).toBe(screen.getByLabelText("Avançar 15 segundos"));
  });

  it("restaura o foco após reautenticar, quando a página monta de novo", async () => {
    const primeira = render(<Player bloqueado={false} liberado />);
    await act(async () => screen.getByLabelText("Voltar 15 segundos").focus());
    await act(async () => primeira.rerender(<Player bloqueado liberado={false} />));
    primeira.unmount();

    // nova montagem (equivalente a voltar ao player depois do login)
    render(<Player bloqueado={false} liberado />);
    await act(async () => {});
    expect(document.activeElement).toBe(screen.getByLabelText("Voltar 15 segundos"));
  });

  it("não rouba o foco quando nunca houve bloqueio", async () => {
    render(<Player bloqueado={false} liberado />);
    await act(async () => {});
    expect(document.activeElement).toBe(document.body);
  });
});
