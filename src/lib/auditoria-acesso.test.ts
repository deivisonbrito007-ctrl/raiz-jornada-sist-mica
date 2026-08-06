import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  auditarResultado,
  classificarNegacao,
  negarAcesso,
  pedidoForaDoEscopo,
  registrarAcessoNegado,
} from "./auditoria-acesso";

const CLIENTE_A = "11111111-1111-4111-8111-111111111111";
const CLIENTE_B = "22222222-2222-4222-8222-222222222222";

function logs() {
  return (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls;
}

function eventos() {
  return logs().map((c) => JSON.parse(String(c[1])));
}

describe("auditoria de acessos negados", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("classifica a camada que bloqueou o acesso", () => {
    expect(
      classificarNegacao({ message: "new row violates row-level security policy for table" }),
    ).toBe("rls");
    expect(classificarNegacao({ message: "permission denied for table progresso" })).toBe("grant");
    expect(classificarNegacao({ message: "Object not found in bucket midias" })).toBe("storage");
    expect(classificarNegacao("Acesso restrito")).toBe("papel");
    expect(classificarNegacao({ message: "timeout" })).toBe("desconhecido");
    expect(classificarNegacao(null)).toBe("desconhecido");
  });

  it("marca como fora do escopo quando o cliente alvo é outro", () => {
    expect(pedidoForaDoEscopo({ acao: "x", userId: CLIENTE_A, clienteAlvo: CLIENTE_B })).toBe(true);
    expect(pedidoForaDoEscopo({ acao: "x", userId: CLIENTE_A, clienteAlvo: CLIENTE_A })).toBe(false);
    expect(pedidoForaDoEscopo({ acao: "x", userId: CLIENTE_A })).toBe(false);
  });

  it("registra evento estruturado com prefixo de auditoria", () => {
    const evento = registrarAcessoNegado(
      { acao: "getMeuDiario", userId: CLIENTE_A, clienteAlvo: CLIENTE_B, tabela: "diario" },
      { message: "permission denied for table diario" },
    );

    expect(evento).toMatchObject({
      evento: "acesso-negado",
      tipo: "grant",
      acao: "getMeuDiario",
      tabela: "diario",
      foraDoEscopo: true,
    });
    expect(logs()[0]?.[0]).toBe("[auditoria:acesso-negado]");
    expect(eventos()[0]).toMatchObject({ tipo: "grant", foraDoEscopo: true });
  });

  it("não despeja ids completos nem textos sensíveis no log", () => {
    registrarAcessoNegado(
      { acao: "getMeuDiario", userId: CLIENTE_A, clienteAlvo: CLIENTE_B, tabela: "diario" },
      { message: "permission denied for table diario" },
    );
    const linha = String(logs()[0]?.[1]);
    expect(linha).not.toContain(CLIENTE_A);
    expect(linha).not.toContain(CLIENTE_B);
    expect(eventos()[0].userId).toBe("11111111…");
  });

  it("negarAcesso registra a tentativa e lança Acesso restrito", () => {
    expect(() =>
      negarAcesso({ acao: "adminGetCliente", userId: CLIENTE_A, clienteAlvo: CLIENTE_B }),
    ).toThrow("Acesso restrito");

    expect(eventos()[0]).toMatchObject({
      tipo: "papel",
      acao: "adminGetCliente",
      foraDoEscopo: true,
    });
  });

  it("auditarResultado registra erros de RLS/GRANT/Storage e ignora sucesso", () => {
    const ok = auditarResultado({ data: [{ id: 1 }], error: null }, { acao: "leitura" });
    expect(ok.data).toHaveLength(1);
    expect(logs()).toHaveLength(0);

    auditarResultado(
      { data: null, error: { message: "new row violates row-level security policy" } },
      { acao: "insereDiario", userId: CLIENTE_A, clienteAlvo: CLIENTE_B, tabela: "diario" },
    );
    auditarResultado(
      { data: null, error: { message: "Object not found" } },
      { acao: "getConteudo:signedUrl", userId: CLIENTE_A, tabela: "storage.midias", recurso: "a/b.mp3" },
    );
    expect(eventos().map((e) => e.tipo)).toEqual(["rls", "storage"]);
    expect(eventos()[1]).toMatchObject({ recurso: "a/b.mp3", foraDoEscopo: false });
  });

  it("erros que não são de permissão não geram ruído na auditoria", () => {
    auditarResultado(
      { data: null, error: { message: "network timeout" } },
      { acao: "leitura", userId: CLIENTE_A },
    );
    expect(logs()).toHaveLength(0);
  });

  it("uma sequência de tentativas fora do escopo fica rastreável nos logs", () => {
    for (const acao of ["getMeuDiario", "getMinhaBiblioteca", "getConteudo"]) {
      auditarResultado(
        { data: null, error: { message: "permission denied for table progresso" } },
        { acao, userId: CLIENTE_A, clienteAlvo: CLIENTE_B, tabela: "progresso" },
      );
    }
    const fora = eventos().filter((e) => e.foraDoEscopo);
    expect(fora).toHaveLength(3);
    expect(fora.map((e) => e.acao)).toEqual(["getMeuDiario", "getMinhaBiblioteca", "getConteudo"]);
    expect(new Set(fora.map((e) => e.tipo))).toEqual(new Set(["grant"]));
  });
});
