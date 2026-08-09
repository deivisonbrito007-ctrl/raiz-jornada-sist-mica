import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  LIMITE_POR_MINUTO,
  MAX_SIMULTANEOS,
  avaliarPreCarregamento,
  estadoPreCarregamento,
  limparPreCarregamento,
  preCarregar,
} from "@/lib/pre-carregamento";

function definirConexao(valor: unknown) {
  Object.defineProperty(navigator, "connection", {
    value: valor,
    configurable: true,
  });
}

describe("pré-carregamento seguro", () => {
  beforeEach(() => {
    limparPreCarregamento();
    definirConexao(undefined);
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  afterEach(() => vi.restoreAllMocks());

  it("adianta o alvo e guarda a chave para não repetir", async () => {
    const tarefa = vi.fn().mockResolvedValue("ok");
    expect(await preCarregar("etapa:1", tarefa)).toEqual({ feito: true });
    expect(tarefa).toHaveBeenCalledTimes(1);

    expect(await preCarregar("etapa:1", tarefa)).toEqual({
      feito: false,
      motivo: "ja_precarregado",
    });
    expect(tarefa).toHaveBeenCalledTimes(1);
  });

  it("não gasta rede em modo de economia de dados, 2G ou offline", () => {
    definirConexao({ saveData: true });
    expect(avaliarPreCarregamento("a")).toBe("economia_de_dados");

    definirConexao({ effectiveType: "slow-2g" });
    expect(avaliarPreCarregamento("a")).toBe("conexao_lenta");

    definirConexao(undefined);
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    expect(avaliarPreCarregamento("a")).toBe("sem_rede");
  });

  it("não adianta nada com a aba em segundo plano", async () => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    const tarefa = vi.fn();
    expect(await preCarregar("etapa:2", tarefa)).toEqual({ feito: false, motivo: "aba_oculta" });
    expect(tarefa).not.toHaveBeenCalled();
  });

  it("respeita o limite de buscas simultâneas", async () => {
    let liberar: (() => void)[] = [];
    const travar = () => new Promise<void>((r) => liberar.push(r));

    const emVoo = Array.from({ length: MAX_SIMULTANEOS }, (_, i) =>
      preCarregar(`lento:${i}`, travar),
    );
    await new Promise((r) => setTimeout(r, 250));

    expect(estadoPreCarregamento().emAndamento).toBe(MAX_SIMULTANEOS);
    expect(avaliarPreCarregamento("extra")).toBe("limite_simultaneo");

    liberar.forEach((r) => r());
    await Promise.all(emVoo);
    expect(estadoPreCarregamento().emAndamento).toBe(0);
  });

  it("respeita o limite por minuto", async () => {
    for (let i = 0; i < LIMITE_POR_MINUTO; i += 1) {
      await preCarregar(`chave:${i}`, () => Promise.resolve());
    }
    expect(estadoPreCarregamento().naJanela).toBe(LIMITE_POR_MINUTO);
    expect(avaliarPreCarregamento("depois")).toBe("limite_por_minuto");
  });

  it("falha em silêncio e libera a chave para uma nova tentativa", async () => {
    const tarefa = vi.fn().mockRejectedValue(new Error("rede caiu"));
    expect(await preCarregar("etapa:3", tarefa)).toEqual({ feito: false });
    expect(avaliarPreCarregamento("etapa:3")).toBeNull();
  });
});
