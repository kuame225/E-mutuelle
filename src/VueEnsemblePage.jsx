import React, { useEffect, useState } from "react";
import {
  UserPlus, ClipboardCheck, HandHeart, Users2, Banknote,
  ChevronRight, CheckCircle2,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage, moduleActif } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

// Complète TableauBordFinancier.jsx (le financier) plutôt que de le
// remplacer — les deux existent côte à côte, comme deux onglets
// séparés dans le menu. Celui-ci rassemble ce qui a besoin d'une
// décision du Bureau, hors argent : adhésions, aides, assemblée à
// venir, prêts — chaque signal n'apparaît que si le module correspondant
// est actif pour cette organisation.
export default function VueEnsemblePage({ onNaviguer }) {
  const { params } = useParametrage();
  const [signaux, setSignaux] = useState(null);
  const [loading, setLoading] = useState(true);

  async function charger() {
    const orgId = params.organisation_id;
    const aidesActif = moduleActif(params, "module_aides");
    const assembleesActif = moduleActif(params, "module_assemblees");
    const pretsActif = moduleActif(params, "module_prets");

    const requetes = [
      supabase.from("adhesions").select("id", { count: "exact", head: true })
        .eq("organisation_id", orgId).eq("statut", "en_attente"),
      supabase.from("declarations_paiement").select("id", { count: "exact", head: true })
        .eq("organisation_id", orgId).eq("statut", "en_attente"),
      aidesActif
        ? supabase.from("aides_sociales").select("id", { count: "exact", head: true })
            .eq("organisation_id", orgId).in("statut", ["en_attente", "en_examen"])
        : Promise.resolve({ count: null }),
      assembleesActif
        ? supabase.from("assemblees").select("titre, date_prevue")
            .eq("organisation_id", orgId)
            .gte("date_prevue", new Date().toISOString())
            .order("date_prevue").limit(1)
        : Promise.resolve({ data: [] }),
      pretsActif
        ? supabase.from("prets").select("id", { count: "exact", head: true })
            .eq("organisation_id", orgId).eq("statut", "en_attente")
        : Promise.resolve({ count: null }),
    ];

    const [adhesionsRes, declarationsRes, aidesRes, assembleesRes, pretsRes] = await Promise.all(requetes);

    setSignaux({
      adhesions: adhesionsRes.count || 0,
      declarations: declarationsRes.count || 0,
      aides: aidesActif ? (aidesRes.count || 0) : null,
      prochaineAssemblee: assembleesActif ? (assembleesRes.data?.[0] || null) : null,
      prets: pretsActif ? (pretsRes.count || 0) : null,
    });
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  if (loading) {
    return (
      <div className="ve-wrap">
        <style>{CSS}</style>
        <div className="ve-skel" />
        <div className="ve-skel" />
      </div>
    );
  }

  const cartes = [
    {
      id: "adhesions", cible: "adhesions",
      titre: "Adhésions en attente", valeur: signaux.adhesions,
      Icon: UserPlus, couleur: C.primary,
      texte: signaux.adhesions === 0 ? "Aucune demande à traiter" : "à valider ou rejeter",
    },
    {
      id: "declarations", cible: "declarations_paiement",
      titre: "Paiements déclarés", valeur: signaux.declarations,
      Icon: ClipboardCheck, couleur: C.warning,
      texte: signaux.declarations === 0 ? "Rien en attente de confirmation" : "en attente de confirmation",
    },
  ];

  if (signaux.aides !== null) {
    cartes.push({
      id: "aides", cible: "aides_admin",
      titre: "Demandes d'aide", valeur: signaux.aides,
      Icon: HandHeart, couleur: C.danger,
      texte: signaux.aides === 0 ? "Aucune demande en instruction" : "en instruction",
    });
  }

  if (signaux.prets !== null) {
    cartes.push({
      id: "prets", cible: "prets",
      titre: "Prêts en attente", valeur: signaux.prets,
      Icon: Banknote, couleur: C.success,
      texte: signaux.prets === 0 ? "Aucune demande à instruire" : "demande(s) à instruire",
    });
  }

  return (
    <div className="ve-wrap">
      <style>{CSS}</style>

      <div className="ve-grille">
        {cartes.map((c) => (
          <button
            key={c.id}
            className="ve-carte"
            onClick={() => onNaviguer && onNaviguer(c.cible)}
          >
            <div className="ve-carte-icone" style={{ background: `${c.couleur}18`, color: c.couleur }}>
              <c.Icon size={20} />
            </div>
            <div className="ve-carte-corps">
              <div className="ve-carte-valeur">
                {c.valeur === 0
                  ? <CheckCircle2 size={22} color={C.success} />
                  : c.valeur}
              </div>
              <div className="ve-carte-titre">{c.titre}</div>
              <div className="ve-carte-texte">{c.texte}</div>
            </div>
            <ChevronRight size={17} color={C.textSubtle} />
          </button>
        ))}
      </div>

      {signaux.prochaineAssemblee && (
        <button
          className="ve-assemblee"
          onClick={() => onNaviguer && onNaviguer("assemblees")}
        >
          <div className="ve-assemblee-icone"><Users2 size={19} /></div>
          <div className="ve-assemblee-corps">
            <div className="ve-assemblee-label">Prochaine assemblée</div>
            <div className="ve-assemblee-titre">{signaux.prochaineAssemblee.titre}</div>
            <div className="ve-assemblee-date">
              {new Date(signaux.prochaineAssemblee.date_prevue).toLocaleDateString("fr-FR", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </div>
          </div>
          <ChevronRight size={17} color={C.textSubtle} />
        </button>
      )}
    </div>
  );
}

const CSS = `
.ve-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .ve-wrap{ padding:${S.lg}px; } }

.ve-grille{ display:grid; gap:14px; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); }
.ve-carte{
  display:flex; align-items:center; gap:14px; text-align:left;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:16px 18px; cursor:pointer; font-family:inherit;
  box-shadow:${SHADOW.xs}; transition:border-color .15s ease, transform .15s ease;
}
.ve-carte:hover{ border-color:${PALETTE.grey300}; transform:translateY(-1px); }
.ve-carte-icone{
  width:44px; height:44px; border-radius:${R.md}px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.ve-carte-corps{ flex:1; min-width:0; }
.ve-carte-valeur{ font-size:22px; font-weight:700; line-height:1; height:24px; display:flex; align-items:center; }
.ve-carte-titre{ font-size:13px; font-weight:600; margin-top:6px; }
.ve-carte-texte{ font-size:12px; color:${C.textSubtle}; margin-top:1px; }

.ve-assemblee{
  display:flex; align-items:center; gap:14px; text-align:left;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100}; border-radius:${R.xl}px;
  padding:16px 18px; cursor:pointer; font-family:inherit;
}
.ve-assemblee-icone{
  width:44px; height:44px; border-radius:${R.md}px; flex-shrink:0;
  background:${C.primary}; color:#fff;
  display:flex; align-items:center; justify-content:center;
}
.ve-assemblee-corps{ flex:1; min-width:0; }
.ve-assemblee-label{ font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:${C.primary}; }
.ve-assemblee-titre{ font-size:14.5px; font-weight:600; margin-top:3px; }
.ve-assemblee-date{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; text-transform:capitalize; }

.ve-skel{
  height:100px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:veShim 1.4s infinite;
}
@keyframes veShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
`;