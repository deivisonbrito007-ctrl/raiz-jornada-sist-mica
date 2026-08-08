import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useAnuncio, limparMemoriaAnuncios } from "@/hooks/use-anuncio";
import { RegiaoAnuncio } from "@/components/regiao-anuncio";

let anunciar: (texto: string) => void;

function Tela({ escopo = "progresso" }: { escopo?: string }) {
  const hook = useAnuncio(escopo);
  anunciar = hook.anunciar;
  return <RegiaoAnuncio texto={hook.texto} nivel="rotina" />;
}

describe("useAnuncio: deduplicação de anúncios entre telas", () => {
  beforeEach(() => {
    limparMemoriaAnuncios();
    window.localStorage.clear();
  });

  it("anuncia a conclusão da prática uma vez", () => {
    render(<Tela />);
    act(() => anunciar("Prática concluída: Respiração."));
    expect(screen.getByTestId("anuncio-live")).toHaveTextContent("Prática concluída: Respiração.");
  });

  it("não repete o mesmo anúncio ao remontar a tela (navegação)", () => {
    const primeira = render(<Tela />);
    act(() => anunciar("Meta semanal de 3 práticas. 1 concluída esta semana."));
    expect(screen.getByTestId("anuncio-live")).not.toBeEmptyDOMElement();
    primeira.unmount();

    // volta para a tela: o mesmo texto não deve ser falado de novo
    render(<Tela />);
    act(() => anunciar("Meta semanal de 3 práticas. 1 concluída esta semana."));
    expect(screen.getByTestId("anuncio-live")).toBeEmptyDOMElement();
  });

  it("anuncia de novo quando a meta ou a sequência muda", () => {
    const primeira = render(<Tela />);
    act(() => anunciar("Meta semanal de 3 práticas. Sequência atual de 2 dias."));
    primeira.unmount();

    render(<Tela />);
    act(() => anunciar("Meta semanal de 4 práticas. Sequência atual de 3 dias."));
    expect(screen.getByTestId("anuncio-live")).toHaveTextContent(
      "Meta semanal de 4 práticas. Sequência atual de 3 dias.",
    );
  });

  it("mantém escopos independentes", () => {
    const primeira = render(<Tela escopo="progresso" />);
    act(() => anunciar("Texto igual."));
    primeira.unmount();
    const { getByTestId } = render(<Tela escopo="diario" />);
    act(() => anunciar("Texto igual."));
    expect(getByTestId("anuncio-live")).toHaveTextContent("Texto igual.");
  });

  it("respeita a preferência de anúncios desativados", () => {
    window.localStorage.setItem("raiz:preferencia-anuncios", "desativado");
    render(<Tela />);
    act(() => anunciar("Prática concluída: Respiração."));
    expect(screen.queryByTestId("anuncio-live")).toBeNull();
  });
});
