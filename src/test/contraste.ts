/**
 * Verificação automatizada de contraste (WCAG 2.1) usando as próprias
 * utilidades de cor do axe-core (`axe.commons.color`).
 *
 * Os tokens são lidos direto de `src/styles.css`, então a checagem cobre
 * todos os temas relevantes (claro = `:root`, escuro = `.dark`) sem
 * depender de um navegador real.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import axe from "axe-core";

const { Color, getContrast, flattenColors } = (axe as any).commons.color as {
  Color: new (r?: number, g?: number, b?: number, a?: number) => any;
  getContrast: (a: unknown, b: unknown) => number;
  flattenColors: (fg: unknown, bg: unknown) => any;
};

export type Tema = "claro" | "escuro";

/** Limites WCAG 2.1 AA. */
export const LIMITE = {
  /** Texto normal (< 18.66px bold / < 24px). */
  texto: 4.5,
  /** Texto grande, ícones e elementos gráficos que carregam significado. */
  grafico: 3,
  /**
   * Bordas e tintas puramente decorativas: o estado já é comunicado por
   * texto e ícone, então só exigimos que a borda seja perceptível.
   */
  decorativo: 1.2,
} as const;

function lerBlocos() {
  const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  const capturar = (seletor: string) => {
    const inicio = css.indexOf(`${seletor} {`);
    if (inicio === -1) return {} as Record<string, string>;
    const abre = css.indexOf("{", inicio);
    const fecha = css.indexOf("}", abre);
    const corpo = css.slice(abre + 1, fecha);
    const mapa: Record<string, string> = {};
    for (const linha of corpo.split(";")) {
      const m = linha.match(/--([\w-]+)\s*:\s*(.+)/);
      if (m && m[1] && m[2]) mapa[m[1].trim()] = m[2].trim();
    }
    return mapa;
  };
  const claro = capturar(":root");
  const escuro = { ...claro, ...capturar(".dark") };
  return { claro, escuro };
}

const BLOCOS = lerBlocos();

/** Valor bruto de um token no tema pedido (resolvendo `var(--x)`). */
export function token(nome: string, tema: Tema): string {
  const mapa = BLOCOS[tema];
  let valor = mapa[nome];
  let voltas = 0;
  while (valor && valor.startsWith("var(") && voltas++ < 5) {
    const ref = valor.slice(4, valor.indexOf(")")).replace("--", "");
    valor = mapa[ref];
  }
  if (!valor) throw new Error(`Token --${nome} não existe no tema ${tema}`);
  return valor;
}

/** Converte token (+ opacidade Tailwind) em Color do axe. */
export function cor(nome: string, tema: Tema, opacidade = 1) {
  const c = new Color();
  c.parseString(token(nome, tema));
  c.alpha = (c.alpha ?? 1) * opacidade;
  return c;
}

export type Par = {
  /** Onde aparece, para a mensagem de falha. */
  onde: string;
  /** Token da cor de frente (texto, ícone ou borda). */
  frente: string;
  /** Opacidade aplicada à frente (ex: `text-terracota/70`). */
  frenteOpacidade?: number;
  /**
   * Camadas de fundo, da mais próxima do texto para a mais distante.
   * Ex: `["floresta/5", "card", "background"]`.
   */
  fundo: Array<{ nome: string; opacidade?: number }>;
  /** Tipo de alvo: texto normal, texto grande ou elemento gráfico. */
  tipo: "texto" | "grafico" | "decorativo";
};

/** Achata a pilha de fundo em uma cor opaca única. */
function fundoFinal(par: Par, tema: Tema) {
  const camadas = [...par.fundo].reverse();
  const primeira = camadas[0];
  if (!primeira) throw new Error(`Par ${par.onde} sem camada de fundo`);
  let base = cor(primeira.nome, tema, primeira.opacidade ?? 1);
  base.alpha = 1;
  for (const camada of camadas.slice(1)) {
    base = flattenColors(cor(camada.nome, tema, camada.opacidade ?? 1), base);
  }
  return base;
}

export type Resultado = {
  onde: string;
  tema: Tema;
  razao: number;
  minimo: number;
  ok: boolean;
};

/** Roda a verificação de contraste de um par em um tema. */
export function verificarContraste(par: Par, tema: Tema): Resultado {
  const fundo = fundoFinal(par, tema);
  const frente = flattenColors(cor(par.frente, tema, par.frenteOpacidade ?? 1), fundo);
  const razao = Math.round(getContrast(fundo, frente) * 100) / 100;
  const minimo = LIMITE[par.tipo];
  return { onde: par.onde, tema, razao, minimo, ok: razao >= minimo };
}

export const TEMAS: Tema[] = ["claro", "escuro"];
