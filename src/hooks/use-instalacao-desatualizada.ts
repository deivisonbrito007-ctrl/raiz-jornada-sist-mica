import { useCallback, useEffect, useState } from "react";
import {
  adiarAviso,
  avisoAdiado,
  instalacaoDesatualizada,
  registrarInstalacao,
} from "@/lib/versao-app";

export type PlataformaInstalacao = "ios" | "android" | "desktop";

/** Está rodando como app instalado (tela inicial / janela própria)? */
export function emModoInstalado(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  if (iosStandalone === true) return true;
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
      window.matchMedia?.("(display-mode: minimal-ui)").matches === true
    );
  } catch {
    return false;
  }
}

/** Preview do editor, iframe ou domínios de desenvolvimento: nunca avisamos. */
export function contextoDeEdicao(): boolean {
  if (typeof window === "undefined") return true;
  if (window.top !== window.self) return true;
  const host = window.location.hostname;
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

export function detectarPlataforma(ua = typeof navigator === "undefined" ? "" : navigator.userAgent):
  | PlataformaInstalacao {
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  // iPadOS moderno se apresenta como Macintosh com toque
  if (/Macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1) {
    return "ios";
  }
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export interface EstadoInstalacao {
  desatualizada: boolean;
  plataforma: PlataformaInstalacao;
  dispensar: () => void;
}

/**
 * Detecta, só depois da hidratação e só dentro do app instalado, se a instalação
 * na tela inicial veio de um build mais antigo que o atual.
 */
export function useInstalacaoDesatualizada(): EstadoInstalacao {
  const [desatualizada, setDesatualizada] = useState(false);
  const [plataforma, setPlataforma] = useState<PlataformaInstalacao>("desktop");

  useEffect(() => {
    if (contextoDeEdicao() || !emModoInstalado()) return;
    setPlataforma(detectarPlataforma());
    if (instalacaoDesatualizada()) {
      if (!avisoAdiado()) setDesatualizada(true);
      return;
    }
    // Primeira abertura instalada neste build: registra a assinatura de origem.
    registrarInstalacao();
  }, []);

  const dispensar = useCallback(() => {
    adiarAviso();
    setDesatualizada(false);
  }, []);

  return { desatualizada, plataforma, dispensar };
}
