import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";

/**
 * Permissions de la personne connectée dans l'organisation active.
 *
 * Une même personne peut détenir plusieurs rôles dans une mutuelle — par
 * exemple secrétaire général et responsable des adhésions : ses permissions
 * s'additionnent, c'est la fonction serveur mes_permissions qui les cumule.
 *
 * Ce hook sert à masquer ce qui n'est pas accessible. Il ne protège rien
 * par lui-même : la base doit refuser de son côté ce que l'écran cache,
 * sans quoi une adresse tapée à la main suffirait à contourner l'affichage.
 */
export function usePermissions() {
  const { params } = useParametrage();
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const orgId = params.organisation_id;

  useEffect(() => {
    if (!orgId) return;

    let actif = true;
    setLoading(true);

    Promise.all([
      supabase.rpc("mes_permissions", { p_org: orgId }),
      supabase.from("roles_admin").select("role").eq("organisation_id", orgId),
    ]).then(([permRes, rolesRes]) => {
      if (!actif) return;
      setPermissions(permRes.data || []);
      setRoles((rolesRes.data || []).map((r) => r.role));
      setLoading(false);
    });

    return () => { actif = false; };
  }, [orgId]);

  /**
   * La personne a-t-elle accès à cet écran ?
   *
   * Tant que les permissions ne sont pas chargées, on répond « non » :
   * mieux vaut un menu qui se remplit une fraction de seconde plus tard
   * qu'un écran qui s'affiche puis disparaît.
   */
  const peut = (permission) => permissions.includes(permission);

  return { permissions, roles, peut, loading };
}