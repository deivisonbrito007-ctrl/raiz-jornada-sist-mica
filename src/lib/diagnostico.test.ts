import { describe, expect, it, beforeEach } from "vitest";
import {
  limparDiagnostico,
  lerDiagnostico,
  normalizarRota,
  registrarRequisicao,
  registrarRota,
  rotuloDaRequisicao,
} from "@/lib/diagnostico";

describe("diagnóstico interno", () => {
  beforeEach(() => limparDiagnostico());

  it("mascara ids dinâmicos nas rotas", () => {
    expect(normalizarRota("/admin/cliente/72da950b-37a9-4874-9f97-fc81260e09d8")).toBe(
      "/admin/cliente/:id",
    );
    expect(normalizarRota("/app/conteudo/72DA950B-37A9-4874-9F97-FC81260E09D8?x=1")).toBe(
      "/app/conteudo/:id",
    );
    expect(normalizarRota("/")).toBe("/");
  });

  it("agrupa requisições por função de servidor sem expor parâmetros", () => {
    expect(rotuloDaRequisicao("http://x/app?_serverFnId=/lib/raiz.functions--getMeuContexto")).toBe(
      "fn: raiz.functions--getMeuContexto",
    );
    const rotulo = rotuloDaRequisicao(
      "https://abc.supabase.co/rest/v1/diario?cliente_id=eq.72da950b-37a9-4874-9f97-fc81260e09d8",
    );
    expect(rotulo).toBe("backend: diario");
    expect(rotulo).not.toContain("72da950b");
  });

  it("agrega chamadas, mediana, p95 e falhas", () => {
    for (const ms of [100, 200, 300, 400, 1000]) registrarRequisicao("/app?_serverFnId=fn", ms);
    registrarRequisicao("/app?_serverFnId=fn", 50, true);

    const { requisicoes, totalRequisicoes, totalErros } = lerDiagnostico();
    const linha = requisicoes.find((r) => r.rotulo === "fn: fn");
    expect(linha?.chamadas).toBe(6);
    expect(linha?.p50).toBe(200);
    expect(linha?.p95).toBe(1000);
    expect(linha?.max).toBe(1000);
    expect(linha?.erros).toBe(1);
    expect(totalRequisicoes).toBe(6);
    expect(totalErros).toBe(1);
  });

  it("agrupa rotas equivalentes numa única linha", () => {
    registrarRota("/admin/cliente/72da950b-37a9-4874-9f97-fc81260e09d8", 120);
    registrarRota("/admin/cliente/11111111-2222-3333-4444-555555555555", 240);

    const { rotas } = lerDiagnostico();
    expect(rotas).toHaveLength(1);
    expect(rotas[0]?.rotulo).toBe("/admin/cliente/:id");
    expect(rotas[0]?.chamadas).toBe(2);
  });

  it("zerar medições limpa os agregados", () => {
    registrarRota("/app", 100);
    limparDiagnostico();
    expect(lerDiagnostico().rotas).toHaveLength(0);
    expect(lerDiagnostico().totalRequisicoes).toBe(0);
  });
});
