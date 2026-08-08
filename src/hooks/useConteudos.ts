import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminApagarConteudo,
  adminListarConteudos,
  adminSalvarConteudo,
} from "@/lib/raiz.functions";
import { mensagemPainel } from "@/lib/erro-permissao";

export type ConteudoTipo = "video" | "audio" | "exercicio" | "texto" | "tarefa";

export type ConteudoAdmin = {
  id: string;
  eixo_id: string;
  tipo: ConteudoTipo;
  titulo: string;
  descricao: string;
  corpo_texto: string | null;
  storage_path: string | null;
  thumbnail_path: string | null;
  duracao_segundos: number;
  ordem: number;
};

export type EixoAdmin = {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  ordem: number;
};

export type SalvarConteudoEntrada = {
  id?: string;
  eixoId: string;
  tipo: ConteudoTipo;
  titulo: string;
  descricao: string;
  corpoTexto: string | null;
  storagePath: string | null;
  thumbnailPath: string | null;
  duracaoSegundos: number;
  ordem: number;
};

/**
 * Encapsula listagem e mutações da biblioteca do terapeuta.
 * As funções de API (`adminListarConteudos`, `adminSalvarConteudo`,
 * `adminApagarConteudo`) continuam sendo a única porta de entrada, com as
 * mesmas checagens de permissão no servidor.
 */
export function useConteudos(habilitado = true) {
  const queryClient = useQueryClient();
  const listar = useServerFn(adminListarConteudos);
  const salvarFn = useServerFn(adminSalvarConteudo);
  const apagarFn = useServerFn(adminApagarConteudo);
  const [reordenando, setReordenando] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-conteudos"],
    queryFn: () => listar(),
    enabled: habilitado,
  });

  const invalidar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-conteudos"] });
    queryClient.invalidateQueries({ queryKey: ["admin-resumo"] });
  }, [queryClient]);

  const conteudos = useMemo(
    () => (data?.conteudos ?? []) as unknown as ConteudoAdmin[],
    [data?.conteudos],
  );
  const eixos = useMemo(() => (data?.eixos ?? []) as EixoAdmin[], [data?.eixos]);

  const salvarMutation = useMutation({
    mutationFn: (entrada: SalvarConteudoEntrada) =>
      salvarFn({
        data: {
          ...(entrada.id ? { id: entrada.id } : {}),
          eixoId: entrada.eixoId,
          tipo: entrada.tipo,
          titulo: entrada.titulo,
          descricao: entrada.descricao,
          corpoTexto: entrada.corpoTexto,
          storagePath: entrada.storagePath,
          thumbnailPath: entrada.thumbnailPath,
          duracaoSegundos: entrada.duracaoSegundos,
          ordem: entrada.ordem,
        },
      }),
    onSuccess: () => invalidar(),
  });

  const apagarMutation = useMutation({
    mutationFn: (id: string) => apagarFn({ data: { id } }),
    onSuccess: () => invalidar(),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const resultados = await Promise.allSettled(ids.map((id) => apagarFn({ data: { id } })));
      const falhas = resultados.filter((r) => r.status === "rejected").length;
      return { total: ids.length, falhas };
    },
    onSuccess: ({ total, falhas }) => {
      invalidar();
      if (falhas === 0) toast.success(`${total} prática(s) excluída(s)`);
      else toast.error(`${falhas} de ${total} não puderam ser excluídas`);
    },
    onError: (erro) => toast.error(mensagemPainel(erro)),
  });

  const moverParaEixoMutation = useMutation({
    mutationFn: async (params: { ids: string[]; eixoId: string }) => {
      const alvo = conteudos.filter((c) => params.ids.includes(c.id));
      await Promise.all(
        alvo.map((c) =>
          salvarFn({
            data: {
              id: c.id,
              eixoId: params.eixoId,
              tipo: c.tipo,
              titulo: c.titulo,
              descricao: c.descricao ?? "",
              corpoTexto: c.corpo_texto,
              storagePath: c.storage_path,
              thumbnailPath: c.thumbnail_path,
              duracaoSegundos: c.duracao_segundos,
              ordem: c.ordem,
            },
          }),
        ),
      );
      return alvo.length;
    },
    onSuccess: (qtd) => {
      invalidar();
      toast.success(`${qtd} prática(s) movida(s) de eixo`);
    },
    onError: (erro) => toast.error(mensagemPainel(erro)),
  });

  /** Persiste a nova sequência de `ordem` de uma lista já reordenada. */
  const reorder = useCallback(
    async (ordenados: ConteudoAdmin[]) => {
      setReordenando(true);
      try {
        const mudaram = ordenados.filter((c, indice) => c.ordem !== indice + 1);
        if (mudaram.length === 0) return;
        await Promise.all(
          ordenados.map((c, indice) =>
            c.ordem === indice + 1
              ? Promise.resolve(null)
              : salvarFn({
                  data: {
                    id: c.id,
                    eixoId: c.eixo_id,
                    tipo: c.tipo,
                    titulo: c.titulo,
                    descricao: c.descricao ?? "",
                    corpoTexto: c.corpo_texto,
                    storagePath: c.storage_path,
                    thumbnailPath: c.thumbnail_path,
                    duracaoSegundos: c.duracao_segundos,
                    ordem: indice + 1,
                  },
                }),
          ),
        );
        invalidar();
        toast.success("Ordem salva");
      } catch (erro) {
        toast.error(mensagemPainel(erro));
        invalidar();
      } finally {
        setReordenando(false);
      }
    },
    [invalidar, salvarFn],
  );

  return {
    conteudos,
    eixos,
    isLoading,
    refetch,
    salvar: salvarMutation.mutateAsync,
    salvando: salvarMutation.isPending,
    apagar: apagarMutation.mutateAsync,
    batchDelete: batchDeleteMutation.mutateAsync,
    excluindoLote: batchDeleteMutation.isPending,
    moverParaEixo: moverParaEixoMutation.mutateAsync,
    movendo: moverParaEixoMutation.isPending,
    reorder,
    reordenando,
  };
}
