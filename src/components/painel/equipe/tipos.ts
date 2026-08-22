import type { EscopoEquipe, FuncaoEquipe, StatusEquipe } from "@/lib/equipe-funcoes";

export type MembroEquipe = {
  userId: string;
  nome: string;
  email: string;
  funcao: FuncaoEquipe;
  status: StatusEquipe;
  escopo: EscopoEquipe;
  principal: boolean;
  desde: string;
  convidadoEm: string | null;
  ultimoAcesso: string | null;
  clientesVinculados: number | null;
  vinculosExplicitos: string[];
  permissoes: string[];
};

export type ConviteEquipe = {
  id: string;
  email: string;
  permissoes: string[];
  funcao: FuncaoEquipe;
  escopo: EscopoEquipe;
  status: string;
  created_at: string;
  reenviado_em: string | null;
};

export type ClienteVinculavel = {
  userId: string;
  nome: string;
  email: string;
  terapeutaId: string | null;
};
