/**
 * Aviso individual para um cliente: registro dentro do app + push/e-mail nos
 * canais que a pessoa autorizou nas preferências dela.
 *
 * Server-only: usa o cliente administrativo porque a notificação é escrita
 * *para* outra pessoa e os dispositivos/preferências dela não são legíveis pela
 * sessão de quem envia. Chame apenas depois de checar a permissão de quem age.
 */
import { enviarEmailLembrete } from "./email-lembrete.server";
import { enviarPush } from "./push.server";

export type AvisoCliente = {
  clienteId: string;
  titulo: string;
  mensagem: string;
  /** rota interna aberta pelo push/e-mail */
  destino?: string;
  /** evita duplicar o mesmo aviso em reenvios */
  chaveDedupe: string;
};

export type ResultadoAviso = {
  noApp: boolean;
  push: number;
  email: boolean;
};

export async function avisarCliente(aviso: AvisoCliente): Promise<ResultadoAviso> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const destino = aviso.destino ?? "/app";

  const { error: erroNotificacao } = await supabaseAdmin.from("notificacoes").insert({
    cliente_id: aviso.clienteId,
    titulo: aviso.titulo,
    mensagem: aviso.mensagem,
  });

  const [{ data: preferencia }, { data: perfil }] = await Promise.all([
    supabaseAdmin
      .from("preferencias_lembretes")
      .select("ativo, canal_push, canal_email")
      .eq("user_id", aviso.clienteId)
      .maybeSingle(),
    supabaseAdmin.from("profiles").select("email").eq("id", aviso.clienteId).maybeSingle(),
  ]);

  // Sem preferência salva ainda: avisos individuais podem seguir pelos dois
  // canais — é resposta a um pedido da própria pessoa, não lembrete automático.
  const canalPush = preferencia?.canal_push ?? true;
  const canalEmail = preferencia?.canal_email ?? true;

  let push = 0;
  if (canalPush) {
    const { data: dispositivos } = await supabaseAdmin
      .from("dispositivos_push")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", aviso.clienteId);

    if (dispositivos && dispositivos.length > 0) {
      const resultado = await enviarPush(dispositivos, {
        titulo: aviso.titulo,
        mensagem: aviso.mensagem,
        destino,
      });
      push = resultado.enviados;
      if (resultado.removidos.length > 0) {
        await supabaseAdmin.from("dispositivos_push").delete().in("endpoint", resultado.removidos);
      }
    }
  }

  let email = false;
  if (canalEmail && perfil?.email) {
    email = await enviarEmailLembrete(perfil.email, {
      titulo: aviso.titulo,
      mensagem: aviso.mensagem,
      destino,
      chaveDedupe: aviso.chaveDedupe,
    });
  }

  return { noApp: !erroNotificacao, push, email };
}
