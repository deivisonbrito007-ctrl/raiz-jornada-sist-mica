/**
 * Diagnóstico interno de desempenho (somente agregados, sem dados privados).
 *
 * O que é coletado, em memória e apenas no navegador de quem está usando:
 *   - tempo de carregamento por rota (com identificadores dinâmicos mascarados);
 *   - contagem, duração e falhas de requisições, agrupadas por rótulo.
 *
 * O que NUNCA é coletado: corpo das requisições, respostas, cabeçalhos,
 * parâmetros de busca, e-mails, ids de clientes ou qualquer texto do diário.
 * Nada é enviado para fora nem gravado em disco: ao recarregar a página os
 * números começam de novo.
 */

export type Amostra = {
  /** rótulo agregado (rota normalizada ou nome da função de servidor) */
  rotulo: string;
  duracoes: number[];
  erros: number;
  ultimaEm: number;
};

export type Agregado = {
  rotulo: string;
  chamadas: number;
  erros: number;
  media: number;
  p50: number;
  p95: number;
  max: number;
  ultimaEm: number;
};

const MAX_ROTULOS = 80;
const MAX_AMOSTRAS = 200;

const rotas = new Map<string, Amostra>();
const requisicoes = new Map<string, Amostra>();
const ouvintes = new Set<() => void>();

let inicioSessao = Date.now();
let instrumentado = false;
let cache: Diagnostico | null = null;

function avisar() {
  cache = null;
  for (const ouvinte of ouvintes) ouvinte();
}

function registrar(mapa: Map<string, Amostra>, rotulo: string, ms: number, falhou: boolean) {
  let amostra = mapa.get(rotulo);
  if (!amostra) {
    if (mapa.size >= MAX_ROTULOS) return;
    amostra = { rotulo, duracoes: [], erros: 0, ultimaEm: 0 };
    mapa.set(rotulo, amostra);
  }
  amostra.duracoes.push(Math.max(0, Math.round(ms)));
  if (amostra.duracoes.length > MAX_AMOSTRAS) amostra.duracoes.shift();
  if (falhou) amostra.erros += 1;
  amostra.ultimaEm = Date.now();
  avisar();
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Troca ids dinâmicos por marcadores, para agrupar rotas sem expor quem é quem. */
export function normalizarRota(caminho: string): string {
  const semQuery = caminho.split("?")[0] ?? caminho;
  return (
    semQuery
      .replace(UUID, ":id")
      .replace(/\/\d{2,}(?=\/|$)/g, "/:n")
      .replace(/\/+$/, "") || "/"
  );
}

/** Rótulo agregado de uma requisição, sem parâmetros nem dados pessoais. */
export function rotuloDaRequisicao(url: string): string {
  try {
    const alvo = new URL(url, "http://local");
    const funcao =
      alvo.searchParams.get("_serverFnId") ??
      alvo.searchParams.get("_serverFn") ??
      alvo.searchParams.get("createServerFn");
    if (funcao) {
      const nome = funcao.split(/[/#?]/).filter(Boolean).pop() ?? funcao;
      return `fn: ${nome.slice(0, 60)}`;
    }
    if (alvo.hostname.includes("supabase")) {
      const tabela = normalizarRota(alvo.pathname).split("/").filter(Boolean).pop() ?? "";
      return `backend: ${tabela || "api"}`;
    }
    return normalizarRota(alvo.pathname);
  } catch {
    return "outros";
  }
}

export function registrarRota(caminho: string, ms: number) {
  registrar(rotas, normalizarRota(caminho), ms, false);
}

export function registrarRequisicao(url: string, ms: number, falhou = false) {
  registrar(requisicoes, rotuloDaRequisicao(url), ms, falhou);
}

function percentil(valores: number[], p: number) {
  if (valores.length === 0) return 0;
  const ordenado = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenado.length - 1, Math.ceil((p / 100) * ordenado.length) - 1);
  return ordenado[Math.max(0, indice)] ?? 0;
}

function agregar(mapa: Map<string, Amostra>): Agregado[] {
  return [...mapa.values()]
    .map((a) => ({
      rotulo: a.rotulo,
      chamadas: a.duracoes.length,
      erros: a.erros,
      media: a.duracoes.reduce((s, v) => s + v, 0) / Math.max(1, a.duracoes.length),
      p50: percentil(a.duracoes, 50),
      p95: percentil(a.duracoes, 95),
      max: Math.max(0, ...a.duracoes),
      ultimaEm: a.ultimaEm,
    }))
    .sort((a, b) => b.chamadas - a.chamadas || b.p95 - a.p95);
}

export type Diagnostico = {
  rotas: Agregado[];
  requisicoes: Agregado[];
  totalRequisicoes: number;
  totalErros: number;
  desdeEm: number;
};

export function lerDiagnostico(): Diagnostico {
  if (cache) return cache;
  const listaRequisicoes = agregar(requisicoes);
  cache = {
    rotas: agregar(rotas),
    requisicoes: listaRequisicoes,
    totalRequisicoes: listaRequisicoes.reduce((s, r) => s + r.chamadas, 0),
    totalErros: listaRequisicoes.reduce((s, r) => s + r.erros, 0),
    desdeEm: inicioSessao,
  };
  return cache;
}

export function inscreverDiagnostico(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function limparDiagnostico() {
  rotas.clear();
  requisicoes.clear();
  inicioSessao = Date.now();
  avisar();
}

/**
 * Liga a coleta: mede o carregamento inicial e envolve o `fetch` para contar
 * requisições. Só roda no navegador e apenas uma vez por sessão.
 */
export function iniciarDiagnostico() {
  if (instrumentado || typeof window === "undefined") return;
  instrumentado = true;

  const original = window.fetch.bind(window);
  window.fetch = async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const inicio = performance.now();
    const url =
      typeof entrada === "string"
        ? entrada
        : entrada instanceof URL
          ? entrada.toString()
          : entrada.url;
    try {
      const resposta = await original(entrada, init);
      registrarRequisicao(url, performance.now() - inicio, !resposta.ok);
      return resposta;
    } catch (erro) {
      registrarRequisicao(url, performance.now() - inicio, true);
      throw erro;
    }
  };

  try {
    const [navegacao] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    if (navegacao && navegacao.duration > 0) {
      registrarRota(window.location.pathname, navegacao.duration);
    }
  } catch {
    // API de performance indisponível: seguimos apenas com as navegações internas
  }
}

/** Marca o início de uma navegação e devolve a função que fecha a medição. */
export function medirNavegacao(caminho: string) {
  const inicio = typeof performance === "undefined" ? Date.now() : performance.now();
  return () => {
    const agora = typeof performance === "undefined" ? Date.now() : performance.now();
    registrarRota(caminho, agora - inicio);
  };
}
