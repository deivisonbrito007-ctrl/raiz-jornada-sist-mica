import { describe, expect, it, beforeEach } from "vitest";

/**
 * Liberação manual de conteúdos pelo terapeuta via serviços/RPC.
 *
 * Cliente PostgREST falso com as mesmas regras do banco:
 * - rpc("has_role") responde pelo papel real do chamador
 * - liberacoes/notificacoes: leitura e escrita apenas do próprio cliente,
 *   ou de qualquer cliente quando o chamador é terapeuta
 * O serviço abaixo reproduz adminDefinirLiberacao.
 */

const CLIENTE_A = "11111111-1111-4111-8111-111111111111";
const CLIENTE_B = "22222222-2222-4222-8222-222222222222";
const TERAPEUTA = "33333333-3333-4333-8333-333333333333";

const PAPEIS: Record<string, "cliente" | "terapeuta"> = {
  [CLIENTE_A]: "cliente",
  [CLIENTE_B]: "cliente",
  [TERAPEUTA]: "terapeuta",
};

const CONTEUDO_1 = "c1111111-1111-4111-8111-111111111111";
const CONTEUDO_2 = "c2222222-2222-4222-8222-222222222222";
const EIXO_PAI = "e1111111-1111-4111-8111-111111111111";

type Linha = Record<string, unknown>;

let liberacoes: Linha[] = [];
let notificacoes: Linha[] = [];

const RLS_ERRO = { message: "new row violates row-level security policy for table" };

function tabela(nome: string): Linha[] {
  return nome === "liberacoes" ? liberacoes : notificacoes;
}

function fakeSupabase(userId: string) {
  const ehTerapeuta = PAPEIS[userId] === "terapeuta";
  return {
    async rpc(fn: string, args: { _user_id: string; _role: string }) {
      if (fn !== "has_role") throw new Error(`rpc desconhecida: ${fn}`);
      // has_role é SECURITY DEFINER: responde pelo papel real do usuário pedido
      return { data: PAPEIS[args._user_id] === args._role, error: null };
    },
    from(nome: string) {
      // RLS aplicada antes de qualquer filtro do app
      const visiveis = () =>
        ehTerapeuta ? tabela(nome) : tabela(nome).filter((l) => l["cliente_id"] === userId);
      let filtros: ((l: Linha) => boolean)[] = [];
      const aplicar = () => visiveis().filter((l) => filtros.every((f) => f(l)));

      const api = {
        select: () => api,
        eq(coluna: string, valor: unknown) {
          filtros.push((l) => l[coluna] === valor);
          return api;
        },
        is(coluna: string, valor: null) {
          filtros.push((l) => (l[coluna] ?? null) === valor);
          return api;
        },
        maybeSingle: async () => ({ data: aplicar()[0] ?? null, error: null }),
        async insert(valores: Linha) {
          if (!ehTerapeuta && valores["cliente_id"] !== userId) {
            return { data: null, error: RLS_ERRO };
          }
          tabela(nome).push({ id: `${nome}-${tabela(nome).length + 1}`, ...valores });
          return { data: [valores], error: null };
        },
        async update(valores: Linha) {
          const alvos = aplicar();
          if (!alvos.length) return { data: null, error: null, count: 0 };
          for (const l of alvos) Object.assign(l, valores);
          return { data: alvos, error: null, count: alvos.length };
        },
        async delete() {
          const alvos = aplicar();
          const ids = new Set(alvos.map((l) => l["id"]));
          if (nome === "liberacoes") liberacoes = liberacoes.filter((l) => !ids.has(l["id"]));
          else notificacoes = notificacoes.filter((l) => !ids.has(l["id"]));
          return { data: alvos, error: null, count: alvos.length };
        },
      };
      // update/delete precisam dos filtros encadeados antes de executar
      const encadeavel = {
        ...api,
        update: (valores: Linha) => ({ eq: (c: string, v: unknown) => (api.eq(c, v), api.update(valores)) }),
        delete: () => ({ eq: (c: string, v: unknown) => (api.eq(c, v), api.delete()) }),
      };
      filtros = [];
      return encadeavel;
    },
  };
}

type Entrada = {
  clienteId: string;
  conteudoId?: string | null;
  eixoId?: string | null;
  liberar: boolean;
  liberarEm?: string | null;
  titulo?: string;
};

/** Reproduz adminDefinirLiberacao (serviço + RPC de papel). */
async function servicoDefinirLiberacao(userId: string, data: Entrada) {
  const supabase = fakeSupabase(userId);
  const { data: ehTerapeuta } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "terapeuta",
  });
  if (!ehTerapeuta) throw new Error("Acesso restrito");

  const base = supabase
    .from("liberacoes")
    .select()
    .eq("cliente_id", data.clienteId)
    .eq(data.conteudoId ? "conteudo_id" : "eixo_id", (data.conteudoId ?? data.eixoId) as string);
  const existente = await (data.conteudoId ? base : base.is("conteudo_id", null)).maybeSingle();

  if (!data.liberar) {
    if (existente.data) {
      await supabase.from("liberacoes").delete().eq("id", existente.data["id"]);
    }
    return { ok: true, removido: Boolean(existente.data) };
  }

  if (existente.data) {
    await supabase
      .from("liberacoes")
      .update({ status: "liberado", liberar_em: data.liberarEm ?? null })
      .eq("id", existente.data["id"]);
  } else {
    const { error } = await supabase.from("liberacoes").insert({
      cliente_id: data.clienteId,
      eixo_id: data.conteudoId ? null : (data.eixoId ?? null),
      conteudo_id: data.conteudoId ?? null,
      status: "liberado",
      liberar_em: data.liberarEm ?? null,
    });
    if (error) throw new Error(error.message);
  }

  if (data.liberarEm && new Date(data.liberarEm) > new Date()) {
    return { ok: true, agendado: true };
  }

  await supabase.from("notificacoes").insert({
    cliente_id: data.clienteId,
    titulo: "Novo conteúdo liberado",
    mensagem: data.titulo ?? "Há algo novo na sua biblioteca.",
  });
  return { ok: true };
}

/** Leitura de liberações como o cliente autenticado (getMinhaBiblioteca). */
async function servicoMinhasLiberacoes(userId: string, clienteId = userId) {
  const supabase = fakeSupabase(userId);
  const r = await supabase.from("liberacoes").select().eq("cliente_id", clienteId).maybeSingle();
  return r.data;
}

function doCliente(lista: Linha[], clienteId: string) {
  return lista.filter((l) => l["cliente_id"] === clienteId);
}

describe("liberação manual pelo terapeuta: escopo em serviços/RPC", () => {
  beforeEach(() => {
    liberacoes = [
      {
        id: "lib-b",
        cliente_id: CLIENTE_B,
        conteudo_id: CONTEUDO_2,
        eixo_id: null,
        status: "liberado",
        liberar_em: null,
      },
    ];
    notificacoes = [];
  });

  it("libera conteúdo apenas para o cliente selecionado", async () => {
    await servicoDefinirLiberacao(TERAPEUTA, {
      clienteId: CLIENTE_A,
      conteudoId: CONTEUDO_1,
      liberar: true,
      titulo: "Carta ao pai",
    });

    expect(doCliente(liberacoes, CLIENTE_A)).toHaveLength(1);
    expect(doCliente(liberacoes, CLIENTE_B)).toHaveLength(1);
    expect(doCliente(liberacoes, CLIENTE_B)[0]).toMatchObject({ conteudo_id: CONTEUDO_2 });
    expect(doCliente(notificacoes, CLIENTE_A)).toHaveLength(1);
    expect(doCliente(notificacoes, CLIENTE_B)).toHaveLength(0);
  });

  it("revogar remove somente a liberação do cliente selecionado", async () => {
    await servicoDefinirLiberacao(TERAPEUTA, {
      clienteId: CLIENTE_A,
      conteudoId: CONTEUDO_1,
      liberar: true,
    });
    const r = await servicoDefinirLiberacao(TERAPEUTA, {
      clienteId: CLIENTE_A,
      conteudoId: CONTEUDO_1,
      liberar: false,
    });

    expect(r).toMatchObject({ removido: true });
    expect(doCliente(liberacoes, CLIENTE_A)).toHaveLength(0);
    expect(doCliente(liberacoes, CLIENTE_B)).toHaveLength(1);
  });

  it("revogar para um cliente não afeta a mesma liberação de outro cliente", async () => {
    liberacoes.push({
      id: "lib-a",
      cliente_id: CLIENTE_A,
      conteudo_id: CONTEUDO_2,
      eixo_id: null,
      status: "liberado",
      liberar_em: null,
    });

    await servicoDefinirLiberacao(TERAPEUTA, {
      clienteId: CLIENTE_A,
      conteudoId: CONTEUDO_2,
      liberar: false,
    });

    expect(liberacoes.map((l) => l["id"])).toEqual(["lib-b"]);
  });

  it("atualização de agendamento atinge só a linha do cliente selecionado", async () => {
    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    await servicoDefinirLiberacao(TERAPEUTA, {
      clienteId: CLIENTE_B,
      conteudoId: CONTEUDO_2,
      liberar: true,
      liberarEm: futuro,
    });

    expect(doCliente(liberacoes, CLIENTE_B)[0]).toMatchObject({ liberar_em: futuro });
    // agendado para o futuro não notifica ninguém
    expect(notificacoes).toHaveLength(0);
    expect(doCliente(liberacoes, CLIENTE_A)).toHaveLength(0);
  });

  it("cliente não consegue liberar conteúdo (nem para si, nem para outro)", async () => {
    await expect(
      servicoDefinirLiberacao(CLIENTE_A, { clienteId: CLIENTE_A, conteudoId: CONTEUDO_1, liberar: true }),
    ).rejects.toThrow("Acesso restrito");
    await expect(
      servicoDefinirLiberacao(CLIENTE_A, { clienteId: CLIENTE_B, conteudoId: CONTEUDO_2, liberar: true }),
    ).rejects.toThrow("Acesso restrito");
    expect(liberacoes).toHaveLength(1);
    expect(notificacoes).toHaveLength(0);
  });

  it("gravação direta em liberacoes/notificacoes de outro cliente é rejeitada pela RLS", async () => {
    const supabase = fakeSupabase(CLIENTE_A);
    const lib = await supabase
      .from("liberacoes")
      .insert({ cliente_id: CLIENTE_B, conteudo_id: CONTEUDO_1, status: "liberado" });
    expect(lib.error?.message).toMatch(/row-level security/);

    const notif = await supabase
      .from("notificacoes")
      .insert({ cliente_id: CLIENTE_B, titulo: "falsa" });
    expect(notif.error?.message).toMatch(/row-level security/);
    expect(doCliente(liberacoes, CLIENTE_B)).toHaveLength(1);
  });

  it("leitura de liberações fora do próprio cliente volta vazia", async () => {
    await servicoDefinirLiberacao(TERAPEUTA, {
      clienteId: CLIENTE_A,
      eixoId: EIXO_PAI,
      liberar: true,
    });

    expect(await servicoMinhasLiberacoes(CLIENTE_A)).toMatchObject({ eixo_id: EIXO_PAI });
    expect(await servicoMinhasLiberacoes(CLIENTE_A, CLIENTE_B)).toBeNull();
    expect(await servicoMinhasLiberacoes(CLIENTE_B, CLIENTE_A)).toBeNull();
    // terapeuta lê o cliente selecionado, um por vez
    expect(await servicoMinhasLiberacoes(TERAPEUTA, CLIENTE_B)).toMatchObject({
      cliente_id: CLIENTE_B,
    });
  });

  it("liberação por eixo não é confundida com liberação por conteúdo", async () => {
    await servicoDefinirLiberacao(TERAPEUTA, {
      clienteId: CLIENTE_A,
      eixoId: EIXO_PAI,
      liberar: true,
    });
    await servicoDefinirLiberacao(TERAPEUTA, {
      clienteId: CLIENTE_A,
      conteudoId: CONTEUDO_1,
      liberar: true,
    });

    const doA = doCliente(liberacoes, CLIENTE_A);
    expect(doA).toHaveLength(2);
    expect(doA.filter((l) => l["conteudo_id"] === null)).toHaveLength(1);
    expect(doCliente(liberacoes, CLIENTE_B)).toHaveLength(1);
  });
});
