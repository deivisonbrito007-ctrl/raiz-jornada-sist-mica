import { useEffect, useRef } from "react";

/** O elemento ainda existe na página e pode receber foco? */
function focavel(el: HTMLElement | null): el is HTMLElement {
  if (!el || !el.isConnected) return false;
  if (el.hasAttribute("disabled")) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.closest("[aria-hidden='true']")) return false;
  return true;
}

/**
 * Gerenciamento de foco para alertas e modais que aparecem e desaparecem no meio
 * da tela (ex.: o aviso de mídia bloqueada do player).
 *
 * - Quando o alerta abre, guarda o elemento que estava focado (a origem).
 * - Quando o alerta fecha (acesso liberado), devolve o foco para essa origem.
 * - Se a origem deixou de existir — caso comum, porque os controles do player
 *   são desmontados durante o bloqueio — usa o alvo alternativo informado
 *   (por exemplo o botão de reproduzir recriado) ou, por último, um fallback.
 *
 * A devolução acontece depois da re-renderização, já que o elemento de destino
 * costuma ser montado no mesmo ciclo em que o alerta sai da tela.
 */
export function useFocoRetorno(
  aberto: boolean,
  alvos: {
    /** preferido quando a origem não existe mais (ex.: botão Reproduzir) */
    alternativo?: () => HTMLElement | null;
    /** último recurso (ex.: link "Voltar à trilha") */
    fallback?: () => HTMLElement | null;
  } = {},
) {
  const origemRef = useRef<HTMLElement | null>(null);
  const abertoAntesRef = useRef(false);
  const alvosRef = useRef(alvos);
  alvosRef.current = alvos;

  useEffect(() => {
    const abertoAntes = abertoAntesRef.current;
    abertoAntesRef.current = aberto;

    // abriu: memoriza de onde a pessoa veio
    if (aberto && !abertoAntes) {
      const ativo = document.activeElement;
      origemRef.current =
        ativo instanceof HTMLElement && ativo !== document.body ? ativo : null;
      return undefined;
    }

    // fechou: devolve o foco no próximo ciclo, quando o destino já existe
    if (!aberto && abertoAntes) {
      const origem = origemRef.current;
      origemRef.current = null;
      const id = setTimeout(() => {
        const destino = focavel(origem)
          ? origem
          : (alvosRef.current.alternativo?.() ?? alvosRef.current.fallback?.() ?? null);
        if (focavel(destino)) destino.focus();
      }, 0);
      return () => clearTimeout(id);
    }

    return undefined;
  }, [aberto]);

  /** Permite registrar manualmente a origem antes de abrir o alerta. */
  const registrarOrigem = (el: HTMLElement | null) => {
    origemRef.current = el;
  };

  return { registrarOrigem };
}
