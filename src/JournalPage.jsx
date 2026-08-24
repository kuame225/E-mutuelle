import React, { useEffect, useState } from "react";
import { ScrollText, Loader2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, S } from "./theme";

const LIBELLES = {
  connexion: "Connexion",
  deconnexion: "Déconnexion",
  activation_compte: "Activation de compte",
  pin_echec: "Code PIN erroné",
  pin_blocage: "Blocage temporaire (PIN)",
  pin_deconnexion_forcee: "Déconnexion forcée (PIN)",
  paiement_enregistre: "Paiement enregistré",
  adhesion_validee: "Adhésion validée",
  aide_demandee: "Demande d'aide sociale",
  profil_modifie: "Profil modifié",
};

export default function JournalPage() {
  const { params } = useParametrage();
  const [entrees, setEntrees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.organisation_id) return;
    (async () => {
      const { data } = await supabase
        .from("journal_activite")
        .select("*, membres(nom)")
        .eq("organisation_id", params.organisation_id)
        .order("created_at", { ascending: false })
        .limit(200);
      setEntrees(data || []);
      setLoading(false);
    })();
  }, [params.organisation_id]);

  if (loading) return <Loader2 className="jn-spin" size={24} />;

  return (
    <div className="jn-wrap">
      <style>{CSS}</style>
      <h1 className="jn-titre"><ScrollText size={20} /> Journal d'activité</h1>
      <div className="jn-liste">
        {entrees.map((e) => (
          <div key={e.id} className="jn-ligne">
            <span className="jn-type">{LIBELLES[e.type_evenement] || e.type_evenement}</span>
            <span className="jn-membre">{e.membres?.nom || "—"}</span>
            <span className="jn-date">
              {new Date(e.created_at).toLocaleString("fr-FR")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CSS = `
.jn-wrap{ padding:${S.xl}px; }
.jn-titre{ display:flex; align-items:center; gap:8px; font-size:19px; margin-bottom:${S.lg}px; }
.jn-liste{ display:flex; flex-direction:column; gap:8px; }
.jn-ligne{
  display:grid; grid-template-columns:1fr 1fr auto; gap:12px; align-items:center;
  padding:10px 14px; background:${C.surface}; border:1px solid ${C.border}; border-radius:10px;
  font-size:13.5px;
}
.jn-type{ font-weight:600; }
.jn-membre{ color:${C.textMuted}; }
.jn-date{ color:${C.textMuted}; font-size:12.5px; white-space:nowrap; }
`;