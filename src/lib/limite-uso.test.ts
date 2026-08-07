import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { consumirLimite, LIMITE_MIDIA_POR_MINUTO } from "./limite-uso.server";

describe("limite de geração de URLs assinadas", () => {
  beforeEach(() => rpc.mockReset());

  it("permite o pedido quando ainda está dentro do limite", async () => {
    rpc.mockResolvedValue({
      data: { permitido: true, usados: 2, limite: 5, liberar_em: null },
      error: null,
    });
    const r = await consumirLimite("user-1", "midia:url-assinada");
    expect(r.permitido).toBe(true);
    expect(r.esperarSegundos).toBe(0);
    expect(rpc).toHaveBeenCalledWith("consumir_limite", {
      _user_id: "user-1",
      _acao: "midia:url-assinada",
      _limite: LIMITE_MIDIA_POR_MINUTO,
      _janela_segundos: 60,
    });
  });

  it("bloqueia e informa quantos segundos faltam ao estourar o limite", async () => {
    rpc.mockResolvedValue({
      data: {
        permitido: false,
        usados: 5,
        limite: 5,
        liberar_em: new Date(Date.now() + 12_000).toISOString(),
      },
      error: null,
    });
    const r = await consumirLimite("user-1", "midia:url-assinada");
    expect(r.permitido).toBe(false);
    expect(r.esperarSegundos).toBeGreaterThan(9);
    expect(r.esperarSegundos).toBeLessThanOrEqual(13);
  });

  it("nunca deixa a espera passar da janela configurada", async () => {
    rpc.mockResolvedValue({
      data: { permitido: false, usados: 9, limite: 5, liberar_em: null },
      error: null,
    });
    const r = await consumirLimite("user-1", "midia:url-assinada", 5, 30);
    expect(r.esperarSegundos).toBeLessThanOrEqual(30);
  });

  it("não trava a mídia se a checagem de limite falhar", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "timeout" } });
    const r = await consumirLimite("user-1", "midia:url-assinada");
    expect(r.permitido).toBe(true);
  });

  it("não trava a mídia se a chamada lançar erro", async () => {
    rpc.mockImplementation(() => {
      throw new Error("sem conexão");
    });

    let resultado: Awaited<ReturnType<typeof consumirLimite>> | null = null;
    let lancou: unknown = null;
    try {
      resultado = await consumirLimite("user-1", "midia:url-assinada");
    } catch (e) {
      lancou = e;
    }
    expect(lancou).toBeNull();
    expect(resultado?.permitido).toBe(true);
  });

});
