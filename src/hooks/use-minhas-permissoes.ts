import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMeuContexto } from "@/lib/raiz.functions";
import type { Permissao } from "@/lib/permissoes";

/**
 * Permissões do usuário logado (mesma queryKey usada pelo layout admin, então
 * reaproveita o cache). Serve para decidir na interface o que mostrar ou
 * bloquear com aviso claro, sem esperar a ação falhar.
 */
export function useMinhasPermissoes() {
  const fetchContexto = useServerFn(getMeuContexto);
  const { data, isLoading, error } = useQuery({
    queryKey: ["meu-contexto"],
    queryFn: () => fetchContexto(),
  });

  const ehTerapeuta = data?.papel === "terapeuta";
  const permissoes = (data?.permissoes ?? []) as Permissao[];

  return {
    carregando: isLoading,
    erro: error,
    ehTerapeuta,
    permissoes,
    pode: (p: Permissao) => ehTerapeuta || permissoes.includes(p),
    /** Só bloqueia depois de carregar, para não piscar aviso indevido. */
    bloqueado: (p: Permissao) => !isLoading && !!data && !(ehTerapeuta || permissoes.includes(p)),
  };
}
