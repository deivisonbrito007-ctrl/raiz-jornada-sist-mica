import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useFocoPlayer, primeiroControleRelevante } from "./use-foco-player";

/** Player em que os controles disponíveis mudam entre montagens. */
function Player({
  bloqueado,
  liberado,
  controles,
}: {
  bloqueado: boolean;
  liberado: boolean;
  controles: string[];
}) {
  useFocoPlayer("c1", { bloqueado, liberado });
  return (
    <div>
      {liberado &&
        !bloqueado &&
        controles.map((nome) => (
          <button key={nome} data-foco-player={nome} aria-label={nome} />
        ))}
      {bloqueado && <button aria-label="Renovar acesso" />}
    </div>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fallback de foco quando o controle original não existe mais", () => {
  it("foca o comando principal (play) quando o controle guardado desapareceu", async () => {
    const tela = render(
      <Player bloqueado={false} liberado controles={["voltar15", "play", "avancar15"]} />,
    );
    await act(async () => screen.getByLabelText("avancar15").focus());
    await act(async () => tela.rerender(<Player bloqueado liberado={false} controles={[]} />));

    // ao liberar, o player voltou sem o botão de avançar
    await act(async () =>
      tela.rerender(<Player bloqueado={false} liberado controles={["play", "concluir"]} />),
    );
    expect(document.activeElement).toBe(screen.getByLabelText("play"));
  });

  it("desce na ordem de preferência quando nem o play existe", async () => {
    const tela = render(<Player bloqueado={false} liberado controles={["play"]} />);
    await act(async () => screen.getByLabelText("play").focus());
    await act(async () => tela.rerender(<Player bloqueado liberado={false} controles={[]} />));
    await act(async () =>
      tela.rerender(<Player bloqueado={false} liberado controles={["concluir", "avancar15"]} />),
    );
    expect(document.activeElement).toBe(screen.getByLabelText("avancar15"));
  });

  it("rola o controle do fallback até a vista", async () => {
    const rolar = vi.fn();
    Element.prototype.scrollIntoView = rolar;
    const tela = render(<Player bloqueado={false} liberado controles={["avancar15"]} />);
    await act(async () => screen.getByLabelText("avancar15").focus());
    await act(async () => tela.rerender(<Player bloqueado liberado={false} controles={[]} />));
    rolar.mockClear();
    await act(async () => tela.rerender(<Player bloqueado={false} liberado controles={["play"]} />));
    expect(document.activeElement).toBe(screen.getByLabelText("play"));
    expect(rolar).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
  });

  it("não força foco algum quando o player não tem controles", async () => {
    const tela = render(<Player bloqueado={false} liberado controles={["play"]} />);
    await act(async () => screen.getByLabelText("play").focus());
    await act(async () => tela.rerender(<Player bloqueado liberado={false} controles={[]} />));
    (document.activeElement as HTMLElement | null)?.blur?.();
    await act(async () => tela.rerender(<Player bloqueado={false} liberado controles={[]} />));
    expect(document.activeElement).toBe(document.body);
  });

  it("ignora controles desabilitados ao escolher o fallback", () => {
    document.body.innerHTML = `
      <button data-foco-player="play" disabled aria-label="play"></button>
      <button data-foco-player="voltar15" aria-label="voltar15"></button>
    `;
    expect(primeiroControleRelevante()).toBe(screen.getByLabelText("voltar15"));
    document.body.innerHTML = "";
  });

  it("retorna nulo quando nenhum controle está na tela", () => {
    document.body.innerHTML = "";
    expect(primeiroControleRelevante()).toBeNull();
  });
});
