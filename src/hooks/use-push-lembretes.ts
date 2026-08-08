import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { registrarDispositivoPush, removerDispositivoPush } from "@/lib/lembretes.functions";
import { VAPID_PUBLIC_KEY } from "@/lib/lembretes";

function base64UrlParaBytes(base64: string): Uint8Array {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const bin = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesParaBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type EstadoPush =
  | "indisponivel"
  | "bloqueado"
  | "desativado"
  | "ativado"
  | "processando";

/** Permissão, inscrição e sincronização do push deste dispositivo. */
export function usePushLembretes() {
  const [estado, setEstado] = useState<EstadoPush>("indisponivel");
  const [erro, setErro] = useState("");
  const salvar = useServerFn(registrarDispositivoPush);
  const remover = useServerFn(removerDispositivoPush);

  const suportado =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!suportado) {
      setEstado("indisponivel");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("bloqueado");
      return;
    }
    let ativo = true;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
        const sub = await reg?.pushManager.getSubscription();
        if (ativo) setEstado(sub ? "ativado" : "desativado");
      } catch {
        if (ativo) setEstado("desativado");
      }
    })();
    return () => {
      ativo = false;
    };
  }, [suportado]);

  const ativar = useCallback(async () => {
    if (!suportado) return;
    setErro("");
    setEstado("processando");
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "bloqueado" : "desativado");
        return;
      }
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlParaBytes(VAPID_PUBLIC_KEY) as BufferSource,
        }));

      await salvar({
        data: {
          endpoint: sub.endpoint,
          p256dh: bytesParaBase64Url(sub.getKey("p256dh")),
          auth: bytesParaBase64Url(sub.getKey("auth")),
          userAgent: navigator.userAgent.slice(0, 300),
        },
      });
      setEstado("ativado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ativar as notificações.");
      setEstado("desativado");
    }
  }, [salvar, suportado]);

  const desativar = useCallback(async () => {
    if (!suportado) return;
    setEstado("processando");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await remover({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setEstado("desativado");
    } catch {
      setEstado("desativado");
    }
  }, [remover, suportado]);

  return { estado, erro, suportado, ativar, desativar };
}
