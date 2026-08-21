import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConteudoFormDialog, formularioVazio } from "../ConteudoFormDialog";

const upload = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload, createSignedUrl: vi.fn() }) } },
}));

const eixos = [{ id: "e1", nome: "Raízes", descricao: "", icone: "sprout", ordem: 1 }];

describe("ConteudoFormDialog", () => {
  beforeEach(() => {
    upload.mockReset();
    upload.mockResolvedValue({ error: null });
  });

  it("mantém 'Salvar material' desabilitado até o título ser preenchido", async () => {
    const usuario = userEvent.setup();
    render(
      <ConteudoFormDialog
        form={{ ...formularioVazio("e1"), tipo: "texto" }}
        eixos={eixos}
        salvando={false}
        onFechar={() => {}}
        onSalvar={() => {}}
      />,
    );
    const salvar = screen.getByRole("button", { name: /Salvar material/i });
    expect(salvar).toBeDisabled();
    await usuario.type(screen.getByLabelText("Título"), "Carta à criança");
    expect(salvar).toBeEnabled();
  });

  it("aplica negrito no editor de texto e envia o HTML formatado", async () => {
    const usuario = userEvent.setup();
    const onSalvar = vi.fn();
    render(
      <ConteudoFormDialog
        form={{ ...formularioVazio("e1"), tipo: "texto", titulo: "Carta" }}
        eixos={eixos}
        salvando={false}
        onFechar={() => {}}
        onSalvar={onSalvar}
      />,
    );

    await usuario.click(screen.getByRole("tab", { name: "Conteúdo" }));
    const editor = await screen.findByRole("textbox", { name: /Conteúdo principal/i });
    await usuario.click(editor);
    await usuario.click(screen.getByRole("button", { name: "Negrito" }));
    await usuario.type(editor, "respire");

    await usuario.click(screen.getByRole("button", { name: /Salvar material/i }));
    await waitFor(() => expect(onSalvar).toHaveBeenCalled());
    const enviado = onSalvar.mock.calls[0]?.[0];
    expect(enviado?.corpoTexto).toMatch(/<strong>respire<\/strong>/);
  });

  it("mostra o upload de mídia apenas para tipos com arquivo", async () => {
    const usuario = userEvent.setup();
    const { unmount } = render(
      <ConteudoFormDialog
        form={{ ...formularioVazio("e1"), tipo: "audio", titulo: "Áudio" }}
        eixos={eixos}
        salvando={false}
        onFechar={() => {}}
        onSalvar={() => {}}
      />,
    );
    await usuario.click(screen.getByRole("tab", { name: "Conteúdo" }));
    expect(screen.getByLabelText("Escolher mídia")).toBeInTheDocument();
    unmount();

    render(
      <ConteudoFormDialog
        form={{ ...formularioVazio("e1"), tipo: "tarefa", titulo: "Tarefa" }}
        eixos={eixos}
        salvando={false}
        onFechar={() => {}}
        onSalvar={() => {}}
      />,
    );
    await usuario.click(screen.getByRole("tab", { name: "Conteúdo" }));
    expect(screen.queryByLabelText("Escolher mídia")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Escolher imagem de capa")).toBeInTheDocument();
  });
});
