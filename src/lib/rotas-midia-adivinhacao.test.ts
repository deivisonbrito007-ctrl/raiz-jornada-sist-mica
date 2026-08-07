import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { garantirConteudoLiberado } from "./liberacao-guard";

/**
 * Requisições diretas às rotas da biblioteca e do player (sem passar pela UI)
 * não podem permitir adivinhar IDs de mídia de outros clientes:
 *
 * - IDs inexistentes, IDs de outro cliente e IDs bloqueados/agendados devem
 *   falhar de forma indistinguível (mesmo status e mesma mensagem);
 * - a resposta nunca traz título, caminho de storage, URL assinada, eixo ou
 *   qualquer detalhe do conteúdo;
 * - o player não persiste nada e responde 403 genérico.
 */

const CLIENTE_A = "11111111-1111-4111-8111-111111111111";
const CLIENTE_B = "22222222-2222-4222-8222-222222222222";

const EIXO_LIVRE = "e1111111-1111-4111-8111-111111111111";
const EIXO_FUTURO = "e2222222-2222-4222-8222-222222222222";
const EIXO_DO_B = "e3333333-3333-4333-8333-333333333333";

const VIDEO_A = "c1111111-1111-4111-8111-111111111111";
const VIDEO_FUTURO = "c2222222-2222-4222-8222-222222222222";
const AUDIO_DO_B = "c3333333-3333-4333-8333-333333333333";
const INEXISTENTE = "c9999999-9999-4999-8999-999999999999";

const AMANHA = new Date(Date.now() + 86_400_000).toISOString();

const CONTEUDOS = [
  {
    id: VIDEO_A,
    eixo_id: EIXO_LIVRE,
    tipo: "video",
    titulo: "Raízes — vídeo do cliente A",
    descricao: "somente A",
    corpo_texto: null,
    storage_path: "a/video-a.mp4",
    duracao_segundos: 600,
  },
  {
    id: VIDEO_FUTURO,
    eixo_id: EIXO_FUTURO,
    tipo: "video",
    titulo: "Agendado para amanhã",
    descricao: "ainda não",
    corpo_texto: null,
    storage_path: "a/video-futuro.mp4",
    duracao_segundos: 300,
  },
  {
    id: AUDIO_DO_B,
    eixo_id: EIXO_DO_B,
    tipo: "audio",
    titulo: "Áudio privado do cliente B",
    descricao: "segredo de B",
    corpo_texto: null,
    storage_path: "b/audio-b.mp3",
    duracao_segundos: 420,
  },
];

const LIBERACOES = [
  { cliente_id: CLIENTE_A, eixo_id: EIXO_LIVRE, conteudo_id: null, status: "liberado", liberar_em: null },
  { cliente_id: CLIENTE_A, eixo_id: EIXO_FUTURO, conteudo_id: null, status: "liberado", liberar_em: AMANHA },
  { cliente_id: CLIENTE_B, eixo_id: EIXO_DO_B, conteudo_id: AUDIO_DO_B, status: "liberado", liberar_em: null },
];

/** Réplica de public.conteudo_liberado(cliente, conteudo, eixo). */
function conteudoLiberado(clienteId: string, conteudoId: string, eixoId: string) {
  const agora = Date.now();
  return LIBERACOES.some(
    (l) =>
      l.cliente_id === clienteId &&
      l.status === "liberado" &&
      (!l.liberar_em || new Date(l.liberar_em).getTime() <= agora) &&
      (l.conteudo_id === conteudoId || (l.conteudo_id === null && l.eixo_id === eixoId)),
  );
}

const upserts: { cliente_id: string; conteudo_id: string }[] = [];
const assinadas: string[] = [];

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakeSupabase(userId: string): any {
  const visiveis = () => CONTEUDOS.filter((c) => conteudoLiberado(userId, c.id, c.eixo_id));
  return {
    from(tabela: string) {
      if (tabela === "conteudos") {
        const api: any = {
          select: () => api,
          order: async () => ({ data: visiveis(), error: null }),
          eq: (_c: string, valor: string) => ({
            maybeSingle: async () => ({
              data: visiveis().find((c) => c.id === valor) ?? null,
              error: null,
            }),
          }),
        };
        return api;
      }
      if (tabela === "progresso") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          upsert: async (linha: any) => {
            upserts.push(linha);
            return { error: null };
          },
        };
      }
      throw new Error(`tabela inesperada: ${tabela}`);
    },
    async rpc(_fn: string, args: { _cliente_id: string; _conteudo_id: string; _eixo_id: string }) {
      return {
        data: conteudoLiberado(args._cliente_id, args._conteudo_id, args._eixo_id),
        error: null,
      };
    },
  };
}

/** Storage privado: só assinamos o que passou pela checagem de escopo. */
const storage = {
  async createSignedUrl(path: string) {
    assinadas.push(path);
    return { data: { signedUrl: `https://midias.local/${path}?token=t` }, error: null };
  },
};

type Resposta =
  | { status: 200; body: Record<string, unknown> }
  | { status: 403 | 404; body: { error: string } };

/**
 * Simula GET /biblioteca/conteudo?conteudoId=… (rota do player/biblioteca),
 * espelhando `getConteudo`: sem liberação, nada de conteúdo nem URL.
 */
async function rotaConteudo(userId: string, conteudoId: string): Promise<Resposta> {
  const supabase = fakeSupabase(userId);
  const { data: conteudo } = await supabase
    .from("conteudos")
    .select("id, eixo_id, tipo, titulo, storage_path")
    .eq("id", conteudoId)
    .maybeSingle();

  if (!conteudo) return { status: 404, body: { error: "Conteúdo não encontrado" } };

  const { data: liberado } = await supabase.rpc("conteudo_liberado", {
    _cliente_id: userId,
    _conteudo_id: conteudo.id,
    _eixo_id: conteudo.eixo_id,
  });
  if (!liberado) return { status: 404, body: { error: "Conteúdo não encontrado" } };

  const assinada = await storage.createSignedUrl(conteudo.storage_path);
  return { status: 200, body: { conteudo, url: assinada.data?.signedUrl ?? null } };
}

/** Simula GET /biblioteca/eixo?eixoId=… (listagem da trilha). */
async function rotaEixo(userId: string, eixoId: string) {
  const supabase = fakeSupabase(userId);
  const { data } = await supabase.from("conteudos").select("id, titulo").order("ordem");
  return (data ?? []).filter((c: any) => c.eixo_id === eixoId);
}

/** Simula POST /player/progresso (persistência de eventos do player). */
async function rotaProgresso(userId: string, conteudoId: string): Promise<Resposta> {
  const supabase = fakeSupabase(userId);
  try {
    await garantirConteudoLiberado(supabase, userId, conteudoId, "marcarProgresso");
  } catch (e) {
    return { status: 403, body: { error: (e as Error).message } };
  }
  await supabase
    .from("progresso")
    .upsert({ cliente_id: userId, conteudo_id: conteudoId, status: "em_andamento" });
  return { status: 200, body: { ok: true } };
}

const SEGREDOS = [
  "Áudio privado do cliente B",
  "segredo de B",
  "b/audio-b.mp3",
  "Agendado para amanhã",
  "a/video-futuro.mp4",
];

function vazaSegredo(resposta: Resposta) {
  const texto = JSON.stringify(resposta);
  return SEGREDOS.some((s) => texto.includes(s));
}

describe("rotas de biblioteca/player: adivinhação de IDs de mídia", () => {
  beforeEach(() => {
    upserts.length = 0;
    assinadas.length = 0;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("entrega o conteúdo liberado do próprio cliente", async () => {
    const r = await rotaConteudo(CLIENTE_A, VIDEO_A);
    expect(r.status).toBe(200);
    expect(assinadas).toEqual(["a/video-a.mp4"]);
  });

  it("responde 404 idêntico para ID de outro cliente, agendado e inexistente", async () => {
    const respostas = await Promise.all(
      [AUDIO_DO_B, VIDEO_FUTURO, INEXISTENTE].map((id) => rotaConteudo(CLIENTE_A, id)),
    );
    for (const r of respostas) {
      expect(r.status).toBe(404);
      expect(r.body).toEqual({ error: "Conteúdo não encontrado" });
    }
    // indistinguíveis entre si: nada revela que o ID existe
    expect(new Set(respostas.map((r) => JSON.stringify(r))).size).toBe(1);
  });

  it("nunca vaza título, caminho de storage ou URL assinada em falhas", async () => {
    for (const id of [AUDIO_DO_B, VIDEO_FUTURO, INEXISTENTE]) {
      const r = await rotaConteudo(CLIENTE_A, id);
      expect(vazaSegredo(r)).toBe(false);
      expect(JSON.stringify(r)).not.toContain("midias.local");
    }
    expect(assinadas).toEqual([]);
  });

  it("não assina URL do Storage para mídia fora do escopo", async () => {
    await rotaConteudo(CLIENTE_A, AUDIO_DO_B);
    await rotaConteudo(CLIENTE_A, VIDEO_FUTURO);
    expect(assinadas).toHaveLength(0);
  });

  it("enumerar a trilha de um eixo alheio devolve lista vazia", async () => {
    await expect(rotaEixo(CLIENTE_A, EIXO_DO_B)).resolves.toEqual([]);
    await expect(rotaEixo(CLIENTE_A, EIXO_FUTURO)).resolves.toEqual([]);
    const proprios = await rotaEixo(CLIENTE_A, EIXO_LIVRE);
    expect(proprios.map((c: any) => c.id)).toEqual([VIDEO_A]);
  });

  it("player responde 403 genérico e não persiste nada para IDs adivinhados", async () => {
    for (const id of [AUDIO_DO_B, VIDEO_FUTURO, INEXISTENTE]) {
      const r = await rotaProgresso(CLIENTE_A, id);
      expect(r.status).toBe(403);
      expect(r.body).toEqual({ error: "Acesso restrito" });
      expect(vazaSegredo(r)).toBe(false);
    }
    expect(upserts).toHaveLength(0);
  });

  it("o cliente B continua com acesso ao próprio áudio (o bloqueio é de escopo, não global)", async () => {
    const r = await rotaConteudo(CLIENTE_B, AUDIO_DO_B);
    expect(r.status).toBe(200);
    const p = await rotaProgresso(CLIENTE_B, AUDIO_DO_B);
    expect(p.status).toBe(200);
    expect(upserts).toHaveLength(1);
  });

  it("varredura de muitos IDs falsos não gera nenhuma resposta diferente", async () => {
    const ids = Array.from(
      { length: 20 },
      (_, i) => `c8888888-8888-4888-8888-${String(i).padStart(12, "0")}`,
    );
    const corpos = new Set<string>();
    for (const id of ids) {
      const r = await rotaConteudo(CLIENTE_A, id);
      corpos.add(JSON.stringify(r));
    }
    expect(corpos.size).toBe(1);
    expect([...corpos][0]).toContain("Conteúdo não encontrado");
  });
});
