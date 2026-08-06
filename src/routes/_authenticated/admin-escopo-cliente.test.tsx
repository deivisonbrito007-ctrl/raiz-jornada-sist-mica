import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapaCalor } from "@/components/mapa-calor";
import { mapaCalorDiario, type ConclusaoDetalhe } from "@/lib/raiz-format";

/**
 * Escopo de dados no painel do terapeuta ao trocar de cliente.
 * Emula adminGetCliente + RLS:
 * - somente terapeuta lê progresso/diário de terceiros
 * - toda consulta é filtrada por cliente_id = clienteId da rota
 * - trocar o cliente (navegação entre páginas) nunca reaproveita
 *   dados do cliente anterior
 */

const HOJE = new Date("2026-08-06T12:00:00.000Z");

function iso(diasAtras: number, hora = 9) {
  const d = new Date(HOJE);
  d.setHours(hora, 0, 0, 0);
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString();
}

const CLIENTE_A = "11111111-1111-4111-8111-111111111111";
const CLIENTE_B = "22222222-2222-4222-8222-222222222222";
const CLIENTE_C = "44444444-4444-4444-8444-444444444444";
const TERAPEUTA = "33333333-3333-4333-8333-333333333333";

const PAPEIS: Record<string, "cliente" | "terapeuta"> = {
  [CLIENTE_A]: "cliente",
  [CLIENTE_B]: "cliente",
  [CLIENTE_C]: "cliente",
  [TERAPEUTA]: "terapeuta",
};

type LinhaProgresso = ConclusaoDetalhe & { clienteId: string };

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

const TABELA_DIARIO = [
  { clienteId: CLIENTE_A, texto: "Reflexão do cliente A" },
  { clienteId: CLIENTE_B, texto: "Reflexão do cliente B" },
];

const chamadas: string[] = [];

/** Emula adminGetCliente (checagem de papel + filtro por cliente_id). */
function adminGetClienteMock(userId: string, clienteId: string) {
  chamadas.push(clienteId);
  if (PAPEIS[userId] !== "terapeuta") throw new Error("Acesso restrito");
  return {
    progresso: TABELA_PROGRESSO.filter((l) => l.clienteId === clienteId).map(
      ({ clienteId: _ignorado, ...detalhe }) => detalhe,
    ),
    diario: TABELA_DIARIO.filter((d) => d.clienteId === clienteId).map((d) => d.texto),
  };
}

function PainelCliente({ userId }: { userId: string }) {
  const [clienteId, setClienteId] = useState(CLIENTE_A);
  const dados = adminGetClienteMock(userId, clienteId);
  const colunas = mapaCalorDiario(
    dados.progresso.map((c) => c.concluidoEm),
    12,
    dados.progresso,
  );
  return (
    <div>
      <p data-testid="cliente-atual">{clienteId}</p>
      <button onClick={() => setClienteId(CLIENTE_A)}>Abrir cliente A</button>
      <button onClick={() => setClienteId(CLIENTE_B)}>Abrir cliente B</button>
      <button onClick={() => setClienteId(CLIENTE_C)}>Abrir cliente C</button>
      <MapaCalor key={clienteId} colunas={colunas} />
      <ul>
        {dados.diario.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function rotulo(diasAtras: number, praticas: number) {
  const d = new Date(HOJE);
  d.setDate(d.getDate() - diasAtras);
  const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${label} — ${praticas} prática${praticas === 1 ? "" : "s"}`;
}

describe("painel do terapeuta: escopo ao trocar de cliente", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(HOJE);
    chamadas.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("troca de cliente substitui os dados e não vaza o cliente anterior", async () => {
    const user = userEvent.setup();
    render(<PainelCliente userId={TERAPEUTA} />);

    await user.click(screen.getByRole("button", { name: rotulo(1, 2) }));
    let painel = await screen.findByRole("dialog");
    expect(within(painel).getByText("Carta ao pai")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Abrir cliente B" }));
    expect(screen.getByTestId("cliente-atual")).toHaveTextContent(CLIENTE_B);
    expect(screen.queryByText("Reflexão do cliente A")).not.toBeInTheDocument();
    expect(screen.getByText("Reflexão do cliente B")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: rotulo(1, 1) }));
    painel = await screen.findByRole("dialog");
    expect(within(painel).getByText("Diálogo com a mãe")).toBeInTheDocument();
    expect(within(painel).queryByText("Carta ao pai")).not.toBeInTheDocument();
    expect(within(painel).queryByText("Respiração da raiz")).not.toBeInTheDocument();
  });

  it("voltar ao cliente anterior refaz a consulta escopada, sem resíduo do outro", async () => {
    const user = userEvent.setup();
    render(<PainelCliente userId={TERAPEUTA} />);

    await user.click(screen.getByRole("button", { name: "Abrir cliente B" }));
    await user.click(screen.getByRole("button", { name: "Abrir cliente A" }));

    expect(screen.getByTestId("cliente-atual")).toHaveTextContent(CLIENTE_A);
    expect(screen.getByText("Reflexão do cliente A")).toBeInTheDocument();
    expect(screen.queryByText("Reflexão do cliente B")).not.toBeInTheDocument();
    // toda navegação dispara nova consulta filtrada pelo cliente da rota
    expect(chamadas).toContain(CLIENTE_B);
    expect(chamadas.filter((c) => c === CLIENTE_A).length).toBeGreaterThan(1);

    await user.click(screen.getByRole("button", { name: rotulo(1, 2) }));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText(/2 práticas · 15 min registrados/)).toBeInTheDocument();
    expect(within(painel).queryByText("Diálogo com a mãe")).not.toBeInTheDocument();
    expect(within(painel).queryByText("Linha do dinheiro")).not.toBeInTheDocument();
  });

  it("cliente sem progresso não herda dias do cliente anterior", async () => {
    const user = userEvent.setup();
    render(<PainelCliente userId={TERAPEUTA} />);

    await user.click(screen.getByRole("button", { name: "Abrir cliente C" }));
    expect(screen.queryByRole("button", { name: rotulo(1, 2) })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: rotulo(1, 1) })).not.toBeInTheDocument();
    expect(screen.queryByText("Reflexão do cliente A")).not.toBeInTheDocument();

    const rotuloVazio = rotulo(1, 0).split(" — ")[0];
    await user.click(
      screen.getByRole("button", { name: new RegExp(`${rotuloVazio} — nenhuma prática`) }),
    );
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText(/0 prática · 0 min registrados/)).toBeInTheDocument();
  });

  it("usuário sem papel de terapeuta não consulta nenhum cliente", () => {
    expect(() => adminGetClienteMock(CLIENTE_A, CLIENTE_B)).toThrow("Acesso restrito");
    expect(() => adminGetClienteMock(CLIENTE_A, CLIENTE_A)).toThrow("Acesso restrito");
  });
});
