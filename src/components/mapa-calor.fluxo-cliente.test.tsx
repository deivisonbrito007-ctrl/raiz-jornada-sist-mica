import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapaCalor } from "./mapa-calor";
import { mapaCalorDiario, type ConclusaoDetalhe } from "@/lib/raiz-format";

/**
 * Integração do heatmap no fluxo do cliente autenticado.
 * Simula a camada de dados com as mesmas regras de RLS do backend:
 * - cliente só lê progresso onde cliente_id = auth.uid()
 * - terapeuta lê progresso de qualquer cliente, mas os dados são
 *   sempre escopados ao cliente consultado (nunca misturados)
 */

const HOJE = new Date("2026-08-06T12:00:00.000Z");

function iso(diasAtras: number, hora = 9) {
  const d = new Date(HOJE);
  d.setHours(hora, 0, 0, 0);
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString();
}

type LinhaProgresso = ConclusaoDetalhe & { clienteId: string };

const CLIENTE_A = "11111111-1111-4111-8111-111111111111";
const CLIENTE_B = "22222222-2222-4222-8222-222222222222";
const TERAPEUTA = "33333333-3333-4333-8333-333333333333";

const TABELA_PROGRESSO: LinhaProgresso[] = [
  {
    clienteId: CLIENTE_A,
    titulo: "Carta ao pai",
    eixoNome: "Pai",
    tipo: "exercicio",
    duracaoSegundos: 600,
    concluidoEm: iso(1, 8),
  },
  {
    clienteId: CLIENTE_A,
    titulo: "Respiração da raiz",
    eixoNome: "Ancestralidade",
    tipo: "audio",
    duracaoSegundos: 300,
    concluidoEm: iso(1, 20),
  },
  {
    clienteId: CLIENTE_B,
    titulo: "Diálogo com a mãe",
    eixoNome: "Mãe",
    tipo: "video",
    duracaoSegundos: 1800,
    concluidoEm: iso(1, 10),
  },
  {
    clienteId: CLIENTE_B,
    titulo: "Linha do dinheiro",
    eixoNome: "Dinheiro",
    tipo: "texto",
    duracaoSegundos: 900,
    concluidoEm: iso(2, 15),
  },
];

const PAPEIS: Record<string, "cliente" | "terapeuta"> = {
  [CLIENTE_A]: "cliente",
  [CLIENTE_B]: "cliente",
  [TERAPEUTA]: "terapeuta",
};

/** Emula getMinhaBiblioteca/adminGetCliente + RLS. */
function buscarConclusoes(userId: string, clienteId: string = userId): ConclusaoDetalhe[] {
  const papel = PAPEIS[userId];
  if (papel !== "terapeuta" && clienteId !== userId) {
    throw new Error("Acesso restrito");
  }
  return TABELA_PROGRESSO.filter((l) => l.clienteId === clienteId).map(
    ({ clienteId: _ignorado, ...detalhe }) => detalhe,
  );
}

function renderMapa(conclusoes: ConclusaoDetalhe[]) {
  const colunas = mapaCalorDiario(
    conclusoes.map((c) => c.concluidoEm),
    12,
    conclusoes,
  );
  return render(<MapaCalor colunas={colunas} />);
}

function rotulo(diasAtras: number, praticas: number) {
  const d = new Date(HOJE);
  d.setDate(d.getDate() - diasAtras);
  const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${label} — ${praticas} prática${praticas === 1 ? "" : "s"}`;
}

describe("MapaCalor no fluxo do cliente autenticado", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(HOJE);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("mostra apenas as práticas do cliente autenticado", async () => {
    const user = userEvent.setup();
    renderMapa(buscarConclusoes(CLIENTE_A));

    const dia = screen.getByRole("button", { name: rotulo(1, 2) });
    await user.click(dia);

    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText(/2 práticas · 15 min registrados/)).toBeInTheDocument();
    expect(within(painel).getByText("Carta ao pai")).toBeInTheDocument();
    expect(within(painel).getByText("Respiração da raiz")).toBeInTheDocument();
    // dados de outro cliente nunca aparecem
    expect(within(painel).queryByText("Diálogo com a mãe")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: rotulo(2, 1) })).not.toBeInTheDocument();
  });

  it("bloqueia o cliente que tenta ler o progresso de outro cliente", () => {
    expect(() => buscarConclusoes(CLIENTE_A, CLIENTE_B)).toThrow("Acesso restrito");
  });

  it("terapeuta vê o heatmap escopado a um cliente por vez, sem vazar o outro", async () => {
    const user = userEvent.setup();
    const { unmount } = renderMapa(buscarConclusoes(TERAPEUTA, CLIENTE_B));

    const diaB = screen.getByRole("button", { name: rotulo(1, 1) });
    await user.click(diaB);
    const painelB = await screen.findByRole("dialog");
    expect(within(painelB).getByText("Diálogo com a mãe")).toBeInTheDocument();
    expect(within(painelB).queryByText("Carta ao pai")).not.toBeInTheDocument();
    expect(within(painelB).queryByText("Respiração da raiz")).not.toBeInTheDocument();
    unmount();

    renderMapa(buscarConclusoes(TERAPEUTA, CLIENTE_A));
    const diaA = screen.getByRole("button", { name: rotulo(1, 2) });
    await user.click(diaA);
    const painelA = await screen.findByRole("dialog");
    expect(within(painelA).getByText("Carta ao pai")).toBeInTheDocument();
    expect(within(painelA).queryByText("Linha do dinheiro")).not.toBeInTheDocument();
  });

  it("dia sem prática do cliente autenticado abre estado vazio", async () => {
    const user = userEvent.setup();
    renderMapa(buscarConclusoes(CLIENTE_A));

    const diaVazio = screen.getByRole("button", {
      name: new RegExp(`${rotulo(2, 0).split(" — ")[0]} — nenhuma prática`),
    });
    await user.click(diaVazio);
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText(/0 prática · 0 min registrados/)).toBeInTheDocument();
  });
});
