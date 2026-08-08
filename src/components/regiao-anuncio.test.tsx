import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RegiaoAnuncio } from "@/components/regiao-anuncio";
import {
  CHAVE_PREFERENCIA_ANUNCIOS,
  deveAnunciar,
  salvarPreferenciaAnuncios,
  lerPreferenciaAnuncios,
} from "@/lib/preferencia-anuncios";

describe("preferência de anúncios em live region", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("usa anúncios completos por padrão", () => {
    expect(lerPreferenciaAnuncios()).toBe("completo");
    render(<RegiaoAnuncio texto="Pausado em 0:10." nivel="rotina" />);
    expect(screen.getByRole("status")).toHaveTextContent("Pausado em 0:10.");
  });

  it("silencia anúncios de rotina no modo reduzido, mas mantém os importantes", () => {
    salvarPreferenciaAnuncios("reduzido");
    expect(lerPreferenciaAnuncios()).toBe("reduzido");
    expect(deveAnunciar("reduzido", "rotina")).toBe(false);
    expect(deveAnunciar("reduzido", "importante")).toBe(true);

    const { unmount } = render(<RegiaoAnuncio texto="Pausado em 0:10." nivel="rotina" />);
    expect(screen.queryByRole("status")).toBeNull();
    unmount();

    render(<RegiaoAnuncio texto="Acesso expirado." nivel="importante" assertivo />);
    expect(screen.getByRole("alert")).toHaveTextContent("Acesso expirado.");
  });

  it("com anúncios desativados, mensagens importantes viram aviso visível", () => {
    salvarPreferenciaAnuncios("desativado");
    render(<RegiaoAnuncio texto="Acesso expirado." nivel="importante" />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    const fallback = screen.getByTestId("fallback-anuncio-visivel");
    expect(fallback).toHaveTextContent("Acesso expirado.");
    expect(fallback).not.toHaveClass("sr-only");
    expect(fallback.getAttribute("aria-live")).toBe("off");
  });

  it("com anúncios desativados, mensagens de rotina desaparecem sem fallback", () => {
    salvarPreferenciaAnuncios("desativado");
    render(<RegiaoAnuncio texto="Pausado em 0:10." nivel="rotina" />);
    expect(screen.queryByTestId("fallback-anuncio-visivel")).toBeNull();
  });

  it("aceita valor inválido no storage voltando para completo", () => {
    window.localStorage.setItem(CHAVE_PREFERENCIA_ANUNCIOS, "qualquer-coisa");
    expect(lerPreferenciaAnuncios()).toBe("completo");
  });
});
