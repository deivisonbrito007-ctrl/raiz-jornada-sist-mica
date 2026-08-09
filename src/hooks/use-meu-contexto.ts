import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMeuContexto } from "@/lib/raiz.functions";
import { CHAVES } from "@/lib/cache-chaves";

type Opcoes = {
  /** revalidação periódica (usada pelo painel do terapeuta) */
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
};

/**
 * Fonte única do contexto/permissões da pessoa autenticada.
 *
 * Cliente e painel liam o mesmo dado com chaves diferentes (`contexto` e
 * `meu-contexto`), dobrando requisições e deixando uma tela velha quando a outra
 * atualizava. Agora é uma consulta só: uma busca serve as duas, e uma
 * invalidação atualiza tudo.
 */
export function useMeuContexto(opcoes: Opcoes = {}) {
  const fetchContexto = useServerFn(getMeuContexto);
  return useQuery({
    queryKey: CHAVES.contexto,
    queryFn: () => fetchContexto(),
    staleTime: 60_000,
    ...opcoes,
  });
}
