import { useState } from "react";
import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FUNCAO_LABEL, FUNCOES_EQUIPE, STATUS_LABEL, STATUS_EQUIPE } from "@/lib/equipe-funcoes";
import { LinhaMembro } from "./linha-membro";
import type { MembroEquipe } from "./tipos";

export function ListaMembros({
  membros,
  meuId,
  onEditarFuncao,
  onVincular,
  onAlterarStatus,
  onRemover,
}: {
  membros: MembroEquipe[];
  meuId: string;
  onEditarFuncao: (m: MembroEquipe) => void;
  onVincular: (m: MembroEquipe) => void;
  onAlterarStatus: (m: MembroEquipe, status: "ativo" | "suspenso") => void;
  onRemover: (m: MembroEquipe) => void;
}) {
  const [busca, setBusca] = useState("");
  const [funcao, setFuncao] = useState<string>("todas");
  const [status, setStatus] = useState<string>("todos");

  const termo = busca.trim().toLowerCase();
  const lista = membros.filter((m) => {
    const casaBusca =
      !termo || m.nome.toLowerCase().includes(termo) || m.email.toLowerCase().includes(termo);
    const casaFuncao = funcao === "todas" || m.funcao === funcao;
    const casaStatus = status === "todos" || m.status === status;
    return casaBusca && casaFuncao && casaStatus;
  });

  return (
    <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
      <h2 className="flex items-center gap-2 text-xl text-floresta">
        <Users className="h-5 w-5 text-salvia" /> Integrantes
      </h2>

      <div className="mt-4 flex flex-wrap gap-3">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar integrante"
          className="max-w-xs rounded-full"
        />
        <label className="sr-only" htmlFor="filtro-funcao">
          Filtrar por função
        </label>
        <select
          id="filtro-funcao"
          value={funcao}
          onChange={(e) => setFuncao(e.target.value)}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm text-floresta"
        >
          <option value="todas">Todas as funções</option>
          {FUNCOES_EQUIPE.map((f) => (
            <option key={f} value={f}>
              {FUNCAO_LABEL[f]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="filtro-status">
          Filtrar por situação
        </label>
        <select
          id="filtro-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm text-floresta"
        >
          <option value="todos">Todas as situações</option>
          {STATUS_EQUIPE.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <ul className="mt-4 space-y-3">
        {lista.map((m) => (
          <LinhaMembro
            key={m.userId}
            membro={m}
            souEu={m.userId === meuId}
            onEditarFuncao={() => onEditarFuncao(m)}
            onVincular={() => onVincular(m)}
            onAlterarStatus={(s) => onAlterarStatus(m, s)}
            onRemover={() => onRemover(m)}
          />
        ))}
        {lista.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhum integrante com esses filtros.
          </li>
        )}
      </ul>
    </section>
  );
}
