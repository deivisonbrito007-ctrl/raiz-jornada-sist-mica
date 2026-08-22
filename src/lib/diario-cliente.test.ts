import { describe, expect, it } from "vitest";

import {
  CONVITES,
  agruparPorMes,
  comporTexto,
  conviteDoDia,
  convitePorIndice,
  ehCompartilhada,
  filtrarEntradas,
  recortar,
  resumoDoDiario,
  tempoRelativo,
  type EntradaDiario,
} from "./diario-cliente";

function entrada(parcial: Partial<EntradaDiario> & { id: string }): EntradaDiario {
  return {
    texto: "texto",
    created_at: "2026-08-01T12:00:00.000Z",
    conteudo_id: null,
    visibilidade: "somente_eu",
    ...parcial,
  };
}

describe("convites de escrita", () => {
  it("dá a volta na lista sem estourar índice", () => {
    expect(convitePorIndice(0)).toBe(CONVITES[0]);
    expect(convitePorIndice(CONVITES.length)).toBe(CONVITES[0]);
    expect(convitePorIndice(-1)).toBe(CONVITES[CONVITES.length - 1]);
  });

  it("mantém o mesmo convite dentro do mesmo dia", () => {
    const manha = new Date(2026, 7, 12, 8);
    const noite = new Date(2026, 7, 12, 23);
    expect(conviteDoDia(manha)).toBe(conviteDoDia(noite));
  });
});

describe("composição do texto", () => {
  it("acrescenta os sentimentos escolhidos", () => {
    expect(comporTexto(" respirei fundo ", ["calma", "gratidao"])).toBe(
      "respirei fundo\n\nSenti: Calma, Gratidão.",
    );
  });

  it("não muda nada quando não há sentimentos", () => {
    expect(comporTexto("só o texto", [])).toBe("só o texto");
  });
});

describe("tempo relativo", () => {
  const agora = new Date(2026, 7, 20, 10);
  it("nomeia hoje, ontem e a semana", () => {
    expect(tempoRelativo(new Date(2026, 7, 20, 1).toISOString(), agora)).toBe("hoje");
    expect(tempoRelativo(new Date(2026, 7, 19, 22).toISOString(), agora)).toBe("ontem");
    expect(tempoRelativo(new Date(2026, 7, 17).toISOString(), agora)).toBe("há 3 dias");
    expect(tempoRelativo(new Date(2026, 7, 12).toISOString(), agora)).toBe("há uma semana");
  });

  it("devolve vazio sem data válida", () => {
    expect(tempoRelativo(null, agora)).toBe("");
    expect(tempoRelativo("não é data", agora)).toBe("");
  });
});

describe("filtros e agrupamento", () => {
  const lista = [
    entrada({ id: "a", texto: "peito aberto", conteudo_id: "c-1", created_at: "2026-08-02T10:00:00.000Z", conteudos: { titulo: "Respiração", eixos: { nome: "Corpo" } } }),
    entrada({ id: "b", texto: "saudade da avó", visibilidade: "compartilhado", created_at: "2026-07-28T10:00:00.000Z" }),
  ];

  it("separa privadas e compartilhadas", () => {
    expect(filtrarEntradas(lista, { filtro: "privadas" }).map((e) => e.id)).toEqual(["a"]);
    expect(filtrarEntradas(lista, { filtro: "compartilhadas" }).map((e) => e.id)).toEqual(["b"]);
    expect(filtrarEntradas(lista, { filtro: "praticas" }).map((e) => e.id)).toEqual(["a"]);
  });

  it("busca no texto, no título da prática e no eixo", () => {
    expect(filtrarEntradas(lista, { busca: "avó" }).map((e) => e.id)).toEqual(["b"]);
    expect(filtrarEntradas(lista, { busca: "respiração" }).map((e) => e.id)).toEqual(["a"]);
    expect(filtrarEntradas(lista, { busca: "corpo" }).map((e) => e.id)).toEqual(["a"]);
  });

  it("agrupa por mês mantendo a ordem recebida", () => {
    const grupos = agruparPorMes(lista);
    expect(grupos).toHaveLength(2);
    expect(grupos[0]?.entradas.map((e) => e.id)).toEqual(["a"]);
  });

  it("reconhece o estado compartilhado", () => {
    expect(ehCompartilhada(lista[1]!)).toBe(true);
    expect(ehCompartilhada(lista[0]!)).toBe(false);
  });
});

describe("resumo do diário", () => {
  it("acolhe quem ainda não escreveu", () => {
    const resumo = resumoDoDiario([]);
    expect(resumo.total).toBe(0);
    expect(resumo.frase).toMatch(/lugar só seu/);
  });

  it("conta dias distintos e compartilhadas", () => {
    const agora = new Date(2026, 7, 20, 10);
    const resumo = resumoDoDiario(
      [
        entrada({ id: "a", created_at: new Date(2026, 7, 20, 8).toISOString() }),
        entrada({ id: "b", created_at: new Date(2026, 7, 20, 21).toISOString() }),
        entrada({
          id: "c",
          created_at: new Date(2026, 7, 18).toISOString(),
          visibilidade: "compartilhado",
        }),
      ],
      agora,
    );
    expect(resumo.total).toBe(3);
    expect(resumo.diasEscrevendo).toBe(2);
    expect(resumo.compartilhadas).toBe(1);
    expect(resumo.frase).toMatch(/hoje/);
  });
});

describe("recorte de texto", () => {
  it("mantém textos curtos intactos", () => {
    expect(recortar("curto")).toEqual({ trecho: "curto", cortado: false });
  });

  it("corta textos longos sem partir palavra", () => {
    const longo = "palavra ".repeat(80);
    const { trecho, cortado } = recortar(longo, 100);
    expect(cortado).toBe(true);
    expect(trecho.endsWith("…")).toBe(true);
    expect(trecho.length).toBeLessThanOrEqual(101);
  });
});
