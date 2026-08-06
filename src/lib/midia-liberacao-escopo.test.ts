import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { garantirConteudoLiberado } from "./liberacao-guard";
import { classificarNegacao } from "./auditoria-acesso";

/**
 * Biblioteca e player só podem carregar vídeo/áudio liberado, e requisições
 * diretas ao Storage sem permissão devem falhar.
 *
 * Cliente falso com as mesmas regras do banco:
 * - `conteudos`: RLS "cliente ve conteudos liberados" (usa conteudo_liberado)
 * - `liberacoes`: leitura só do próprio cliente
 * - bucket `midias` é privado: só URL assinada válida devolve o arquivo
 */

const CLIENTE_A = "11111111-1111-4111-8111-111111111111";
const CLIENTE_B = "22222222-2222-4222-8222-222222222222";

const EIXO_LIVRE = "e1111111-1111-4111-8111-111111111111";
const EIXO_FUTURO = "e2222222-2222-4222-8222-222222222222";
const EIXO_FECHADO = "e3333333-3333-4333-8333-333333333333";

const VIDEO_LIB = "c1111111-1111-4111-8111-111111111111";
const AUDIO_LIB = "c2222222-2222-4222-8222-222222222222";
const VIDEO_FUTURO = "c3333333-3333-4333-8333-333333333333";
const AUDIO_FECHADO = "c4444444-4444-4444-8444-444444444444";
const VIDEO_DO_B = "c5555555-5555-4555-8555-555555555555";

const AMANHA = new Date(Date.now() + 86_400_000).toISOString();

const CONTEUDOS = [
  { id: VIDEO_LIB, eixo_id: EIXO_LIVRE, tipo: "video", storage_path: "a/video-lib.mp4" },
  { id: AUDIO_LIB, eixo_id: EIXO_LIVRE, tipo: "audio", storage_path: "a/audio-lib.mp3" },
  { id: VIDEO_FUTURO, eixo_id: EIXO_FUTURO, tipo: "video", storage_path: "a/video-futuro.mp4" },
  { id: AUDIO_FECHADO, eixo_id: EIXO_FECHADO, tipo: "audio", storage_path: "a/audio-fechado.mp3" },
  { id: VIDEO_DO_B, eixo_id: EIXO_FECHADO, tipo: "video", storage_path: "b/video-b.mp4" },
];

const LIBERACOES = [
  { cliente_id: CLIENTE_A, eixo_id: EIXO_LIVRE, conteudo_id: null, status: "liberado", liberar_em: null },
  { cliente_id: CLIENTE_A, eixo_id: EIXO_FUTURO, conteudo_id: null, status: "liberado", liberar_em: AMANHA },
  { cliente_id: CLIENTE_A, eixo_id: EIXO_FECHADO, conteudo_id: null, status: "bloqueado", liberar_em: null },
  { cliente_id: CLIENTE_B, eixo_id: EIXO_FECHADO, conteudo_id: VIDEO_DO_B, status: "liberado", liberar_em: null },
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

const ERRO_STORAGE = { message: "Object not found" };
let assinadas: { path: string; expiraEm: number }[] = [];

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakeSupabase(userId: string): any {
  const visiveis = () =>
    CONTEUDOS.filter((c) => conteudoLiberado(userId, c.id, c.eixo_id));
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
          then: undefined,
        };
        return api;
      }
      if (tabela === "liberacoes") {
        return {
          select: () => ({
            eq: async (_c: string, valor: string) => ({
              // RLS: apenas as próprias liberações
              data: LIBERACOES.filter((l) => l.cliente_id === valor && valor === userId),
              error: null,
            }),
          }),
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

/** Bucket privado `midias`: acesso direto negado; URL assinada válida funciona. */
const storage = {
  async download(_bucket: string, _path: string) {
    return { data: null, error: { message: "new row violates row-level security policy" } };
  },
  async fetchPublicUrl(path: string) {
    return { status: 400, error: ERRO_STORAGE, path };
  },
  async createSignedUrl(path: string, segundos: number) {
    if (!CONTEUDOS.some((c) => c.storage_path === path)) {
      return { data: null, error: ERRO_STORAGE };
    }
    assinadas.push({ path, expiraEm: Date.now() + segundos * 1000 });
    return { data: { signedUrl: `https://midias.local/${path}?token=t&exp=${segundos}` }, error: null };
  },
  async fetchSigned(url: string) {
    const path = url.split("https://midias.local/")[1]?.split("?")[0] ?? "";
    const reg = assinadas.find((a) => a.path === path);
    if (!reg) return { status: 401, error: { message: "Unauthorized" } };
    if (reg.expiraEm <= Date.now()) return { status: 400, error: { message: "signed url expired" } };
    return { status: 200, error: null };
  },
};

/** Réplica de getMinhaBiblioteca (apenas mídia liberada). */
async function carregarBiblioteca(userId: string) {
  const supabase = fakeSupabase(userId);
  const { data } = await supabase.from("conteudos").select("*").order("ordem");
  return (data ?? []).filter((c: any) => c.tipo === "video" || c.tipo === "audio");
}

/** Réplica de getConteudo: só assina URL de conteúdo liberado. */
async function carregarPlayer(userId: string, conteudoId: string) {
  const supabase = fakeSupabase(userId);
  await garantirConteudoLiberado(supabase, userId, conteudoId, "getConteudo");
  const conteudo = CONTEUDOS.find((c) => c.id === conteudoId)!;
  const assinada = await storage.createSignedUrl(conteudo.storage_path, 3600);
  return { conteudo, url: assinada.data?.signedUrl ?? null };
}

describe("biblioteca e player: só mídia liberada", () => {
  beforeEach(() => {
    assinadas = [];
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("biblioteca do cliente lista apenas vídeo/áudio liberados agora", async () => {
    const itens = await carregarBiblioteca(CLIENTE_A);
    expect(itens.map((c: any) => c.id)).toEqual([VIDEO_LIB, AUDIO_LIB]);
  });

  it("biblioteca não vaza mídia de eixo agendado nem bloqueado", async () => {
    const ids = (await carregarBiblioteca(CLIENTE_A)).map((c: any) => c.id);
    expect(ids).not.toContain(VIDEO_FUTURO);
    expect(ids).not.toContain(AUDIO_FECHADO);
    expect(ids).not.toContain(VIDEO_DO_B);
  });

  it("cada cliente vê somente a própria mídia liberada", async () => {
    const idsB = (await carregarBiblioteca(CLIENTE_B)).map((c: any) => c.id);
    expect(idsB).toEqual([VIDEO_DO_B]);
  });

  it("player assina URL para vídeo e áudio liberados", async () => {
    const video = await carregarPlayer(CLIENTE_A, VIDEO_LIB);
    const audio = await carregarPlayer(CLIENTE_A, AUDIO_LIB);
    expect(video.url).toContain("video-lib.mp4");
    expect(audio.url).toContain("audio-lib.mp3");
    expect(assinadas).toHaveLength(2);
  });

  it("player recusa conteúdo agendado, bloqueado ou de outro cliente e não assina URL", async () => {
    for (const id of [VIDEO_FUTURO, AUDIO_FECHADO, VIDEO_DO_B]) {
      await expect(carregarPlayer(CLIENTE_A, id)).rejects.toThrow("Acesso restrito");
    }
    expect(assinadas).toEqual([]);
  });

  it("download direto no bucket privado é negado pelo RLS do Storage", async () => {
    const r = await storage.download("midias", "a/video-lib.mp4");
    expect(r.data).toBeNull();
    expect(classificarNegacao(r.error)).toBe("rls");
  });

  it("URL pública do bucket privado responde erro", async () => {
    const r = await storage.fetchPublicUrl("a/video-lib.mp4");
    expect(r.status).toBe(400);
    expect(classificarNegacao(r.error)).toBe("storage");
  });

  it("URL assinada inventada/não emitida falha com 401", async () => {
    const r = await storage.fetchSigned("https://midias.local/a/audio-fechado.mp3?token=falso");
    expect(r.status).toBe(401);
  });

  it("URL assinada expirada falha com 400", async () => {
    await storage.createSignedUrl("a/video-lib.mp4", -1);
    const r = await storage.fetchSigned("https://midias.local/a/video-lib.mp4?token=t");
    expect(r.status).toBe(400);
    expect(classificarNegacao(r.error)).toBe("storage");
  });

  it("caminho inexistente não gera URL assinada", async () => {
    const r = await storage.createSignedUrl("a/nao-existe.mp4", 3600);
    expect(r.data).toBeNull();
    expect(classificarNegacao(r.error)).toBe("storage");
  });
});
