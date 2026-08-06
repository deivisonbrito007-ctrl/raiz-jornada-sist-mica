/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor, screen } from "@testing-library/react";

const navigate = vi.fn();
let contexto: any = undefined;

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  useNavigate: () => navigate,
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: contexto }) }));
vi.mock("@/lib/raiz.functions", () => ({ getMeuContexto: vi.fn() }));

const Entrada = ((await import("./entrada")).Route as any).component as () => React.ReactElement;

describe("triagem de papel em /entrada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contexto = undefined;
  });

  it("mostra estado de carregamento enquanto o papel não chega", () => {
    render(<Entrada />);
    expect(screen.getByText("Preparando o seu espaço...")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("envia terapeuta para o painel /admin", async () => {
    contexto = { papel: "terapeuta" };
    render(<Entrada />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/admin", replace: true }));
  });

  it("envia cliente para o app /app", async () => {
    contexto = { papel: "cliente" };
    render(<Entrada />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/app", replace: true }));
  });
});
