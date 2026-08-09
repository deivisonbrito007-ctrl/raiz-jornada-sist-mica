import { Link } from "@tanstack/react-router";
import {
  UserPlus,
  Route as RouteIcon,
  FilePlus2,
  Sparkles,
  ClipboardCheck,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import type { Permissao } from "@/lib/permissoes";

export type AcaoRapida = {
  label: string;
  to: string;
  icone: LucideIcon;
  permissao?: Permissao;
};

export const ACOES_RAPIDAS: AcaoRapida[] = [
  { label: "Cadastrar cliente", to: "/admin/clientes", icone: UserPlus, permissao: "ver_clientes" },
  {
    label: "Liberar trilha",
    to: "/admin/clientes",
    icone: RouteIcon,
    permissao: "gerenciar_liberacoes",
  },
  {
    label: "Criar conteúdo",
    to: "/admin/conteudos",
    icone: FilePlus2,
    permissao: "gerenciar_conteudos",
  },
  { label: "Criar trilha", to: "/admin/trilhas", icone: Sparkles, permissao: "gerenciar_conteudos" },
  {
    label: "Registrar revisão",
    to: "/admin/acompanhamento",
    icone: ClipboardCheck,
    permissao: "ver_clientes",
  },
  {
    label: "Ver solicitações de apoio",
    to: "/admin/acompanhamento",
    icone: LifeBuoy,
    permissao: "ver_clientes",
  },
];

/** Ações rápidas, já filtradas pelas permissões de quem está no painel. */
export function AcoesRapidas({ pode }: { pode: (p: Permissao) => boolean }) {
  const acoes = ACOES_RAPIDAS.filter((a) => !a.permissao || pode(a.permissao));
  if (acoes.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {acoes.map((a) => (
        <Link
          key={a.label}
          to={a.to}
          className="flex min-h-11 items-center gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-organico)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <a.icone className="size-5 shrink-0 text-salvia" aria-hidden="true" />
          <span className="truncate text-sm font-medium text-floresta">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}
