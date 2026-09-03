// Pont entre main.jsx (hors de l'arbre React, où le service worker est
// enregistré) et les composants React — main.jsx ne peut pas appeler
// setState directement sur un composant, ce petit registre d'abonnés
// sert d'intermédiaire.

const abonnes = new Set();

// Renseigné par main.jsx dès qu'une nouvelle version est prête ;
// appelé par le bandeau au clic sur "Mettre à jour".
export const fonctionMiseAJour = { actuelle: null };

export function annoncerMiseAJourDisponible() {
  abonnes.forEach((notifier) => notifier());
}

export function surMiseAJourDisponible(notifier) {
  abonnes.add(notifier);
  return () => abonnes.delete(notifier);
}