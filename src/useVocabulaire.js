import { useCallback, useMemo } from "react";
import { useParametrage } from "./useParametrage";
import { motPourType, libelleType, capitaliser } from "./vocabulaire";

/* ============================================================
   Vocabulaire de l'organisation actuellement affichée.

   Le type vient de useParametrage, qui le reçoit soit de la table
   parametrage (personne connectée), soit de la fonction publique
   organisation_publique_par_slug (visiteur non connecté).

   Cette seconde voie est indispensable : les écrans publics — accueil,
   adhésion, connexion — s'affichent avant toute session, et une lecture
   directe de la table organisations y serait refusée par la RLS. Le
   vocabulaire retomberait alors silencieusement sur celui d'une
   mutuelle, quel que soit le type réel de l'organisation.

   Aucune requête supplémentaire n'est donc émise ici : tout passe par
   le cache partagé que useParametrage alimente déjà.

   Usage :
     const { mot, motMaj } = useVocabulaire();
     <h1>{mot("membres")}</h1>
     <p>{motMaj("bureau_le")} examinera votre demande.</p>
   ============================================================ */

export function useVocabulaire() {
  const { params } = useParametrage();

  // « mutuelle » par défaut : c'est le vocabulaire de référence, et les
  // organisations créées avant l'ouverture multi-type en relèvent toutes.
  const type = params.type_organisation || "mutuelle";

  // Fonctions mémorisées sur le type : sans cela, elles seraient recréées
  // à chaque rendu, et tout useEffect qui les liste en dépendance se
  // relancerait en boucle chez l'appelant.
  const mot = useCallback((cle) => motPourType(type, cle), [type]);
  const motMaj = useCallback((cle) => capitaliser(motPourType(type, cle)), [type]);

  return useMemo(
    () => ({ type, libelle: libelleType(type), mot, motMaj }),
    [type, mot, motMaj]
  );
}