import { describe, expect, it } from "vitest";
import { planejarLiberacao } from "./renovacao-liberacao";

describe("renovação de acesso aplicada pelo terapeuta", () => {
  it("liberar pela primeira vez avisa que há conteúdo novo", () => {
    const plano = planejarLiberacao({ statusAtual: null, titulo: "Carta ao pai" });
    expect(plano).toMatchObject({ acao: "conteudo_liberado", renovacao: false, agendada: false });
    expect(plano.notificacao?.titulo).toBe("Novo conteúdo liberado");
    expect(plano.notificacao?.mensagem).toContain("Carta ao pai");
  });

  it("liberar algo bloqueado é registrado como renovação de acesso", () => {
    const plano = planejarLiberacao({ statusAtual: "bloqueado", titulo: "Respiração da raiz" });
    expect(plano.acao).toBe("liberacao_renovada");
    expect(plano.renovacao).toBe(true);
    expect(plano.notificacao?.titulo).toBe("Acesso renovado");
    expect(plano.notificacao?.mensagem).toMatch(/liberada novamente/);
    expect(plano.notificacao?.mensagem).toMatch(/retomar de onde parou/);
  });

  it("renovação sem título traz mensagem genérica, sem citar prática", () => {
    const plano = planejarLiberacao({ statusAtual: "bloqueado", titulo: "   " });
    expect(plano.acao).toBe("liberacao_renovada");
    expect(plano.notificacao?.mensagem).toBe(
      "Seu acesso foi renovado: você pode retomar de onde parou.",
    );
  });

  it("reliberar algo que já estava liberado não vira renovação", () => {
    const plano = planejarLiberacao({ statusAtual: "liberado", titulo: "Carta ao pai" });
    expect(plano.acao).toBe("conteudo_liberado");
    expect(plano.renovacao).toBe(false);
  });

  it("renovação agendada para o futuro não notifica agora, mas guarda o histórico", () => {
    const agora = new Date("2026-01-01T10:00:00Z");
    const plano = planejarLiberacao({
      statusAtual: "bloqueado",
      liberarEm: "2026-01-05T10:00:00Z",
      titulo: "Carta ao pai",
      agora,
    });
    expect(plano.acao).toBe("liberacao_agendada");
    expect(plano.agendada).toBe(true);
    expect(plano.renovacao).toBe(true);
    expect(plano.notificacao).toBeNull();
  });

  it("data já passada vale como liberação imediata", () => {
    const agora = new Date("2026-01-10T10:00:00Z");
    const plano = planejarLiberacao({
      statusAtual: "bloqueado",
      liberarEm: "2026-01-05T10:00:00Z",
      agora,
    });
    expect(plano.acao).toBe("liberacao_renovada");
    expect(plano.agendada).toBe(false);
    expect(plano.notificacao?.titulo).toBe("Acesso renovado");
  });
});
