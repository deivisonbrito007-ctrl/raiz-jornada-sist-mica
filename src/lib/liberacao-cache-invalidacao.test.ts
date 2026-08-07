import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

/**
 * Quando o terapeuta altera liberações do mesmo cliente (libera, agenda ou
 * revoga), a biblioteca e o player precisam refletir apenas o estado atual:
 * o cache das chaves ["biblioteca"], ["trilha", eixo] e ["conteudo", id]
 * é invalidado e refetchado — nunca servindo o estado anterior.
 */

const CLIENTE = "11111111-1111-4111-8111-111111111111";
const EIXO = "e1111111-1111-4111-8111-111111111111";
const VIDEO = "c1111111-1111-4111-8111-111111111111";
const AUDIO = "c2222222-2222-4222-8222-222222222222";

const CONTEUDOS = [
  { id: VIDEO, eixo_id: EIXO, titulo: "Vídeo raiz", storage_path: "a/video.mp4" },
  { id: AUDIO, eixo_id: EIXO, titulo: "Áudio raiz", storage_path: "a/audio.mp3" },
];

type Liberacao = {
  cliente_id: string;
  conteudo_id: string;
  status: "liberado" | "bloqueado";
  liberar_em: string | null;
};

/** Estado do banco, alterado pelas ações do terapeuta. */
let liberacoes: Liberacao[] = [];
let chamadas: string[] = [];

function liberado(conteudoId: string) {
  return liberacoes.some(
    (l) =>
      l.cliente_id === CLIENTE &&
      l.conteudo_id === conteudoId &&
      l.status === "liberado" &&
      (!l.liberar_em || new Date(l.liberar_em).getTime() <= Date.now()),
  );
}

/* Ações do terapeuta (painel admin) */
function liberar(conteudoId: string, liberarEm: string | null = null) {
  liberacoes = liberacoes.filter((l) => l.conteudo_id !== conteudoId);
  liberacoes.push({ cliente_id: CLIENTE, conteudo_id: conteudoId, status: "liberado", liberar_em: liberarEm });
}
function revogar(conteudoId: string) {
  liberacoes = liberacoes.filter((l) => l.conteudo_id !== conteudoId);
  liberacoes.push({ cliente_id: CLIENTE, conteudo_id: conteudoId, status: "bloqueado", liberar_em: null });
}

/* Leituras do cliente (server functions da biblioteca/player) */
async function fetchBiblioteca() {
  chamadas.push("biblioteca");
  return CONTEUDOS.filter((c) => liberado(c.id)).map((c) => ({ id: c.id, titulo: c.titulo }));
}
async function fetchTrilha(eixoId: string) {
  chamadas.push(`trilha:${eixoId}`);
  return CONTEUDOS.filter((c) => c.eixo_id === eixoId && liberado(c.id)).map((c) => c.id);
}
async function fetchConteudo(conteudoId: string) {
  chamadas.push(`conteudo:${conteudoId}`);
  const c = CONTEUDOS.find((x) => x.id === conteudoId);
  if (!c || !liberado(conteudoId)) return { conteudo: null, url: null };
  return { conteudo: { id: c.id, titulo: c.titulo }, url: `https://midias.local/${c.storage_path}?t=1` };
}

const opBiblioteca = { queryKey: ["biblioteca"], queryFn: fetchBiblioteca };
const opTrilha = { queryKey: ["trilha", EIXO], queryFn: () => fetchTrilha(EIXO) };
const opConteudo = (id: string) => ({ queryKey: ["conteudo", id], queryFn: () => fetchConteudo(id) });

/** Efeito da mudança de liberação no cliente: invalida as três frentes. */
async function invalidarPorLiberacao(qc: QueryClient, conteudoId?: string) {
  await qc.invalidateQueries({ queryKey: ["biblioteca"] });
  await qc.invalidateQueries({ queryKey: ["trilha"] });
  if (conteudoId) await qc.invalidateQueries({ queryKey: ["conteudo", conteudoId] });
}

let qc: QueryClient;

describe("biblioteca e player após o terapeuta alterar liberações", () => {
  beforeEach(() => {
    liberacoes = [];
    chamadas = [];
    liberar(VIDEO);
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 5 * 60_000, gcTime: 5 * 60_000 } },
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    qc.clear();
    vi.restoreAllMocks();
  });

  it("carrega apenas o conteúdo liberado no primeiro acesso", async () => {
    await expect(qc.fetchQuery(opBiblioteca)).resolves.toEqual([{ id: VIDEO, titulo: "Vídeo raiz" }]);
    await expect(qc.fetchQuery(opTrilha)).resolves.toEqual([VIDEO]);
  });

  it("nova liberação aparece na biblioteca e na trilha após invalidar o cache", async () => {
    await qc.fetchQuery(opBiblioteca);
    liberar(AUDIO);
    // cache ainda fresco: sem invalidação o cliente veria o estado antigo
    expect(qc.getQueryData(["biblioteca"])).toHaveLength(1);

    await invalidarPorLiberacao(qc, AUDIO);
    await qc.fetchQuery(opBiblioteca);
    expect((qc.getQueryData(["biblioteca"]) as { id: string }[]).map((c) => c.id)).toEqual([VIDEO, AUDIO]);
    await expect(qc.fetchQuery(opTrilha)).resolves.toEqual([VIDEO, AUDIO]);
  });

  it("revogação remove o conteúdo da biblioteca e zera o player", async () => {
    await qc.fetchQuery(opBiblioteca);
    const antes = await qc.fetchQuery(opConteudo(VIDEO));
    expect(antes.url).toContain("midias.local");

    revogar(VIDEO);
    await invalidarPorLiberacao(qc, VIDEO);

    await expect(qc.fetchQuery(opBiblioteca)).resolves.toEqual([]);
    await expect(qc.fetchQuery(opTrilha)).resolves.toEqual([]);
    const depois = await qc.fetchQuery(opConteudo(VIDEO));
    expect(depois).toEqual({ conteudo: null, url: null });
  });

  it("invalidação refetcha as queries ativas de biblioteca, trilha e conteúdo", async () => {
    await qc.fetchQuery(opBiblioteca);
    await qc.fetchQuery(opTrilha);
    await qc.fetchQuery(opConteudo(VIDEO));
    chamadas = [];

    revogar(VIDEO);
    await invalidarPorLiberacao(qc, VIDEO);
    await Promise.all([qc.fetchQuery(opBiblioteca), qc.fetchQuery(opTrilha), qc.fetchQuery(opConteudo(VIDEO))]);

    expect(chamadas).toContain("biblioteca");
    expect(chamadas).toContain(`trilha:${EIXO}`);
    expect(chamadas).toContain(`conteudo:${VIDEO}`);
  });

  it("liberação agendada para o futuro não vaza para a biblioteca nem para o player", async () => {
    const amanha = new Date(Date.now() + 86_400_000).toISOString();
    liberar(AUDIO, amanha);
    await invalidarPorLiberacao(qc, AUDIO);

    await expect(qc.fetchQuery(opBiblioteca)).resolves.toEqual([{ id: VIDEO, titulo: "Vídeo raiz" }]);
    await expect(qc.fetchQuery(opConteudo(AUDIO))).resolves.toEqual({ conteudo: null, url: null });
  });

  it("liberar de novo após revogar volta a servir o estado atual, sem resíduo do cache", async () => {
    await qc.fetchQuery(opConteudo(VIDEO));
    revogar(VIDEO);
    await invalidarPorLiberacao(qc, VIDEO);
    expect((await qc.fetchQuery(opConteudo(VIDEO))).url).toBeNull();

    liberar(VIDEO);
    await invalidarPorLiberacao(qc, VIDEO);
    const atual = await qc.fetchQuery(opConteudo(VIDEO));
    expect(atual.conteudo).toEqual({ id: VIDEO, titulo: "Vídeo raiz" });
    expect(atual.url).toContain("a/video.mp4");
  });

  it("sequência de mudanças aplica apenas o último estado", async () => {
    liberar(AUDIO);
    revogar(AUDIO);
    liberar(AUDIO);
    revogar(VIDEO);
    await invalidarPorLiberacao(qc, AUDIO);
    await invalidarPorLiberacao(qc, VIDEO);

    await expect(qc.fetchQuery(opBiblioteca)).resolves.toEqual([{ id: AUDIO, titulo: "Áudio raiz" }]);
  });
});
