import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { useConteudos, type ConteudoAdmin } from "@/hooks/useConteudos";
import {
  FILTROS_VAZIOS,
  FilterBar,
  temFiltroAtivo,
  type FiltrosConteudos,
} from "@/components/AdminConteudos/FilterBar";
import { ConteudoCard } from "@/components/AdminConteudos/ConteudoCard";
import {
  ConteudoFormDialog,
  formularioVazio,
  type FormularioConteudo,
} from "@/components/AdminConteudos/ConteudoFormDialog";
import { BatchActionsToolbar } from "@/components/AdminConteudos/BatchActionsToolbar";
import { EmptyState } from "@/components/AdminConteudos/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/conteudos")({
  component: AdminConteudos,
});

function AdminConteudos() {
  const { pode, carregando } = useMinhasPermissoes();
  const podeGerenciar = pode("gerenciar_conteudos");

  const {
    conteudos,
    eixos,
    salvar,
    salvando,
    apagar,
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

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const termo = filtros.busca.trim().toLowerCase();
  const filtrando = temFiltroAtivo(filtros);

  const filtrados = useMemo(
    () =>
      conteudos.filter((c) => {
        if (filtros.eixo !== "todos" && c.eixo_id !== filtros.eixo) return false;
        if (filtros.tipo !== "todos" && c.tipo !== filtros.tipo) return false;
        if (filtros.status === "com_midia" && !c.storage_path) return false;
        if (filtros.status === "sem_midia" && c.storage_path) return false;
        if (filtros.status === "com_capa" && !c.thumbnail_path) return false;
        if (termo && !`${c.titulo} ${c.descricao ?? ""}`.toLowerCase().includes(termo)) return false;
        return true;
      }),
    [conteudos, filtros.eixo, filtros.tipo, filtros.status, termo],
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
      await apagar(id);
      toast.success("Prática excluída");
    } catch (erro) {
      toast.error(mensagemPainel(erro));
    }
  }

  async function submeter(entrada: Parameters<typeof salvar>[0]) {
    try {
      await salvar(entrada);
      setForm(null);
      toast.success("Conteúdo salvo");
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
          <p className="mt-2 text-sm text-muted-foreground">
            Organize as práticas de cada eixo. Nada fica visível antes de você liberar.
          </p>
        </div>
        <ControlePermitido permissao="gerenciar_conteudos">
          <Button
            onClick={() => setForm(formularioVazio(eixos[0]?.id ?? "", conteudos.length + 1))}
            disabled={!eixos.length}
            className="min-h-11 rounded-full bg-terracota px-6 text-terracota-foreground hover:bg-terracota/90 focus-visible:ring-2 focus-visible:ring-floresta"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Nova prática
          </Button>
        </ControlePermitido>
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
          ocupado={excluindoLote || movendo}
          onExcluir={async () => {
            await batchDelete(selecionados);
            setSelecionados([]);
          }}
          onMoverParaEixo={async (eixoId) => {
            await moverParaEixo({ ids: selecionados, eixoId });
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
                          selecionado={selecionados.includes(conteudo.id)}
                          onSelecionar={(marcado) =>
                            setSelecionados((atual) =>
                              marcado
                                ? [...atual, conteudo.id]
                                : atual.filter((id) => id !== conteudo.id),
                            )
                          }
                          onEditar={() =>
                            setForm({
                              id: conteudo.id,
                              eixoId: conteudo.eixo_id,
                              tipo: conteudo.tipo,
                              titulo: conteudo.titulo,
                              descricao: conteudo.descricao ?? "",
                              corpoTexto: conteudo.corpo_texto ?? "",
                              storagePath: conteudo.storage_path ?? "",
                              thumbnailPath: conteudo.thumbnail_path ?? "",
                              duracaoSegundos: conteudo.duracao_segundos,
                              ordem: conteudo.ordem,
                            })
                          }
                          onExcluir={() => void excluir(conteudo.id)}
                          onMover={(direcao) =>
                            moverComTeclado(eixo.id, lista, conteudo.id, direcao)
                          }
                        />
                      ))}
                      {lista.length === 0 && (
                        <li className="text-xs text-muted-foreground">Nenhuma prática ainda.</li>
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
        salvando={salvando}
        onFechar={() => setForm(null)}
        onSalvar={submeter}
      />
    </div>
  );
}
