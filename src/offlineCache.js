// Consultation hors ligne pour l'espace membre — jamais d'écriture en
// attente, seulement la dernière copie connue d'une lecture réussie.
// Toujours tenter le réseau en premier ; ne se rabattre sur la version
// locale qu'en cas d'échec réel de la requête (coupure), jamais sur une
// simple absence de résultat ou une erreur applicative (permission
// refusée, etc.) — sans quoi une vraie erreur pourrait se masquer
// derrière des données périmées.

const PREFIXE = "baamo_cache";

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

/**
 * Enveloppe une requête réseau : tente le réseau, met à jour le cache
 * dès qu'il répond sans erreur, se rabat sur la dernière copie connue
 * uniquement si la requête elle-même échoue (coupure réseau).
 *
 * @param {string} id - identifiant unique de cache, propre à l'écran
 *   et au membre (ex: `cotisations_${membre.id}`)
 * @param {() => Promise<{data, error}>} requeteReseau
 * @returns {Promise<{data, error, depuisCache, horodatageCache}>}
 */
export async function chargerAvecCache(id, requeteReseau) {
  try {
    const resultat = await requeteReseau();
    if (!resultat.error) {
      sauverCache(id, resultat.data);
      return { data: resultat.data, error: null, depuisCache: false, horodatageCache: null };
    }
    return { data: resultat.data, error: resultat.error, depuisCache: false, horodatageCache: null };
  } catch (e) {
    const secours = lireCache(id);
    if (secours) {
      return { data: secours.donnees, error: null, depuisCache: true, horodatageCache: secours.horodatage };
    }
    return { data: null, error: e, depuisCache: false, horodatageCache: null };
  }
}