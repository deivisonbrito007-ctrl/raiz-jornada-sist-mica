import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rlsConfigurado } from "@/test/rls-ambiente";
import {
  criarCenarioSeguranca,
  duracaoEstavel,
  textoDiario,
  tituloConteudo,
  type Cenario,
} from "@/test/fabrica-dados";

/**
 * Verifica que a fábrica de dados entrega sempre o mesmo cenário
 * (múltiplos terapeutas e clientes) e que o RLS se comporta igual
 * em cima dele — sem flutuação entre execuções.
 */
describe.skipIf(!rlsConfigurado)("cenário determinístico de segurança", () => {
  let cenario: Cenario;

  beforeAll(async () => {
    cenario = await criarCenarioSeguranca({
      terapeutas: 2,
      clientes: 3,
      eixos: 2,
      conteudosPorEixo: 3,
      diarioPorCliente: 2,
    });
  });

  afterAll(async () => {
    await cenario?.limpar();
  });

  it("semeia a forma esperada de dados", () => {
    expect(cenario.terapeutas).toHaveLength(2);
    expect(cenario.clientes).toHaveLength(3);
    expect(cenario.eixos).toHaveLength(2);
    expect(cenario.conteudos).toHaveLength(6);
    expect(cenario.conteudos.map((c) => c.titulo)).toEqual([
      tituloConteudo(cenario.marcador, 0, 0),
      tituloConteudo(cenario.marcador, 0, 1),
      tituloConteudo(cenario.marcador, 0, 2),
      tituloConteudo(cenario.marcador, 1, 0),
      tituloConteudo(cenario.marcador, 1, 1),
      tituloConteudo(cenario.marcador, 1, 2),
    ]);
    expect(cenario.conteudos.map((c) => c.duracaoSegundos)).toEqual([
      duracaoEstavel(0, 0),
      duracaoEstavel(0, 1),
      duracaoEstavel(0, 2),
      duracaoEstavel(1, 0),
      duracaoEstavel(1, 1),
      duracaoEstavel(1, 2),
    ]);
    for (const cliente of cenario.clientes) {
      expect(cliente.liberados).toHaveLength(2);
      expect(cliente.agendados).toHaveLength(2);
      expect(cliente.revogados).toHaveLength(2);
      expect(cliente.diario.map((d) => d.texto)).toEqual([
        textoDiario(cliente.indice, 0),
        textoDiario(cliente.indice, 1),
      ]);
    }
  });

  it("cada cliente enxerga só o próprio diário previsível", async () => {
    for (const cliente of cenario.clientes) {
      const { data, error } = await cliente.db.from("diario").select("cliente_id, texto");
      expect(error).toBeNull();
      expect(data!.map((d) => d.texto).sort()).toEqual([
        textoDiario(cliente.indice, 0),
        textoDiario(cliente.indice, 1),
      ]);
      expect(data!.every((d) => d.cliente_id === cliente.id)).toBe(true);
    }
  });

  it("cada cliente enxerga exatamente os conteúdos liberados para si", async () => {
    for (const cliente of cenario.clientes) {
      const { data, error } = await cliente.db
        .from("conteudos")
        .select("id")
        .in(
          "eixo_id",
          cenario.eixos.map((e) => e.id),
        );
      expect(error).toBeNull();
      expect(data!.map((c) => c.id).sort()).toEqual([...cliente.liberados].sort());
      for (const bloqueado of [...cliente.agendados, ...cliente.revogados]) {
        expect(data!.some((c) => c.id === bloqueado)).toBe(false);
      }
    }
  });

  it("progresso é previsível por cliente e não vaza entre eles", async () => {
    for (const cliente of cenario.clientes) {
      const { data, error } = await cliente.db.from("progresso").select("cliente_id, posicao_segundos");
      expect(error).toBeNull();
      expect(data!.every((p) => p.cliente_id === cliente.id)).toBe(true);
      expect(data!.map((p) => p.posicao_segundos)).toEqual([10 * (cliente.indice + 1)]);
    }
  });

  it("todos os terapeutas do cenário veem a base completa de clientes", async () => {
    const idsClientes = cenario.clientes.map((c) => c.id).sort();
    for (const terapeuta of cenario.terapeutas) {
      const perfis = await terapeuta.db.from("profiles").select("id").in("id", idsClientes);
      expect(perfis.error).toBeNull();
      expect(perfis.data!.map((p) => p.id).sort()).toEqual(idsClientes);

      const diarios = await terapeuta.db.from("diario").select("cliente_id").in("cliente_id", idsClientes);
      expect(diarios.error).toBeNull();
      expect(new Set(diarios.data!.map((d) => d.cliente_id))).toEqual(new Set(idsClientes));
    }
  });

  it("cliente não escreve nem lê dados de nenhum outro cliente do cenário", async () => {
    const [primeiro, ...outros] = cenario.clientes;
    for (const outro of outros) {
      const leitura = await primeiro!.db.from("diario").select("id").eq("cliente_id", outro.id);
      expect(leitura.data).toEqual([]);

      const escrita = await primeiro!.db.from("diario").insert({ cliente_id: outro.id, texto: "invasão" });
      expect(escrita.error).not.toBeNull();
      expect(escrita.error!.message.toLowerCase()).toContain("row-level security");
    }
  });

  it("dois cenários criados em sequência produzem os mesmos resultados de RLS", async () => {
    const outroCenario = await criarCenarioSeguranca({
      terapeutas: 1,
      clientes: 2,
      eixos: 1,
      conteudosPorEixo: 3,
      diarioPorCliente: 2,
    });
    try {
      const visao = async (c: Cenario, indice: number) => {
        const cliente = c.clientes[indice]!;
        const conteudos = await cliente.db
          .from("conteudos")
          .select("id")
          .in(
            "eixo_id",
            c.eixos.map((e) => e.id),
          );
        const diario = await cliente.db.from("diario").select("texto");
        return {
          conteudos: conteudos.data!.length,
          diario: diario.data!.map((d) => d.texto).sort(),
        };
      };

      const a = await visao(outroCenario, 0);
      const b = await visao(outroCenario, 1);
      expect(a.conteudos).toBe(1);
      expect(b.conteudos).toBe(1);
      expect(a.diario).toEqual([textoDiario(0, 0), textoDiario(0, 1)]);
      expect(b.diario).toEqual([textoDiario(1, 0), textoDiario(1, 1)]);

      // o cenário maior mantém as mesmas garantias em paralelo
      const c = await visao(cenario, 0);
      expect(c.diario).toEqual([textoDiario(0, 0), textoDiario(0, 1)]);
    } finally {
      await outroCenario.limpar();
    }
  });
});
