// Consultation hors ligne pour l'espace membre — jamais d'écriture en
// attente, seulement la dernière copie connue d'une lecture réussie.
// Toujours tenter le réseau en premier ; ne se rabattre sur la version
// locale qu'en cas d'échec réel de la requête (coupure), jamais sur une
// simple absence de résultat ou une erreur applicative (permission
// refusée, etc.) — sans quoi une vraie erreur pourrait se masquer
// derrière des données périmées.
//
// Point important : le client Supabase ne lève pas toujours une
// exception en cas de coupure réseau — il peut renvoyer normalement
// { data: null, error: ... } sans jamais passer par un bloc catch. Se
// fier uniquement à une exception laisserait le repli sur le cache ne
// jamais se déclencher en pratique. Deux filets sont donc utilisés :
// navigator.onLine, vérifié avant même de tenter le réseau, et la forme
// de l'erreur renvoyée — une erreur Postgres/PostgREST porte toujours
// un code ; une coupure réseau n'en porte jamais.

const PREFIXE = "babamoo_cache";

function cle(id) {
  return `${PREFIXE}_${id}`;
}

export function sauverCache(id, donnees) {
  try {
    localStorage.setItem(cle(id), JSON.stringify({ donnees, horodatage: Date.now() }));
  } catch {
    // Quota localStorage dépassé ou navigation privée — la mise en
    // cache est un plus, jamais une exigence : on ne bloque rien pour ça.
  }
}

export function lireCache(id) {
  try {
    const brut = localStorage.getItem(cle(id));
    return brut ? JSON.parse(brut) : null; // { donnees, horodatage }
  } catch {
    return null;
  }
}

export function ressembleAUneCoupureReseau(erreur) {
  if (!erreur) return false;
  // Une erreur Postgres/PostgREST porte toujours un code (ex: "23505",
  // "PGRST116"). Son absence, combinée à un message générique de fetch,
  // signale une coupure plutôt qu'un refus applicatif.
  if (erreur.code) return false;
  const message = String(erreur.message || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("load failed") ||
    message.includes("fetch failed")
  );
}

function repliCache(id) {
  const secours = lireCache(id);
  if (secours) {
    return { data: secours.donnees, error: null, depuisCache: true, horodatageCache: secours.horodatage };
  }
  return null;
}

/**
 * Enveloppe une requête réseau : tente le réseau, met à jour le cache
 * dès qu'il répond sans erreur, se rabat sur la dernière copie connue
 * en cas de coupure — qu'elle se manifeste par une exception, par une
 * erreur réseau renvoyée normalement, ou par navigator.onLine à faux.
 *
 * @param {string} id - identifiant unique de cache, propre à l'écran
 *   et au membre (ex: `cotisations_${membre.id}`)
 * @param {() => Promise<{data, error}>} requeteReseau
 * @returns {Promise<{data, error, depuisCache, horodatageCache}>}
 */
export async function chargerAvecCache(id, requeteReseau) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const repli = repliCache(id);
    if (repli) return repli;
    // Pas de copie locale disponible : on tente quand même le réseau,
    // navigator.onLine n'étant pas fiable à 100 % sur tous les appareils.
  }

  try {
    const resultat = await requeteReseau();

    if (!resultat.error) {
      sauverCache(id, resultat.data);
      return { data: resultat.data, error: null, depuisCache: false, horodatageCache: null };
    }

    if (ressembleAUneCoupureReseau(resultat.error)) {
      const repli = repliCache(id);
      if (repli) return repli;
    }

    return { data: resultat.data, error: resultat.error, depuisCache: false, horodatageCache: null };
  } catch (e) {
    const repli = repliCache(id);
    if (repli) return repli;
    return { data: null, error: e, depuisCache: false, horodatageCache: null };
  }
}