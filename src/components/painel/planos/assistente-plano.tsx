import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, Check, Eye, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadMidia } from "@/components/AdminConteudos/UploadMidia";
import { FREQUENCIAS, NIVEIS, NIVEL_DESCRICAO, NIVEL_LABEL, type Nivel } from "@/lib/etapas";
import { NIVEL_MARCADORES, planoPrincipalEmCurso, statusLabel } from "@/lib/planos";
import { formatarData, formatarDuracao } from "@/lib/raiz-format";
import {
  etapasDaTrilha,
  montarEnvio,
  planoVazio,
  type ConteudoTrilha,
  type EstadoPlano,
} from "./tipos";
import { EtapasDoPlano } from "./etapas-plano";

export type TrilhaDetalhe = {
  id: string;
  nome: string;
  resumo: string;
  objetivo: string;
  nivel: string;
  prerequisitos: string;
  alertas: string;
  modos: string[] | null;
  eixos?: { nome: string } | null;
};

type PlanoExistente = {
  id: string;
  cliente_id: string;
  trilha_id: string;
  status: EstadoPlano extends never ? never : string;
  data_inicio: string;
  data_revisao: string | null;
  liberar_em: string | null;
};

type Props = {
  aberto: boolean;
  aoFechar: () => void;
  clientes: { id: string; nome: string; email: string }[];
  trilhas: TrilhaDetalhe[];
  conteudos: ConteudoTrilha[];
  planos: PlanoExistente[];
  inicial?: EstadoPlano | null;
  salvando: boolean;
  aoSalvar: (envio: ReturnType<typeof montarEnvio>) => void;
};

const PASSOS = [
  "Cliente",
  "Trilha",
  "Objetivo",
  "Personalização",
  "Cronograma",
  "Profundidade",
  "Revisão",
] as const;

/** Assistente em 7 etapas para criar o plano de acompanhamento. */
export function AssistentePlano({
  aberto,
  aoFechar,
  clientes,
  trilhas,
  conteudos,
  planos,
  inicial,
  salvando,
  aoSalvar,
}: Props) {
  const [passo, setPasso] = useState(0);
  const [plano, setPlano] = useState<EstadoPlano>(inicial ?? planoVazio());
  const [busca, setBusca] = useState("");
  const [previa, setPrevia] = useState(false);
  const [agendarEm, setAgendarEm] = useState("");

  useEffect(() => {
    if (aberto) {
      setPlano(inicial ?? planoVazio());
      setPasso(0);
      setPrevia(false);
      setAgendarEm("");
    }
  }, [aberto, inicial]);

  const trilha = trilhas.find((t) => t.id === plano.trilhaId) ?? null;
  const cliente = clientes.find((c) => c.id === plano.clienteId) ?? null;

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((c) => `${c.nome} ${c.email}`.toLowerCase().includes(termo));
  }, [busca, clientes]);

  const emCurso = plano.clienteId
    ? planoPrincipalEmCurso(
        planos.map((p) => ({ ...p, status: p.status as never })),
        plano.clienteId,
      )
    : undefined;

  const etapasVisiveis = plano.etapas.filter((e) => e.visivel);
  const duracaoTotal = plano.etapas
    .filter((e) => e.visivel)
    .reduce((soma, e) => soma + e.duracaoSegundos, 0);

  function alterar(mudanca: Partial<EstadoPlano>) {
    setPlano((atual) => ({ ...atual, ...mudanca }));
  }

  function escolherTrilha(trilhaId: string) {
    alterar({
      trilhaId,
      etapas: etapasDaTrilha(conteudos, trilhaId),
      nivel: (trilhas.find((t) => t.id === trilhaId)?.nivel as Nivel) ?? plano.nivel,
    });
  }

  function podeAvancar() {
    if (passo === 0) return Boolean(plano.clienteId);
    if (passo === 1) return Boolean(plano.trilhaId);
    if (passo === 4) return Boolean(plano.dataInicio);
    return true;
  }

  function enviar(acao: "rascunho" | "liberar" | "agendar") {
    if (!plano.clienteId || !plano.trilhaId) {
      toast.error("Escolha o cliente e a trilha antes de salvar");
      return;
    }
    if (acao === "agendar" && !agendarEm) {
      toast.error("Informe a data e a hora da liberação");
      return;
    }
    aoSalvar(montarEnvio(plano, acao, agendarEm));
  }

  return (
    <Dialog open={aberto} onOpenChange={(estaAberto) => !estaAberto && aoFechar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {plano.id ? "Editar plano de acompanhamento" : "Criar plano de acompanhamento"}
          </DialogTitle>
          <DialogDescription>
            Etapa {passo + 1} de {PASSOS.length} — {PASSOS[passo]}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-wrap gap-1" aria-label="Etapas do assistente">
          {PASSOS.map((nome, indice) => (
            <li key={nome} className="flex-1">
              <button
                type="button"
                onClick={() => indice <= passo && setPasso(indice)}
                aria-current={indice === passo ? "step" : undefined}
                className={`h-1.5 w-full rounded-full ${
                  indice <= passo ? "bg-floresta" : "bg-secondary"
                }`}
              >
                <span className="sr-only">{nome}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="space-y-4 py-2">
          {/* ETAPA 1 — CLIENTE */}
          {passo === 0 && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="busca-cliente">Buscar cliente</Label>
                <Input
                  id="busca-cliente"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome ou e-mail"
                />
              </div>
              <ul className="max-h-64 space-y-2 overflow-y-auto" role="radiogroup" aria-label="Clientes">
                {clientesFiltrados.map((c) => {
                  const escolhido = plano.clienteId === c.id;
                  const trilhaAtual = planos.find(
                    (p) => p.cliente_id === c.id && p.status !== "rascunho",
                  );
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={escolhido}
                        onClick={() => alterar({ clienteId: c.id })}
                        className={`w-full rounded-2xl border p-4 text-left ${
                          escolhido ? "border-floresta bg-secondary" : "border-border bg-card"
                        }`}
                      >
                        <p className="font-medium text-foreground">{c.nome || c.email}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                        <p className="mt-1 text-xs text-salvia">
                          {trilhaAtual
                            ? `Trilha atual: ${trilhas.find((t) => t.id === trilhaAtual.trilha_id)?.nome ?? "trilha"} · ${statusLabel(trilhaAtual)}`
                            : "Sem plano em curso"}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {emCurso && (
                <p
                  role="status"
                  className="flex items-start gap-2 rounded-2xl bg-terracota/10 p-4 text-sm text-terracota"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Esta pessoa já tem um plano principal em andamento (
                  {trilhas.find((t) => t.id === emCurso.trilha_id)?.nome ?? "trilha"}). Você pode
                  seguir, se for essa a sua indicação.
                </p>
              )}
            </div>
          )}

          {/* ETAPA 2 — TRILHA */}
          {passo === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                A escolha da trilha é sempre sua. O sistema não sugere caminhos automaticamente.
              </p>
              <ul className="space-y-2" role="radiogroup" aria-label="Trilhas publicadas">
                {trilhas.map((t) => {
                  const escolhida = plano.trilhaId === t.id;
                  const etapas = conteudos.filter((c) => c.trilha_id === t.id);
                  const duracao = etapas.reduce((s, c) => s + c.duracao_segundos, 0);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={escolhida}
                        onClick={() => escolherTrilha(t.id)}
                        className={`w-full rounded-2xl border p-4 text-left ${
                          escolhida ? "border-floresta bg-secondary" : "border-border bg-card"
                        }`}
                      >
                        <p className="font-medium text-foreground">{t.nome}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {NIVEL_LABEL[t.nivel as Nivel]} · {etapas.length} etapa(s)
                          {duracao > 0 ? ` · ${formatarDuracao(duracao)}` : ""}
                        </p>
                        {t.resumo && <p className="mt-2 text-sm text-muted-foreground">{t.resumo}</p>}
                        {t.prerequisitos && (
                          <p className="mt-2 text-xs text-salvia">Pré-requisitos: {t.prerequisitos}</p>
                        )}
                        {t.alertas && (
                          <p className="mt-1 text-xs text-terracota">Atenção: {t.alertas}</p>
                        )}
                      </button>
                    </li>
                  );
                })}
                {trilhas.length === 0 && (
                  <li className="rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground">
                    Publique uma trilha para poder criar um plano.
                  </li>
                )}
              </ul>
              {trilha && (
                <details className="rounded-2xl border border-border p-4">
                  <summary className="cursor-pointer text-sm font-medium text-floresta">
                    Visualizar a trilha antes de atribuir
                  </summary>
                  <ol className="mt-3 space-y-2 text-sm">
                    {conteudos
                      .filter((c) => c.trilha_id === trilha.id)
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((c, i) => (
                        <li key={c.id} className="rounded-xl bg-secondary/60 px-3 py-2">
                          <span className="font-medium">{i + 1}. {c.titulo}</span>
                          {c.descricao && (
                            <p className="text-xs text-muted-foreground">{c.descricao}</p>
                          )}
                        </li>
                      ))}
                  </ol>
                </details>
              )}
            </div>
          )}

          {/* ETAPA 3 — OBJETIVO */}
          {passo === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="objetivo">Objetivo personalizado</Label>
                <Textarea
                  id="objetivo"
                  rows={3}
                  value={plano.objetivo}
                  onChange={(e) => alterar({ objetivo: e.target.value })}
                  placeholder="O que este plano busca cuidar nesta fase"
                />
              </div>
              <div>
                <Label htmlFor="motivo">Motivo da indicação</Label>
                <Textarea
                  id="motivo"
                  rows={2}
                  value={plano.motivoIndicacao}
                  onChange={(e) => alterar({ motivoIndicacao: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="orientacao">Orientação escrita para a pessoa</Label>
                <Textarea
                  id="orientacao"
                  rows={3}
                  value={plano.mensagem}
                  onChange={(e) => alterar({ mensagem: e.target.value })}
                />
              </div>
              <UploadMidia
                eixoId="planos"
                variante="midia"
                accept="audio/*"
                caminhoAtual={plano.audioPath}
                onEnviado={(caminho) => alterar({ audioPath: caminho })}
                onRemover={() => alterar({ audioPath: null })}
              />
              <div>
                <Label htmlFor="orientacoes-especiais">Orientações especiais</Label>
                <Textarea
                  id="orientacoes-especiais"
                  rows={2}
                  value={plano.orientacoesEspeciais}
                  onChange={(e) => alterar({ orientacoesEspeciais: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* ETAPA 4 — PERSONALIZAÇÃO */}
          {passo === 3 && (
            <EtapasDoPlano etapas={plano.etapas} aoMudar={(etapas) => alterar({ etapas })} />
          )}

          {/* ETAPA 5 — CRONOGRAMA */}
          {passo === 4 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="data-inicio">Data de início</Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={plano.dataInicio}
                  onChange={(e) => alterar({ dataInicio: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="data-revisao">Data de revisão</Label>
                <Input
                  id="data-revisao"
                  type="date"
                  value={plano.dataRevisao}
                  onChange={(e) => alterar({ dataRevisao: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="frequencia">Frequência</Label>
                <select
                  id="frequencia"
                  className="min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"
                  value={plano.frequencia}
                  onChange={(e) => alterar({ frequencia: e.target.value })}
                >
                  {FREQUENCIAS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={plano.lembretesAtivos}
                  onChange={(e) => alterar({ lembretesAtivos: e.target.checked })}
                />
                Enviar lembretes de prática para esta pessoa
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                O prazo de cada etapa é definido na etapa de personalização, em dias após o início.
              </p>
            </div>
          )}

          {/* ETAPA 6 — PROFUNDIDADE */}
          {passo === 5 && (
            <div className="space-y-4">
              <fieldset>
                <legend className="text-sm font-medium text-floresta">Nível de profundidade</legend>
                <div className="mt-2 grid gap-2">
                  {NIVEIS.map((n) => (
                    <label
                      key={n}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                        plano.nivel === n ? "border-floresta bg-secondary" : "border-border"
                      }`}
                    >
                      <input
                        type="radio"
                        name="nivel"
                        className="mt-1"
                        checked={plano.nivel === n}
                        onChange={() => alterar({ nivel: n })}
                      />
                      <span>
                        <span className="block font-medium text-foreground">{NIVEL_LABEL[n]}</span>
                        <span className="block text-xs text-muted-foreground">
                          {NIVEL_DESCRICAO[n]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium text-floresta">Como pode ser praticado</legend>
                <div className="mt-2 space-y-2">
                  {NIVEL_MARCADORES.map((m) => (
                    <label key={m.chave} className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={Boolean(plano[m.chave])}
                        onChange={(e) => alterar({ [m.chave]: e.target.checked } as Partial<EstadoPlano>)}
                      />
                      <span>
                        <span className="block text-foreground">{m.label}</span>
                        <span className="block text-xs text-muted-foreground">{m.ajuda}</span>
                      </span>
                    </label>
                  ))}
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={plano.permiteRepetir}
                      onChange={(e) => alterar({ permiteRepetir: e.target.checked })}
                    />
                    <span className="text-foreground">Pode repetir as práticas deste plano</span>
                  </label>
                </div>
              </fieldset>
            </div>
          )}

          {/* ETAPA 7 — REVISÃO */}
          {passo === 6 && (
            <div className="space-y-4">
              <dl className="grid gap-3 rounded-2xl bg-secondary/60 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Cliente</dt>
                  <dd className="text-foreground">{cliente?.nome || cliente?.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Trilha</dt>
                  <dd className="text-foreground">{trilha?.nome ?? "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Objetivo</dt>
                  <dd className="text-foreground">{plano.objetivo || "Sem objetivo escrito"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Nível</dt>
                  <dd className="text-foreground">{NIVEL_LABEL[plano.nivel]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Frequência</dt>
                  <dd className="text-foreground">{plano.frequencia}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Início</dt>
                  <dd className="text-foreground">{formatarData(plano.dataInicio)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Revisão</dt>
                  <dd className="text-foreground">
                    {plano.dataRevisao ? formatarData(plano.dataRevisao) : "Sem data"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Etapas</dt>
                  <dd className="text-foreground">
                    {etapasVisiveis.length} visível(is) de {plano.etapas.length}
                    {duracaoTotal > 0 ? ` · ${formatarDuracao(duracaoTotal)}` : ""}
                  </dd>
                </div>
              </dl>

              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-full"
                onClick={() => setPrevia((v) => !v)}
                aria-expanded={previa}
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                {previa ? "Fechar visualização" : "Visualizar como cliente"}
              </Button>

              {previa && (
                <div className="rounded-3xl border border-border bg-card p-5">
                  <h3 className="font-display text-lg text-floresta">{trilha?.nome}</h3>
                  {plano.mensagem && <p className="mt-2 text-sm text-foreground">{plano.mensagem}</p>}
                  <ol className="mt-3 space-y-2 text-sm">
                    {etapasVisiveis.map((e, i) => (
                      <li key={e.chave} className="rounded-xl bg-secondary/60 px-3 py-2">
                        {i + 1}. {e.titulo || "Atividade combinada"}
                        {e.obrigatoria ? "" : " (opcional)"}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="agendar-em">Agendar liberação para</Label>
                <Input
                  id="agendar-em"
                  type="datetime-local"
                  value={agendarEm}
                  onChange={(e) => setAgendarEm(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 rounded-full"
                  disabled={salvando}
                  onClick={() => enviar("rascunho")}
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Salvar rascunho
                </Button>
                <Button
                  type="button"
                  className="min-h-11 rounded-full"
                  disabled={salvando}
                  onClick={() => enviar("liberar")}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Liberar agora
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 rounded-full"
                  disabled={salvando}
                  onClick={() => enviar("agendar")}
                >
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  Agendar liberação
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 rounded-full"
            disabled={passo === 0}
            onClick={() => setPasso((p) => Math.max(0, p - 1))}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar
          </Button>
          {passo < PASSOS.length - 1 && (
            <Button
              type="button"
              className="min-h-11 rounded-full"
              disabled={!podeAvancar()}
              onClick={() => setPasso((p) => Math.min(PASSOS.length - 1, p + 1))}
            >
              Continuar
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
