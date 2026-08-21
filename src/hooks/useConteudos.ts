import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminApagarConteudo,
  adminDuplicarConteudo,
  adminListarConteudos,
  adminMudarStatusConteudo,
  adminSalvarConteudo,
} from "@/lib/raiz.functions";
import { mensagemPainel } from "@/lib/erro-permissao";

export type ConteudoTipo =
  | "video"
  | "audio"
  | "meditacao"
  | "aterramento"
  | "movimento_sistemico"
  | "exercicio"
  | "texto"
  | "texto_educativo"
  | "diario_integracao"
  | "pergunta_reflexiva"
  | "checkin"
  | "checkout"
  | "acao_alinhada"
  | "pratica_semanal"
  | "tarefa"
  | "pdf";

export type ConteudoNivel = "leve" | "intermediario" | "profundo";
export type ConteudoStatus = "rascunho" | "em_revisao" | "publicado" | "arquivado";

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
  /* Campos de curadoria (podem faltar em dados antigos em memória) */
  objetivo?: string;
  instrucoes?: string;
  perguntas_integracao?: string;
  materiais?: string;
  sensibilidades?: string;
  criterios_interrupcao?: string;
  transcricao?: string;
  legendas_path?: string | null;
  nivel?: ConteudoNivel;
  status?: ConteudoStatus;
  versao?: number;
  autor_id?: string | null;
  revisor_id?: string | null;
  data_revisao?: string | null;
  updated_at?: string | null;
  trilha_id?: string | null;
  conteudo_origem_id?: string | null;
};

export type EixoAdmin = {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  ordem: number;
};

export type TrilhaResumo = { id: string; nome: string; status: string; eixo_id: string };
export type PessoaResumo = { id: string; nome: string; email: string };

export type SalvarConteudoEntrada = {
  id?: string;
  eixoId: string;
  tipo: ConteudoTipo;
  titulo: string;
  descricao: string;
  objetivo?: string;
  instrucoes?: string;
  perguntasIntegracao?: string;
  materiais?: string;
  sensibilidades?: string;
  orientacoesPausa?: string;
  transcricao?: string;
  legendasPath?: string | null;
  corpoTexto: string | null;
  storagePath: string | null;
  thumbnailPath: string | null;
  duracaoSegundos: number;
  ordem: number;
  nivel?: ConteudoNivel;
  status?: ConteudoStatus;
  versao?: number;
  autorId?: string | null;
  revisorId?: string | null;
  dataRevisao?: string | null;
};

/** Campos de curadoria preservados quando a mutação é apenas de ordem/eixo. */
function preservar(c: ConteudoAdmin) {
  return {
    objetivo: c.objetivo ?? "",
    instrucoes: c.instrucoes ?? "",
    perguntasIntegracao: c.perguntas_integracao ?? "",
    materiais: c.materiais ?? "",
    sensibilidades: c.sensibilidades ?? "",
    orientacoesPausa: c.criterios_interrupcao ?? "",
    transcricao: c.transcricao ?? "",
    legendasPath: c.legendas_path ?? null,
    nivel: c.nivel ?? ("leve" as const),
    status: c.status ?? ("publicado" as const),
    versao: c.versao ?? 1,
    autorId: c.autor_id ?? null,
    revisorId: c.revisor_id ?? null,
    dataRevisao: c.data_revisao ?? null,
  };
}

/**
 * Encapsula listagem e mutações da biblioteca do terapeuta.
 * As funções de API continuam sendo a única porta de entrada, com as mesmas
 * checagens de permissão no servidor.
 */
export function useConteudos(habilitado = true) {
  const queryClient = useQueryClient();
  const listar = useServerFn(adminListarConteudos);
  const salvarFn = useServerFn(adminSalvarConteudo);
  const apagarFn = useServerFn(adminApagarConteudo);
  const duplicarFn = useServerFn(adminDuplicarConteudo);
  const statusFn = useServerFn(adminMudarStatusConteudo);
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
  const trilhas = useMemo(() => (data?.trilhas ?? []) as TrilhaResumo[], [data?.trilhas]);
  const pessoas = useMemo(() => (data?.pessoas ?? []) as PessoaResumo[], [data?.pessoas]);

  const salvarMutation = useMutation({
    mutationFn: (entrada: SalvarConteudoEntrada) =>
      salvarFn({
        data: {
          ...(entrada.id ? { id: entrada.id } : {}),
          eixoId: entrada.eixoId,
          tipo: entrada.tipo,
          titulo: entrada.titulo,
          descricao: entrada.descricao,
          objetivo: entrada.objetivo ?? "",
          instrucoes: entrada.instrucoes ?? "",
          perguntasIntegracao: entrada.perguntasIntegracao ?? "",
          materiais: entrada.materiais ?? "",
          sensibilidades: entrada.sensibilidades ?? "",
          orientacoesPausa: entrada.orientacoesPausa ?? "",
          transcricao: entrada.transcricao ?? "",
          legendasPath: entrada.legendasPath ?? null,
          corpoTexto: entrada.corpoTexto,
          storagePath: entrada.storagePath,
          thumbnailPath: entrada.thumbnailPath,
          duracaoSegundos: entrada.duracaoSegundos,
          ordem: entrada.ordem,
          nivel: entrada.nivel ?? "leve",
          status: entrada.status ?? "rascunho",
          versao: entrada.versao ?? 1,
          autorId: entrada.autorId ?? null,
          revisorId: entrada.revisorId ?? null,
          dataRevisao: entrada.dataRevisao ?? null,
        },
      }),
    onSuccess: () => invalidar(),
  });

  const apagarMutation = useMutation({
    mutationFn: (id: string) => apagarFn({ data: { id } }),
    onSuccess: (resultado) => {
      invalidar();
      if (resultado && resultado.ok === false) toast.error(resultado.mensagem);
    },
  });

  const duplicarMutation = useMutation({
    mutationFn: (id: string) => duplicarFn({ data: { id } }),
    onSuccess: () => {
      invalidar();
      toast.success("Cópia criada como rascunho");
    },
    onError: (erro) => toast.error(mensagemPainel(erro)),
  });

  const statusMutation = useMutation({
    mutationFn: (params: { ids: string[]; status: ConteudoStatus }) =>
      statusFn({ data: { ids: params.ids, status: params.status } }),
    onSuccess: (_r, params) => {
      invalidar();
      const rotulo =
        params.status === "publicado"
          ? "publicado(s)"
          : params.status === "arquivado"
            ? "arquivado(s)"
            : params.status === "em_revisao"
              ? "enviado(s) para revisão"
              : "movido(s) para rascunho";
      toast.success(`${params.ids.length} conteúdo(s) ${rotulo}`);
    },
    onError: (erro) => toast.error(mensagemPainel(erro)),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const resultados = await Promise.allSettled(ids.map((id) => apagarFn({ data: { id } })));
      const bloqueados = resultados.filter(
        (r) => r.status === "fulfilled" && r.value && r.value.ok === false,
      ).length;
      const falhas =
        resultados.filter((r) => r.status === "rejected").length + bloqueados;
      return { total: ids.length, falhas, bloqueados };
    },
    onSuccess: ({ total, falhas, bloqueados }) => {
      invalidar();
      if (falhas === 0) toast.success(`${total} prática(s) excluída(s)`);
      else if (bloqueados > 0)
        toast.error(
          `${bloqueados} de ${total} está(ão) em uso em trilhas ou planos — arquive em vez de excluir.`,
        );
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
              ...preservar(c),
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
                    ...preservar(c),
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
    trilhas,
    pessoas,
    isLoading,
    refetch,
    salvar: salvarMutation.mutateAsync,
    salvando: salvarMutation.isPending,
    apagar: apagarMutation.mutateAsync,
    duplicar: duplicarMutation.mutateAsync,
    duplicando: duplicarMutation.isPending,
    mudarStatus: statusMutation.mutateAsync,
    mudandoStatus: statusMutation.isPending,
    batchDelete: batchDeleteMutation.mutateAsync,
    excluindoLote: batchDeleteMutation.isPending,
    moverParaEixo: moverParaEixoMutation.mutateAsync,
    movendo: moverParaEixoMutation.isPending,
    reorder,
    reordenando,
  };
}
