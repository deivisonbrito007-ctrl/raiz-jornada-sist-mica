import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Clock, NotebookPen } from "lucide-react";
import { ETAPA_LABEL, type TipoEtapa } from "@/lib/etapas";
import { formatarDuracao } from "@/lib/raiz-format";

export type EtapaJornada = {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipoEtapa?: string | null;
  duracaoSegundos?: number | null;
  ordem: number;
  obrigatoria?: boolean | null;
  prazoDias?: number | null;
  personalizada: boolean;
  status: string;
};

const ROTULO_STATUS: Record<string, string> = {
  concluido: "Concluída",
  em_andamento: "Em andamento",
};

/**
 * As etapas como caminho vertical: marcadores ligados por linha, a etapa atual
 * com halo respirando. Etapas escritas pela terapeuta não têm conteúdo para
 * abrir, então expandem no lugar em vez de navegar.
 */
export function CaminhoEtapas({
  etapas,
  atualId,
  nomeTrilha,
}: {
  etapas: EtapaJornada[];
  atualId: string | null;
  nomeTrilha: string;
}) {
  const concluidas = etapas.filter((e) => e.status === "concluido");
  const [mostrarTudo, setMostrarTudo] = useState(concluidas.length <= 2);
  const visiveis = mostrarTudo ? etapas : etapas.filter((e) => e.status !== "concluido");

  return (
    <div className="mt-5">
      {!mostrarTudo && concluidas.length > 0 && (
        <button
          type="button"
          onClick={() => setMostrarTudo(true)}
          className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-4 text-xs font-medium text-floresta"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Ver as {concluidas.length} etapas já concluídas
        </button>
      )}

      <ol className="relative space-y-1" aria-label={`Etapas da trilha ${nomeTrilha}`}>
        <span
          aria-hidden="true"
          className="absolute bottom-4 left-[15px] top-4 w-px bg-gradient-to-b from-salvia/50 via-border to-transparent"
        />
        {visiveis.map((etapa) => (
          <li key={etapa.id} className="relative pl-11">
            <Marcador status={etapa.status} atual={etapa.id === atualId} />
            {etapa.personalizada ? (
              <EtapaCombinada etapa={etapa} />
            ) : (
              <Link
                to="/app/etapa/$conteudoId"
                params={{ conteudoId: etapa.id }}
                className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-secondary/70"
              >
                <Descricao etapa={etapa} />
                <StatusPilula etapa={etapa} atual={etapa.id === atualId} />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Marcador({ status, atual }: { status: string; atual: boolean }) {
  const concluida = status === "concluido";
  return (
    <span
      aria-hidden="true"
      className={`absolute left-1.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
        concluida
          ? "border-salvia bg-salvia text-floresta-foreground"
          : atual
            ? "animate-respirar border-ocre bg-ocre/25"
            : "border-border bg-card"
      }`}
    >
      {concluida && <Check className="h-3.5 w-3.5" />}
    </span>
  );
}

function Descricao({ etapa }: { etapa: EtapaJornada }) {
  const tipo = etapa.tipoEtapa ? ETAPA_LABEL[etapa.tipoEtapa as TipoEtapa] : null;
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-foreground">
        {etapa.ordem}. {etapa.titulo}
      </p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {tipo && <span>{tipo}</span>}
        {etapa.duracaoSegundos ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatarDuracao(etapa.duracaoSegundos)}
          </span>
        ) : null}
        <span>{etapa.obrigatoria ? "essencial" : "opcional"}</span>
        {etapa.prazoDias ? <span>sugerida em {etapa.prazoDias} dias</span> : null}
      </p>
    </div>
  );
}

function StatusPilula({ etapa, atual }: { etapa: EtapaJornada; atual: boolean }) {
  const rotulo = ROTULO_STATUS[etapa.status] ?? (atual ? "Você está aqui" : "A fazer");
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
        etapa.status === "concluido"
          ? "bg-salvia/20 text-floresta"
          : atual
            ? "bg-ocre/20 text-floresta"
            : "bg-secondary text-muted-foreground"
      }`}
    >
      {rotulo}
    </span>
  );
}

/** Atividade escrita só para este plano: não existe conteúdo para abrir. */
function EtapaCombinada({ etapa }: { etapa: EtapaJornada }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="rounded-2xl bg-secondary/60 px-3 py-2.5">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {etapa.ordem}. {etapa.titulo}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <NotebookPen className="h-3 w-3" aria-hidden="true" />
            Combinado com a terapeuta
            {etapa.prazoDias ? ` · sugerida em ${etapa.prazoDias} dias` : ""}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberta ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {aberta && (
        <p className="mt-2 whitespace-pre-line border-t border-border pt-2 text-sm leading-relaxed text-muted-foreground">
          {etapa.descricao ||
            "Sua terapeuta combinou esta atividade fora do app. Se tiver dúvidas, use o espaço de apoio."}
        </p>
      )}
    </div>
  );
}
