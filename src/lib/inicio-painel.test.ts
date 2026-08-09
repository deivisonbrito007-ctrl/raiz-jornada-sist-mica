/**
 * Regras da aba "Início" do painel.
 *
 * Trava o que a terapeuta vê ao entrar: contagens reais, janela da semana no
 * fuso de São Paulo, ordem das prioridades e — importante — a ausência de
 * qualquer diagnóstico ou texto de diário na linha do tempo.
 */
import { describe, expect, it } from "vitest";
import {
  dataCurta,
  dataLocal,
  montarAgenda,
  montarLinhaDoTempo,
  montarPrioridades,
  montarResumo,
  resumirObjetivo,
  semanaDe,
  quandoRelativo,
  type DadosInicio,
} from "./inicio-painel";

const CLI_A = "11111111-1111-4111-8111-111111111111";
const CLI_B = "22222222-2222-4222-8222-222222222222";
const TERA = "33333333-3333-4333-8333-333333333333";

/** Domingo 9 de agosto de 2026, 23h em São Paulo (já 10/08 em UTC). */
const AGORA = new Date("2026-08-10T02:00:00Z");

function dados(parcial: Partial<DadosInicio> = {}): DadosInicio {
  return {
    clientes: [],
    perfis: [
      { id: CLI_A, nome: "Ana", email: "ana@ex.com" },
      { id: CLI_B, nome: "", email: "bruno@ex.com" },
      { id: TERA, nome: "Terapeuta", email: "t@ex.com" },
    ],
    atribuicoes: [],
    trilhas: [{ id: "t1", nome: "Raízes" }],
    revisoes: [],
    apoio: [],
    convites: [],
    etapas: [],
    praticas: [],
    compartilhados: [],
    ...parcial,
  };
}

function atribuicao(over: Partial<DadosInicio["atribuicoes"][number]> = {}) {
  return {
    id: "a1",
    cliente_id: CLI_A,
    terapeuta_id: TERA,
    trilha_id: "t1",
    objetivo: "Reduzir a autocrítica no trabalho",
    status: "ativa",
    data_inicio: "2026-08-01",
    data_revisao: "2026-08-12",
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
    ...over,
  };
}

describe("datas e janelas", () => {
  it("usa o dia local de São Paulo, não o UTC", () => {
    // 02:00 UTC do dia 10 ainda é dia 9 em São Paulo.
    expect(dataLocal(AGORA)).toBe("2026-08-09");
  });

  it("a semana vai de segunda a domingo", () => {
    expect(semanaDe("2026-08-09")).toEqual({ inicio: "2026-08-03", fim: "2026-08-09" });
    expect(semanaDe("2026-08-10")).toEqual({ inicio: "2026-08-10", fim: "2026-08-16" });
  });

  it("formata data curta sem escorregar de fuso", () => {
    expect(dataCurta("2026-08-01")).toBe("01/08/2026");
    expect(dataCurta(null)).toBe("");
  });

  it("descreve o tempo em linguagem simples", () => {
    expect(quandoRelativo("2026-08-09T13:00:00Z", AGORA)).toBe("hoje");
    expect(quandoRelativo("2026-08-08T13:00:00Z", AGORA)).toBe("ontem");
    expect(quandoRelativo("2026-08-05T13:00:00Z", AGORA)).toBe("há 4 dias");
    expect(quandoRelativo("2026-08-12T13:00:00Z", AGORA)).toBe("em 3 dias");
  });
});

describe("resumo", () => {
  it("conta apenas o que existe de verdade", () => {
    const d = dados({
      clientes: [
        { id: CLI_A, nome: "Ana", email: "ana@ex.com", status: "ativo" },
        { id: CLI_B, nome: "", email: "bruno@ex.com", status: "encerrado" },
      ],
      atribuicoes: [
        atribuicao(),
        atribuicao({ id: "a2", data_inicio: "2026-08-20", data_revisao: null }),
        atribuicao({ id: "a3", status: "pausada", data_revisao: "2026-08-09" }),
      ],
      apoio: [
        { id: "s1", cliente_id: CLI_A, status: "aberta", origem: "etapa", created_at: "2026-08-09T12:00:00Z" },
        { id: "s2", cliente_id: CLI_B, status: "encerrada", origem: "etapa", created_at: "2026-08-01T12:00:00Z" },
      ],
      praticas: [
        { cliente_id: CLI_A, concluido_em: "2026-08-08T12:00:00Z" },
        { cliente_id: CLI_A, concluido_em: "2026-07-01T12:00:00Z" },
      ],
      etapas: [{ atribuicao_id: "a1", concluida_em: "2026-08-07T12:00:00Z" }],
    });

    const porId = new Map(montarResumo(d, AGORA).map((c) => [c.id, c.valor]));
    expect(porId.get("clientes")).toBe(1);
    expect(porId.get("trilhas")).toBe(1); // a2 começa no futuro, a3 está pausada
    expect(porId.get("revisoes")).toBe(1); // 09/08 cai na semana corrente
    expect(porId.get("apoio")).toBe(1);
    expect(porId.get("aguardando")).toBe(1);
    expect(porId.get("atividades")).toBe(2); // só as dos últimos 7 dias
  });

  it("zero não é erro: cada cartão traz uma frase acolhedora", () => {
    const cartoes = montarResumo(dados(), AGORA);
    expect(cartoes).toHaveLength(6);
    for (const c of cartoes) {
      expect(c.valor).toBe(0);
      expect(c.vazio.length).toBeGreaterThan(5);
      expect(c.para.startsWith("/admin")).toBe(true);
    }
  });
});

describe("prioridades do dia", () => {
  const completo = dados({
    atribuicoes: [
      atribuicao({ id: "a-venc", data_revisao: "2026-08-05" }),
      atribuicao({ id: "a-pausa", status: "pausada", data_revisao: null }),
    ],
    apoio: [
      { id: "s1", cliente_id: CLI_A, status: "aberta", origem: "etapa", created_at: "2026-08-09T12:00:00Z" },
    ],
    revisoes: [
      { id: "r1", cliente_id: CLI_B, atribuicao_id: "a-venc", devolutiva: "", created_at: "2026-08-08T12:00:00Z" },
      { id: "r2", cliente_id: CLI_B, atribuicao_id: "a-venc", devolutiva: "Ótimo caminho", created_at: "2026-08-08T12:00:00Z" },
    ],
    convites: [
      { id: "c1", email: "novo@ex.com", nome: "Novo", status: "pendente", expira_em: "2026-08-20T00:00:00Z", created_at: "2026-08-08T12:00:00Z" },
      { id: "c2", email: "velho@ex.com", nome: "", status: "aceito", expira_em: "2026-08-01T00:00:00Z", created_at: "2026-07-01T12:00:00Z" },
    ],
  });

  it("ordena por urgência: apoio, revisão, devolutiva, plano, convite", () => {
    // Dois planos: o da revisão vencida e o pausado — os dois pedem atenção.
    expect(montarPrioridades(completo, AGORA).map((p) => p.tipo)).toEqual([
      "apoio",
      "revisao",
      "devolutiva",
      "plano",
      "plano",
      "convite",
    ]);
  });

  it("usa linguagem factual, sem diagnóstico nem emoção classificada", () => {
    const textos = montarPrioridades(completo, AGORA)
      .map((p) => `${p.titulo} ${p.detalhe}`)
      .join(" | ")
      .toLowerCase();
    expect(textos).toContain("solicitou contato");
    expect(textos).toContain("precisa de acompanhamento");
    expect(textos).toContain("plano pausado");
    expect(textos).toContain("convite enviado e ainda não aceito");
    for (const proibido of ["risco", "grave", "ansios", "deprim", "crise", "instável"]) {
      expect(textos).not.toContain(proibido);
    }
  });

  it("ignora revisão distante e devolutiva já escrita", () => {
    const d = dados({ atribuicoes: [atribuicao({ data_revisao: "2026-12-01" })] });
    expect(montarPrioridades(d, AGORA)).toEqual([]);
  });

  it("marca convite pendente que já expirou", () => {
    const d = dados({
      convites: [
        { id: "c1", email: "x@ex.com", nome: "", status: "pendente", expira_em: "2026-08-01T00:00:00Z", created_at: "2026-07-20T12:00:00Z" },
      ],
    });
    expect(montarPrioridades(d, AGORA)[0]?.detalhe).toBe("Convite expirou sem ser aceito");
  });
});

describe("agenda de revisões", () => {
  it("lista da revisão mais próxima para a mais distante, com responsável", () => {
    const d = dados({
      atribuicoes: [
        atribuicao({ id: "a2", data_revisao: "2026-08-25" }),
        atribuicao({ id: "a1", data_revisao: "2026-08-12" }),
        atribuicao({ id: "a3", data_revisao: "2026-08-01", cliente_id: CLI_B, terapeuta_id: null }),
      ],
    });
    const agenda = montarAgenda(d, AGORA);
    expect(agenda.map((i) => i.id)).toEqual(["a3", "a1", "a2"]);
    expect(agenda[0]).toMatchObject({
      cliente: "bruno@ex.com",
      trilha: "Raízes",
      responsavel: "Não atribuído",
      atrasada: true,
      data: "01/08/2026",
    });
    expect(agenda[1]?.atrasada).toBe(false);
  });

  it("resume o objetivo em uma linha, sem cortar palavra no meio", () => {
    expect(resumirObjetivo("   ")).toBe("Objetivo não descrito");
    const longo = resumirObjetivo("palavra ".repeat(30));
    expect(longo.endsWith("…")).toBe(true);
    expect(longo.length).toBeLessThanOrEqual(92);
  });
});

describe("linha do tempo", () => {
  const d = dados({
    atribuicoes: [
      atribuicao({ id: "a1", created_at: "2026-08-01T10:00:00Z" }),
      atribuicao({ id: "a2", status: "pausada", updated_at: "2026-08-06T10:00:00Z" }),
      atribuicao({ id: "a3", status: "concluida", updated_at: "2026-08-07T10:00:00Z" }),
    ],
    etapas: [{ atribuicao_id: "a1", concluida_em: "2026-08-09T10:00:00Z" }],
    compartilhados: [{ id: "d1", cliente_id: CLI_A, compartilhado_em: "2026-08-08T10:00:00Z" }],
    apoio: [
      { id: "s1", cliente_id: CLI_B, status: "aberta", origem: "etapa", created_at: "2026-08-05T10:00:00Z" },
    ],
  });

  it("junta os cinco tipos de evento em ordem do mais recente", () => {
    const eventos = montarLinhaDoTempo(d, AGORA);
    expect(eventos.map((e) => e.tipo)).toEqual([
      "etapa_concluida",
      "registro_compartilhado",
      "plano_finalizado",
      "plano_pausado",
      "apoio",
      "trilha_iniciada",
      "trilha_iniciada",
      "trilha_iniciada",
    ]);
  });

  it("nunca mostra o conteúdo do diário, só o fato do compartilhamento", () => {
    const evento = montarLinhaDoTempo(d, AGORA).find((e) => e.tipo === "registro_compartilhado");
    expect(evento?.descricao).toBe("Compartilhou um registro do diário");
    // O dado de entrada nem tem o texto: a função de servidor não o busca.
    expect(Object.keys(d.compartilhados[0]!)).toEqual(["id", "cliente_id", "compartilhado_em"]);
  });

  it("respeita o limite pedido", () => {
    expect(montarLinhaDoTempo(d, AGORA, 3)).toHaveLength(3);
  });
});
