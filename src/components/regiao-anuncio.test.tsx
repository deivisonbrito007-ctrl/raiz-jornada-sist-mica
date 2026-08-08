import { describe, expect, it } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useAnuncio } from "@/hooks/use-anuncio";
import { RegiaoAnuncio } from "./regiao-anuncio";

function Tela() {
  const { anuncio, anunciar } = useAnuncio();
  return (
    <div>
      <RegiaoAnuncio anuncio={anuncio} />
      <button onClick={() => anunciar("Progresso atualizado: prática concluída.")}>concluir</button>
      <button onClick={() => anunciar("Não foi possível salvar.", "assertive")}>falhar</button>
    </div>
  );
}

describe("anúncios acessíveis de progresso", () => {
  it("anuncia a conclusão numa live region polida", async () => {
    render(<Tela />);
    const polido = screen.getByTestId("anuncio-polido");
    expect(polido).toHaveAttribute("aria-live", "polite");
    expect(polido).toHaveAttribute("role", "status");
    expect(polido.textContent).toBe("");

    await act(async () => screen.getByText("concluir").click());
    expect(polido.textContent).toContain("prática concluída");
  });

  it("usa a região assertiva para erros de progresso", async () => {
    render(<Tela />);
    await act(async () => screen.getByText("falhar").click());
    const assertivo = screen.getByTestId("anuncio-assertivo");
    expect(assertivo).toHaveAttribute("aria-live", "assertive");
    expect(assertivo.textContent).toContain("Não foi possível salvar");
    expect(screen.getByTestId("anuncio-polido").textContent).toBe("");
  });

  it("não repete a mesma mensagem seguida", async () => {
    const vistos: number[] = [];
    function Espia() {
      const { anuncio, anunciar } = useAnuncio();
      if (anuncio) vistos.push(anuncio.selo);
      return <button onClick={() => anunciar("mesma coisa")}>ir</button>;
    }
    render(<Espia />);
    const botao = screen.getByText("ir");
    await act(async () => botao.click());
    await act(async () => botao.click());
    expect(new Set(vistos).size).toBe(1);
  });

  it("mantém as duas regiões montadas mesmo sem anúncio", () => {
    render(<RegiaoAnuncio anuncio={null} />);
    expect(screen.getByTestId("anuncio-polido")).toBeInTheDocument();
    expect(screen.getByTestId("anuncio-assertivo")).toBeInTheDocument();
  });
});
