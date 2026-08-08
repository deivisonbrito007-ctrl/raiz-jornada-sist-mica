/**
 * Envio do e-mail de lembrete pela infraestrutura de e-mail da Lovable.
 * Server-only. Enquanto o domínio de envio não estiver verificado,
 * o envio falha de forma silenciosa (push e sininho continuam funcionando).
 */
import { render } from "@react-email/render";
import { sendLovableEmail } from "@lovable.dev/email-js";
import { LembretePraticaEmail } from "./email-templates/lembrete-pratica";

export type LembreteEmail = {
  titulo: string;
  mensagem: string;
  destino: string;
  chaveDedupe: string;
};

const BASE_APP = "https://useraiz.online";

export async function enviarEmailLembrete(
  para: string,
  lembrete: LembreteEmail,
): Promise<boolean> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const senderDomain = process.env["SENDER_DOMAIN"];
  const fromDomain = process.env["FROM_DOMAIN"] ?? senderDomain;
  if (!apiKey || !senderDomain) return false;

  const elemento = LembretePraticaEmail({
    titulo: lembrete.titulo,
    mensagem: lembrete.mensagem,
    url: `${BASE_APP}${lembrete.destino}`,
  });

  try {
    const html = await render(elemento);
    const text = await render(elemento, { plainText: true });
    const res = await sendLovableEmail(
      {
        to: para,
        from: `Raiz <lembretes@${fromDomain}>`,
        sender_domain: senderDomain,
        subject: lembrete.titulo,
        html,
        text,
        purpose: "transactional",
        label: `lembrete-${lembrete.chaveDedupe.split(":")[1] ?? "pratica"}`,
        idempotency_key: lembrete.chaveDedupe,
      },
      { apiKey, idempotencyKey: lembrete.chaveDedupe },
    );
    return res.success;
  } catch (e) {
    console.error("[lembretes] falha no e-mail", e);
    return false;
  }
}
