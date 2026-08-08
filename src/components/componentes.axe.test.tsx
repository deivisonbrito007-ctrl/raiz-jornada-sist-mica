import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { esperarSemViolacoes } from "@/test/axe";
import type { ConclusaoDetalhe } from "@/lib/raiz-format";

// Os componentes usam <Link> do roteador; nos testes ele vira uma âncora simples.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
    ...props
  }: React.ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
}));

const { AvisoMidiaBloqueada } = await import("./aviso-midia-bloqueada");
const { StatusMidiaBadge } = await import("./status-midia");
const { MapaCalor } = await import("./mapa-calor");
const { ContinuarDeOndeParei } = await import("./continuar-de-onde-parei");
const { LembreteRetorno } = await import("./lembrete-retorno");
const { AvisoPermissao } = await import("./aviso-permissao");
const { MatrizPermissoes } = await import("./matriz-permissoes");
const { mapaCalorDiario } = await import("@/lib/raiz-format");

const HOJE = new Date("2026-08-06T12:00:00.000Z");

function iso(diasAtras: number, hora = 9) {
  const d = new Date(HOJE);
  d.setHours(hora, 0, 0, 0);
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString();
}

const conclusoes: ConclusaoDetalhe[] = [
  {
    titulo: "Carta ao pai",
    eixoNome: "Pai",
    tipo: "exercicio",
    duracaoSegundos: 600,
    concluidoEm: iso(1, 8),
  },
  {
    titulo: "Respiração da raiz",
    eixoNome: "Ancestralidade",
    tipo: "audio",
    duracaoSegundos: 300,
    concluidoEm: iso(4, 20),
  },
];

describe("axe-core — componentes do cliente", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(HOJE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["validade", "revogado", "removido", "falha", "limite"] as const)(
    "aviso de mídia bloqueada (%s) não tem violação",
    async (motivo) => {
      render(
        <main>
          <h1>Prática</h1>
          <AvisoMidiaBloqueada
            motivo={motivo}
            renovando={false}
            emEspera={false}
            eixoId="eixo-1"
            onRenovar={() => {}}
          />
        </main>,
      );
      await esperarSemViolacoes();
    },
  );

  it("aviso em espera, com contagem e botão aria-disabled, não tem violação", async () => {
    render(
      <main>
        <h1>Prática</h1>
        <AvisoMidiaBloqueada
          motivo="validade"
          renovando={false}
          emEspera
          esperaAte={Date.now() + 8000}
          onRenovar={() => {}}
        />
      </main>,
    );
    await esperarSemViolacoes();
  });

  it.each(["liberada", "expirada", "revogada", "limitada"] as const)(
    "selo de status da mídia (%s) não tem violação",
    async (status) => {
      render(<StatusMidiaBadge status={status} />);
      await esperarSemViolacoes();
    },
  );

  it("calendário de prática (heatmap) não tem violação", async () => {
    const datas = conclusoes.map((c) => c.concluidoEm);
    render(
      <main>
        <h2>Seu ritmo</h2>
        <MapaCalor colunas={mapaCalorDiario(datas, 12, conclusoes)} />
      </main>,
    );
    await esperarSemViolacoes();
  });

  it("calendário com o detalhe do dia aberto não tem violação", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const datas = conclusoes.map((c) => c.concluidoEm);
    render(
      <main>
        <h2>Seu ritmo</h2>
        <MapaCalor colunas={mapaCalorDiario(datas, 12, conclusoes)} />
      </main>,
    );
    const dias = screen.getAllByRole("button");
    await user.click(dias[dias.length - 1]!);
    await esperarSemViolacoes();
  });

  it("calendário em estado de erro não tem violação", async () => {
    render(
      <main>
        <h2>Seu ritmo</h2>
        <MapaCalor colunas={[]} erro="falhou" onTentarNovamente={() => {}} />
      </main>,
    );
    await esperarSemViolacoes();
  });

  it("atalho “Continuar de onde parei” não tem violação", async () => {
    render(
      <main>
        <h1>Sua trilha</h1>
        <ContinuarDeOndeParei
          pratica={{
            id: "c1",
            eixoNome: "Mãe",
            tipo: "audio",
            titulo: "Respiração da raiz",
            duracaoSegundos: 600,
            posicaoSegundos: 120,
          }}
        />
      </main>,
    );
    await esperarSemViolacoes();
  });

  it("lembrete de retorno não tem violação", async () => {
    render(
      <main>
        <h1>Seu painel</h1>
        <LembreteRetorno
          datas={[iso(9), iso(16)]}
          streakSemanas={2}
          sugestao={{ id: "c1", titulo: "Respiração da raiz", eixoNome: "Mãe" }}
        />
      </main>,
    );
    await esperarSemViolacoes();
  });

  it("região de anúncios para leitor de tela não tem violação", async () => {
    render(<RegiaoAnuncio mensagem="Prática marcada como concluída." />);
    await esperarSemViolacoes();
  });
});

describe("axe-core — componentes do painel do terapeuta", () => {
  it("aviso de permissão não tem violação", async () => {
    render(
      <main>
        <h1>Equipe</h1>
        <AvisoPermissao mensagem="Você não pode liberar conteúdos nesta equipe." />
      </main>,
    );
    await esperarSemViolacoes();
  });

  it("matriz de permissões não tem violação", async () => {
    render(
      <main>
        <h1>Permissões</h1>
        <MatrizPermissoes
          linhas={[
            {
              id: "u1",
              nome: "Ana",
              email: "ana@raiz.app",
              papel: "terapeuta",
              permissoes: ["liberar_conteudo"],
              total: true,
            },
            {
              id: "u2",
              nome: "Bruno",
              email: "bruno@raiz.app",
              papel: "convite",
              permissoes: [],
            },
          ]}
        />
      </main>,
    );
    await esperarSemViolacoes();
  });
});

it("o helper aponta a violação quando ela existe (rede de segurança do CI)", async () => {
  render(
    <main>
      <h1>Tela com problema</h1>
      {/* botão sem nome acessível: o axe precisa reprovar isto */}
      <button type="button" />
    </main>,
  );
  await expect(esperarSemViolacoes()).rejects.toThrow(/button-name/);
});
