import { describe, expect, it, vi, afterEach } from "vitest";
import { rolarParaVista } from "./rolar-para-vista";

function criarAlvo() {
  const el = document.createElement("button");
  el.scrollIntoView = vi.fn();
  return el;
}

function movimentoReduzido(reduzido: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((consulta: string) => ({
      matches: reduzido && consulta.includes("reduce"),
      media: consulta,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("rolarParaVista", () => {
  it("rola até o centro da tela com animação suave", () => {
    movimentoReduzido(false);
    const alvo = criarAlvo();
    rolarParaVista(alvo);
    expect(alvo.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
  });

  it("aceita outro alinhamento", () => {
    movimentoReduzido(false);
    const alvo = criarAlvo();
    rolarParaVista(alvo, "start");
    expect(alvo.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
  });

  it("rola sem animação com movimento reduzido", () => {
    movimentoReduzido(true);
    const alvo = criarAlvo();
    rolarParaVista(alvo);
    expect(alvo.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
  });

  it("não quebra sem elemento ou sem suporte a rolagem", () => {
    movimentoReduzido(false);
    expect(() => rolarParaVista(null)).not.toThrow();
    const semSuporte = document.createElement("div");
    // @ts-expect-error simulando ambiente sem scrollIntoView
    semSuporte.scrollIntoView = undefined;
    expect(() => rolarParaVista(semSuporte)).not.toThrow();
  });
});
