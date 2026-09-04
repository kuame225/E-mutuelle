import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

// skipWaiting() a été retiré d'ici : il faisait prendre le contrôle au
// nouveau service worker sur-le-champ, sans jamais laisser de version
// "en attente" — ce qui court-circuitait entièrement le bandeau de
// mise à jour, qui n'avait donc jamais rien à annoncer. L'activation
// est maintenant déclenchée par le clic sur "Mettre à jour", via le
// message SKIP_WAITING envoyé par vite-plugin-pwa.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Nom de repli lorsqu'une notification arrive sans titre.
// Vient de .env, comme le manifeste et le titre de la page.
const NOM_PLATEFORME = import.meta.env.VITE_NOM_PLATEFORME || "Babamoo";

// ---- Réception d'une notification push ----
self.addEventListener("push", (event) => {
  let donnees = { titre: NOM_PLATEFORME, message: "", url: "/" };

  try {
    donnees = { ...donnees, ...event.data.json() };
  } catch (e) {
    // Charge utile non lisible : on garde les valeurs par défaut
  }

  event.waitUntil(
    self.registration.showNotification(donnees.titre, {
      body: donnees.message,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: donnees.url },
      lang: "fr",
    })
  );
});

// ---- Clic sur la notification ----
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((fenetres) => {
        const ouverte = fenetres.find((f) => f.url.startsWith(self.location.origin));
        if (ouverte) {
          ouverte.focus();
          return ouverte.navigate(cible);
        }
        return self.clients.openWindow(cible);
      })
  );
});