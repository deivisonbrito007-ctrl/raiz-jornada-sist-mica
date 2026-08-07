import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clienteAdmin,
  criarUsuario,
  removerUsuario,
  rlsConfigurado,
  tornarTerapeuta,
  type UsuarioTeste,
} from "./rls-ambiente";

/**
 * Fábrica de dados determinística para os testes de segurança.
 *
 * Objetivo: todo teste que precisa de "múltiplos terapeutas e clientes"
 * recebe sempre a MESMA forma de cenário — mesma quantidade de eixos,
 * conteúdos, liberações, progresso e diário, com textos e datas fixas —
 * de modo que nenhuma asserção dependa de dados residuais do banco nem
 * da ordem/momento da execução. Só os UUIDs e e-mails variam (o Supabase
 * os gera), e nunca são usados como valor esperado.
 */

/** Data-base fixa do cenário (evita depender de "hoje"). */
export const DATA_BASE = new Date("2026-01-05T12:00:00.000Z");

/** Deslocamento em dias a partir da DATA_BASE, em ISO. */
export function diaRelativo(dias: number): string {
  return new Date(DATA_BASE.getTime() + dias * 86_400_000).toISOString();
}

/** Gerador pseudoaleatório determinístico (mulberry32) para valores estáveis. */
export function geradorEstavel(semente = 20260105) {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Duração determinística (60–600s) derivada de índices, não de Math.random. */
export function duracaoEstavel(indiceEixo: number, indiceConteudo: number): number {
  const aleatorio = geradorEstavel(1000 * (indiceEixo + 1) + (indiceConteudo + 1));
  return 60 + Math.floor(aleatorio() * 540);
}

export type ConteudoCenario = {
  id: string;
  titulo: string;
  eixoId: string;
  indiceEixo: number;
  indice: number;
  duracaoSegundos: number;
};

export type EixoCenario = {
  id: string;
  nome: string;
  indice: number;
  conteudos: ConteudoCenario[];
};

export type ClienteCenario = UsuarioTeste & {
  indice: number;
  /** conteúdos liberados agora */
  liberados: string[];
  /** conteúdos com liberação agendada para o futuro */
  agendados: string[];
  /** conteúdos com liberação revogada */
  revogados: string[];
  diario: { id: string; texto: string }[];
};

export type TerapeutaCenario = UsuarioTeste & { indice: number };

export type Cenario = {
  admin: SupabaseClient;
  marcador: string;
  eixos: EixoCenario[];
  conteudos: ConteudoCenario[];
  terapeutas: TerapeutaCenario[];
  clientes: ClienteCenario[];
  /** atalhos: primeiro terapeuta / primeiros clientes */
  terapeuta: TerapeutaCenario;
  cliente: ClienteCenario;
  outroCliente: ClienteCenario;
  conteudoLiberado: ConteudoCenario;
  conteudoBloqueado: ConteudoCenario;
  limpar: () => Promise<void>;
};

export type OpcoesCenario = {
  terapeutas?: number;
  clientes?: number;
  eixos?: number;
  conteudosPorEixo?: number;
  /** entradas de diário por cliente */
  diarioPorCliente?: number;
};

const PADRAO: Required<OpcoesCenario> = {
  terapeutas: 2,
  clientes: 3,
  eixos: 2,
  conteudosPorEixo: 3,
  diarioPorCliente: 2,
};

/** Texto de diário previsível: sempre o mesmo para (cliente, entrada). */
export function textoDiario(indiceCliente: number, indiceEntrada: number): string {
  return `diario-c${indiceCliente}-e${indiceEntrada}`;
}

/** Título de conteúdo previsível: sempre o mesmo para (eixo, conteúdo). */
export function tituloConteudo(marcador: string, indiceEixo: number, indice: number): string {
  return `[${marcador}] Prática ${indiceEixo}.${indice}`;
}

/**
 * Monta o cenário completo no banco usando service role e devolve
 * clientes autenticados por usuário. Regras determinísticas:
 *
 * - cliente i recebe liberação vigente do conteúdo i de cada eixo;
 * - cliente i recebe liberação AGENDADA (futuro) do conteúdo i+1;
 * - cliente i recebe liberação REVOGADA do conteúdo i+2 (quando existir);
 * - progresso: posição = 10 * (i + 1) no primeiro conteúdo liberado;
 * - diário: `diario-c{i}-e{n}`.
 */
export async function criarCenarioSeguranca(opcoes: OpcoesCenario = {}): Promise<Cenario> {
  if (!rlsConfigurado) throw new Error("cenário de segurança exige credenciais do backend");
  const cfg = { ...PADRAO, ...opcoes };
  const admin = clienteAdmin();
  const marcador = `seed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  // --- usuários -----------------------------------------------------------
  const terapeutasBrutos = await Promise.all(
    Array.from({ length: cfg.terapeutas }, (_, i) => criarUsuario(admin, `terapeuta${i}`)),
  );
  const clientesBrutos = await Promise.all(
    Array.from({ length: cfg.clientes }, (_, i) => criarUsuario(admin, `cliente${i}`)),
  );
  for (const t of terapeutasBrutos) await tornarTerapeuta(admin, t.id);

  const terapeutas: TerapeutaCenario[] = terapeutasBrutos.map((u, indice) => ({ ...u, indice }));

  // --- eixos e conteúdos --------------------------------------------------
  const eixosInseridos = await admin
    .from("eixos")
    .insert(
      Array.from({ length: cfg.eixos }, (_, i) => ({
        nome: `[${marcador}] Eixo ${i}`,
        descricao: `eixo determinístico ${i}`,
        ordem: 900 + i,
      })),
    )
    .select("id, nome, ordem");
  if (eixosInseridos.error) throw new Error(eixosInseridos.error.message);

  const eixos: EixoCenario[] = [...eixosInseridos.data]
    .sort((a, b) => (a.ordem as number) - (b.ordem as number))
    .map((e, indice) => ({ id: e.id as string, nome: e.nome as string, indice, conteudos: [] }));

  const linhasConteudo = eixos.flatMap((eixo) =>
    Array.from({ length: cfg.conteudosPorEixo }, (_, i) => ({
      eixo_id: eixo.id,
      titulo: tituloConteudo(marcador, eixo.indice, i),
      tipo: "texto" as const,
      corpo_texto: `corpo ${eixo.indice}.${i}`,
      descricao: `descrição ${eixo.indice}.${i}`,
      duracao_segundos: duracaoEstavel(eixo.indice, i),
      ordem: i,
    })),
  );
  const conteudosInseridos = await admin.from("conteudos").insert(linhasConteudo).select("id, titulo, eixo_id");
  if (conteudosInseridos.error) throw new Error(conteudosInseridos.error.message);

  const conteudos: ConteudoCenario[] = [];
  for (const eixo of eixos) {
    for (let i = 0; i < cfg.conteudosPorEixo; i += 1) {
      const titulo = tituloConteudo(marcador, eixo.indice, i);
      const linha = conteudosInseridos.data.find((c) => c.titulo === titulo);
      if (!linha) throw new Error(`conteúdo não semeado: ${titulo}`);
      const item: ConteudoCenario = {
        id: linha.id as string,
        titulo,
        eixoId: eixo.id,
        indiceEixo: eixo.indice,
        indice: i,
        duracaoSegundos: duracaoEstavel(eixo.indice, i),
      };
      eixo.conteudos.push(item);
      conteudos.push(item);
    }
  }

  // --- liberações, progresso e diário ------------------------------------
  const clientes: ClienteCenario[] = clientesBrutos.map((u, indice) => ({
    ...u,
    indice,
    liberados: [],
    agendados: [],
    revogados: [],
    diario: [],
  }));

  const linhasLiberacao: Record<string, unknown>[] = [];
  for (const cliente of clientes) {
    for (const eixo of eixos) {
      const alvo = (deslocamento: number): ConteudoCenario => {
        const item = eixo.conteudos[(cliente.indice + deslocamento) % eixo.conteudos.length];
        if (!item) throw new Error("eixo sem conteúdos semeados");
        return item;
      };
      const liberado = alvo(0);
      const agendado = alvo(1);
      const revogado = alvo(2);


      cliente.liberados.push(liberado.id);
      linhasLiberacao.push({ cliente_id: cliente.id, conteudo_id: liberado.id, status: "liberado" });

      if (agendado.id !== liberado.id) {
        cliente.agendados.push(agendado.id);
        linhasLiberacao.push({
          cliente_id: cliente.id,
          conteudo_id: agendado.id,
          status: "liberado",
          liberar_em: diaRelativo(3650),
        });
      }
      if (revogado.id !== liberado.id && revogado.id !== agendado.id) {
        cliente.revogados.push(revogado.id);
        linhasLiberacao.push({ cliente_id: cliente.id, conteudo_id: revogado.id, status: "bloqueado" });
      }
    }
  }
  const liberacoes = await admin.from("liberacoes").insert(linhasLiberacao);
  if (liberacoes.error) throw new Error(liberacoes.error.message);

  const linhasProgresso = clientes.map((cliente) => ({
    cliente_id: cliente.id,
    conteudo_id: cliente.liberados[0],
    status: "em_andamento" as const,
    posicao_segundos: 10 * (cliente.indice + 1),
  }));
  const progresso = await admin.from("progresso").insert(linhasProgresso);
  if (progresso.error) throw new Error(progresso.error.message);

  const linhasDiario = clientes.flatMap((cliente) =>
    Array.from({ length: cfg.diarioPorCliente }, (_, n) => ({
      cliente_id: cliente.id,
      texto: textoDiario(cliente.indice, n),
    })),
  );
  const diario = await admin.from("diario").insert(linhasDiario).select("id, cliente_id, texto");
  if (diario.error) throw new Error(diario.error.message);
  for (const cliente of clientes) {
    cliente.diario = diario.data
      .filter((d) => d.cliente_id === cliente.id)
      .map((d) => ({ id: d.id as string, texto: d.texto as string }))
      .sort((a, b) => a.texto.localeCompare(b.texto));
  }

  const idsConteudo = conteudos.map((c) => c.id);
  const idsEixo = eixos.map((e) => e.id);

  const limpar = async () => {
    await admin.from("progresso").delete().in("conteudo_id", idsConteudo);
    await admin.from("liberacoes").delete().in("conteudo_id", idsConteudo);
    await admin.from("liberacoes").delete().in("eixo_id", idsEixo);
    await admin.from("diario").delete().in("conteudo_id", idsConteudo);
    await admin.from("conteudos").delete().in("id", idsConteudo);
    await admin.from("eixos").delete().in("id", idsEixo);
    for (const u of [...clientes, ...terapeutas]) {
      await removerUsuario(admin, u.id);
    }
  };

  const primeiroTerapeuta = terapeutas[0];
  const primeiroCliente = clientes[0];
  const segundoCliente = clientes[1] ?? clientes[0];
  if (!primeiroTerapeuta || !primeiroCliente || !segundoCliente) {
    throw new Error("cenário exige ao menos 1 terapeuta e 1 cliente");
  }
  const idLiberado = primeiroCliente.liberados[0];
  const idBloqueado = primeiroCliente.revogados[0] ?? primeiroCliente.agendados[0];
  const conteudoLiberado = conteudos.find((c) => c.id === idLiberado);
  const conteudoBloqueado = conteudos.find((c) => c.id === idBloqueado);
  if (!conteudoLiberado || !conteudoBloqueado) {
    throw new Error("cenário exige conteúdo liberado e conteúdo bloqueado");
  }

  return {
    admin,
    marcador,
    eixos,
    conteudos,
    terapeutas,
    clientes,
    terapeuta: primeiroTerapeuta,
    cliente: primeiroCliente,
    outroCliente: segundoCliente,
    conteudoLiberado,
    conteudoBloqueado,
    limpar,
  };
}

