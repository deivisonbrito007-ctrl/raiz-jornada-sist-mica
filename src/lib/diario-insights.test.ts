import { describe, expect, it } from "vitest";

import {
  insightsDoDiario,
  resumosMensais,
  sentimentosDaEntrada,
  temasRecorrentes,
  tendenciasSentimentos,
} from "./diario-insights";
import type { EntradaDiario } from "./diario-cliente";

function entrada(parcial: Partial<EntradaDiario> & { id: string }): EntradaDiario {
  return {
    texto: "texto",
    created_at: "2026-08-01T12:00:00.000Z",
    conteudo_id: null,
    visibilidade: "somente_eu",
    ...parcial,
  };
}

describe("sentimentos da entrada", () => {
  it("lê a linha Senti com acentos", () => {
    expect(
      sentimentosDaEntrada(entrada({ id: "a", texto: "hoje\n\nSenti: Calma, Gratidão." })),
    ).toEqual(["calma", "gratidao"]);
  });

  it("devolve vazio sem a linha", () => {
    expect(sentimentosDaEntrada(entrada({ id: "a", texto: "só texto" }))).toEqual([]);
  });
});

describe("tendências de sentimentos", () => {
  const agora = new Date("2026-08-20T12:00:00.000Z");

  it("marca sentimento novo quando só aparece na janela recente", () => {
    const t = tendenciasSentimentos(
      [entrada({ id: "a", texto: "Senti: Coragem.", created_at: "2026-08-18T10:00:00.000Z" })],
      agora,
    );
    expect(t[0]?.chave).toBe("coragem");
    expect(t[0]?.tendencia).toBe("nova");
  });

  it("reconhece queda entre as janelas", () => {
    const t = tendenciasSentimentos(
      [
        entrada({ id: "a", texto: "Senti: Medo.", created_at: "2026-07-05T10:00:00.000Z" }),
        entrada({ id: "b", texto: "Senti: Medo.", created_at: "2026-07-10T10:00:00.000Z" }),
      ],
      agora,
    );
    expect(t[0]?.tendencia).toBe("descendo");
    expect(t[0]?.proporcao).toBe(1);
  });
});

describe("temas recorrentes", () => {
  it("ignora palavras vazias e conta repetições", () => {
    const temas = temasRecorrentes([
      entrada({ id: "a", texto: "a saudade do meu pai apareceu com saudade" }),
      entrada({ id: "b", texto: "meu pai e o chão firme" }),
    ]);
    const palavras = temas.map((t) => t.palavra);
    expect(palavras).toContain("saudade");
    expect(palavras).toContain("pai");
    expect(palavras).not.toContain("meu");
  });

  it("não conta a linha de sentimentos como tema", () => {
    const temas = temasRecorrentes([
      entrada({ id: "a", texto: "algo\n\nSenti: Calma." }),
      entrada({ id: "b", texto: "outro\n\nSenti: Calma." }),
    ]);
    expect(temas.map((t) => t.palavra)).not.toContain("calma");
  });
});

describe("resumo mensal", () => {
  it("agrupa por mês com dias, práticas e eixo mais presente", () => {
    const meses = resumosMensais([
      entrada({
        id: "a",
        created_at: "2026-08-02T10:00:00.000Z",
        conteudo_id: "c1",
        texto: "Senti: Calma.",
        conteudos: { titulo: "Respiração", eixos: { nome: "Corpo" } },
      }),
      entrada({ id: "b", created_at: "2026-08-02T22:00:00.000Z" }),
      entrada({ id: "c", created_at: "2026-07-20T10:00:00.000Z", visibilidade: "compartilhado" }),
    ]);
    expect(meses).toHaveLength(2);
    expect(meses[0]?.total).toBe(2);
    expect(meses[0]?.dias).toBe(1);
    expect(meses[0]?.dePraticas).toBe(1);
    expect(meses[0]?.eixoMaisPresente).toBe("Corpo");
    expect(meses[0]?.frase).toContain("reflexões");
    expect(meses[1]?.compartilhadas).toBe(1);
  });
});

describe("insights do diário", () => {
  it("sinaliza vazio sem entradas", () => {
    const i = insightsDoDiario([]);
    expect(i.vazio).toBe(true);
    expect(i.meses).toEqual([]);
  });
});
