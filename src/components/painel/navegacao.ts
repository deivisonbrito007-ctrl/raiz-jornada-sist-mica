import {
  Users,
  ClipboardList,
  Activity,
  Route as RouteIcon,
  Library,
  Package,
  UsersRound,
  ShieldCheck,
  Eye,
  LifeBuoy,
  Gauge,
  UserCircle,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import type { Permissao } from "@/lib/permissoes";

export type ItemPainel = {
  to: string;
  label: string;
  icone: LucideIcon;
  /** Estado ativo só no caminho exato. */
  exact?: boolean;
  /** Permissão exigida; ausente = sempre visível para quem já entra no painel. */
  permissao?: Permissao;
  /** Título mostrado no cabeçalho interno. */
  titulo: string;
  /** Trilha de navegação (sem o item atual). */
  trilha?: { label: string; to?: string }[];
  /** Mostra a pesquisa contextual no cabeçalho. */
  pesquisa?: false | { placeholder: string };
  /** Abre fora do painel (não marca ativo). */
  externo?: boolean;
};

export type GrupoPainel = { id: string; label: string; itens: ItemPainel[] };

export const GRUPOS_PAINEL: GrupoPainel[] = [
  {
    id: "atendimento",
    label: "Atendimento",
    itens: [
      {
        to: "/admin/inicio",
        label: "Início",
        titulo: "Visão geral",
        icone: LayoutDashboard,
      },
      {
        to: "/admin",
        label: "Clientes",
        titulo: "Clientes",
        exact: true,
        permissao: "ver_clientes",
        icone: Users,
        pesquisa: { placeholder: "Buscar por nome ou e-mail" },
      },
      {
        to: "/admin/clientes",
        label: "Planos de acompanhamento",
        titulo: "Planos de acompanhamento",
        permissao: "ver_clientes",
        icone: ClipboardList,
      },
      {
        to: "/admin/monitoramento",
        label: "Monitoramento",
        titulo: "Monitoramento",
        permissao: "ver_clientes",
        icone: Activity,
      },
    ],
  },
  {
    id: "biblioteca",
    label: "Biblioteca",
    itens: [
      {
        to: "/admin/trilhas",
        label: "Trilhas",
        titulo: "Trilhas",
        permissao: "gerenciar_conteudos",
        icone: RouteIcon,
      },
      {
        to: "/admin/conteudos",
        label: "Conteúdos",
        titulo: "Conteúdos",
        permissao: "gerenciar_conteudos",
        icone: Library,
      },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    itens: [
      {
        to: "/admin/pacotes",
        label: "Pacotes",
        titulo: "Pacotes",
        permissao: "gerenciar_pacotes",
        icone: Package,
      },
      {
        to: "/admin/equipe",
        label: "Equipe",
        titulo: "Equipe",
        permissao: "gerenciar_equipe",
        icone: UsersRound,
      },
      {
        to: "/admin/auditoria",
        label: "Auditoria",
        titulo: "Auditoria",
        permissao: "gerenciar_equipe",
        icone: ShieldCheck,
      },
    ],
  },
  {
    id: "utilidades",
    label: "Utilidades",
    itens: [
      {
        to: "/app",
        label: "Ver como cliente",
        titulo: "Ver como cliente",
        icone: Eye,
        externo: true,
      },
      {
        to: "/admin/diagnostico",
        label: "Diagnóstico",
        titulo: "Diagnóstico de desempenho",
        permissao: "gerenciar_equipe",
        icone: Gauge,
      },
      { to: "/admin/ajuda", label: "Ajuda", titulo: "Ajuda", icone: LifeBuoy },
      { to: "/admin/perfil", label: "Perfil", titulo: "Meu perfil", icone: UserCircle },
    ],
  },
];

const TODOS = GRUPOS_PAINEL.flatMap((g) => g.itens).filter((i) => !i.externo);

/** Item que corresponde ao caminho atual (o mais específico primeiro). */
export function itemAtual(pathname: string): ItemPainel | undefined {
  const candidatos = [...TODOS].sort((a, b) => b.to.length - a.to.length);
  return candidatos.find((i) =>
    i.exact ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`),
  );
}

/** Título e trilha do cabeçalho para o caminho atual. */
export function cabecalhoDoCaminho(pathname: string): {
  titulo: string;
  trilha: { label: string; to?: string }[];
  pesquisa: false | { placeholder: string };
} {
  if (pathname.startsWith("/admin/cliente/")) {
    return {
      titulo: "Detalhes do cliente",
      trilha: [{ label: "Atendimento" }, { label: "Clientes", to: "/admin" }],
      pesquisa: false,
    };
  }
  const item = itemAtual(pathname);
  if (!item) return { titulo: "Painel", trilha: [], pesquisa: false };
  const grupo = GRUPOS_PAINEL.find((g) => g.itens.some((i) => i.to === item.to));
  return {
    titulo: item.titulo,
    trilha: grupo ? [{ label: grupo.label }] : [],
    pesquisa: item.pesquisa ?? false,
  };
}

export function iniciaisDe(nome?: string | null, email?: string | null) {
  const base = (nome ?? email ?? "").trim();
  if (!base) return "R";
  const partes = base.split(/[\s@._-]+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letras.join("") || base[0]!.toUpperCase();
}
