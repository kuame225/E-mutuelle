import { supabase } from "./supabaseClient";

// Types d'événements à consigner
export const EVENEMENTS = {
  CONNEXION: "connexion",
  DECONNEXION: "deconnexion",
  ACTIVATION_COMPTE: "activation_compte",
  PIN_ECHEC: "pin_echec",
  PIN_BLOCAGE: "pin_blocage",
  PIN_DECONNEXION_FORCEE: "pin_deconnexion_forcee",
  PAIEMENT_ENREGISTRE: "paiement_enregistre",
  ADHESION_VALIDEE: "adhesion_validee",
  AIDE_DEMANDEE: "aide_demandee",
  PROFIL_MODIFIE: "profil_modifie",
};

/**
 * Organisation courante, lue dans le cache que useParametrage alimente.
 *
 * Éviter une requête à chaque écriture du journal : le cache est renseigné
 * dès le premier écran monté, et le journal n'est sollicité qu'ensuite.
 * La colonne accepte la valeur nulle, certains événements précédant
 * l'identification de l'organisation.
 */
function organisationCourante() {
  try {
    const brut = sessionStorage.getItem("org_identite");
    if (!brut) return null;
    return JSON.parse(brut).organisation_id || null;
  } catch {
    return null;
  }
}

export async function consigner(typeEvenement, details = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("journal_activite").insert({
    user_id: user.id,
    membre_id: details.membre_id || null,
    organisation_id: details.organisation_id || organisationCourante(),
    type_evenement: typeEvenement,
    details,
  });

  // Le journal ne doit jamais interrompre l'action en cours : on se contente
  // de signaler l'échec en console.
  if (error) console.warn("Journal :", error.message);
}