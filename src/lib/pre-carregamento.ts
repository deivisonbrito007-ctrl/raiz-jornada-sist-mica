/**
 * Pré-carregamento seguro e limitado.
 *
 * Busca antecipadamente o próximo passo da trilha para que o avanço no fluxo
 * seja instantâneo — mas com freios, porque adiantar dados custa bateria,
 * dados móveis e capacidade do servidor:
 *
 *   - no máximo 2 buscas antecipadas ao mesmo tempo;
 *   - no máximo 8 por minuto (janela deslizante);
 *   - cada chave é adiantada uma única vez;
 *   - nada acontece offline, em modo de economia de dados, em conexão 2G ou
 *     com a aba em segundo plano;
 *   - roda em tempo ocioso, nunca competindo com o carregamento da tela atual;
 *   - falha em silêncio: um pré-carregamento é só uma otimização.
 */

export const MAX_SIMULTANEOS = 2;
export const LIMITE_POR_MINUTO = 8;
const JANELA_MS = 60_000;
const MAX_CHAVES_LEMBRADAS = 60;

export type MotivoIgnorado =
  | "ja_precarregado"
  | "sem_rede"
  | "economia_de_dados"
  | "conexao_lenta"
  | "aba_oculta"
  | "limite_simultaneo"
  | "limite_por_minuto";

const feitas = new Set<string>();
let emAndamento = 0;
let janela: number[] = [];

function agora() {
  return Date.now();
}

/** Conexão fraca ou usuário pedindo economia de dados: não gastamos rede à toa. */
function estadoDaRede(): MotivoIgnorado | null {
  if (typeof navigator === "undefined") return null;
  if (navigator.onLine === false) return "sem_rede";
  const conexao = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!conexao) return null;
  if (conexao.saveData) return "economia_de_dados";
  if (conexao.effectiveType === "2g" || conexao.effectiveType === "slow-2g") {
    return "conexao_lenta";
  }
  return null;
}

/** Diz se um pré-carregamento pode acontecer agora — e, se não, por quê. */
export function avaliarPreCarregamento(chave: string): MotivoIgnorado | null {
  if (feitas.has(chave)) return "ja_precarregado";

  const rede = estadoDaRede();
  if (rede) return rede;

  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return "aba_oculta";
  }
  if (emAndamento >= MAX_SIMULTANEOS) return "limite_simultaneo";

  janela = janela.filter((t) => agora() - t < JANELA_MS);
  if (janela.length >= LIMITE_POR_MINUTO) return "limite_por_minuto";

  return null;
}

function emTempoOcioso(tarefa: () => void) {
  const janelaGlobal = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, opcoes?: { timeout: number }) => number;
  };
  if (typeof janelaGlobal.requestIdleCallback === "function") {
    janelaGlobal.requestIdleCallback(tarefa, { timeout: 1200 });
    return;
  }
  setTimeout(tarefa, 200);
}

export type ResultadoPre = { feito: boolean; motivo?: MotivoIgnorado };

/**
 * Executa `tarefa` como pré-carregamento, respeitando todos os limites.
 * Resolve com `{ feito: false, motivo }` quando escolhemos não adiantar nada.
 */
export function preCarregar(chave: string, tarefa: () => Promise<unknown>): Promise<ResultadoPre> {
  const motivo = avaliarPreCarregamento(chave);
  if (motivo) return Promise.resolve({ feito: false, motivo });

  feitas.add(chave);
  if (feitas.size > MAX_CHAVES_LEMBRADAS) {
    const primeira = feitas.values().next().value;
    if (primeira) feitas.delete(primeira);
  }
  emAndamento += 1;
  janela.push(agora());

  return new Promise<ResultadoPre>((resolver) => {
    emTempoOcioso(() => {
      // segunda checagem: a aba pode ter sido escondida enquanto esperávamos
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        emAndamento = Math.max(0, emAndamento - 1);
        feitas.delete(chave);
        resolver({ feito: false, motivo: "aba_oculta" });
        return;
      }
      Promise.resolve()
        .then(tarefa)
        .then(
          () => resolver({ feito: true }),
          () => {
            // falhou: esquecemos a chave para que a próxima tentativa valha
            feitas.delete(chave);
            resolver({ feito: false });
          },
        )
        .finally(() => {
          emAndamento = Math.max(0, emAndamento - 1);
        });
    });
  });
}

/** Usado em testes e ao trocar de usuário. */
export function limparPreCarregamento() {
  feitas.clear();
  janela = [];
  emAndamento = 0;
}

export function estadoPreCarregamento() {
  janela = janela.filter((t) => agora() - t < JANELA_MS);
  return { chaves: feitas.size, emAndamento, naJanela: janela.length };
}
