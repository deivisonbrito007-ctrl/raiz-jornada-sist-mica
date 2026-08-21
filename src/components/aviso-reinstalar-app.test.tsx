import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvisoReinstalarApp } from "./aviso-reinstalar-app";
import { detectarPlataforma } from "@/hooks/use-instalacao-desatualizada";
import { CHAVE_ADIADO, CHAVE_ASSINATURA, VERSAO_ICONES } from "@/lib/versao-app";

function instaladoComoApp(standalone = true) {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: standalone && consulta.includes("standalone"),
    media: consulta,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

function comUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

function instalacaoAntiga() {
  localStorage.setItem(
    CHAVE_ASSINATURA,
    JSON.stringify({ app: "0.9.0", icones: VERSAO_ICONES - 1 }),
  );
}

beforeEach(() => {
  localStorage.clear();
  comUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15");
  instaladoComoApp();
});

afterEach(() => vi.unstubAllGlobals());

describe("AvisoReinstalarApp", () => {
  it("não aparece no navegador comum", async () => {
    instalacaoAntiga();
    instaladoComoApp(false);
    render(<AvisoReinstalarApp />);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("não aparece quando a instalação é do build atual", async () => {
    localStorage.setItem(CHAVE_ASSINATURA, JSON.stringify({ app: "1", icones: VERSAO_ICONES }));
    render(<AvisoReinstalarApp />);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("registra a assinatura na primeira abertura instalada", async () => {
    render(<AvisoReinstalarApp />);
    await waitFor(() => expect(localStorage.getItem(CHAVE_ASSINATURA)).toContain("icones"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("mostra instruções de iOS quando o build é mais novo", async () => {
    instalacaoAntiga();
    render(<AvisoReinstalarApp />);
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAccessibleName(/versão antiga/i);
    await userEvent.click(screen.getByRole("button", { name: "Reinstalar" }));
    expect(screen.getByText(/iPhone e iPad/)).toBeInTheDocument();
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument();
  });

  it("mostra instruções de Android para user agent Android", async () => {
    comUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126");
    instalacaoAntiga();
    render(<AvisoReinstalarApp />);
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "Reinstalar" }));
    expect(screen.getByText(/Android \(Chrome\)/)).toBeInTheDocument();
    expect(screen.getByText(/Instalar app/)).toBeInTheDocument();
  });

  it("“Agora não” adia o aviso", async () => {
    instalacaoAntiga();
    render(<AvisoReinstalarApp />);
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "Agora não" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem(CHAVE_ADIADO)).not.toBeNull();
  });

  it("Esc fecha o aviso", async () => {
    instalacaoAntiga();
    render(<AvisoReinstalarApp />);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("detectarPlataforma", () => {
  it("classifica iOS, Android e desktop", () => {
    expect(detectarPlataforma("iPhone; CPU iPhone OS 17_0")).toBe("ios");
    expect(detectarPlataforma("Linux; Android 14; Pixel")).toBe("android");
    expect(detectarPlataforma("Windows NT 10.0; Win64; x64")).toBe("desktop");
  });
});
