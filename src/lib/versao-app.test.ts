import { beforeEach, describe, expect, it } from "vitest";
import {
  CHAVE_ADIADO,
  CHAVE_ASSINATURA,
  DIAS_ADIAMENTO,
  VERSAO_ICONES,
  adiarAviso,
  assinaturaInstalada,
  avisoAdiado,
  instalacaoDesatualizada,
  registrarInstalacao,
} from "./versao-app";

const MS_DIA = 24 * 60 * 60 * 1000;

describe("assinatura de instalação", () => {
  beforeEach(() => localStorage.clear());

  it("sem assinatura registrada não considera a instalação antiga", () => {
    expect(instalacaoDesatualizada()).toBe(false);
  });

  it("registra a assinatura do build atual", () => {
    registrarInstalacao();
    expect(assinaturaInstalada()?.icones).toBe(VERSAO_ICONES);
    expect(instalacaoDesatualizada()).toBe(false);
  });

  it("detecta instalação com versão de ícones anterior", () => {
    localStorage.setItem(
      CHAVE_ASSINATURA,
      JSON.stringify({ app: "0.9.0", icones: VERSAO_ICONES - 1 }),
    );
    expect(instalacaoDesatualizada()).toBe(true);
  });

  it("ignora assinatura corrompida", () => {
    localStorage.setItem(CHAVE_ASSINATURA, "{não é json");
    expect(assinaturaInstalada()).toBeNull();
    expect(instalacaoDesatualizada()).toBe(false);
  });

  it("adia o aviso por 14 dias e volta depois", () => {
    const agora = Date.now();
    adiarAviso(agora);
    expect(avisoAdiado(agora + 13 * MS_DIA)).toBe(true);
    expect(avisoAdiado(agora + (DIAS_ADIAMENTO + 1) * MS_DIA)).toBe(false);
  });

  it("reinstalar limpa o adiamento", () => {
    adiarAviso();
    registrarInstalacao();
    expect(localStorage.getItem(CHAVE_ADIADO)).toBeNull();
    expect(avisoAdiado()).toBe(false);
  });
});
