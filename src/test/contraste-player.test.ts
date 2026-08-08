import { describe, expect, it } from "vitest";
import { TEMAS, verificarContraste, type Par, type Tema } from "@/test/contraste";

/**
 * Pares de cor realmente usados nos estados do player (selos, ícones,
 * diálogo de bloqueio, botões e barra de progresso).
 */
const CARTAO = [{ nome: "card" }, { nome: "background" }];

const PARES: Par[] = [
  // Selo "Mídia liberada"
  {
    onde: 'selo "Mídia liberada" — texto',
    frente: "floresta",
    fundo: [{ nome: "salvia", opacidade: 0.15 }, ...CARTAO],
    tipo: "texto",
  },
  {
    onde: 'selo "Mídia liberada" — ícone',
    frente: "floresta",
    fundo: [{ nome: "salvia", opacidade: 0.15 }, ...CARTAO],
    tipo: "grafico",
  },
  {
    onde: 'selo "Mídia liberada" — borda',
    frente: "salvia",
    frenteOpacidade: 0.4,
    fundo: [{ nome: "salvia", opacidade: 0.15 }, ...CARTAO],
    tipo: "decorativo",
  },
  // Selo "Acesso expirado"
  {
    onde: 'selo "Acesso expirado" — texto',
    frente: "floresta",
    fundo: [{ nome: "ocre", opacidade: 0.15 }, ...CARTAO],
    tipo: "texto",
  },
  {
    onde: 'selo "Acesso expirado" — ícone',
    frente: "floresta",
    fundo: [{ nome: "ocre", opacidade: 0.15 }, ...CARTAO],
    tipo: "grafico",
  },
  // Selo "Acesso revogado"
  {
    onde: 'selo "Acesso revogado" — texto',
    frente: "terracota",
    fundo: [{ nome: "terracota", opacidade: 0.15 }, ...CARTAO],
    tipo: "texto",
  },
  {
    onde: 'selo "Acesso revogado" — ícone',
    frente: "terracota",
    fundo: [{ nome: "terracota", opacidade: 0.15 }, ...CARTAO],
    tipo: "grafico",
  },
  // Selo "Muitos pedidos" (limite de uso)
  {
    onde: 'selo "Muitos pedidos" — texto',
    frente: "floresta",
    fundo: [{ nome: "ocre", opacidade: 0.15 }, ...CARTAO],
    tipo: "texto",
  },
  // Diálogo de bloqueio (aviso-midia-bloqueada)
  {
    onde: "aviso de bloqueio — título",
    frente: "floresta",
    fundo: [{ nome: "terracota", opacidade: 0.1 }, ...CARTAO],
    tipo: "texto",
  },
  {
    onde: "aviso de bloqueio — texto de apoio",
    frente: "muted-foreground",
    fundo: [{ nome: "terracota", opacidade: 0.1 }, ...CARTAO],
    tipo: "texto",
  },
  {
    onde: "aviso de expiração — ícone",
    frente: "ocre-forte",
    fundo: [{ nome: "ocre", opacidade: 0.1 }, ...CARTAO],
    tipo: "grafico",
  },
  {
    onde: "aviso de expiração — borda",
    frente: "ocre",
    frenteOpacidade: 0.3,
    fundo: [{ nome: "ocre", opacidade: 0.1 }, ...CARTAO],
    tipo: "decorativo",
  },
  {
    onde: "aviso de remoção — ícone",
    frente: "terracota",
    fundo: [{ nome: "terracota", opacidade: 0.1 }, ...CARTAO],
    tipo: "grafico",
  },
  {
    onde: "contagem regressiva do botão",
    frente: "muted-foreground",
    fundo: [{ nome: "muted", opacidade: 0.3 }, ...CARTAO],
    tipo: "texto",
  },
  // Botões do player
  {
    onde: 'botão "Renovar acesso" (primário)',
    frente: "floresta-foreground",
    fundo: [{ nome: "floresta" }, ...CARTAO],
    tipo: "texto",
  },
  {
    onde: 'botão "Reproduzir" (salvia)',
    frente: "salvia-foreground",
    fundo: [{ nome: "salvia" }, ...CARTAO],
    tipo: "texto",
  },
  {
    onde: "botão secundário (voltar 15s / avançar 15s)",
    frente: "secondary-foreground",
    fundo: [{ nome: "secondary" }, ...CARTAO],
    tipo: "texto",
  },
  {
    onde: "anel de foco visível dos controles",
    frente: "ring",
    fundo: CARTAO,
    tipo: "grafico",
  },
  // Barra de progresso e tempos
  {
    onde: "barra de progresso — trilho preenchido",
    frente: "palco-realce",
    fundo: [{ nome: "palco-foreground", opacidade: 0.2 }, { nome: "palco" }],
    tipo: "grafico",
  },
  {
    onde: "tempos decorrido/total sobre o palco do player",
    frente: "palco-foreground",
    frenteOpacidade: 0.6,
    fundo: [{ nome: "palco" }],
    tipo: "texto",
  },
  {
    onde: "legenda de áudio sobre o palco do player",
    frente: "palco-foreground",
    frenteOpacidade: 0.7,
    fundo: [{ nome: "palco-foreground", opacidade: 0.05 }, { nome: "palco" }],
    tipo: "texto",
  },
  {
    onde: "botão play/pausa sobre o palco",
    frente: "terracota-foreground",
    fundo: [{ nome: "terracota" }, { nome: "palco" }],
    tipo: "texto",
  },
  {
    onde: "ícones de avançar/voltar 15s sobre a faixa do player",
    frente: "palco-foreground",
    frenteOpacidade: 0.8,
    fundo: [{ nome: "palco" }],
    tipo: "grafico",
  },
  {
    onde: "hover e anel de foco dos controles sobre o palco",
    frente: "palco-realce",
    fundo: [{ nome: "palco" }],
    tipo: "grafico",
  },
  {
    onde: "tempo decorrido / duração",
    frente: "muted-foreground",
    fundo: CARTAO,
    tipo: "texto",
  },
  {
    onde: "título da prática",
    frente: "foreground",
    fundo: CARTAO,
    tipo: "texto",
  },
];

describe("contraste WCAG dos estados do player (axe-core)", () => {
  for (const tema of TEMAS) {
    describe(`tema ${tema}`, () => {
      for (const par of PARES) {
        it(`${par.onde} atende ao mínimo WCAG AA`, () => {
          const r = verificarContraste(par, tema as Tema);
          expect(r.ok, `${par.onde} no tema ${tema}: ${r.razao}:1 (mínimo ${r.minimo}:1)`).toBe(
            true,
          );
        });
      }
    });
  }

  it("cobre os dois temas relevantes", () => {
    expect(TEMAS).toEqual(["claro", "escuro"]);
  });
});
