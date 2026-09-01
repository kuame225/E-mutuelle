import React, { useEffect, useState } from "react";
import {
  Loader2, AlertCircle, CheckCircle2, X, Check, Clock,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { useVocabulaire } from "./useVocabulaire";
import { C, R, S, SHADOW, PALETTE } from "./theme";
import PaiementModal from "./PaiementModal";

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatPeriode(periode) {
  const mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const [annee, m] = String(periode).split("-");
  const index = parseInt(m, 10) - 1;
  return mois[index] ? `${mois[index]} ${annee}` : periode;
}

const TYPES_LABEL = {
  wave: "Wave", orange_money: "Orange Money", mtn_money: "MTN Money",
  moov_money: "Moov Money", autre: "Autre",
};

const FILTRES = [
  { id: "en_attente", label: "En attente" },
  { id: "confirmee",  label: "Confirmées" },
  { id: "rejetee",    label: "Rejetées" },
];

export default function DeclarationsPaiementPage() {
  const { params } = useParametrage();
  const { mot } = useVocabulaire();

  const [declarations, setDeclarations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState("en_attente");
  const [confirmationCible, setConfirmationCible] = useState(null); // { declaration, cotisation, membre }
  const [confirmationGroupee, setConfirmationGroupee] = useState(null); // { declaration, cotisations }
  const [rejetCible, setRejetCible] = useState(null);
  const [motifRejet, setMotifRejet] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function charger() {
    setLoading(true);
    const { data, error } = await supabase
      .from("declarations_paiement")
      .select("*, membres(nom), moyens_paiement(type, libelle)")
      .eq("organisation_id", params.organisation_id)
      .eq("statut", filtre)
      .order("created_at", { ascending: false });

    if (error) setMessage({ type: "err", texte: error.message });
    setDeclarations(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.organisation_id, filtre]);

  function notifier(texte) {
    setMessage({ type: "ok", texte });
    setTimeout(() => setMessage(null), 3500);
  }

  async function marquerTraitee(id, statut, extra = {}) {
    const { data: userData } = await supabase.auth.getUser();
    return supabase
      .from("declarations_paiement")
      .update({ statut, traite_par: userData.user?.id, traite_le: new Date().toISOString(), ...extra })
      .eq("id", id);
  }

  async function ouvrirConfirmation(d) {
    if (d.cotisation_ids?.length) {
      // Déclaration groupée — jamais via PaiementModal (bâti pour une
      // seule cotisation). On récupère juste de quoi montrer un
      // récapitulatif avant de confirmer, la répartition elle-même
      // étant faite par enregistrer_paiement_groupe().
      setEnCours(true);
      const { data: cots, error } = await supabase
        .from("cotisations")
        .select("id, periode, montant_du, montant_paye")
        .in("id", d.cotisation_ids);
      setEnCours(false);

      if (error) { setMessage({ type: "err", texte: error.message }); return; }
      setConfirmationGroupee({ declaration: d, cotisations: cots || [] });
      return;
    }

    if (!d.cotisation_id) {
      // Pas d'échéance précisée par le membre : on ne peut pas rattacher
      // automatiquement à une cotisation. On marque confirmée pour la
      // sortir de la file, à charge pour le Bureau d'enregistrer le
      // paiement là où il correspond réellement (droit d'adhésion, aide…).
      setEnCours(true);
      const { error } = await marquerTraitee(d.id, "confirmee");
      setEnCours(false);
      if (error) { setMessage({ type: "err", texte: error.message }); return; }
      notifier("Déclaration confirmée — enregistrez le paiement dans l'écran correspondant.");
      charger();
      return;
    }

    setEnCours(true);
    const { data: cotisation, error } = await supabase
      .from("cotisations")
      .select("*")
      .eq("id", d.cotisation_id)
      .maybeSingle();
    setEnCours(false);

    if (error || !cotisation) {
      setMessage({ type: "err", texte: "Échéance introuvable — elle a peut-être été supprimée." });
      return;
    }

    setConfirmationCible({ declaration: d, cotisation, membre: { nom: d.membres?.nom } });
  }

  // Se déclenche à la fermeture de PaiementModal, qu'il y ait eu paiement
  // ou simple annulation. On vérifie l'état réel de la cotisation plutôt
  // que de supposer qu'une fermeture signifie un succès : PaiementModal
  // n'a jamais été lu ici, impossible de se fier à un contrat de callback
  // qu'on n'a pas vérifié.
  async function apresFermetureModal() {
    const { declaration, cotisation } = confirmationCible;
    setConfirmationCible(null);

    const { data: maj } = await supabase
      .from("cotisations")
      .select("montant_paye")
      .eq("id", cotisation.id)
      .maybeSingle();

    const paiementEnregistre = maj && Number(maj.montant_paye) > Number(cotisation.montant_paye);

    if (paiementEnregistre) {
      await marquerTraitee(declaration.id, "confirmee");
      notifier("Paiement enregistré et déclaration confirmée.");
      charger();
    }
    // Sinon : rien n'a été enregistré (fenêtre fermée sans valider) — la
    // déclaration reste en attente, on ne recharge même pas la liste.
  }

  // Même principe qu'apresFermetureModal, mais sans PaiementModal : la
  // répartition est faite côté serveur par enregistrer_paiement_groupe(),
  // qui rappelle enregistrer_paiement() une fois par cotisation.
  async function confirmerGroupee() {
    const { declaration } = confirmationGroupee;
    setEnCours(true);

    const { error } = await supabase.rpc("enregistrer_paiement_groupe", {
      p_cotisation_ids: declaration.cotisation_ids,
      p_montant_total: declaration.montant,
      p_mode: declaration.moyens_paiement?.type || "autre",
      p_reference: declaration.reference,
    });

    if (error) {
      setEnCours(false);
      setMessage({ type: "err", texte: error.message });
      return;
    }

    const { error: majErr } = await marquerTraitee(declaration.id, "confirmee");
    setEnCours(false);
    setConfirmationGroupee(null);

    if (majErr) { setMessage({ type: "err", texte: majErr.message }); return; }
    notifier("Paiement enregistré et déclaration confirmée.");
    charger();
  }

  async function rejeter() {
    setEnCours(true);
    const { error } = await marquerTraitee(rejetCible.id, "rejetee", {
      motif_rejet: motifRejet.trim() || null,
    });
    setEnCours(false);
    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    setRejetCible(null);
    setMotifRejet("");
    notifier("Déclaration rejetée.");
    charger();
  }

  return (
    <div className="dp-wrap">
      <style>{CSS}</style>

      {message && (
        <div className={`dp-msg ${message.type === "ok" ? "is-ok" : "is-err"}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} aria-label="Fermer"><X size={15} /></button>
        </div>
      )}

      <nav className="dp-tabs">
        {FILTRES.map((f) => (
          <button
            key={f.id}
            className={`dp-tab ${filtre === f.id ? "is-on" : ""}`}
            onClick={() => setFiltre(f.id)}
          >
            {f.label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="dp-skel" />
      ) : declarations.length === 0 ? (
        <div className="dp-vide">
          <Clock size={36} color={PALETTE.grey300} />
          <div className="dp-vide-titre">
            Aucune déclaration {FILTRES.find((f) => f.id === filtre)?.label.toLowerCase()}
          </div>
        </div>
      ) : (
        <ul className="dp-liste">
          {declarations.map((d) => (
            <li key={d.id} className="dp-ligne">
              <div className="dp-ligne-corps">
                <div className="dp-ligne-titre">{d.membres?.nom || "—"}</div>
                <div className="dp-ligne-date">
                  {new Date(d.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  {" à "}
                  {new Date(d.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="dp-ligne-meta">
                  {d.cotisation_ids?.length > 1 && `${d.cotisation_ids.length} échéances · `}
                  {TYPES_LABEL[d.moyens_paiement?.type] || d.moyens_paiement?.libelle || "Moyen non précisé"}
                  {d.reference && ` · Réf. ${d.reference}`}
                </div>
                {d.note && <div className="dp-ligne-note">{d.note}</div>}
                {d.statut === "rejetee" && d.motif_rejet && (
                  <div className="dp-ligne-motif">Motif : {d.motif_rejet}</div>
                )}
              </div>
              <strong>{montant(d.montant)} FCFA</strong>

              {filtre === "en_attente" && (
                <div className="dp-actions">
                  <button className="dp-btn-confirmer" onClick={() => ouvrirConfirmation(d)} disabled={enCours}>
                    <Check size={14} /> Confirmer
                  </button>
                  <button
                    className="dp-btn-rejeter"
                    onClick={() => { setRejetCible(d); setMotifRejet(""); }}
                    disabled={enCours}
                  >
                    <X size={14} /> Rejeter
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirmationCible && (
        <PaiementModal
          cotisation={confirmationCible.cotisation}
          membre={confirmationCible.membre}
          onClose={apresFermetureModal}
          onSuccess={() => {}}
        />
      )}

      {confirmationGroupee && (
        <div className="dp-overlay" onClick={() => setConfirmationGroupee(null)}>
          <div className="dp-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="dp-modal-titre">Confirmer ce paiement groupé ?</h3>
            <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none" }}>
              {confirmationGroupee.cotisations.map((c) => (
                <li
                  key={c.id}
                  style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "7px 0", fontSize: 13.5, color: C.textMuted,
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <span>{formatPeriode(c.periode)}</span>
                  <span>{montant(c.montant_du - c.montant_paye)} F restant</span>
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 14, margin: "0 0 16px" }}>
              Montant déclaré : <strong>{montant(confirmationGroupee.declaration.montant)} FCFA</strong>
            </p>
            <div className="dp-modal-actions">
              <button className="dp-mbtn dp-mbtn-ghost" onClick={() => setConfirmationGroupee(null)} disabled={enCours}>
                Annuler
              </button>
              <button
                className="dp-mbtn"
                style={{ flex: 2, background: C.success, color: "#fff" }}
                onClick={confirmerGroupee}
                disabled={enCours}
              >
                {enCours ? <><Loader2 size={16} className="dp-spin" /> Enregistrement…</> : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejetCible && (
        <div className="dp-overlay" onClick={() => setRejetCible(null)}>
          <div className="dp-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="dp-modal-titre">Rejeter cette déclaration ?</h3>
            <div className="dp-champ">
              <label className="dp-label" htmlFor="dp-motif">
                Motif <span className="dp-opt">— facultatif, visible par le {mot("membre_singulier").toLowerCase()}</span>
              </label>
              <textarea
                id="dp-motif" rows={2} className="dp-fld"
                value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)}
              />
            </div>
            <div className="dp-modal-actions">
              <button className="dp-mbtn dp-mbtn-ghost" onClick={() => setRejetCible(null)} disabled={enCours}>
                Annuler
              </button>
              <button className="dp-mbtn dp-mbtn-danger" onClick={rejeter} disabled={enCours}>
                {enCours ? <><Loader2 size={16} className="dp-spin" /> Envoi…</> : "Rejeter"}
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
.dp-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .dp-wrap{ padding:${S.lg}px; } }

.dp-msg{
  display:flex; align-items:center; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
}
.dp-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.dp-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }
.dp-msg button{ margin-left:auto; background:none; border:none; cursor:pointer; color:inherit; opacity:.7; display:flex; padding:0; }

.dp-tabs{ display:flex; gap:6px; background:${PALETTE.grey100}; border-radius:${R.pill}px; padding:4px; width:fit-content; }
.dp-tab{
  background:none; border:none; border-radius:${R.pill}px; padding:9px 16px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; color:${C.textMuted};
  transition:background .16s ease, color .16s ease;
}
.dp-tab.is-on{ background:${C.surface}; color:${C.primary}; box-shadow:${SHADOW.xs}; }

.dp-liste{
  list-style:none; margin:0; padding:0;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; overflow:hidden; box-shadow:${SHADOW.xs};
}
.dp-ligne{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border}; flex-wrap:wrap;
}
.dp-ligne:last-child{ border-bottom:none; }
.dp-ligne-corps{ flex:1; min-width:180px; }
.dp-ligne-titre{ font-size:14.5px; font-weight:600; }
.dp-ligne-date{ font-size:13px; font-weight:600; color:${C.primary}; margin-top:3px; }
.dp-ligne-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }
.dp-ligne-note{ font-size:13px; color:${C.textMuted}; margin-top:4px; }
.dp-ligne-motif{ font-size:12.5px; color:${C.danger}; margin-top:4px; }

.dp-actions{ display:flex; gap:6px; flex-shrink:0; }
.dp-btn-confirmer{
  display:flex; align-items:center; gap:5px;
  background:#DCFCE7; color:${C.success}; border:none;
  border-radius:${R.pill}px; padding:7px 13px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600;
}
.dp-btn-confirmer:hover:not(:disabled){ background:#BBF7D0; }
.dp-btn-rejeter{
  display:flex; align-items:center; gap:5px;
  background:${PALETTE.grey200}; color:${C.textMuted}; border:none;
  border-radius:${R.pill}px; padding:7px 13px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600;
}
.dp-btn-rejeter:hover:not(:disabled){ background:#FEE2E2; color:${C.danger}; }
.dp-actions button:disabled{ opacity:.6; cursor:not-allowed; }

/* ---- Modale (rejet) ---- */
.dp-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; overflow-y:auto;
}
.dp-modal{ width:100%; max-width:440px; background:${C.surface}; border-radius:${R.xxl}px; padding:${S.xl}px; box-shadow:${SHADOW.lg}; margin:auto; }
.dp-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0 0 ${S.md}px; }
.dp-champ{ display:flex; flex-direction:column; gap:6px; margin-bottom:${S.md}px; }
.dp-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.dp-opt{ font-weight:400; color:${C.textSubtle}; }
.dp-fld{
  width:100%; box-sizing:border-box; padding:11px 13px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px; color:${C.text}; outline:none;
}
.dp-fld:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }

.dp-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }
.dp-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.dp-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.dp-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.dp-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.dp-mbtn-ghost{ flex:1; background:${C.surface}; color:${C.textMuted}; border:1.5px solid ${C.border}; }
.dp-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.dp-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.dp-vide-titre{ font-size:15px; font-weight:600; margin-top:${S.sm}px; }
.dp-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:dpShim 1.4s infinite;
}
.dp-spin{ animation:dpSpin 1s linear infinite; }
@keyframes dpSpin{ to{ transform:rotate(360deg); } }
@keyframes dpShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;