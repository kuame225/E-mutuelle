import React, { useState } from "react";
import {
  X, Upload, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, ArrowLeft,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, R, S, SHADOW } from "./theme";

// Format attendu, une ligne par membre — mois_adhesion et paye_jusqua au
// format AAAA-MM (paye_jusqua vide si le membre n'a encore rien payé) :
// nom,telephone,poste,service,mois_adhesion,paye_jusqua
const COLONNES = ["nom", "telephone", "poste", "service", "mois_adhesion", "paye_jusqua"];

function analyserCsv(texte) {
  const lignes = texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lignes.length < 2) return { erreur: "Le fichier ne contient aucune ligne de données.", rangees: [] };

  const entete = lignes[0].split(",").map((c) => c.trim().toLowerCase());
  const indexNom = entete.indexOf("nom");
  const indexAdhesion = entete.indexOf("mois_adhesion");
  if (indexNom === -1 || indexAdhesion === -1) {
    return {
      erreur: "Colonnes manquantes — au minimum \"nom\" et \"mois_adhesion\" sont obligatoires.",
      rangees: [],
    };
  }

  const rangees = lignes.slice(1).map((ligne, i) => {
    const valeurs = ligne.split(",").map((c) => c.trim());
    const rangee = {};
    entete.forEach((col, idx) => { rangee[col] = valeurs[idx] || ""; });
    rangee._ligne = i + 2; // pour un message d'erreur qui pointe vers la bonne ligne du fichier
    return rangee;
  });

  return { erreur: null, rangees };
}

function versDate(periodeAaaaMm) {
  if (!periodeAaaaMm) return null;
  const m = periodeAaaaMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-01`;
}

export default function ImportMembresModal({ organisationId, onClose, onTermine }) {
  const [etape, setEtape] = useState("depot"); // depot | apercu | import | resultat
  const [rangees, setRangees] = useState([]);
  const [erreurFichier, setErreurFichier] = useState("");
  const [progression, setProgression] = useState({ fait: 0, total: 0 });
  const [resultats, setResultats] = useState([]); // { ligne, nom, ok, message }

  function onFichierChoisi(e) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;

    setErreurFichier("");
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const { erreur, rangees: r } = analyserCsv(String(lecteur.result));
      if (erreur) { setErreurFichier(erreur); return; }
      setRangees(r);
      setEtape("apercu");
    };
    lecteur.onerror = () => setErreurFichier("Impossible de lire ce fichier.");
    lecteur.readAsText(fichier, "utf-8");
  }

  async function lancerImport() {
    setEtape("import");
    setProgression({ fait: 0, total: rangees.length });
    const sortie = [];

    for (const r of rangees) {
      const dateAdhesion = versDate(r.mois_adhesion);
      if (!r.nom || !dateAdhesion) {
        sortie.push({ ligne: r._ligne, nom: r.nom || "—", ok: false, message: "Nom ou mois d'adhésion invalide." });
        setProgression((p) => ({ ...p, fait: p.fait + 1 }));
        continue;
      }

      const { data, error } = await supabase.rpc("importer_membre_avec_historique", {
        p_organisation_id: organisationId,
        p_nom: r.nom,
        p_telephone: r.telephone || null,
        p_poste: r.poste || null,
        p_service: r.service || null,
        p_mois_adhesion: dateAdhesion,
        p_mois_paye_jusqua: versDate(r.paye_jusqua),
      });

      if (error) {
        sortie.push({ ligne: r._ligne, nom: r.nom, ok: false, message: error.message });
      } else {
        sortie.push({ ligne: r._ligne, nom: r.nom, ok: true, message: `${data.mois_generes} mois générés` });
      }

      setProgression((p) => ({ ...p, fait: p.fait + 1 }));
    }

    setResultats(sortie);
    setEtape("resultat");
  }

  const succesCount = resultats.filter((r) => r.ok).length;

  return (
    <div className="imp-overlay" onClick={etape === "import" ? undefined : onClose}>
      <style>{CSS}</style>
      <div className="imp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="imp-head">
          <h3 className="imp-titre"><FileSpreadsheet size={18} /> Importer des membres</h3>
          {etape !== "import" && (
            <button className="imp-fermer" onClick={onClose}><X size={18} /></button>
          )}
        </div>

        {etape === "depot" && (
          <div className="imp-corps">
            <p className="imp-texte">
              Un fichier CSV, une ligne par membre. Colonnes attendues, dans n'importe quel ordre :
            </p>
            <div className="imp-colonnes">
              {COLONNES.map((c) => <code key={c}>{c}</code>)}
            </div>
            <p className="imp-texte imp-texte-petit">
              <code>mois_adhesion</code> et <code>paye_jusqua</code> au format AAAA-MM (ex : 2024-01).
              Laissez <code>paye_jusqua</code> vide si le membre n'a encore rien payé — son historique sera
              généré comme dû, exactement comme un mois qui n'aurait jamais été réglé.
            </p>

            {erreurFichier && <div className="imp-erreur"><AlertCircle size={15} /> {erreurFichier}</div>}

            <label className="imp-depot">
              <Upload size={22} />
              <span>Choisir un fichier CSV</span>
              <input type="file" accept=".csv,text/csv" onChange={onFichierChoisi} hidden />
            </label>
          </div>
        )}

        {etape === "apercu" && (
          <div className="imp-corps">
            <button className="imp-retour" onClick={() => setEtape("depot")}>
              <ArrowLeft size={14} /> Choisir un autre fichier
            </button>
            <p className="imp-texte">
              <strong>{rangees.length}</strong> ligne{rangees.length > 1 ? "s" : ""} détectée{rangees.length > 1 ? "s" : ""}
              — vérifiez avant de confirmer, l'import ne peut pas être annulé une fois lancé.
            </p>
            <div className="imp-tableau-scroll">
              <table className="imp-tableau">
                <thead>
                  <tr>
                    <th>Nom</th><th>Téléphone</th><th>Adhésion</th><th>Payé jusqu'à</th>
                  </tr>
                </thead>
                <tbody>
                  {rangees.map((r) => (
                    <tr key={r._ligne}>
                      <td>{r.nom || <em>manquant</em>}</td>
                      <td>{r.telephone || "—"}</td>
                      <td>{r.mois_adhesion || <em>manquant</em>}</td>
                      <td>{r.paye_jusqua || "aucun"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn-primary btn-full" onClick={lancerImport}>
              Importer ces {rangees.length} membre{rangees.length > 1 ? "s" : ""}
            </button>
          </div>
        )}

        {etape === "import" && (
          <div className="imp-corps imp-corps-centre">
            <Loader2 size={28} className="spin" />
            <p className="imp-texte">
              Import en cours — {progression.fait} / {progression.total}
            </p>
            <div className="imp-barre"><div style={{ width: `${(progression.fait / progression.total) * 100}%` }} /></div>
          </div>
        )}

        {etape === "resultat" && (
          <div className="imp-corps">
            <div className="imp-resultat-titre">
              <CheckCircle2 size={18} color={C.success} />
              {succesCount} sur {resultats.length} membre{resultats.length > 1 ? "s" : ""} importé{succesCount > 1 ? "s" : ""}
            </div>
            <div className="imp-tableau-scroll">
              <table className="imp-tableau">
                <thead><tr><th>Ligne</th><th>Nom</th><th>Résultat</th></tr></thead>
                <tbody>
                  {resultats.map((r) => (
                    <tr key={r.ligne} className={r.ok ? "" : "imp-ligne-erreur"}>
                      <td>{r.ligne}</td>
                      <td>{r.nom}</td>
                      <td>{r.ok ? r.message : <span className="imp-msg-erreur"><AlertCircle size={13} /> {r.message}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn-primary btn-full" onClick={onTermine}>Terminer</button>
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.imp-overlay{
  position:fixed; inset:0; z-index:300; background:rgba(10,20,40,.5);
  display:flex; align-items:center; justify-content:center; padding:${S.lg}px;
}
.imp-modal{
  background:${C.surface}; border-radius:${R.xxl}px; width:100%; max-width:560px;
  max-height:86vh; display:flex; flex-direction:column; box-shadow:${SHADOW.lg};
}
.imp-head{
  display:flex; align-items:center; justify-content:space-between;
  padding:18px 22px; border-bottom:1px solid ${C.border};
}
.imp-titre{ display:flex; align-items:center; gap:8px; font-size:16px; font-weight:700; margin:0; }
.imp-fermer{ background:none; border:none; cursor:pointer; color:${C.textSubtle}; padding:4px; }
.imp-corps{ padding:22px; overflow-y:auto; display:flex; flex-direction:column; gap:14px; }
.imp-corps-centre{ align-items:center; text-align:center; padding:40px 22px; }
.imp-texte{ font-size:13.5px; color:${C.textMuted}; line-height:1.55; margin:0; }
.imp-texte-petit{ font-size:12px; }
.imp-colonnes{ display:flex; flex-wrap:wrap; gap:6px; }
.imp-colonnes code{
  background:${C.bg}; border:1px solid ${C.border}; border-radius:6px;
  padding:4px 9px; font-size:12px; font-family:monospace;
}
.imp-erreur{
  display:flex; align-items:flex-start; gap:8px; background:${C.dangerSoft}; color:${C.danger};
  border-radius:${R.md}px; padding:11px 13px; font-size:13px;
}
.imp-depot{
  display:flex; flex-direction:column; align-items:center; gap:10px;
  border:2px dashed ${C.border}; border-radius:${R.lg}px; padding:32px;
  cursor:pointer; color:${C.textMuted}; font-size:13.5px; font-weight:600;
}
.imp-depot:hover{ border-color:${C.primary}; color:${C.primary}; }
.imp-retour{
  display:flex; align-items:center; gap:6px; background:none; border:none;
  color:${C.primary}; cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:600;
  padding:0; align-self:flex-start;
}
.imp-tableau-scroll{ max-height:260px; overflow-y:auto; border:1px solid ${C.border}; border-radius:${R.md}px; }
.imp-tableau{ width:100%; border-collapse:collapse; font-size:12.5px; }
.imp-tableau th{
  position:sticky; top:0; background:${C.bg}; text-align:left; padding:9px 12px;
  font-weight:700; color:${C.textMuted}; border-bottom:1px solid ${C.border};
}
.imp-tableau td{ padding:9px 12px; border-bottom:1px solid ${C.border}; }
.imp-tableau em{ color:${C.danger}; font-style:normal; }
.imp-ligne-erreur{ background:${C.dangerSoft}; }
.imp-msg-erreur{ display:flex; align-items:center; gap:5px; color:${C.danger}; }
.imp-resultat-titre{ display:flex; align-items:center; gap:8px; font-size:15px; font-weight:700; }
.imp-barre{
  width:100%; height:6px; border-radius:999px; background:${C.border}; overflow:hidden;
}
.imp-barre div{ height:100%; background:${C.primary}; transition:width .3s ease; }
.spin{ animation:impSpin 1s linear infinite; }
@keyframes impSpin{ to{ transform:rotate(360deg); } }
`;