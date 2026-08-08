/**
 * Service worker dedicado às notificações de lembrete do Raiz.
 * Não faz cache de app-shell nem intercepta navegação — só push e clique.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { titulo: "Raiz", mensagem: event.data ? event.data.text() : "" };
  }

  const titulo = dados.titulo || "Raiz";
  const opcoes = {
    body: dados.mensagem || "",
    tag: dados.tipo || "lembrete",
    renotify: false,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { destino: dados.destino || "/app" },
  };

  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.destino) || "/app";

  event.waitUntil(
    (async () => {
      const clientes = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const aberta = clientes.find((c) => "focus" in c);
      if (aberta) {
        await aberta.focus();
        if ("navigate" in aberta) {
          try {
            await aberta.navigate(destino);
          } catch {
            /* navegação bloqueada — a janela já está em foco */
          }
        }
        return;
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
