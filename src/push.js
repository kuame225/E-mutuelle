import { supabase } from "./supabaseClient";

// Clé publique VAPID — publique par nature, elle peut figurer dans le code.
const VAPID_PUBLIC_KEY = "BKzsUyBek2KHPIh3125zqV-c4GhS3D-AeczHew4ZvMOI3Y1SfJYe1ivfZjSDz9c3zdJc9wyxsZkMKe4qhRWjOz8";

export function pushDisponible() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushAutorise() {
  return pushDisponible() && Notification.permission === "granted";
}

export function pushRefuse() {
  return pushDisponible() && Notification.permission === "denied";
}

export async function activerNotifications(membreId) {
  if (!pushDisponible()) {
    return { ok: false, motif: "non_supporte" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, motif: "refuse" };
  }

  const registration = await navigator.serviceWorker.ready;

  let abonnement = await registration.pushManager.getSubscription();
  if (!abonnement) {
    abonnement = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64EnTableau(VAPID_PUBLIC_KEY),
    });
  }

  const brut = abonnement.toJSON();

  const { error } = await supabase.from("push_abonnements").upsert(
    {
      membre_id: membreId,
      endpoint: brut.endpoint,
      p256dh: brut.keys.p256dh,
      auth: brut.keys.auth,
      appareil: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" }
  );

  if (error) return { ok: false, motif: "enregistrement", detail: error.message };

  return { ok: true };
}

function base64EnTableau(base64) {
  const complement = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalise = (base64 + complement).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(normalise);
  return Uint8Array.from([...brut].map((c) => c.charCodeAt(0)));
}

// Même mécanique que activerNotifications(), pour l'exploitant : un
// abonnement séparé (push_abonnements_exploitant), indexé par user_id
// plutôt que membre_id — l'exploitant n'a pas de fiche membre, c'est un
// rôle plateforme, pas un rattachement à une organisation.
export async function activerNotificationsExploitant(userId) {
  if (!pushDisponible()) {
    return { ok: false, motif: "non_supporte" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, motif: "refuse" };
  }

  const registration = await navigator.serviceWorker.ready;

  let abonnement = await registration.pushManager.getSubscription();
  if (!abonnement) {
    abonnement = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64EnTableau(VAPID_PUBLIC_KEY),
    });
  }

  const brut = abonnement.toJSON();

  const { error } = await supabase.from("push_abonnements_exploitant").upsert(
    {
      user_id: userId,
      endpoint: brut.endpoint,
      p256dh: brut.keys.p256dh,
      auth: brut.keys.auth,
      appareil: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" }
  );

  if (error) return { ok: false, motif: "enregistrement", detail: error.message };

  return { ok: true };
}