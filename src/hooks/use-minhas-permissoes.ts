import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMeuContexto } from "@/lib/raiz.functions";
import { ehPermissao, type Permissao } from "@/lib/permissoes";

/**
 * Permissões do usuário atual para uso na UI.
 *
 * Serve para esconder/desabilitar controles ANTES da requisição, evitando
 * chamadas que voltariam com erro de permissão. O servidor continua sendo a
 * fonte de verdade — isto é só navegação e clareza.
 */
export function useMinhasPermissoes() {
  const fetchContexto = useServerFn(getMeuContexto);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["meu-contexto"],
    queryFn: () => fetchContexto(),
    staleTime: 10_000,
  });

  const ehTerapeuta = data?.papel === "terapeuta";
  const permissoes = (data?.permissoes ?? []).filter((p): p is Permissao => ehPermissao(p));

  const pode = (permissao: Permissao) => ehTerapeuta || permissoes.includes(permissao);
  const podeAlguma = (lista: Permissao[]) => lista.some((p) => pode(p));
  const podeTodas = (lista: Permissao[]) => lista.every((p) => pode(p));

  return {
    carregando: isLoading,
    falhou: isError,
    ehTerapeuta,
    permissoes,
    podeAdministrar: Boolean(data?.podeAdministrar),
    pode,
    podeAlguma,
    podeTodas,
  };
}
