import { describe, expect, it } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useAnuncio } from "@/hooks/use-anuncio";
import { RegiaoAnuncio } from "@/components/regiao-anuncio";

function Sonda() {
  const { anuncio, anunciar, limpar } = useAnuncio();
  return (
    <div>
      <RegiaoAnuncio anuncio={anuncio} rotulo="Avisos de teste" />
      <button onClick={() => anunciar("Gravação concluída.")}>ok</button>
      <button onClick={() => anunciar("Falhou.", "assertive")}>erro</button>
      <button onClick={limpar}>limpar</button>
    </div>
  );
}

const polite = () => screen.getByRole("status");
const assertive = () => screen.getByRole("alert");

describe("anúncios acessíveis de progresso e diário", () => {
  it("anuncia confirmações em região polite", async () => {
    render(<Sonda />);
    await act(async () => screen.getByText("ok").click());
    expect(polite()).toHaveTextContent("Gravação concluída.");
    expect(polite()).toHaveAttribute("aria-live", "polite");
    expect(polite()).toHaveAttribute("aria-atomic", "true");
    expect(assertive()).toHaveTextContent("");
  });

  it("anuncia erros e bloqueios em região assertive", async () => {
    render(<Sonda />);
    await act(async () => screen.getByText("erro").click());
    expect(assertive()).toHaveTextContent("Falhou.");
    expect(assertive()).toHaveAttribute("aria-live", "assertive");
    expect(polite()).toHaveTextContent("");
  });

  it("não repete a mesma mensagem em cliques seguidos", async () => {
    render(<Sonda />);
    await act(async () => screen.getByText("ok").click());
    const primeiro = polite().textContent;
    await act(async () => screen.getByText("ok").click());
    expect(polite().textContent).toBe(primeiro);
  });

  it("permite repetir a mensagem depois de limpar", async () => {
    render(<Sonda />);
    await act(async () => screen.getByText("ok").click());
    await act(async () => screen.getByText("limpar").click());
    expect(polite()).toHaveTextContent("");
    await act(async () => screen.getByText("ok").click());
    expect(polite()).toHaveTextContent("Gravação concluída.");
  });

  it("troca entre mensagens diferentes e mantém só a última ativa", async () => {
    render(<Sonda />);
    await act(async () => screen.getByText("ok").click());
    await act(async () => screen.getByText("erro").click());
    expect(assertive()).toHaveTextContent("Falhou.");
    expect(polite()).toHaveTextContent("");
  });

  it("mantém a região viva no DOM mesmo sem mensagens", () => {
    render(<RegiaoAnuncio anuncio={null} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
