import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  CONSULTA_MOVIMENTO_REDUZIDO,
  classeMovimento,
  rolagem,
  useMovimentoReduzido,
} from "./use-movimento-reduzido";

type Ouvinte = (e: { matches: boolean }) => void;

/** matchMedia controlável: permite virar a preferência durante o teste. */
function instalarMatchMedia(inicial: boolean) {
  const estado = { matches: inicial };
  const ouvintes = new Set<Ouvinte>();
  const mq = {
    get matches() {
      return estado.matches;
    },
    media: CONSULTA_MOVIMENTO_REDUZIDO,
    addEventListener: (_: string, fn: Ouvinte) => ouvintes.add(fn),
    removeEventListener: (_: string, fn: Ouvinte) => ouvintes.delete(fn),
    addListener: (fn: Ouvinte) => ouvintes.add(fn),
    removeListener: (fn: Ouvinte) => ouvintes.delete(fn),
    dispatchEvent: () => true,
    onchange: null,
  };
  const matchMedia = vi.fn((consulta: string) => {
    expect(consulta).toBe(CONSULTA_MOVIMENTO_REDUZIDO);
    return mq as unknown as MediaQueryList;
  });
  vi.stubGlobal("matchMedia", matchMedia);
  window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
  return {
    matchMedia,
    ouvintes,
    virar(valor: boolean) {
      estado.matches = valor;
      for (const fn of ouvintes) fn({ matches: valor });
    },
  };
}

function Sonda() {
  const reduzido = useMovimentoReduzido();
  return (
    <div data-testid="sonda" data-reduzido={reduzido ? "true" : "false"}>
      {reduzido ? "sem movimento" : "com movimento"}
    </div>
  );
}

describe("useMovimentoReduzido", () => {
  const original = window.matchMedia;

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    vi.unstubAllGlobals();
    window.matchMedia = original;
  });

  it("retorna false quando a pessoa não pediu menos movimento", () => {
    instalarMatchMedia(false);
    render(<Sonda />);
    expect(screen.getByTestId("sonda")).toHaveAttribute("data-reduzido", "false");
  });

  it("retorna true quando o sistema pede prefers-reduced-motion: reduce", () => {
    instalarMatchMedia(true);
    render(<Sonda />);
    expect(screen.getByTestId("sonda")).toHaveAttribute("data-reduzido", "true");
    expect(screen.getByText("sem movimento")).toBeInTheDocument();
  });

  it("acompanha a mudança da preferência sem recarregar a tela", () => {
    const mm = instalarMatchMedia(false);
    render(<Sonda />);
    expect(screen.getByTestId("sonda")).toHaveAttribute("data-reduzido", "false");
    act(() => mm.virar(true));
    expect(screen.getByTestId("sonda")).toHaveAttribute("data-reduzido", "true");
    act(() => mm.virar(false));
    expect(screen.getByTestId("sonda")).toHaveAttribute("data-reduzido", "false");
  });

  it("remove o ouvinte ao desmontar, sem vazar assinatura", () => {
    const mm = instalarMatchMedia(true);
    const { unmount } = render(<Sonda />);
    expect(mm.ouvintes.size).toBe(1);
    unmount();
    expect(mm.ouvintes.size).toBe(0);
  });

  it("não quebra quando matchMedia não existe (SSR/jsdom antigo)", () => {
    vi.stubGlobal("matchMedia", undefined);
    // @ts-expect-error simulando ambiente sem matchMedia
    window.matchMedia = undefined;
    render(<Sonda />);
    expect(screen.getByTestId("sonda")).toHaveAttribute("data-reduzido", "false");
  });

  it("classeMovimento troca a classe animada pela estática", () => {
    expect(classeMovimento(false, "animate-fade-in")).toBe("animate-fade-in");
    expect(classeMovimento(true, "animate-fade-in")).toBe("");
    expect(classeMovimento(true, "animate-fade-in", "opacity-100")).toBe("opacity-100");
  });

  it("rolagem usa auto com movimento reduzido e smooth no padrão", () => {
    expect(rolagem(true)).toBe("auto");
    expect(rolagem(false)).toBe("smooth");
  });
});
