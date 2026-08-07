import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { toast } from "sonner";
import {
  bloqueioDePermissao,
  classificarErroPermissao,
  notificarErro,
} from "./erro-permissao";

describe("classificarErroPermissao", () => {
  it("reconhece acesso restrito como falta de permissão", () => {
    const r = classificarErroPermissao(new Error("Acesso restrito"));
    expect(r.tipo).toBe("permissao");
    expect(r.ehPermissao).toBe(true);
    expect(r.orientacao).toMatch(/terapeuta/i);
  });

  it("reconhece permission denied do Postgres (42501)", () => {
    const r = classificarErroPermissao({ message: "permission denied for table", code: "42501" });
    expect(r.tipo).toBe("permissao");
  });

  it("reconhece bloqueio de RLS", () => {
    const r = classificarErroPermissao({
      message: "new row violates row-level security policy",
    });
    expect(r.tipo).toBe("rls");
  });

  it("reconhece sessão expirada", () => {
    expect(classificarErroPermissao({ status: 401, message: "Unauthorized" }).tipo).toBe("sessao");
    expect(classificarErroPermissao(new Error("JWT expired")).tipo).toBe("sessao");
  });

  it("reconhece pedido fora do escopo", () => {
    expect(classificarErroPermissao(new Error("Cliente fora do escopo")).tipo).toBe("escopo");
  });

  it("não classifica erros comuns como permissão, mas mantém a mensagem", () => {
    const r = classificarErroPermissao(new Error("Falha de rede"));
    expect(r.ehPermissao).toBe(false);
    expect(r.mensagem).toBe("Falha de rede");
  });

  it("nunca deixa mensagem vazia", () => {
    const r = classificarErroPermissao(undefined);
    expect(r.titulo.length).toBeGreaterThan(0);
    expect(r.mensagem.length).toBeGreaterThan(0);
  });
});

describe("bloqueioDePermissao", () => {
  it("cita a permissão que falta", () => {
    const r = bloqueioDePermissao("ver_diario");
    expect(r.mensagem).toContain("Ver diário dos clientes");
    expect(r.orientacao).toMatch(/Equipe/);
  });
});

describe("notificarErro", () => {
  beforeEach(() => vi.mocked(toast.error).mockClear());

  it("avisa o usuário com título e orientação (nunca falha em silêncio)", () => {
    notificarErro(new Error("Acesso restrito"), "Não foi possível salvar o conteúdo");
    expect(toast.error).toHaveBeenCalledTimes(1);
    const [titulo, opcoes] = vi.mocked(toast.error).mock.calls[0]!;
    expect(titulo).toBe("Você não tem permissão para isso");
    expect(String((opcoes as { description: string }).description)).toContain(
      "Não foi possível salvar o conteúdo",
    );
  });
});
