import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LayoutGrid, List, Plus } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { mensagemPainel } from "@/lib/erro-permissao";
import { useMinhasPermissoes } from "@/hooks/use-minhas-permissoes";
import { ControlePermitido, SecaoSemPermissao } from "@/components/permissao-ui";
import {
  useConteudos,
  type ConteudoAdmin,
  type ConteudoStatus,
} from "@/hooks/useConteudos";
import {
  FILTROS_VAZIOS,
  FilterBar,
  temFiltroAtivo,
  type FiltrosConteudos,
} from "@/components/AdminConteudos/FilterBar";
import { ConteudoCard } from "@/components/AdminConteudos/ConteudoCard";
import { ConteudoGrade } from "@/components/AdminConteudos/ConteudoGrade";
import { PreviaConteudo } from "@/components/AdminConteudos/PreviaConteudo";
import { PainelTrilhasRelacionadas } from "@/components/AdminConteudos/PainelTrilhasRelacionadas";
import {
  ConteudoFormDialog,
  formularioVazio,
  type FormularioConteudo,
} from "@/components/AdminConteudos/ConteudoFormDialog";
import { BatchActionsToolbar } from "@/components/AdminConteudos/BatchActionsToolbar";
import { EmptyState } from "@/components/AdminConteudos/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/conteudos")({
  component: AdminConteudos,
  head: () => ({
    meta: [
      { title: "Biblioteca de conteúdos | Raiz" },
      {
        name: "description",
        content:
          "Biblioteca de materiais reutilizáveis: áudios, meditações, exercícios e textos usados nas trilhas.",
      },
    ],
  }),
});

/** Converte um registro do banco no formulário completo de edição. */
function paraFormulario(c: ConteudoAdmin): FormularioConteudo {
  return {
    id: c.id,
    eixoId: c.eixo_id,
    tipo: c.tipo,
    titulo: c.titulo,
    descricao: c.descricao ?? "",
    objetivo: c.objetivo ?? "",
    instrucoes: c.instrucoes ?? "",
    perguntasIntegracao: c.perguntas_integracao ?? "",
    materiais: c.materiais ?? "",
    sensibilidades: c.sensibilidades ?? "",
    orientacoesPausa: c.criterios_interrupcao ?? "",
    transcricao: c.transcricao ?? "",
    legendasPath: c.legendas_path ?? "",
    corpoTexto: c.corpo_texto ?? "",
    storagePath: c.storage_path ?? "",
    thumbnailPath: c.thumbnail_path ?? "",
    duracaoSegundos: c.duracao_segundos,
    ordem: c.ordem,
    nivel: c.nivel ?? "leve",
    status: c.status ?? "rascunho",
    versao: c.versao ?? 1,
    autorId: c.autor_id ?? "",
    revisorId: c.revisor_id ?? "",
    dataRevisao: (c.data_revisao ?? "").slice(0, 10),
  };
}

function AdminConteudos() {
  const { pode, carregando } = useMinhasPermissoes();
  const podeGerenciar = pode("gerenciar_conteudos");

  const {
    conteudos,
    eixos,
    pessoas,
    salvar,
    salvando,
    apagar,
    duplicar,
    mudarStatus,
    mudandoStatus,
    batchDelete,
    excluindoLote,
    moverParaEixo,
    movendo,
    reorder,
  } = useConteudos(podeGerenciar);

  const [filtros, setFiltros] = useState<FiltrosConteudos>(FILTROS_VAZIOS);
  const [form, setForm] = useState<FormularioConteudo | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [ordemLocal, setOrdemLocal] = useState<Record<string, string[]>>({});
  const [visao, setVisao] = useState<"lista" | "grade">("lista");
  const [previa, setPrevia] = useState<ConteudoAdmin | null>(null);
  const [trilhasDe, setTrilhasDe] = useState<ConteudoAdmin | null>(null);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const termo = filtros.busca.trim().toLowerCase();
  const filtrando = temFiltroAtivo(filtros);

  /** Só materiais da biblioteca: etapas internas de trilha ficam na aba Trilhas. */
  const biblioteca = useMemo(() => conteudos.filter((c) => !c.trilha_id), [conteudos]);

  /** Quantas trilhas usam cada material (etapa direta ou cópia editável). */
  const usoPorConteudo = useMemo(() => {
    const mapa = new Map<string, Set<string>>();
    for (const c of conteudos) {
      if (!c.trilha_id) continue;
      const origem = c.conteudo_origem_id ?? c.id;
      if (!mapa.has(origem)) mapa.set(origem, new Set());
      mapa.get(origem)!.add(c.trilha_id);
    }
    return mapa;
  }, [conteudos]);

  const nomeEixo = (id: string) => eixos.find((e) => e.id === id)?.nome ?? "—";
  const nomePessoa = (id?: string | null) => {
    if (!id) return "—";
    const p = pessoas.find((x) => x.id === id);
    return p?.nome || p?.email || "—";
  };
  const trilhasUsando = (id: string) => usoPorConteudo.get(id)?.size ?? 0;

  const filtrados = useMemo(
    () =>
      biblioteca.filter((c) => {
        if (filtros.eixo !== "todos" && c.eixo_id !== filtros.eixo) return false;
        if (filtros.tipo !== "todos" && c.tipo !== filtros.tipo) return false;
        if (filtros.situacao !== "todos" && (c.status ?? "publicado") !== filtros.situacao)
          return false;
        if (filtros.nivel !== "todos" && (c.nivel ?? "leve") !== filtros.nivel) return false;
        if (filtros.status === "com_midia" && !c.storage_path) return false;
        if (filtros.status === "sem_midia" && c.storage_path) return false;
        if (filtros.status === "com_capa" && !c.thumbnail_path) return false;
        if (termo && !`${c.titulo} ${c.descricao ?? ""}`.toLowerCase().includes(termo)) return false;
        return true;
      }),
    [biblioteca, filtros.eixo, filtros.tipo, filtros.situacao, filtros.nivel, filtros.status, termo],
  );

  function ordenarEixo(eixoId: string, lista: ConteudoAdmin[]) {
    const local = ordemLocal[eixoId];
    if (!local) return lista;
    return [...lista].sort((a, b) => {
      const ia = local.indexOf(a.id);
      const ib = local.indexOf(b.id);
      if (ia === -1 || ib === -1) return a.ordem - b.ordem;
      return ia - ib;
    });
  }

  async function persistirOrdem(eixoId: string, lista: ConteudoAdmin[]) {
    setOrdemLocal((atual) => ({ ...atual, [eixoId]: lista.map((c) => c.id) }));
    await reorder(lista);
  }

  function aoArrastar(eixoId: string, lista: ConteudoAdmin[], evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;
    const de = lista.findIndex((c) => c.id === active.id);
    const para = lista.findIndex((c) => c.id === over.id);
    if (de < 0 || para < 0) return;
    void persistirOrdem(eixoId, arrayMove(lista, de, para));
  }

  function moverComTeclado(eixoId: string, lista: ConteudoAdmin[], id: string, direcao: -1 | 1) {
    const de = lista.findIndex((c) => c.id === id);
    const para = de + direcao;
    if (de < 0 || para < 0 || para >= lista.length) return;
    void persistirOrdem(eixoId, arrayMove(lista, de, para));
  }

  async function excluir(id: string) {
    try {
      const resultado = await apagar(id);
      if (resultado?.ok) toast.success("Material excluído");
    } catch (erro) {
      toast.error(mensagemPainel(erro));
    }
  }

  async function submeter(entrada: Parameters<typeof salvar>[0]) {
    try {
      await salvar(entrada);
      setForm(null);
      toast.success("Material salvo");
    } catch (erro) {
      toast.error(mensagemPainel(erro));
    }
  }

  async function trocarStatus(ids: string[], status: ConteudoStatus) {
    try {
      await mudarStatus({ ids, status });
    } catch (erro) {
      toast.error(mensagemPainel(erro));
    }
  }

  const eixosVisiveis = eixos
    .filter((eixo) => filtros.eixo === "todos" || eixo.id === filtros.eixo)
    .filter((eixo) => !filtrando || filtrados.some((c) => c.eixo_id === eixo.id));

  if (!carregando && !podeGerenciar) {
    return (
      <div>
        <h1 className="font-display text-3xl text-floresta">Conteúdos</h1>
        <SecaoSemPermissao
          permissao="gerenciar_conteudos"
          className="mt-6"
          titulo="Biblioteca restrita"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-floresta">Conteúdos</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Biblioteca de materiais individuais reutilizáveis. Cada material pode entrar em várias
            trilhas — as trilhas montam a sequência, aqui você cuida do material em si.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Alternar visualização"
            className="flex items-center gap-1 rounded-full bg-papel p-1 shadow-organico"
          >
            <Button
              type="button"
              variant={visao === "lista" ? "default" : "ghost"}
              size="icon"
              onClick={() => setVisao("lista")}
              aria-label="Ver em lista"
              aria-pressed={visao === "lista"}
              className="min-h-11 min-w-11 rounded-full"
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant={visao === "grade" ? "default" : "ghost"}
              size="icon"
              onClick={() => setVisao("grade")}
              aria-label="Ver em grade"
              aria-pressed={visao === "grade"}
              className="min-h-11 min-w-11 rounded-full"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <ControlePermitido permissao="gerenciar_conteudos">
            <Button
              onClick={() => setForm(formularioVazio(eixos[0]?.id ?? "", biblioteca.length + 1))}
              disabled={!eixos.length}
              className="min-h-11 rounded-full bg-terracota px-6 text-terracota-foreground hover:bg-terracota/90 focus-visible:ring-2 focus-visible:ring-floresta"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Novo material
            </Button>
          </ControlePermitido>
        </div>
      </div>

      <div className="mt-8">
        <FilterBar
          filtros={filtros}
          eixos={eixos}
          onChange={setFiltros}
          quantidade={filtrados.length}
        />
      </div>

      <div className="mt-4">
        <BatchActionsToolbar
          quantidade={selecionados.length}
          eixos={eixos}
          ocupado={excluindoLote || movendo || mudandoStatus}
          onExcluir={async () => {
            await batchDelete(selecionados);
            setSelecionados([]);
          }}
          onMoverParaEixo={async (eixoId) => {
            await moverParaEixo({ ids: selecionados, eixoId });
            setSelecionados([]);
          }}
          onStatus={async (status) => {
            await trocarStatus(selecionados, status);
            setSelecionados([]);
          }}
          onLimpar={() => setSelecionados([])}
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            filtrando={filtrando}
            podeCriar={Boolean(eixos.length)}
            onNova={() => setForm(formularioVazio(eixos[0]?.id ?? "", 1))}
          />
        </div>
      ) : visao === "grade" ? (
        <div className="mt-6">
          <ConteudoGrade
            conteudos={filtrados}
            selecionados={selecionados}
            eixoNome={nomeEixo}
            nomePessoa={nomePessoa}
            trilhasUsando={trilhasUsando}
            onSelecionar={(id, marcado) =>
              setSelecionados((atual) =>
                marcado ? [...atual, id] : atual.filter((x) => x !== id),
              )
            }
            onEditar={(c) => setForm(paraFormulario(c))}
            onDuplicar={(c) => void duplicar(c.id)}
            onVisualizar={(c) => setPrevia(c)}
            onVerTrilhas={(c) => setTrilhasDe(c)}
            onStatus={(c, status) => void trocarStatus([c.id], status)}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {eixosVisiveis.map((eixo) => {
            const lista = ordenarEixo(
              eixo.id,
              filtrados.filter((c) => c.eixo_id === eixo.id),
            );
            return (
              <section key={eixo.id} className="rounded-3xl bg-card p-6 shadow-organico">
                <h2 className="font-display text-xl text-floresta">{eixo.nome}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{eixo.descricao}</p>

                <DndContext
                  sensors={sensores}
                  collisionDetection={closestCenter}
                  onDragEnd={(evento) => aoArrastar(eixo.id, lista, evento)}
                >
                  <SortableContext
                    items={lista.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="mt-4 space-y-2">
                      {lista.map((conteudo) => (
                        <ConteudoCard
                          key={conteudo.id}
                          conteudo={conteudo}
                          eixoNome={eixo.nome}
                          autorNome={nomePessoa(conteudo.autor_id)}
                          revisorNome={nomePessoa(conteudo.revisor_id)}
                          trilhasUsando={trilhasUsando(conteudo.id)}
                          selecionado={selecionados.includes(conteudo.id)}
                          onSelecionar={(marcado) =>
                            setSelecionados((atual) =>
                              marcado
                                ? [...atual, conteudo.id]
                                : atual.filter((id) => id !== conteudo.id),
                            )
                          }
                          onEditar={() => setForm(paraFormulario(conteudo))}
                          onDuplicar={() => void duplicar(conteudo.id)}
                          onVisualizar={() => setPrevia(conteudo)}
                          onVerTrilhas={() => setTrilhasDe(conteudo)}
                          onStatus={(status) => void trocarStatus([conteudo.id], status)}
                          onExcluir={() => void excluir(conteudo.id)}
                          onMover={(direcao) =>
                            moverComTeclado(eixo.id, lista, conteudo.id, direcao)
                          }
                        />
                      ))}
                      {lista.length === 0 && (
                        <li className="text-xs text-muted-foreground">Nenhum material ainda.</li>
                      )}
                    </ul>
                  </SortableContext>
                </DndContext>
              </section>
            );
          })}
        </div>
      )}

      <ConteudoFormDialog
        form={form}
        eixos={eixos}
        pessoas={pessoas}
        salvando={salvando}
        onFechar={() => setForm(null)}
        onSalvar={submeter}
      />

      <PreviaConteudo conteudo={previa} aberto={Boolean(previa)} onFechar={() => setPrevia(null)} />

      <PainelTrilhasRelacionadas
        conteudo={trilhasDe}
        aberto={Boolean(trilhasDe)}
        onFechar={() => setTrilhasDe(null)}
      />
    </div>
  );
}
