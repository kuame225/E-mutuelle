import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { motPourType, libelleType, capitaliser } from "./vocabulaire";

/* ============================================================
   Vocabulaire de l'organisation actuellement affichée.

   Le type vit sur organisations, pas sur parametrage — d'où cette
   lecture séparée, mise en cache dans sessionStorage comme l'identité
   pour éviter une requête à chaque écran monté.

   Usage :
     const { mot, type } = useVocabulaire();
     <h1>{mot("membres")}</h1>
   ============================================================ */

const CLE_CACHE = "org_type";

function lireCache(orgId) {
  try {
    const brut = sessionStorage.getItem(CLE_CACHE);
    if (!brut) return null;
    const { organisation_id, type } = JSON.parse(brut);
    return organisation_id === orgId ? type : null;
  } catch {
    return null;
  }
}

function ecrireCache(orgId, type) {
  try {
    sessionStorage.setItem(CLE_CACHE, JSON.stringify({ organisation_id: orgId, type }));
  } catch {
    // Stockage indisponible : le type sera relu au prochain écran, sans gravité.
  }
}

export function useVocabulaire() {
  const { params } = useParametrage();
  const orgId = params.organisation_id;

  // « mutuelle » par défaut : c'est le vocabulaire de référence, et
  // toutes les organisations créées avant l'ouverture multi-type en
  // relèvent effectivement.
  const [type, setType] = useState(() => lireCache(orgId) || "mutuelle");

  useEffect(() => {
    if (!orgId) return;

    const enCache = lireCache(orgId);
    if (enCache) { setType(enCache); return; }

    let actif = true;
    supabase
      .from("organisations")
      .select("type_organisation")
      .eq("id", orgId)
      .maybeSingle()
      .then(({ data }) => {
        if (!actif) return;
        const t = data?.type_organisation || "mutuelle";
        setType(t);
        ecrireCache(orgId, t);
      });

    return () => { actif = false; };
  }, [orgId]);

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