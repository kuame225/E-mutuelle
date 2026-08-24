import { supabase } from "./supabaseClient";

/**
 * Notification adressée à un membre en particulier.
 * Enregistre le message dans la table notifications (il apparaîtra dans la
 * cloche), puis pousse une alerte sur les appareils abonnés de ce membre.
 *
 * L'organisation est transmise pour que la fonction serveur puisse vérifier
 * que le membre visé lui appartient bien.
 */
export async function notifierMembre(membreId, { type, titre, message, url, organisationId }) {
  await supabase.from("notifications").insert({
    membre_id: membreId,
    type: type || "systeme",
    titre,
    message,
  });

  // L'échec du push ne doit jamais bloquer l'action en cours
  try {
    const { data, error } = await supabase.functions.invoke("envoyer-push", {
      body: {
        membre_id: membreId,
        organisation_id: organisationId || null,
        titre,
        message,
        url: url || "/",
      },
    });
    if (error) console.warn("Push non envoyé :", error);
    return data;
  } catch (e) {
    console.warn("Push non envoyé :", e);
    return null;
  }
}

/**
 * Diffusion d'un communiqué à un groupe : "tous", "a_jour" ou "retard".
 *
 * Le communiqué lui-même est déjà enregistré par CommunicationPage dans la
 * table communications_mutuelle ; on ne s'occupe ici que de l'alerte push.
 *
 * L'organisation est OBLIGATOIRE : sans elle, « tous » désignerait tous les
 * abonnés de la plateforme, toutes mutuelles confondues. Plutôt que de
 * risquer d'alerter les membres d'une autre mutuelle, on refuse d'envoyer.
 */
export async function diffuserCommunique({ cible, titre, message, organisationId }) {
  if (!organisationId) {
    console.warn("Diffusion refusée : organisation non précisée.");
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke("envoyer-push", {
      body: {
        cible: cible || "tous",
        organisation_id: organisationId,
        titre,
        message,
        url: "/",
      },
    });
    if (error) {
      console.warn("Diffusion push :", error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn("Diffusion push non envoyée :", e);
    return null;
  }
}