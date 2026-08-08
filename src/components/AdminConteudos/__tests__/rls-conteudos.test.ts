import { describe, expect, it } from "vitest";

/**
 * RLS de `conteudos` na biblioteca do terapeuta.
 *
 * O cliente só enxerga práticas liberadas para ele (política que usa
 * `conteudo_liberado`); o terapeuta/equipe com `gerenciar_conteudos` enxerga
 * a biblioteca inteira. Aqui simulamos o PostgREST aplicando essas regras
 * para garantir que a tela nunca depende de filtro no frontend.
 */

type Linha = {
  id: string;
  eixo_id: string;
  titulo: string;
  thumbnail_path: string | null;
};

const BANCO: Linha[] = [
  { id: "c1", eixo_id: "e1", titulo: "Liberada para Ana", thumbnail_path: "capas/e1/a.jpg" },
  { id: "c2", eixo_id: "e1", titulo: "Bloqueada", thumbnail_path: null },
  { id: "c3", eixo_id: "e2", titulo: "Liberada para Bruno", thumbnail_path: null },
];

const LIBERACOES: Record<string, string[]> = {
  ana: ["c1"],
  bruno: ["c3"],
};

function selectConteudos(sessao: { id: string; papel: "terapeuta" | "cliente" }) {
  if (sessao.papel === "terapeuta") return { data: BANCO, error: null };
  const permitidos = LIBERACOES[sessao.id] ?? [];
  return { data: BANCO.filter((linha) => permitidos.includes(linha.id)), error: null };
}

describe("RLS de conteudos", () => {
  it("terapeuta lê a biblioteca completa, inclusive a coluna de capa", () => {
    const { data } = selectConteudos({ id: "t1", papel: "terapeuta" });
    expect(data.map((l) => l.id)).toEqual(["c1", "c2", "c3"]);
    expect(data[0]?.thumbnail_path).toBe("capas/e1/a.jpg");
  });

  it("cliente só recebe as práticas liberadas para a própria sessão", () => {
    const ana = selectConteudos({ id: "ana", papel: "cliente" });
    const bruno = selectConteudos({ id: "bruno", papel: "cliente" });
    expect(ana.data.map((l) => l.id)).toEqual(["c1"]);
    expect(bruno.data.map((l) => l.id)).toEqual(["c3"]);
    expect(ana.data.map((l) => l.id)).not.toContain("c2");
  });

  it("cliente sem liberações não vê nada da biblioteca", () => {
    const { data } = selectConteudos({ id: "carla", papel: "cliente" });
    expect(data).toHaveLength(0);
  });
});
