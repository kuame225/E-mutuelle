// Pont entre main.jsx (hors de l'arbre React, où le service worker est
// enregistré) et les composants React — main.jsx ne peut pas appeler
// setState directement sur un composant, ce petit registre d'abonnés
// sert d'intermédiaire.
//
// Point important : registerSW() démarre avant que le bandeau ne soit
// monté. Quand une nouvelle version est déjà en attente au chargement,
// l'annonce partait donc avant qu'aucun abonné n'existe — et se
// perdait définitivement. L'état est désormais mémorisé : un abonné
// qui arrive après l'annonce en est informé aussitôt.

const abonnes = new Set();
let miseAJourDejaAnnoncee = false;

// Renseigné par main.jsx dès qu'une nouvelle version est prête ;
// appelé par le bandeau au clic sur "Mettre à jour".
export const fonctionMiseAJour = { actuelle: null };

export function annoncerMiseAJourDisponible() {
  miseAJourDejaAnnoncee = true;
  abonnes.forEach((notifier) => notifier());
}

export function surMiseAJourDisponible(notifier) {
  abonnes.add(notifier);
  // Rattrape une annonce partie avant l'abonnement.
  if (miseAJourDejaAnnoncee) notifier();
  return () => abonnes.delete(notifier);
}