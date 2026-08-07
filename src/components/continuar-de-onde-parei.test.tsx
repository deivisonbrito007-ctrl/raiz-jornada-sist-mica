import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContinuarDeOndeParei } from "./continuar-de-onde-parei";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, search, ...rest }: any) => (
    <a
      href={`${String(to).replace("$conteudoId", params.conteudoId)}?retomar=${search.retomar}`}
      {...rest}
    >
      {children}
    </a>
  ),
}));

describe("botão Continuar de onde parei", () => {
  const pratica = {
    id: "c1",
    eixoNome: "Raízes",
    tipo: "audio",
    titulo: "Meditação da origem",
    duracaoSegundos: 600,
    posicaoSegundos: 150,
  };

  it("leva à prática com o pedido de retomada automática", () => {
    render(<ContinuarDeOndeParei pratica={pratica} />);
    const link = screen.getByRole("link", { name: /Continuar de onde parei/i });
    expect(link).toHaveAttribute("href", "/app/conteudo/c1?retomar=true");
  });

  it("mostra onde parou e quanto falta", () => {
    render(<ContinuarDeOndeParei pratica={pratica} />);
    expect(screen.getByText("Meditação da origem")).toBeInTheDocument();
    expect(screen.getByText(/parou em 2 min 30s/)).toBeInTheDocument();
    expect(screen.getByText(/faltam 7 min 30s/)).toBeInTheDocument();
  });
});
