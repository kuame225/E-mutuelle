import React, { useState } from "react";
import {
  X, Upload, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, Pencil, ArrowLeft,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, R, S, SHADOW } from "./theme";

// Colonnes attendues du CSV. Le bénéficiaire est identifié par son nom :
// l'ONG ne connaît pas les identifiants internes de la plateforme.
const COLONNES = [
  "beneficiaire", "activite", "type_agr", "cout_projet", "montant_accorde",
  "taux", "date_decaissement", "date_fin_remboursement", "deja_rembourse",
];

function analyserCsv(texte) {
  const lignes = texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lignes.length < 2) {
    return { erreur: "Le fichier ne contient aucune ligne de données.", rangees: [] };
  }

  // Point-virgule ou virgule : Excel français produit l'un, les outils
  // anglophones l'autre. On détecte plutôt que d'imposer.
  const separateur = lignes[0].includes(";") ? ";" : ",";
  const entete = lignes[0].split(separateur).map((c) => c.trim().toLowerCase());

  if (!entete.includes("beneficiaire") || !entete.includes("montant_accorde")) {
    return {
      erreur: "Colonnes manquantes — au minimum \"beneficiaire\" et \"montant_accorde\".",
      rangees: [],
    };
  }

  const rangees = lignes.slice(1).map((ligne, i) => {
    const valeurs = ligne.split(separateur).map((c) => c.trim());
    const rangee = {};
    entete.forEach((col, idx) => { rangee[col] = valeurs[idx] || ""; });
    rangee._ligne = i + 2;
    return rangee;
  });

  return { erreur: null, rangees };
}

export default function ReprendreAppuiModal({ organisationId, beneficiaires, onClose, onTermine }) {
  const [mode, setMode] = useState(null); // null | manuel | csv
  return (
    <div className="rp-overlay" onClick={onClose}>
      <div className="rp-modal" onClick={(e) => e.stopPropagation()}>
        <style>{CSS}</style>

        <div className="rp-head">
          <h3 className="rp-titre">Reprendre un appui existant</h3>
          <button className="rp-fermer" onClick={onClose}><X size={18} /></button>
        </div>

        {mode === null && (
          <div className="rp-corps">
            <p className="rp-texte">
              Pour les appuis déjà décaissés avant l'inscription sur la plateforme.
              La décision ayant été prise hors application, ils sont saisis directement
              à leur état réel, sans passer par le circuit de validation.
            </p>
            <button className="rp-choix" onClick={() => setMode("manuel")}>
              <Pencil size={20} />
              <span>
                <strong>Saisie manuelle</strong>
                <em>Un appui à la fois</em>
              </span>
            </button>
            <button className="rp-choix" onClick={() => setMode("csv")}>
              <FileSpreadsheet size={20} />
              <span>
                <strong>Import d'un fichier</strong>
                <em>Plusieurs appuis d'un coup, depuis un CSV</em>
              </span>
            </button>
          </div>
        )}

        {mode === "manuel" && (
          <SaisieManuelle
            organisationId={organisationId} beneficiaires={beneficiaires}
            onRetour={() => setMode(null)} onTermine={onTermine}
          />
        )}

        {mode === "csv" && (
          <ImportCsv
            organisationId={organisationId} beneficiaires={beneficiaires}
            onRetour={() => setMode(null)} onTermine={onTermine}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------- Saisie manuelle ---------------- */

function SaisieManuelle({ organisationId, beneficiaires, onRetour, onTermine }) {
  const [form, setForm] = useState({
    beneficiaire_id: beneficiaires[0]?.id || "",
    activite: "", type_agr: "", cout_projet: "",
    montant_accorde: "", taux: "0",
    date_decaissement: "", date_fin_remboursement: "",
    deja_rembourse: "", date_dernier_versement: "",
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const maj = (cle, v) => setForm((f) => ({ ...f, [cle]: v }));

  async function enregistrer() {
    if (!form.beneficiaire_id) { setErreur("Choisissez un bénéficiaire."); return; }
    if (!form.montant_accorde || Number(form.montant_accorde) <= 0) {
      setErreur("Le montant accordé est obligatoire."); return;
    }
    if (!form.date_decaissement) {
      setErreur("La date de décaissement est obligatoire."); return;
    }

    setEnvoi(true);
    setErreur("");

    const { error } = await supabase.rpc("reprendre_appui_existant", {
      p_organisation_id: organisationId,
      p_beneficiaire_id: form.beneficiaire_id,
      p_activite_a_entreprendre: form.activite.trim() || null,
      p_type_agr: form.type_agr.trim() || null,
      p_cout_projet: form.cout_projet ? Number(form.cout_projet) : null,
      p_montant_accorde: Number(form.montant_accorde),
      p_taux_interet_pct: Number(form.taux) || 0,
      p_date_decaissement: form.date_decaissement,
      p_date_fin_remboursement: form.date_fin_remboursement || null,
      p_deja_rembourse: form.deja_rembourse ? Number(form.deja_rembourse) : 0,
      p_date_dernier_versement: form.date_dernier_versement || null,
    });

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }
    onTermine();
  }

  return (
    <div className="rp-corps">
      <button className="rp-retour" onClick={onRetour}>
        <ArrowLeft size={14} /> Changer de méthode
      </button>

      <label className="rp-label">Bénéficiaire *</label>
      <select className="rp-input" value={form.beneficiaire_id}
        onChange={(e) => maj("beneficiaire_id", e.target.value)}>
        {beneficiaires.length === 0 && <option value="">Aucun bénéficiaire enregistré</option>}
        {beneficiaires.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
      </select>

      <label className="rp-label">Activité</label>
      <input className="rp-input" value={form.activite}
        onChange={(e) => maj("activite", e.target.value)} />

      <label className="rp-label">Type d'AGR</label>
      <input className="rp-input" value={form.type_agr}
        onChange={(e) => maj("type_agr", e.target.value)}
        placeholder="Commerce, élevage, transformation…" />

      <div className="rp-duo">
        <div>
          <label className="rp-label">Coût du projet (FCFA)</label>
          <input className="rp-input" type="number" value={form.cout_projet}
            onChange={(e) => maj("cout_projet", e.target.value)} />
        </div>
        <div>
          <label className="rp-label">Montant accordé (FCFA) *</label>
          <input className="rp-input" type="number" value={form.montant_accorde}
            onChange={(e) => maj("montant_accorde", e.target.value)} />
        </div>
      </div>

      <div className="rp-duo">
        <div>
          <label className="rp-label">Taux d'intérêt (%)</label>
          <input className="rp-input" type="number" step="0.1" value={form.taux}
            onChange={(e) => maj("taux", e.target.value)} />
        </div>
        <div>
          <label className="rp-label">Date de décaissement *</label>
          <input className="rp-input" type="date" value={form.date_decaissement}
            onChange={(e) => maj("date_decaissement", e.target.value)} />
        </div>
      </div>

      <label className="rp-label">Fin de remboursement prévue</label>
      <input className="rp-input" type="date" value={form.date_fin_remboursement}
        onChange={(e) => maj("date_fin_remboursement", e.target.value)} />

      <div className="rp-encadre">
        <div className="rp-encadre-titre">Remboursements déjà effectués</div>
        <div className="rp-duo">
          <div>
            <label className="rp-label">Total déjà remboursé (FCFA)</label>
            <input className="rp-input" type="number" value={form.deja_rembourse}
              onChange={(e) => maj("deja_rembourse", e.target.value)} />
          </div>
          <div>
            <label className="rp-label">Date du dernier versement</label>
            <input className="rp-input" type="date" value={form.date_dernier_versement}
              onChange={(e) => maj("date_dernier_versement", e.target.value)} />
          </div>
        </div>
        <p className="rp-note">
          Laissez vide si rien n'a encore été remboursé. Le détail versement par versement
          pourra être saisi ensuite par l'ASC, comme pour un appui normal.
        </p>
      </div>

      {erreur && <div className="rp-erreur"><AlertCircle size={15} /> {erreur}</div>}

      <button className="btn-primary btn-full" onClick={enregistrer} disabled={envoi}>
        {envoi ? <><Loader2 size={15} className="rp-spin" /> Enregistrement…</> : "Reprendre cet appui"}
      </button>
    </div>
  );
}

/* ---------------- Import CSV ---------------- */

function ImportCsv({ organisationId, beneficiaires, onRetour, onTermine }) {
  const [rangees, setRangees] = useState([]);
  const [erreurFichier, setErreurFichier] = useState("");
  const [progression, setProgression] = useState({ fait: 0, total: 0 });
  const [resultats, setResultats] = useState(null);
  const [enCours, setEnCours] = useState(false);

  // Correspondance par nom, insensible à la casse et aux espaces —
  // l'ONG saisit des noms, pas des identifiants internes.
  const parNom = {};
  beneficiaires.forEach((b) => { parNom[b.nom.trim().toLowerCase()] = b.id; });

  function onFichier(e) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setErreurFichier("");

    const lecteur = new FileReader();
    lecteur.onload = () => {
      const { erreur, rangees: r } = analyserCsv(String(lecteur.result));
      if (erreur) { setErreurFichier(erreur); return; }
      setRangees(r);
    };
    lecteur.onerror = () => setErreurFichier("Impossible de lire ce fichier.");
    lecteur.readAsText(fichier, "utf-8");
  }

  async function lancer() {
    setEnCours(true);
    setProgression({ fait: 0, total: rangees.length });
    const sortie = [];

    for (const r of rangees) {
      const idBenef = parNom[(r.beneficiaire || "").trim().toLowerCase()];

      if (!idBenef) {
        sortie.push({
          ligne: r._ligne, nom: r.beneficiaire || "—", ok: false,
          message: "Bénéficiaire introuvable — vérifiez l'orthographe du nom.",
        });
        setProgression((p) => ({ ...p, fait: p.fait + 1 }));
        continue;
      }

      const { error } = await supabase.rpc("reprendre_appui_existant", {
        p_organisation_id: organisationId,
        p_beneficiaire_id: idBenef,
        p_activite_a_entreprendre: r.activite || null,
        p_type_agr: r.type_agr || null,
        p_cout_projet: r.cout_projet ? Number(r.cout_projet) : null,
        p_montant_accorde: Number(r.montant_accorde),
        p_taux_interet_pct: Number(r.taux) || 0,
        p_date_decaissement: r.date_decaissement || null,
        p_date_fin_remboursement: r.date_fin_remboursement || null,
        p_deja_rembourse: r.deja_rembourse ? Number(r.deja_rembourse) : 0,
        p_date_dernier_versement: null,
      });

      sortie.push({
        ligne: r._ligne, nom: r.beneficiaire, ok: !error,
        message: error ? error.message : "Repris",
      });
      setProgression((p) => ({ ...p, fait: p.fait + 1 }));
    }

    setEnCours(false);
    setResultats(sortie);
  }

  if (resultats) {
    const succes = resultats.filter((r) => r.ok).length;
    return (
      <div className="rp-corps">
        <div className="rp-resultat-titre">
          <CheckCircle2 size={18} color={C.success} />
          {succes} sur {resultats.length} appui{resultats.length > 1 ? "s" : ""} repris
        </div>
        <div className="rp-scroll">
          <table className="rp-tableau">
            <thead><tr><th>Ligne</th><th>Bénéficiaire</th><th>Résultat</th></tr></thead>
            <tbody>
              {resultats.map((r) => (
                <tr key={r.ligne} className={r.ok ? "" : "rp-ligne-err"}>
                  <td>{r.ligne}</td>
                  <td>{r.nom}</td>
                  <td>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn-primary btn-full" onClick={onTermine}>Terminer</button>
      </div>
    );
  }

  if (enCours) {
    return (
      <div className="rp-corps rp-corps-centre">
        <Loader2 size={28} className="rp-spin" />
        <p className="rp-texte">Reprise en cours — {progression.fait} / {progression.total}</p>
      </div>
    );
  }

  return (
    <div className="rp-corps">
      <button className="rp-retour" onClick={onRetour}>
        <ArrowLeft size={14} /> Changer de méthode
      </button>

      {rangees.length === 0 ? (
        <>
          <p className="rp-texte">Colonnes attendues, dans n'importe quel ordre :</p>
          <div className="rp-colonnes">
            {COLONNES.map((c) => <code key={c}>{c}</code>)}
          </div>
          <p className="rp-note">
            Le bénéficiaire est reconnu par son nom — il doit déjà exister dans la liste.
            Les dates au format AAAA-MM-JJ. Séparateur point-virgule ou virgule.
          </p>

          {erreurFichier && <div className="rp-erreur"><AlertCircle size={15} /> {erreurFichier}</div>}

          <label className="rp-depot">
            <Upload size={22} />
            <span>Choisir un fichier CSV</span>
            <input type="file" accept=".csv,text/csv" onChange={onFichier} hidden />
          </label>
        </>
      ) : (
        <>
          <p className="rp-texte">
            <strong>{rangees.length}</strong> ligne{rangees.length > 1 ? "s" : ""} détectée{rangees.length > 1 ? "s" : ""}.
            Vérifiez avant de confirmer — la reprise ne peut pas être annulée.
          </p>
          <div className="rp-scroll">
            <table className="rp-tableau">
              <thead>
                <tr><th>Bénéficiaire</th><th>Montant</th><th>Décaissé le</th><th>Remboursé</th></tr>
              </thead>
              <tbody>
                {rangees.map((r) => {
                  const connu = parNom[(r.beneficiaire || "").trim().toLowerCase()];
                  return (
                    <tr key={r._ligne} className={connu ? "" : "rp-ligne-err"}>
                      <td>{r.beneficiaire || <em>manquant</em>}{!connu && " (introuvable)"}</td>
                      <td>{r.montant_accorde}</td>
                      <td>{r.date_decaissement || "—"}</td>
                      <td>{r.deja_rembourse || "0"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button className="btn-primary btn-full" onClick={lancer}>
            Reprendre ces {rangees.length} appui{rangees.length > 1 ? "s" : ""}
          </button>
        </>
      )}
    </div>
  );
}

const CSS = `
.rp-overlay{
  position:fixed; inset:0; z-index:320; background:rgba(10,20,40,.5);
  display:flex; align-items:center; justify-content:center; padding:${S.lg}px;
}
.rp-modal{
  background:${C.surface}; border-radius:${R.xxl}px; width:100%; max-width:560px;
  max-height:88vh; display:flex; flex-direction:column; box-shadow:${SHADOW.lg};
}
.rp-head{
  display:flex; align-items:center; justify-content:space-between;
  padding:18px 22px; border-bottom:1px solid ${C.border};
}
.rp-titre{ font-size:17px; font-weight:700; margin:0; }
.rp-fermer{ background:none; border:none; cursor:pointer; color:${C.textSubtle}; padding:4px; }
.rp-corps{ padding:22px; overflow-y:auto; display:flex; flex-direction:column; gap:10px; }
.rp-corps-centre{ align-items:center; text-align:center; padding:44px 22px; }
.rp-texte{ font-size:13.5px; color:${C.textMuted}; line-height:1.55; margin:0; }
.rp-note{ font-size:12px; color:${C.textSubtle}; line-height:1.45; margin:2px 0 0; }

.rp-choix{
  display:flex; align-items:center; gap:14px; text-align:left;
  background:${C.bg}; border:1.5px solid ${C.border}; border-radius:${R.lg}px;
  padding:16px 18px; cursor:pointer; font-family:inherit; color:${C.text};
}
.rp-choix:hover{ border-color:${C.primary}; }
.rp-choix span{ display:flex; flex-direction:column; gap:3px; }
.rp-choix strong{ font-size:14.5px; }
.rp-choix em{ font-size:12.5px; color:${C.textSubtle}; font-style:normal; }

.rp-retour{
  display:flex; align-items:center; gap:6px; background:none; border:none;
  color:${C.primary}; cursor:pointer; font-family:inherit;
  font-size:12.5px; font-weight:600; padding:0; align-self:flex-start;
}
.rp-label{ font-size:12.5px; font-weight:600; color:${C.textMuted}; margin-top:4px; }
.rp-input{
  width:100%; box-sizing:border-box; padding:11px 13px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  font-family:inherit; font-size:14px; outline:none;
}
.rp-duo{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
@media (max-width:520px){ .rp-duo{ grid-template-columns:1fr; } }

.rp-encadre{
  background:${C.bg}; border-radius:${R.md}px; padding:14px; margin-top:6px;
  display:flex; flex-direction:column; gap:8px;
}
.rp-encadre-titre{ font-size:13px; font-weight:700; }

.rp-colonnes{ display:flex; flex-wrap:wrap; gap:6px; }
.rp-colonnes code{
  background:${C.bg}; border:1px solid ${C.border}; border-radius:6px;
  padding:4px 9px; font-size:11.5px; font-family:monospace;
}
.rp-depot{
  display:flex; flex-direction:column; align-items:center; gap:10px;
  border:2px dashed ${C.border}; border-radius:${R.lg}px; padding:30px;
  cursor:pointer; color:${C.textMuted}; font-size:13.5px; font-weight:600;
}
.rp-depot:hover{ border-color:${C.primary}; color:${C.primary}; }

.rp-scroll{ max-height:240px; overflow-y:auto; border:1px solid ${C.border}; border-radius:${R.md}px; }
.rp-tableau{ width:100%; border-collapse:collapse; font-size:12.5px; }
.rp-tableau th{
  position:sticky; top:0; background:${C.bg}; text-align:left; padding:9px 12px;
  font-weight:700; color:${C.textMuted}; border-bottom:1px solid ${C.border};
}
.rp-tableau td{ padding:9px 12px; border-bottom:1px solid ${C.border}; }
.rp-tableau em{ color:${C.danger}; font-style:normal; }
.rp-ligne-err{ background:#FEE2E2; }
.rp-resultat-titre{ display:flex; align-items:center; gap:9px; font-size:15px; font-weight:700; }

.rp-erreur{
  display:flex; align-items:flex-start; gap:8px; background:#FEE2E2; color:${C.danger};
  border-radius:${R.md}px; padding:11px 13px; font-size:13px; line-height:1.45;
}
.rp-spin{ animation:rpSpin 1s linear infinite; }
@keyframes rpSpin{ to{ transform:rotate(360deg); } }
`;