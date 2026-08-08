import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Quando uma prática, sequência ou liberação é removida em tempo real, o cliente
 * precisa receber um aviso acessível: anunciado por leitor de tela, com foco e
 * com orientação sobre o próximo passo.
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

const toastInfo = vi.fn();
vi.mock("sonner", () => ({ toast: { info: (...a: unknown[]) => toastInfo(...a) } }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...resto }: any) => (
    <a href="/app" {...resto}>
      {children}
    </a>
  ),
}));

const { AvisoRemocaoRealtime, avisoDaMudanca } = await import("./aviso-remocao-realtime");

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AvisoRemocaoRealtime />
    </QueryClientProvider>,
  );
}

async function emitir(tabela: string, evento: any) {
  await waitFor(() => expect(handlersPorTabela[tabela]?.length).toBeTruthy());
  for (const h of handlersPorTabela[tabela]!) h(evento);
}

beforeEach(() => {
  handlersPorTabela = {};
  toastInfo.mockClear();
});

describe("aviso acessível de remoção em tempo real", () => {
  it("não mostra nada enquanto nada foi removido", async () => {
    montar();
    await waitFor(() => expect(handlersPorTabela["conteudos"]?.length).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("anuncia a remoção de uma prática com orientação e foco no aviso", async () => {
    montar();
    await emitir("conteudos", { eventType: "DELETE", old: { id: "c-1" } });

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveAttribute("aria-live", "assertive");
    expect(alerta).toHaveAccessibleName("Uma prática foi removida");
    expect(alerta).toHaveAccessibleDescription(/Volte à sua biblioteca/);
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(toastInfo).toHaveBeenCalled();
  });

  it("anuncia a remoção de uma sequência inteira", async () => {
    montar();
    await emitir("eixos", { eventType: "DELETE", old: { id: "e-1" } });
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveAccessibleName("Uma sequência foi removida");
    expect(alerta).toHaveTextContent(/progresso já registrado continua guardado/);
  });

  it("anuncia a retirada de uma liberação", async () => {
    montar();
    await emitir("liberacoes", { eventType: "DELETE", old: { id: "l-1" } });
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveAccessibleName("Uma liberação foi retirada");
    expect(alerta).toHaveTextContent(/nova liberação/i);
  });

  it("não interrompe quando a mudança é apenas uma nova liberação", async () => {
    montar();
    await emitir("liberacoes", { eventType: "UPDATE", new: { liberar_em: null } });
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it("oferece caminho por teclado para a biblioteca e para dispensar o aviso", async () => {
    montar();
    await emitir("conteudos", { eventType: "DELETE", old: { id: "c-2" } });
    await screen.findByRole("alert");

    expect(screen.getByRole("link", { name: "Ver minha biblioteca" })).toBeInTheDocument();
    const dispensar = screen.getByRole("button", { name: "Entendi, dispensar aviso" });
    await userEvent.click(dispensar);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("traduz cada mudança na mensagem certa", () => {
    expect(avisoDaMudanca({ tipo: "liberacao" })).toBeNull();
    expect(avisoDaMudanca()).toBeNull();
    expect(avisoDaMudanca({ tipo: "removido", conteudoId: "x" })?.titulo).toMatch(/prática/i);
    expect(avisoDaMudanca({ tipo: "sequencia-removida", eixoId: "x" })?.titulo).toMatch(
      /sequência/i,
    );
    expect(avisoDaMudanca({ tipo: "liberacao-removida" })?.orientacao).toMatch(/biblioteca/i);
  });
});
