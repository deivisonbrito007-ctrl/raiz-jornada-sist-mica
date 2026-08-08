import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ConteudoCard } from "../ConteudoCard";
import type { ConteudoAdmin } from "@/hooks/useConteudos";

vi.mock("@/components/permissao-ui", () => ({
  SePode: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const criarSignedUrl = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: criarSignedUrl }) } },
}));

const base: ConteudoAdmin = {
  id: "c1",
  eixo_id: "e1",
  tipo: "audio",
  titulo: "Meditação da origem",
  descricao: "Uma prática de chegada",
  corpo_texto: null,
  storage_path: "e1/audio.mp3",
  thumbnail_path: null,
  duracao_segundos: 600,
  ordem: 1,
};

function renderizar(conteudo: ConteudoAdmin) {
  return render(
    <ul>
      <ConteudoCard
        conteudo={conteudo}
        selecionado={false}
        onSelecionar={() => {}}
        onEditar={() => {}}
        onExcluir={() => {}}
        arrastavel={false}
      />
    </ul>,
  );
}

describe("ConteudoCard", () => {
  beforeEach(() => {
    criarSignedUrl.mockReset();
    criarSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://midias.local/capa.jpg?token=t" },
      error: null,
    });
  });

  it("exibe a miniatura quando existe thumbnail_path", async () => {
    renderizar({ ...base, id: "c-capa", thumbnail_path: "capas/e1/capa.jpg" });
    const imagem = await screen.findByRole("img", { name: /Capa da prática Meditação da origem/i });
    await waitFor(() =>
      expect(imagem).toHaveAttribute("src", "https://midias.local/capa.jpg?token=t"),
    );
  });

  it("mostra ícone do tipo quando não há capa", async () => {
    renderizar({ ...base, id: "c-sem-capa" });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/Sem capa/i)).toBeInTheDocument();
  });

  it("traz selo de mídia enviada, duração e rótulos acessíveis", () => {
    renderizar({ ...base, id: "c-selo" });
    expect(screen.getByText("mídia enviada")).toBeInTheDocument();
    expect(screen.getByText(/10 min/)).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Selecionar prática Meditação da origem/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Excluir prática Meditação da origem/i }),
    ).toBeInTheDocument();
  });
});
