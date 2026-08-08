import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Foco do aviso `role="alert"` de remoção em tempo real.
 *
 * O aviso rouba o foco para ser anunciado, então ao dispensá-lo o foco precisa
 * voltar para onde a pessoa estava. Se o elemento de origem desapareceu junto
 * com a prática removida, o foco vai para o primeiro controle relevante — nunca
 * para o `<body>`. E como o aviso é inline (sem armadilha), Tab continua
 * atravessando o resto da página.
 */

type Handler = (evento?: any) => void;
let handlersPorTabela: Record<string, Handler[]> = {};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "cliente-1" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ not: async () => ({ data: [] }) }) }),
    }),
    channel: (nome: string) => {
      const canal: any = {
        nome,
        on: (_e: string, config: any, handler: Handler) => {
          const lista = handlersPorTabela[config.table] ?? [];
          lista.push(handler);
          handlersPorTabela[config.table] = lista;
          return canal;
        },
        subscribe: () => canal,
      };
      return canal;
    },
    removeChannel: () => {},
  },
}));

vi.mock("sonner", () => ({ toast: { info: () => {} } }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...resto }: any) => (
    <a href="/app" {...resto}>
      {children}
    </a>
  ),
}));

const { AvisoRemocaoRealtime } = await import("./aviso-remocao-realtime");

function Pagina({ comOrigem = true }: { comOrigem?: boolean }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <main>
        <button type="button">Primeiro controle</button>
        {comOrigem ? <button type="button">Abrir prática</button> : null}
        <AvisoRemocaoRealtime />
        <button type="button">Depois do aviso</button>
      </main>
    </QueryClientProvider>
  );
}

async function emitirRemocao(tabela = "conteudos") {
  await waitFor(() => expect(handlersPorTabela[tabela]?.length).toBeTruthy());
  await act(async () => {
    for (const h of handlersPorTabela[tabela]!) h({ eventType: "DELETE", old: { id: "c-1" } });
  });
}

beforeEach(() => {
  handlersPorTabela = {};
});

describe("foco do aviso de remoção", () => {
  it("devolve o foco ao elemento de origem ao dispensar pelo botão", async () => {
    render(<Pagina />);
    const origem = screen.getByRole("button", { name: "Abrir prática" });
    origem.focus();

    await emitirRemocao();
    const alerta = await screen.findByRole("alert");
    await waitFor(() => expect(alerta).toHaveFocus());

    await userEvent.click(screen.getByRole("button", { name: "Entendi, dispensar aviso" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(origem).toHaveFocus();
  });

  it("dispensa com Escape e devolve o foco à origem", async () => {
    render(<Pagina />);
    const origem = screen.getByRole("button", { name: "Abrir prática" });
    origem.focus();

    await emitirRemocao();
    await screen.findByRole("alert");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(origem).toHaveFocus();
  });

  it("cai no primeiro controle relevante quando a origem não existe mais", async () => {
    render(<Pagina comOrigem={false} />);
    await emitirRemocao();
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: "Entendi, dispensar aviso" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByRole("button", { name: "Primeiro controle" })).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("não cria armadilha: Tab sai do aviso para o restante da página", async () => {
    render(<Pagina />);
    await emitirRemocao();
    await screen.findByRole("alert");

    await userEvent.tab(); // Ver minha biblioteca
    expect(screen.getByRole("link", { name: "Ver minha biblioteca" })).toHaveFocus();
    await userEvent.tab(); // Entendi, dispensar aviso
    expect(screen.getByRole("button", { name: "Entendi, dispensar aviso" })).toHaveFocus();
    await userEvent.tab(); // já fora do aviso
    expect(screen.getByRole("button", { name: "Depois do aviso" })).toHaveFocus();
  });

  it("o atalho da biblioteca fecha o aviso sem sequestrar o foco da navegação", async () => {
    render(<Pagina />);
    const origem = screen.getByRole("button", { name: "Abrir prática" });
    origem.focus();

    await emitirRemocao();
    await screen.findByRole("alert");
    const atalho = screen.getByRole("link", { name: "Ver minha biblioteca" });
    await userEvent.click(atalho);

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    // quem navega é a rota de destino; o aviso não devolve o foco à origem
    expect(origem).not.toHaveFocus();
  });
});
