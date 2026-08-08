import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadMidia } from "../UploadMidia";

const upload = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload }) } },
}));

const erroToast = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (m: string) => erroToast(m) },
}));

describe("UploadMidia", () => {
  beforeEach(() => {
    upload.mockReset();
    erroToast.mockReset();
  });

  it("mostra nome, tamanho e barra de progresso durante o envio", async () => {
    const usuario = userEvent.setup();
    let liberar: (v: { error: null }) => void = () => {};
    upload.mockImplementation(() => new Promise((res) => (liberar = res)));
    const onEnviado = vi.fn();

    render(
      <UploadMidia
        eixoId="e1"
        variante="midia"
        accept="audio/*"
        caminhoAtual={null}
        onEnviado={onEnviado}
        onRemover={() => {}}
      />,
    );

    const arquivo = new File(["a".repeat(2048)], "meditacao.mp3", { type: "audio/mpeg" });
    await usuario.upload(screen.getByLabelText("Escolher mídia") as HTMLInputElement, arquivo);

    expect(screen.getByText(/meditacao\.mp3 · 2 KB/)).toBeInTheDocument();
    expect(await screen.findByRole("progressbar")).toBeInTheDocument();

    liberar({ error: null });
    await waitFor(() => expect(onEnviado).toHaveBeenCalled());
    expect(onEnviado.mock.calls[0]?.[0]).toMatch(/^e1\/\d+-meditacao\.mp3$/);
  });

  it("aceita só o tipo permitido e avisa em caso de erro", async () => {
    const usuario = userEvent.setup();
    upload.mockResolvedValue({ error: { message: "Falhou" } });

    render(
      <UploadMidia
        eixoId="e1"
        variante="capa"
        accept="image/png,image/jpeg,image/webp"
        caminhoAtual={null}
        onEnviado={() => {}}
        onRemover={() => {}}
      />,
    );

    const input = screen.getByLabelText("Escolher imagem de capa") as HTMLInputElement;
    expect(input.accept).toBe("image/png,image/jpeg,image/webp");

    await usuario.upload(input, new File(["x"], "capa.png", { type: "image/png" }));
    await waitFor(() => expect(erroToast).toHaveBeenCalled());
  });
});
