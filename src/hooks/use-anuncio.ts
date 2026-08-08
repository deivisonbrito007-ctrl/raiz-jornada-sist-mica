import { useCallback, useState } from "react";

/**
 * Anúncios para leitor de tela com deduplicação por escopo.
 *
 * A memória do último texto vive fora do componente (módulo), de propósito:
 * ao navegar entre biblioteca, trilha, player e progresso os componentes
 * desmontam e remontam, e sem essa memória o mesmo aviso ("Prática concluída")
 * seria falado de novo a cada volta para a tela. Com ela, só uma mudança real
 * de mensagem gera fala.
 */
const ultimoPorEscopo = new Map<string, string>();

export function useAnuncio(escopo: string) {
  const [texto, setTexto] = useState("");

  const anunciar = useCallback(
    (novo: string) => {
      if (!novo) return;
      // Mesma mensagem do último anúncio deste escopo: não repete. Isso vale
      // inclusive depois de remontar a tela — a live region fica vazia e o
      // leitor de tela não ouve o mesmo aviso duas vezes.
      if (ultimoPorEscopo.get(escopo) === novo) return;
      ultimoPorEscopo.set(escopo, novo);
      setTexto(novo);
    },
    [escopo],
  );

  return { texto, anunciar, jaAnunciado: (valor: string) => ultimoPorEscopo.get(escopo) === valor };
}

/** Usado nos testes e ao sair da conta, para não vazar anúncios entre sessões. */
export function limparMemoriaAnuncios() {
  ultimoPorEscopo.clear();
}
