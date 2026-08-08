/**
 * Envio de Web Push (VAPID) compatível com o runtime de borda.
 * Server-only: usa a chave privada VAPID.
 */
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { VAPID_PUBLIC_KEY } from "./lembretes";

export type DispositivoPush = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type CargaPush = {
  titulo: string;
  mensagem: string;
  destino: string;
  tipo: string;
};

export type ResultadoPush = {
  enviados: number;
  removidos: string[];
};

/**
 * Envia a notificação para todos os dispositivos do cliente.
 * Endpoints com 404/410 são devolvidos em `removidos` para limpeza.
 */
export async function enviarPush(
  dispositivos: DispositivoPush[],
  carga: CargaPush,
): Promise<ResultadoPush> {
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:contato@useraiz.online";
  if (!privateKey || dispositivos.length === 0) return { enviados: 0, removidos: [] };

  const vapid = { subject, publicKey: VAPID_PUBLIC_KEY, privateKey };
  let enviados = 0;
  const removidos: string[] = [];

  for (const d of dispositivos) {
    try {
      const payload = await buildPushPayload(
        { data: carga, options: { ttl: 60 * 60 * 12, urgency: "normal" } },
        { endpoint: d.endpoint, expirationTime: null, keys: { p256dh: d.p256dh, auth: d.auth } },
        vapid,
      );
      const res = await fetch(d.endpoint, {
        method: payload.method,
        headers: payload.headers,
        body: payload.body,
      });
      if (res.status === 404 || res.status === 410) {
        removidos.push(d.endpoint);
      } else if (res.ok) {
        enviados += 1;
      } else {
        console.error("[push] falha no envio", res.status, await res.text());
      }
    } catch (e) {
      console.error("[push] erro inesperado", e);
    }
  }

  return { enviados, removidos };
}
