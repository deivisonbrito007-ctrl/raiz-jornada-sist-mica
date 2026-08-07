import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  chaveServico,
  clienteAdmin,
  clienteAnonimo,
  criarUsuario,
  removerUsuario,
  rlsConfigurado,
  tornarTerapeuta,
  type UsuarioTeste,
} from "@/test/rls-ambiente";

/**
 * Testes de RLS com consultas reais ao banco.
 * Cenário: dois clientes (Ana e Bruno) com dados próprios, um conteúdo
 * liberado só para Ana, mais um terapeuta com permissão ampla.
 */
describe.skipIf(!rlsConfigurado)("RLS real: vazamento entre clientes", () => {
  let admin: SupabaseClient;
  let ana: UsuarioTeste;
  let bruno: UsuarioTeste;
  let terapeuta: UsuarioTeste;
  let eixoId: string;
  let conteudoLiberadoId: string;
  let conteudoBloqueadoId: string;
  let diarioAnaId: string;

  beforeAll(async () => {
    admin = clienteAdmin();
    [ana, bruno, terapeuta] = await Promise.all([
      criarUsuario(admin, "ana"),
      criarUsuario(admin, "bruno"),
      criarUsuario(admin, "terapeuta"),
    ]);
    await tornarTerapeuta(admin, terapeuta.id);

    const eixo = await admin
      .from("eixos")
      .insert({ nome: `Eixo RLS ${Date.now()}`, descricao: "teste", ordem: 999 })
      .select("id")
      .single();
    if (eixo.error) throw new Error(eixo.error.message);
    eixoId = eixo.data.id as string;

    const conteudos = await admin
      .from("conteudos")
      .insert([
        { eixo_id: eixoId, titulo: "Prática liberada", tipo: "texto", corpo_texto: "a", ordem: 1 },
        { eixo_id: eixoId, titulo: "Prática bloqueada", tipo: "texto", corpo_texto: "b", ordem: 2 },
      ])
      .select("id, titulo");
    if (conteudos.error) throw new Error(conteudos.error.message);
    conteudoLiberadoId = conteudos.data.find((c) => c.titulo === "Prática liberada")!.id as string;
    conteudoBloqueadoId = conteudos.data.find((c) => c.titulo === "Prática bloqueada")!.id as string;

    // Somente Ana recebe liberação do primeiro conteúdo.
    const lib = await admin
      .from("liberacoes")
      .insert({ cliente_id: ana.id, conteudo_id: conteudoLiberadoId, status: "liberado" });
    if (lib.error) throw new Error(lib.error.message);

    const diarios = await admin
      .from("diario")
      .insert([
        { cliente_id: ana.id, texto: "segredo da Ana" },
        { cliente_id: bruno.id, texto: "segredo do Bruno" },
      ])
      .select("id, cliente_id");
    if (diarios.error) throw new Error(diarios.error.message);
    diarioAnaId = diarios.data.find((d) => d.cliente_id === ana.id)!.id as string;

    const prog = await admin.from("progresso").insert([
      { cliente_id: ana.id, conteudo_id: conteudoLiberadoId, status: "em_andamento", posicao_segundos: 42 },
      { cliente_id: bruno.id, conteudo_id: conteudoLiberadoId, status: "em_andamento", posicao_segundos: 7 },
    ]);
    if (prog.error) throw new Error(prog.error.message);
  });

  afterAll(async () => {
    if (!rlsConfigurado) return;
    await admin.from("progresso").delete().eq("conteudo_id", conteudoLiberadoId);
    await admin.from("liberacoes").delete().eq("eixo_id", eixoId);
    await admin.from("liberacoes").delete().in("conteudo_id", [conteudoLiberadoId, conteudoBloqueadoId]);
    await admin.from("conteudos").delete().eq("eixo_id", eixoId);
    await admin.from("eixos").delete().eq("id", eixoId);
    for (const u of [ana, bruno, terapeuta]) {
      if (u?.id) await removerUsuario(admin, u.id);
    }
  });

  it("diário: cada cliente lê apenas as próprias linhas", async () => {
    const [daAna, doBruno] = await Promise.all([
      ana.db.from("diario").select("cliente_id, texto"),
      bruno.db.from("diario").select("cliente_id, texto"),
    ]);

    expect(daAna.error).toBeNull();
    expect(doBruno.error).toBeNull();
    expect(daAna.data!.every((d) => d.cliente_id === ana.id)).toBe(true);
    expect(JSON.stringify(daAna.data)).not.toContain("segredo do Bruno");
    expect(doBruno.data!.every((d) => d.cliente_id === bruno.id)).toBe(true);
    expect(JSON.stringify(doBruno.data)).not.toContain("segredo da Ana");
  });

  it("diário: filtrar explicitamente pelo id do outro cliente devolve zero linhas", async () => {
    const { data, error } = await bruno.db.from("diario").select("id").eq("cliente_id", ana.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("diário: escrever no nome de outro cliente é recusado pela política", async () => {
    const insercao = await bruno.db.from("diario").insert({ cliente_id: ana.id, texto: "invasão" });
    expect(insercao.error).not.toBeNull();
    expect(insercao.error!.message.toLowerCase()).toContain("row-level security");

    const atualizacao = await bruno.db
      .from("diario")
      .update({ texto: "alterado" })
      .eq("id", diarioAnaId)
      .select("id");
    expect(atualizacao.error).toBeNull();
    expect(atualizacao.data).toEqual([]);

    const exclusao = await bruno.db.from("diario").delete().eq("id", diarioAnaId).select("id");
    expect(exclusao.error).toBeNull();
    expect(exclusao.data).toEqual([]);

    const conferencia = await admin.from("diario").select("texto").eq("id", diarioAnaId).single();
    expect(conferencia.data!.texto).toBe("segredo da Ana");
  });

  it("conteúdos: só aparecem para quem tem liberação vigente", async () => {
    const [visaoAna, visaoBruno] = await Promise.all([
      ana.db.from("conteudos").select("id").eq("eixo_id", eixoId),
      bruno.db.from("conteudos").select("id").eq("eixo_id", eixoId),
    ]);

    expect(visaoAna.data!.map((c) => c.id)).toEqual([conteudoLiberadoId]);
    expect(visaoBruno.data).toEqual([]);

    const bloqueado = await ana.db.from("conteudos").select("id").eq("id", conteudoBloqueadoId);
    expect(bloqueado.data).toEqual([]);
  });

  it("conteúdos: liberação futura ou revogada não abre acesso", async () => {
    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    await admin
      .from("liberacoes")
      .update({ liberar_em: futuro })
      .eq("cliente_id", ana.id)
      .eq("conteudo_id", conteudoLiberadoId);
    const agendado = await ana.db.from("conteudos").select("id").eq("id", conteudoLiberadoId);
    expect(agendado.data).toEqual([]);

    await admin
      .from("liberacoes")
      .update({ status: "bloqueado", liberar_em: null })
      .eq("cliente_id", ana.id)
      .eq("conteudo_id", conteudoLiberadoId);
    const revogado = await ana.db.from("conteudos").select("id").eq("id", conteudoLiberadoId);
    expect(revogado.data).toEqual([]);

    await admin
      .from("liberacoes")
      .update({ status: "liberado" })
      .eq("cliente_id", ana.id)
      .eq("conteudo_id", conteudoLiberadoId);
    const restaurado = await ana.db.from("conteudos").select("id").eq("id", conteudoLiberadoId);
    expect(restaurado.data!.map((c) => c.id)).toEqual([conteudoLiberadoId]);
  });

  it("progresso e liberações: leitura e escrita ficam presas ao próprio cliente", async () => {
    const leitura = await bruno.db.from("progresso").select("cliente_id, posicao_segundos");
    expect(leitura.error).toBeNull();
    expect(leitura.data!.every((p) => p.cliente_id === bruno.id)).toBe(true);

    const forjado = await bruno.db
      .from("progresso")
      .insert({ cliente_id: ana.id, conteudo_id: conteudoLiberadoId, status: "concluido" });
    expect(forjado.error).not.toBeNull();

    const sequestro = await bruno.db
      .from("progresso")
      .update({ posicao_segundos: 999 })
      .eq("cliente_id", ana.id)
      .select("id");
    expect(sequestro.data).toEqual([]);

    const posicaoAna = await admin
      .from("progresso")
      .select("posicao_segundos")
      .eq("cliente_id", ana.id)
      .eq("conteudo_id", conteudoLiberadoId)
      .single();
    expect(posicaoAna.data!.posicao_segundos).toBe(42);

    const liberacaoForjada = await bruno.db
      .from("liberacoes")
      .insert({ cliente_id: bruno.id, conteudo_id: conteudoBloqueadoId, status: "liberado" });
    expect(liberacaoForjada.error).not.toBeNull();
    expect(liberacaoForjada.error!.message.toLowerCase()).toContain("row-level security");
  });

  it("perfis: cliente vê só o próprio; terapeuta vê a base de clientes", async () => {
    const meu = await bruno.db.from("profiles").select("id, email");
    expect(meu.error).toBeNull();
    expect(meu.data!.map((p) => p.id)).toEqual([bruno.id]);

    const outro = await bruno.db.from("profiles").select("id").eq("id", ana.id);
    expect(outro.data).toEqual([]);

    const visaoTerapeuta = await terapeuta.db.from("profiles").select("id").in("id", [ana.id, bruno.id]);
    expect(visaoTerapeuta.error).toBeNull();
    expect(visaoTerapeuta.data!.map((p) => p.id).sort()).toEqual([ana.id, bruno.id].sort());
  });

  it("papéis: cliente não enxerga papéis alheios e não consegue se promover", async () => {
    const papeis = await bruno.db.from("user_roles").select("user_id, role");
    expect(papeis.error).toBeNull();
    expect(papeis.data!.every((p) => p.user_id === bruno.id)).toBe(true);

    const promocao = await bruno.db.from("user_roles").insert({ user_id: bruno.id, role: "terapeuta" });
    expect(promocao.error).not.toBeNull();

    const equipe = await bruno.db.from("equipe_admins").insert({ user_id: bruno.id });
    expect(equipe.error).not.toBeNull();

    const permissao = await bruno.db
      .from("equipe_permissoes")
      .insert({ user_id: bruno.id, permissao: "gerenciar_equipe" });
    expect(permissao.error).not.toBeNull();
  });

  it("tabelas administrativas: cliente não lê auditoria nem limites de uso", async () => {
    const auditoria = await bruno.db.from("auditoria_acessos_negados").select("id");
    expect(auditoria.data ?? []).toEqual([]);

    const equipeAuditoria = await bruno.db.from("auditoria_equipe").select("id");
    expect(equipeAuditoria.data ?? []).toEqual([]);

    const limites = await bruno.db.from("limites_uso").select("id");
    expect(limites.data ?? []).toEqual([]);

    const convites = await bruno.db.from("convites_equipe").select("id, token");
    expect(convites.data ?? []).toEqual([]);
  });

  it("anônimo: nenhuma tabela do app responde com linhas", async () => {
    const anon = clienteAnonimo();
    for (const tabela of ["diario", "progresso", "conteudos", "eixos", "profiles", "liberacoes"] as const) {
      const { data } = await anon.from(tabela).select("*").limit(5);
      expect(data ?? [], `tabela ${tabela} exposta ao anônimo`).toEqual([]);
    }
  });

  it("funções de segurança: cliente não consegue elevar privilégio via RPC", async () => {
    const podeGerenciar = await bruno.db.rpc("pode", { _permissao: "gerenciar_equipe" });
    expect(podeGerenciar.error === null ? podeGerenciar.data : false).toBe(false);

    const eTerapeuta = await bruno.db.rpc("is_terapeuta");
    expect(eTerapeuta.error === null ? eTerapeuta.data : false).toBe(false);

    const liberado = await bruno.db.rpc("conteudo_liberado", {
      _cliente_id: ana.id,
      _conteudo_id: conteudoBloqueadoId,
      _eixo_id: eixoId,
    });
    expect(liberado.error === null ? liberado.data : false).toBe(false);
  });

  it("terapeuta: consulta agregada cruza clientes sem depender de service role", async () => {
    expect(chaveServico).not.toBe("");
    const progresso = await terapeuta.db
      .from("progresso")
      .select("cliente_id")
      .in("cliente_id", [ana.id, bruno.id]);
    expect(progresso.error).toBeNull();
    expect(new Set(progresso.data!.map((p) => p.cliente_id))).toEqual(new Set([ana.id, bruno.id]));
  });
});
