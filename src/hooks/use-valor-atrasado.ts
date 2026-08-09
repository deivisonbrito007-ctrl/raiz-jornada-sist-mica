import { useEffect, useState } from "react";

/** Atrasa a propagação de um valor (ex.: campo de busca) para evitar filtrar a cada tecla. */
export function useValorAtrasado<T>(valor: T, atrasoMs = 300): T {
  const [atrasado, setAtrasado] = useState(valor);

  useEffect(() => {
    const id = setTimeout(() => setAtrasado(valor), atrasoMs);
    return () => clearTimeout(id);
  }, [valor, atrasoMs]);

  return atrasado;
}
