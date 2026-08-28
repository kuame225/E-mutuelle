import React, { useEffect, useMemo, useState } from "react";
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2, ArrowLeft,
  ChevronRight, PieChart, Check,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function PartageBeneficesPage() {
  const { params } = useParametrage();
  const [exercices, setExercices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creation, setCreation] = useState(false);
  const [selected, setSelected] = useState(null);

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from("exercices_partage")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("created_at", { ascending: false });
    setExercices(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  if (selected) {
    return (
      <FicheExercice
        exercice={selected}
        onBack={() => setSelected(null)}
        onDelete={() => { setSelected(null); charger(); }}
      />
    );
  }

  return (
    <div className="pb-wrap">
      <style>{CSS}</style>

      <div className="pb-intro">
        <PieChart size={16} />
        <span>
          Intérêt calculé au prorata du capital détenu par chaque coopérateur.
          Le montant suggéré (ventes moins achats de la période) reste modifiable
          avant validation — rien n'est enregistré tant que vous n'avez pas confirmé.
        </span>
      </div>

      <div className="pb-tools">
        <button className="pb-btn" onClick={() => setCreation(true)}>
          <Plus size={17} /> Nouvel exercice
        </button>
      </div>

      {loading ? (
        <div className="pb-skel" />
      ) : exercices.length === 0 ? (
        <div className="pb-vide">
          <PieChart size={36} color={PALETTE.grey300} />
          <div className="pb-vide-titre">Aucun exercice de partage</div>
          <div className="pb-vide-sub">
            Préparez votre premier exercice une fois vos achats et ventes enregistrés.
          </div>
        </div>
      ) : (
        <ul className="pb-liste">
          {exercices.map((e) => (
            <li key={e.id} className="pb-ligne" onClick={() => setSelected(e)}>
              <div className="pb-ligne-corps">
                <div className="pb-ligne-titre">{e.libelle}</div>
                <div className="pb-ligne-meta">
                  {e.periode_debut && e.periode_fin
                    ? `${new Date(e.periode_debut).toLocaleDateString("fr-FR")} → ${new Date(e.periode_fin).toLocaleDateString("fr-FR")}`
                    : new Date(e.created_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <strong>{montant(e.montant_a_repartir)} FCFA</strong>
              <ChevronRight size={18} color={PALETTE.grey300} />
            </li>
          ))}
        </ul>
      )}

      {creation && (
        <ModalNouvelExercice
          organisationId={params.organisation_id}
          onCancel={() => setCreation(false)}
          onCree={(ex) => { setCreation(false); charger(); setSelected(ex); }}
        />
      )}
    </div>
  );
}

/* ---------------- Préparation d'un nouvel exercice ---------------- */

function ModalNouvelExercice({ organisationId, onCancel, onCree }) {
  const [libelle, setLibelle] = useState("");
  const [periodeDebut, setPeriodeDebut] = useState("");
  const [periodeFin, setPeriodeFin] = useState("");
  const [ventesPeriode, setVentesPeriode] = useState(null);
  const [achatsPeriode, setAchatsPeriode] = useState(null);
  const [montantARepartir, setMontantARepartir] = useState("");
  const [montantModifieAMain, setMontantModifieAMain] = useState(false);
  const [capitaux, setCapitaux] = useState([]);
  const [calculEnCours, setCalculEnCours] = useState(false);
  const [calcule, setCalcule] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [err, setErr] = useState("");

  async function calculer() {
    if (!periodeDebut || !periodeFin) { setErr("Indiquez la période concernée."); return; }
    if (periodeFin < periodeDebut) { setErr("La fin de période précède son début."); return; }

    setCalculEnCours(true);
    setErr("");

    const [{ data: ventes }, { data: achats }, { data: capital }] = await Promise.all([
      supabase.from("ventes_cooperative").select("montant")
        .eq("organisation_id", organisationId)
        .gte("date_vente", periodeDebut).lte("date_vente", periodeFin),
      supabase.from("achats_cooperative").select("montant")
        .eq("organisation_id", organisationId)
        .gte("date_achat", periodeDebut).lte("date_achat", periodeFin),
      supabase.from("capital_membres").select("*")
        .eq("organisation_id", organisationId)
        .gt("capital_total", 0)
        .order("nom"),
    ]);

    const totalVentes = (ventes || []).reduce((s, v) => s + Number(v.montant || 0), 0);
    const totalAchats = (achats || []).reduce((s, a) => s + Number(a.montant || 0), 0);
    const suggestion = Math.max(0, totalVentes - totalAchats);

    setVentesPeriode(totalVentes);
    setAchatsPeriode(totalAchats);
    setCapitaux(capital || []);
    if (!montantModifieAMain) setMontantARepartir(String(suggestion));
    setCalcule(true);
    setCalculEnCours(false);
  }

  const totalCapital = capitaux.reduce((s, c) => s + Number(c.capital_total), 0);
  const previewLignes = useMemo(() => {
    const m = parseFloat(montantARepartir) || 0;
    return capitaux.map((c) => ({
      ...c,
      part: totalCapital > 0 ? m * (Number(c.capital_total) / totalCapital) : 0,
    }));
  }, [capitaux, montantARepartir, totalCapital]);

  async function valider() {
    if (!libelle.trim()) { setErr("Indiquez un libellé (ex : Exercice 2025)."); return; }
    const m = parseInt(montantARepartir, 10);
    if (!m || m <= 0) { setErr("Indiquez un montant à répartir."); return; }
    if (totalCapital <= 0) { setErr("Aucun coopérateur ne détient de parts sociales pour l'instant."); return; }

    setEnCours(true);
    setErr("");

    const { data: exercice, error } = await supabase
      .from("exercices_partage")
      .insert({
        organisation_id: organisationId,
        libelle: libelle.trim(),
        periode_debut: periodeDebut || null,
        periode_fin: periodeFin || null,
        ventes_periode: ventesPeriode,
        achats_periode: achatsPeriode,
        montant_a_repartir: m,
      })
      .select()
      .single();

    if (error) { setEnCours(false); setErr(error.message); return; }

    const lignes = previewLignes
      .filter((l) => l.part > 0)
      .map((l) => ({
        exercice_id: exercice.id,
        membre_id: l.membre_id,
        capital_a_la_date: l.capital_total,
        montant_attribue: Math.round(l.part),
      }));

    const { error: errLignes } = await supabase.from("parts_repartition").insert(lignes);

    setEnCours(false);

    if (errLignes) { setErr(errLignes.message); return; }

    onCree(exercice);
  }

  return (
    <div className="pb-overlay" onClick={onCancel}>
      <div className="pb-modal">
        <header className="pb-modal-head">
          <h3 className="pb-modal-titre">Nouvel exercice de partage</h3>
          <button className="pb-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        <div className="pb-champ">
          <label className="pb-label" htmlFor="pb-libelle">Libellé</label>
          <input
            id="pb-libelle" className="pb-fld" value={libelle}
            onChange={(e) => setLibelle(e.target.value)} placeholder="Ex : Exercice 2025"
          />
        </div>

        <div className="pb-deux-champs">
          <div className="pb-champ">
            <label className="pb-label" htmlFor="pb-debut">Début de période</label>
            <input id="pb-debut" type="date" className="pb-fld" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} />
          </div>
          <div className="pb-champ">
            <label className="pb-label" htmlFor="pb-fin">Fin de période</label>
            <input id="pb-fin" type="date" className="pb-fld" max={new Date().toISOString().slice(0, 10)} value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} />
          </div>
        </div>

        <button className="pb-btn-calc" onClick={calculer} disabled={calculEnCours}>
          {calculEnCours ? <><Loader2 size={15} className="pb-spin" /> Calcul…</> : "Calculer la suggestion"}
        </button>

        {calcule && (
          <>
            <div className="pb-suggestion">
              <div>
                <span>{montant(ventesPeriode)} FCFA</span>
                <small>Ventes de la période</small>
              </div>
              <div>
                <span>{montant(achatsPeriode)} FCFA</span>
                <small>Achats de la période</small>
              </div>
            </div>

            <div className="pb-champ">
              <label className="pb-label" htmlFor="pb-montant">
                Montant à répartir <span className="pb-opt">— modifiable</span>
              </label>
              <div className="pb-fld-devise">
                <input
                  id="pb-montant" type="number" min="0" className="pb-fld"
                  value={montantARepartir}
                  onChange={(e) => { setMontantARepartir(e.target.value); setMontantModifieAMain(true); }}
                />
                <span>FCFA</span>
              </div>
            </div>

            {totalCapital <= 0 ? (
              <div className="pb-err">
                <AlertCircle size={15} /> Aucun coopérateur ne détient de parts sociales : rien à répartir.
              </div>
            ) : (
              <div className="pb-apercu">
                <div className="pb-apercu-titre">
                  Aperçu — {previewLignes.filter((l) => l.part > 0).length} coopérateur(s)
                </div>
                <ul className="pb-apercu-liste">
                  {previewLignes.filter((l) => l.part > 0).map((l) => (
                    <li key={l.membre_id}>
                      <span>{l.nom}</span>
                      <span className="pb-apercu-cap">{montant(l.capital_total)} FCFA détenus</span>
                      <strong>{montant(Math.round(l.part))} FCFA</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {err && <div className="pb-err"><AlertCircle size={15} /> {err}</div>}

        <div className="pb-modal-actions">
          <button className="pb-mbtn pb-mbtn-ghost" onClick={onCancel} disabled={enCours}>Annuler</button>
          <button
            className="pb-mbtn pb-mbtn-primary"
            onClick={valider}
            disabled={enCours || !calcule || totalCapital <= 0}
          >
            {enCours ? <><Loader2 size={16} className="pb-spin" /> Enregistrement…</> : "Valider la répartition"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Fiche exercice (détail + suivi des paiements) ---------------- */

function FicheExercice({ exercice, onBack, onDelete }) {
  const [lignes, setLignes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suppression, setSuppression] = useState(false);
  const [enCours, setEnCours] = useState(false);

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from("parts_repartition")
      .select("*, membres(nom)")
      .eq("exercice_id", exercice.id)
      .order("montant_attribue", { ascending: false });
    setLignes(data || []);
    setLoading(false);
  }

  useEffect(() => { charger(); }, [exercice.id]);

  async function basculerPaye(ligne) {
    setEnCours(true);
    const { error } = await supabase
      .from("parts_repartition")
      .update({
        paye: !ligne.paye,
        paye_le: !ligne.paye ? new Date().toISOString().slice(0, 10) : null,
      })
      .eq("id", ligne.id);
    setEnCours(false);
    if (!error) charger();
  }

  async function supprimerExercice() {
    setEnCours(true);
    const { error } = await supabase.from("exercices_partage").delete().eq("id", exercice.id);
    setEnCours(false);
    if (!error) onDelete();
  }

  const totalPaye = lignes.filter((l) => l.paye).reduce((s, l) => s + Number(l.montant_attribue), 0);

  return (
    <div className="pb-wrap">
      <style>{CSS}</style>

      <button className="pb-retour" onClick={onBack}>
        <ArrowLeft size={16} /> Retour aux exercices
      </button>

      <header className="pb-entete">
        <div>
          <h1 className="pb-titre">{exercice.libelle}</h1>
          <div className="pb-sous-titre">
            {exercice.periode_debut && exercice.periode_fin
              ? `${new Date(exercice.periode_debut).toLocaleDateString("fr-FR")} → ${new Date(exercice.periode_fin).toLocaleDateString("fr-FR")}`
              : `Créé le ${new Date(exercice.created_at).toLocaleDateString("fr-FR")}`}
          </div>
        </div>
        <button className="pb-lien pb-lien-danger" onClick={() => setSuppression(true)}>
          <Trash2 size={13} /> Supprimer
        </button>
      </header>

      <div className="pb-resume">
        <div>
          <span>{montant(exercice.montant_a_repartir)} FCFA</span>
          <small>Total réparti</small>
        </div>
        <div>
          <span>{montant(totalPaye)} FCFA</span>
          <small>Déjà versé</small>
        </div>
        <div>
          <span>{montant(exercice.montant_a_repartir - totalPaye)} FCFA</span>
          <small>Restant à verser</small>
        </div>
      </div>

      {loading ? (
        <div className="pb-skel" />
      ) : (
        <ul className="pb-liste-repartition">
          {lignes.map((l) => (
            <li key={l.id} className="pb-ligne-repartition">
              <div className="pb-repartition-corps">
                <div className="pb-repartition-nom">{l.membres?.nom || "—"}</div>
                <div className="pb-repartition-meta">{montant(l.capital_a_la_date)} FCFA détenus</div>
              </div>
              <strong>{montant(l.montant_attribue)} FCFA</strong>
              <button
                className={`pb-paye ${l.paye ? "is-on" : ""}`}
                onClick={() => basculerPaye(l)}
                disabled={enCours}
              >
                {l.paye ? <><Check size={13} /> Versé</> : "Marquer versé"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {suppression && (
        <div className="pb-overlay" onClick={() => setSuppression(false)}>
          <div className="pb-modal pb-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="pb-modal-titre">Supprimer cet exercice ?</h3>
            <p className="pb-modal-texte">
              La répartition de <strong>{montant(exercice.montant_a_repartir)} FCFA</strong> entre
              {" "}{lignes.length} coopérateur(s) sera définitivement supprimée.
            </p>
            <div className="pb-modal-actions">
              <button className="pb-mbtn pb-mbtn-ghost" onClick={() => setSuppression(false)} disabled={enCours}>
                Annuler
              </button>
              <button className="pb-mbtn pb-mbtn-danger" onClick={supprimerExercice} disabled={enCours}>
                {enCours ? <><Loader2 size={16} className="pb-spin" /> Suppression…</> : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Styles ---------------- */

const CSS = `
.pb-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .pb-wrap{ padding:${S.lg}px; } }

.pb-intro{
  display:flex; align-items:flex-start; gap:9px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:12px 15px;
  font-size:13px; color:${C.textMuted}; line-height:1.55;
}

.pb-tools{ display:flex; align-items:center; }
.pb-btn{
  margin-left:auto; display:flex; align-items:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.pb-btn:hover{ background:${C.primaryDark}; }

.pb-liste{
  list-style:none; margin:0; padding:0;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; overflow:hidden; box-shadow:${SHADOW.xs};
}
.pb-ligne{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border};
  cursor:pointer; transition:background .14s ease;
}
.pb-ligne:hover{ background:${C.bg}; }
.pb-ligne:last-child{ border-bottom:none; }
.pb-ligne-corps{ flex:1; min-width:0; }
.pb-ligne-titre{ font-size:14.5px; font-weight:600; }
.pb-ligne-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }

.pb-retour{
  display:flex; align-items:center; gap:7px; align-self:flex-start;
  background:none; border:none; color:${C.textMuted}; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; padding:0;
}
.pb-retour:hover{ color:${C.primary}; }

.pb-entete{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; }
.pb-titre{ font-size:22px; font-weight:700; letter-spacing:-.02em; margin:0; }
.pb-sous-titre{ font-size:13.5px; color:${C.textSubtle}; margin-top:4px; }
.pb-lien{
  display:flex; align-items:center; gap:6px; flex-shrink:0;
  background:none; border:none; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:600; padding:0;
}
.pb-lien-danger{ color:${C.danger}; }

.pb-resume{ display:flex; gap:${S.md}px; flex-wrap:wrap; }
.pb-resume > div{
  flex:1; min-width:140px; background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px;
  padding:${S.md}px ${S.lg}px; display:flex; flex-direction:column; gap:2px;
}
.pb-resume span{ font-size:18px; font-weight:700; letter-spacing:-.01em; }
.pb-resume small{ font-size:12px; color:${C.textSubtle}; }

.pb-liste-repartition{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.pb-ligne-repartition{
  display:flex; align-items:center; gap:${S.md}px; flex-wrap:wrap;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.md}px;
  padding:11px 15px;
}
.pb-repartition-corps{ flex:1; min-width:140px; }
.pb-repartition-nom{ font-size:14px; font-weight:600; }
.pb-repartition-meta{ font-size:12px; color:${C.textSubtle}; margin-top:2px; }
.pb-ligne-repartition strong{ font-size:14.5px; }
.pb-paye{
  flex-shrink:0; display:flex; align-items:center; gap:6px;
  background:${PALETTE.grey200}; color:${C.textMuted}; border:none;
  border-radius:${R.pill}px; padding:7px 13px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600;
  transition:background .16s ease, color .16s ease;
}
.pb-paye.is-on{ background:#DCFCE7; color:${C.success}; }
.pb-paye:disabled{ opacity:.6; cursor:not-allowed; }

/* ---- Modale ---- */
.pb-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; overflow-y:auto;
}
.pb-modal{ width:100%; max-width:560px; background:${C.surface}; border-radius:${R.xxl}px; padding:${S.xl}px; box-shadow:${SHADOW.lg}; margin:auto; }
.pb-modal-court{ max-width:440px; }
.pb-modal-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; margin-bottom:${S.lg}px; }
.pb-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.pb-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:8px 0 ${S.md}px; }
.pb-close{ background:none; border:1px solid ${C.border}; border-radius:${R.sm}px; color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex; }
.pb-close:hover{ color:${C.danger}; border-color:${C.danger}; }

.pb-champ{ display:flex; flex-direction:column; gap:6px; margin-bottom:${S.md}px; }
.pb-deux-champs{ display:grid; grid-template-columns:1fr 1fr; gap:${S.md}px; }
.pb-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.pb-opt{ font-weight:400; color:${C.textSubtle}; }
.pb-fld{
  width:100%; box-sizing:border-box; padding:11px 13px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px; color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.pb-fld:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.pb-fld-devise{ display:flex; align-items:center; gap:8px; }
.pb-fld-devise span{ font-size:13px; color:${C.textSubtle}; flex-shrink:0; }

.pb-btn-calc{
  width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
  background:${PALETTE.blue50}; color:${C.primary}; border:1.5px dashed ${PALETTE.blue200 || PALETTE.blue100};
  border-radius:${R.md}px; padding:11px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; margin-bottom:${S.md}px;
}
.pb-btn-calc:hover:not(:disabled){ background:${PALETTE.blue100}; }
.pb-btn-calc:disabled{ opacity:.7; cursor:not-allowed; }

.pb-suggestion{ display:flex; gap:${S.md}px; margin-bottom:${S.md}px; }
.pb-suggestion > div{
  flex:1; background:${C.bg}; border-radius:${R.md}px; padding:10px 13px;
  display:flex; flex-direction:column; gap:2px;
}
.pb-suggestion span{ font-size:15px; font-weight:700; }
.pb-suggestion small{ font-size:11.5px; color:${C.textSubtle}; }

.pb-apercu{
  background:${C.bg}; border-radius:${R.md}px; padding:${S.md}px; margin-bottom:${S.md}px;
}
.pb-apercu-titre{ font-size:12.5px; font-weight:700; color:${C.textMuted}; margin-bottom:${S.sm}px; }
.pb-apercu-liste{ list-style:none; margin:0; padding:0; max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; }
.pb-apercu-liste li{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  background:${C.surface}; border-radius:${R.sm}px; padding:8px 11px; font-size:13px;
}
.pb-apercu-liste li > span:first-child{ font-weight:600; flex:1; min-width:100px; }
.pb-apercu-cap{ font-size:11.5px; color:${C.textSubtle}; }
.pb-apercu-liste strong{ color:${C.primary}; }

.pb-err{
  display:flex; align-items:flex-start; gap:8px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:11px 13px; font-size:13px; line-height:1.5; margin-bottom:${S.md}px;
}

.pb-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }
.pb-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.pb-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.pb-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.pb-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.pb-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.pb-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.pb-mbtn-ghost{ flex:1; background:${C.surface}; color:${C.textMuted}; border:1.5px solid ${C.border}; }
.pb-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.pb-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.pb-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.pb-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:44ch; line-height:1.6; }
.pb-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:pbShim 1.4s infinite;
}
.pb-spin{ animation:pbSpin 1s linear infinite; }
@keyframes pbSpin{ to{ transform:rotate(360deg); } }
@keyframes pbShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;