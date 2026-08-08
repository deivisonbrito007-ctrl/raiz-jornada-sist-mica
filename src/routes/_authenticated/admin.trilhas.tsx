import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  adminApagarEtapa,
  adminDuplicarTrilha,
  adminListarTrilhas,
  adminReordenarEtapas,
  adminSalvarEtapa,
  adminSalvarTrilha,
} from "@/lib/trilhas.functions";
import {
  ETAPA_DESCRICAO,
  ETAPA_LABEL,
  NIVEIS,
  NIVEL_LABEL,
  STATUS_TRILHA,
  STATUS_TRILHA_LABEL,
  TIPOS_ETAPA,
  type Nivel,
  type StatusTrilha,
  type TipoEtapa,
} from "@/lib/etapas";

export const Route = createFileRoute("/_authenticated/admin/trilhas")({
  head: () => ({
    meta: [
      { title: "Trilhas terapêuticas — Raiz" },
      {
        name: "description",
        content:
          "Crie, revise e publique trilhas terapêuticas com etapas guiadas para o acompanhamento entre sessões.",
      },
      { property: "og:title", content: "Trilhas terapêuticas — Raiz" },
      {
        property: "og:description",
        content: "Gerenciador de trilhas guiadas do acompanhamento Raiz.",
      },
    ],
  }),
  component: AdminTrilhas,
});

const campoClasse =
  "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground";

type FormTrilha = {
  id?: string;
  eixoId: string;
  nome: string;
  resumo: string;
  objetivo: string;
  nivel: Nivel;
  status: StatusTrilha;
  prerequisitos: string;
  alertas: string;
  orientacoesPausa: string;
};

type FormEtapa = {
  id?: string;
  trilhaId: string;
  tipoEtapa: TipoEtapa;
  tipo: "video" | "audio" | "exercicio" | "texto" | "tarefa";
  titulo: string;
  descricao: string;
  corpoTexto: string;
  duracaoMinutos: number;
  obrigatoria: boolean;
  materiais: string;
  localRecomendado: string;
  sensibilidades: string;
  criteriosInterrupcao: string;
  permiteRepetir: boolean;
};

function AdminTrilhas() {
  const queryClient = useQueryClient();
  const carregar = useServerFn(adminListarTrilhas);
  const salvarTrilha = useServerFn(adminSalvarTrilha);
  const duplicar = useServerFn(adminDuplicarTrilha);
  const salvarEtapa = useServerFn(adminSalvarEtapa);
  const reordenar = useServerFn(adminReordenarEtapas);
  const apagarEtapa = useServerFn(adminApagarEtapa);

  const { data, isLoading } = useQuery({ queryKey: ["admin-trilhas"], queryFn: () => carregar() });

  const [formTrilha, setFormTrilha] = useState<FormTrilha | null>(null);
  const [formEtapa, setFormEtapa] = useState<FormEtapa | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["admin-trilhas"] });

  const mutTrilha = useMutation({
    mutationFn: salvarTrilha,
    onSuccess: () => {
      toast.success("Trilha salva");
      setFormTrilha(null);
      void invalidar();
    },
    onError: () => toast.error("Não foi possível salvar a trilha"),
  });

  const mutEtapa = useMutation({
    mutationFn: salvarEtapa,
    onSuccess: () => {
      toast.success("Etapa salva");
      setFormEtapa(null);
      void invalidar();
    },
    onError: () => toast.error("Não foi possível salvar a etapa"),
  });

  const mutDuplicar = useMutation({
    mutationFn: duplicar,
    onSuccess: () => {
      toast.success("Trilha duplicada como rascunho");
      void invalidar();
    },
  });

  const mutReordenar = useMutation({ mutationFn: reordenar, onSuccess: () => void invalidar() });
  const mutApagar = useMutation({
    mutationFn: apagarEtapa,
    onSuccess: () => {
      toast.success("Etapa removida");
      void invalidar();
    },
  });

  const eixos = data?.eixos ?? [];
  const trilhas = useMemo(() => data?.trilhas ?? [], [data]);

  function novaTrilha() {
    setFormTrilha({
      eixoId: eixos[0]?.id ?? "",
      nome: "",
      resumo: "",
      objetivo: "",
      nivel: "leve",
      status: "rascunho",
      prerequisitos: "",
      alertas: "",
      orientacoesPausa: "",
    });
  }

  function etapasDe(trilhaId: string) {
    return (data?.etapas ?? [])
      .filter((e) => e.trilha_id === trilhaId)
      .sort((a, b) => a.ordem - b.ordem);
  }

  function mover(trilhaId: string, etapaId: string, direcao: -1 | 1) {
    const lista = etapasDe(trilhaId);
    const i = lista.findIndex((e) => e.id === etapaId);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= lista.length) return;
    const nova = [...lista];
    const [item] = nova.splice(i, 1);
    nova.splice(j, 0, item);
    mutReordenar.mutate({
      data: { trilhaId, ordens: nova.map((e, idx) => ({ id: e.id, ordem: idx })) },
    });
  }

  return (
    <section className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl text-floresta">Trilhas terapêuticas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monte a sequência de etapas de cada trilha e publique quando estiver pronta.
          </p>
        </div>
        <Button onClick={novaTrilha} className="min-h-11 shrink-0 rounded-full">
          <Plus className="h-4 w-4" />
          Nova trilha
        </Button>
      </header>

      {isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando trilhas...
        </p>
      )}

      {!isLoading && trilhas.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Nenhuma trilha criada ainda</p>
          <p className="mt-1">
            Comece criando uma trilha para uma área da vida e acrescente as etapas na ordem em que o
            cliente vai percorrer.
          </p>
        </div>
      )}

      <ul className="space-y-4">
        {trilhas.map((trilha) => {
          const etapas = etapasDe(trilha.id);
          const aberta = expandida === trilha.id;
          return (
            <li
              key={trilha.id}
              className="rounded-3xl border border-border bg-card p-5 shadow-organico"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-salvia">
                    {eixos.find((e) => e.id === trilha.eixo_id)?.nome ?? "Área"}
                  </p>
                  <h2 className="truncate font-display text-lg text-floresta">{trilha.nome}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{trilha.resumo}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
                      {STATUS_TRILHA_LABEL[trilha.status as StatusTrilha]}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
                      {NIVEL_LABEL[trilha.nivel as Nivel]}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
                      {etapas.length} etapa(s)
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
                      versão {trilha.versao}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button
                    variant="secondary"
                    className="min-h-11 rounded-full"
                    onClick={() => setExpandida(aberta ? null : trilha.id)}
                    aria-expanded={aberta}
                  >
                    {aberta ? "Fechar etapas" : "Ver etapas"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar a trilha ${trilha.nome}`}
                    className="min-h-11 min-w-11 rounded-full"
                    onClick={() =>
                      setFormTrilha({
                        id: trilha.id,
                        eixoId: trilha.eixo_id,
                        nome: trilha.nome,
                        resumo: trilha.resumo,
                        objetivo: trilha.objetivo,
                        nivel: trilha.nivel as Nivel,
                        status: trilha.status as StatusTrilha,
                        prerequisitos: trilha.prerequisitos,
                        alertas: trilha.alertas,
                        orientacoesPausa: trilha.orientacoes_pausa,
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Duplicar a trilha ${trilha.nome}`}
                    className="min-h-11 min-w-11 rounded-full"
                    onClick={() => mutDuplicar.mutate({ data: { trilhaId: trilha.id } })}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {aberta && (
                <div className="mt-5 border-t border-border pt-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <h3 className="font-display text-base text-floresta">Etapas da trilha</h3>
                    <Button
                      variant="secondary"
                      className="min-h-11 shrink-0 rounded-full"
                      onClick={() =>
                        setFormEtapa({
                          trilhaId: trilha.id,
                          tipoEtapa: "orientacao",
                          tipo: "texto",
                          titulo: "",
                          descricao: "",
                          corpoTexto: "",
                          duracaoMinutos: 5,
                          obrigatoria: true,
                          materiais: "",
                          localRecomendado: "",
                          sensibilidades: "",
                          criteriosInterrupcao: "",
                          permiteRepetir: true,
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Nova etapa
                    </Button>
                  </div>

                  {etapas.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Nenhuma etapa ainda. A primeira etapa costuma ser a orientação inicial.
                    </p>
                  ) : (
                    <ol className="mt-3 space-y-2">
                      {etapas.map((etapa, indice) => (
                        <li
                          key={etapa.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-secondary px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-wider text-salvia">
                              {indice + 1}.{" "}
                              {ETAPA_LABEL[etapa.tipo_etapa as TipoEtapa] ?? "Etapa"}
                              {!etapa.obrigatoria && " · opcional"}
                            </p>
                            <p className="truncate text-sm font-medium text-foreground">
                              {etapa.titulo}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="min-h-11 min-w-11 rounded-full"
                              aria-label={`Mover ${etapa.titulo} para cima`}
                              onClick={() => mover(trilha.id, etapa.id, -1)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="min-h-11 min-w-11 rounded-full"
                              aria-label={`Mover ${etapa.titulo} para baixo`}
                              onClick={() => mover(trilha.id, etapa.id, 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="min-h-11 min-w-11 rounded-full"
                              aria-label={`Editar ${etapa.titulo}`}
                              onClick={() =>
                                setFormEtapa({
                                  id: etapa.id,
                                  trilhaId: trilha.id,
                                  tipoEtapa: (etapa.tipo_etapa ?? "orientacao") as TipoEtapa,
                                  tipo: etapa.tipo as FormEtapa["tipo"],
                                  titulo: etapa.titulo,
                                  descricao: etapa.descricao,
                                  corpoTexto: etapa.corpo_texto ?? "",
                                  duracaoMinutos: Math.round(etapa.duracao_segundos / 60),
                                  obrigatoria: etapa.obrigatoria,
                                  materiais: etapa.materiais,
                                  localRecomendado: etapa.local_recomendado,
                                  sensibilidades: etapa.sensibilidades,
                                  criteriosInterrupcao: etapa.criterios_interrupcao,
                                  permiteRepetir: etapa.permite_repetir,
                                })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="min-h-11 min-w-11 rounded-full text-destructive"
                              aria-label={`Remover ${etapa.titulo}`}
                              onClick={() => mutApagar.mutate({ data: { etapaId: etapa.id } })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={Boolean(formTrilha)} onOpenChange={(aberto) => !aberto && setFormTrilha(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {formTrilha?.id ? "Editar trilha" : "Nova trilha"}
            </DialogTitle>
          </DialogHeader>
          {formTrilha && (
            <form
              className="space-y-4"
              onSubmit={(evento) => {
                evento.preventDefault();
                mutTrilha.mutate({
                  data: {
                    ...(formTrilha.id ? { id: formTrilha.id } : {}),
                    eixoId: formTrilha.eixoId,
                    nome: formTrilha.nome,
                    resumo: formTrilha.resumo,
                    objetivo: formTrilha.objetivo,
                    nivel: formTrilha.nivel,
                    status: formTrilha.status,
                    prerequisitos: formTrilha.prerequisitos,
                    alertas: formTrilha.alertas,
                    orientacoesPausa: formTrilha.orientacoesPausa,
                    ordem: 0,
                  },
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="trilha-nome">Nome</Label>
                  <Input
                    id="trilha-nome"
                    required
                    value={formTrilha.nome}
                    onChange={(e) => setFormTrilha({ ...formTrilha, nome: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="trilha-eixo">Área da vida</Label>
                  <select
                    id="trilha-eixo"
                    className={campoClasse}
                    value={formTrilha.eixoId}
                    onChange={(e) => setFormTrilha({ ...formTrilha, eixoId: e.target.value })}
                  >
                    {eixos.map((eixo) => (
                      <option key={eixo.id} value={eixo.id}>
                        {eixo.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="trilha-nivel">Nível de profundidade</Label>
                  <select
                    id="trilha-nivel"
                    className={campoClasse}
                    value={formTrilha.nivel}
                    onChange={(e) =>
                      setFormTrilha({ ...formTrilha, nivel: e.target.value as Nivel })
                    }
                  >
                    {NIVEIS.map((nivel) => (
                      <option key={nivel} value={nivel}>
                        {NIVEL_LABEL[nivel]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="trilha-status">Status</Label>
                  <select
                    id="trilha-status"
                    className={campoClasse}
                    value={formTrilha.status}
                    onChange={(e) =>
                      setFormTrilha({ ...formTrilha, status: e.target.value as StatusTrilha })
                    }
                  >
                    {STATUS_TRILHA.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_TRILHA_LABEL[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="trilha-resumo">Resumo para o cliente</Label>
                <Textarea
                  id="trilha-resumo"
                  rows={2}
                  value={formTrilha.resumo}
                  onChange={(e) => setFormTrilha({ ...formTrilha, resumo: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="trilha-objetivo">Objetivo terapêutico</Label>
                <Textarea
                  id="trilha-objetivo"
                  rows={2}
                  value={formTrilha.objetivo}
                  onChange={(e) => setFormTrilha({ ...formTrilha, objetivo: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="trilha-prereq">Pré-requisitos</Label>
                  <Textarea
                    id="trilha-prereq"
                    rows={2}
                    value={formTrilha.prerequisitos}
                    onChange={(e) =>
                      setFormTrilha({ ...formTrilha, prerequisitos: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="trilha-alertas">Alertas e cuidados</Label>
                  <Textarea
                    id="trilha-alertas"
                    rows={2}
                    value={formTrilha.alertas}
                    onChange={(e) => setFormTrilha({ ...formTrilha, alertas: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="trilha-pausa">Orientações de pausa</Label>
                <Textarea
                  id="trilha-pausa"
                  rows={2}
                  value={formTrilha.orientacoesPausa}
                  onChange={(e) =>
                    setFormTrilha({ ...formTrilha, orientacoesPausa: e.target.value })
                  }
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 rounded-full"
                  onClick={() => setFormTrilha(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="min-h-11 rounded-full" disabled={mutTrilha.isPending}>
                  Salvar trilha
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(formEtapa)} onOpenChange={(aberto) => !aberto && setFormEtapa(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {formEtapa?.id ? "Editar etapa" : "Nova etapa"}
            </DialogTitle>
          </DialogHeader>
          {formEtapa && (
            <form
              className="space-y-4"
              onSubmit={(evento) => {
                evento.preventDefault();
                const trilha = trilhas.find((t) => t.id === formEtapa.trilhaId);
                if (!trilha) return;
                const etapas = etapasDe(formEtapa.trilhaId);
                mutEtapa.mutate({
                  data: {
                    ...(formEtapa.id ? { id: formEtapa.id } : {}),
                    trilhaId: formEtapa.trilhaId,
                    eixoId: trilha.eixo_id,
                    tipo: formEtapa.tipo,
                    tipoEtapa: formEtapa.tipoEtapa,
                    titulo: formEtapa.titulo,
                    descricao: formEtapa.descricao,
                    corpoTexto: formEtapa.corpoTexto || null,
                    duracaoSegundos: Math.max(0, Math.round(formEtapa.duracaoMinutos * 60)),
                    ordem: formEtapa.id
                      ? (etapas.find((e) => e.id === formEtapa.id)?.ordem ?? 0)
                      : etapas.length,
                    obrigatoria: formEtapa.obrigatoria,
                    materiais: formEtapa.materiais,
                    localRecomendado: formEtapa.localRecomendado,
                    sensibilidades: formEtapa.sensibilidades,
                    transcricao: "",
                    criteriosInterrupcao: formEtapa.criteriosInterrupcao,
                    permiteRepetir: formEtapa.permiteRepetir,
                  },
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="etapa-tipo-etapa">Tipo de etapa</Label>
                  <select
                    id="etapa-tipo-etapa"
                    className={campoClasse}
                    value={formEtapa.tipoEtapa}
                    onChange={(e) =>
                      setFormEtapa({ ...formEtapa, tipoEtapa: e.target.value as TipoEtapa })
                    }
                  >
                    {TIPOS_ETAPA.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {ETAPA_LABEL[tipo]}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ETAPA_DESCRICAO[formEtapa.tipoEtapa]}
                  </p>
                </div>
                <div>
                  <Label htmlFor="etapa-formato">Formato</Label>
                  <select
                    id="etapa-formato"
                    className={campoClasse}
                    value={formEtapa.tipo}
                    onChange={(e) =>
                      setFormEtapa({ ...formEtapa, tipo: e.target.value as FormEtapa["tipo"] })
                    }
                  >
                    <option value="texto">Texto</option>
                    <option value="audio">Áudio</option>
                    <option value="video">Vídeo</option>
                    <option value="exercicio">Exercício</option>
                    <option value="tarefa">Tarefa</option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A mídia é enviada na aba Conteúdos depois de criar a etapa.
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="etapa-titulo">Título</Label>
                <Input
                  id="etapa-titulo"
                  required
                  value={formEtapa.titulo}
                  onChange={(e) => setFormEtapa({ ...formEtapa, titulo: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="etapa-descricao">Instrução em tela</Label>
                <Textarea
                  id="etapa-descricao"
                  rows={3}
                  value={formEtapa.descricao}
                  onChange={(e) => setFormEtapa({ ...formEtapa, descricao: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="etapa-corpo">Conteúdo de texto (opcional)</Label>
                <Textarea
                  id="etapa-corpo"
                  rows={4}
                  value={formEtapa.corpoTexto}
                  onChange={(e) => setFormEtapa({ ...formEtapa, corpoTexto: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="etapa-duracao">Duração (min)</Label>
                  <Input
                    id="etapa-duracao"
                    type="number"
                    min={0}
                    max={240}
                    value={formEtapa.duracaoMinutos}
                    onChange={(e) =>
                      setFormEtapa({ ...formEtapa, duracaoMinutos: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="etapa-local">Local recomendado</Label>
                  <Input
                    id="etapa-local"
                    value={formEtapa.localRecomendado}
                    onChange={(e) =>
                      setFormEtapa({ ...formEtapa, localRecomendado: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="etapa-materiais">Materiais</Label>
                  <Input
                    id="etapa-materiais"
                    value={formEtapa.materiais}
                    onChange={(e) => setFormEtapa({ ...formEtapa, materiais: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="etapa-sensibilidades">Sensibilidades</Label>
                  <Textarea
                    id="etapa-sensibilidades"
                    rows={2}
                    value={formEtapa.sensibilidades}
                    onChange={(e) =>
                      setFormEtapa({ ...formEtapa, sensibilidades: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="etapa-interrupcao">Critérios de interrupção</Label>
                  <Textarea
                    id="etapa-interrupcao"
                    rows={2}
                    value={formEtapa.criteriosInterrupcao}
                    onChange={(e) =>
                      setFormEtapa({ ...formEtapa, criteriosInterrupcao: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={formEtapa.obrigatoria}
                    onCheckedChange={(v) =>
                      setFormEtapa({ ...formEtapa, obrigatoria: v === true })
                    }
                  />
                  Etapa obrigatória
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={formEtapa.permiteRepetir}
                    onCheckedChange={(v) =>
                      setFormEtapa({ ...formEtapa, permiteRepetir: v === true })
                    }
                  />
                  Pode repetir
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 rounded-full"
                  onClick={() => setFormEtapa(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="min-h-11 rounded-full" disabled={mutEtapa.isPending}>
                  Salvar etapa
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
