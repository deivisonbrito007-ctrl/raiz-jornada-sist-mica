import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  guardarPendente,
  lerPendente,
  limparPendente,
  reenviarPendente,
  temPendente,
} from "@/lib/progresso-pendente";

describe("fila local de progresso", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("guarda a posição no aparelho quando o acesso está bloqueado", () => {
    guardarPendente({ conteudoId: "c1", posicaoSegundos: 42, tocando: false });
    expect(temPendente("c1")).toBe(true);
    expect(lerPendente("c1")?.posicaoSegundos).toBe(42);
  });

  it("não rebaixa uma conclusão guardada para em andamento", () => {
    guardarPendente({ conteudoId: "c1", status: "concluido", posicaoSegundos: 10 });
    guardarPendente({ conteudoId: "c1", status: "em_andamento", posicaoSegundos: 20 });
    expect(lerPendente("c1")?.status).toBe("concluido");
    expect(lerPendente("c1")?.posicaoSegundos).toBe(20);
  });

  it("reenvia posição e conclusão e limpa a fila", async () => {
    guardarPendente({ conteudoId: "c1", posicaoSegundos: 31.7, status: "concluido" });
    const salvarPosicao = vi.fn().mockResolvedValue({ ok: true });
    const marcarProgresso = vi.fn().mockResolvedValue({ ok: true });

    const enviado = await reenviarPendente("c1", { salvarPosicao, marcarProgresso });

    expect(salvarPosicao).toHaveBeenCalledWith({
      data: { conteudoId: "c1", posicaoSegundos: 31, tocando: false },
    });
    expect(marcarProgresso).toHaveBeenCalledWith({
      data: { conteudoId: "c1", status: "concluido" },
    });
    expect(enviado?.status).toBe("concluido");
    expect(temPendente("c1")).toBe(false);
  });

  it("mantém a fila quando o reenvio falha", async () => {
    guardarPendente({ conteudoId: "c1", posicaoSegundos: 12 });
    const salvarPosicao = vi.fn().mockRejectedValue(new Error("sem rede"));
    const marcarProgresso = vi.fn();

    const enviado = await reenviarPendente("c1", { salvarPosicao, marcarProgresso });

    expect(enviado).toBeNull();
    expect(marcarProgresso).not.toHaveBeenCalled();
    expect(temPendente("c1")).toBe(true);
  });

  it("descarta pendências antigas e não confunde práticas diferentes", () => {
    guardarPendente({ conteudoId: "c1", posicaoSegundos: 5 });
    guardarPendente({
      conteudoId: "c2",
      posicaoSegundos: 9,
      atualizadoEm: Date.now() - 8 * 24 * 60 * 60 * 1000,
    });
    expect(temPendente("c1")).toBe(true);
    expect(temPendente("c2")).toBe(false);
    limparPendente("c1");
    expect(temPendente("c1")).toBe(false);
  });
});
