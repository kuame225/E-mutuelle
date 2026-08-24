import React, { useEffect, useState } from "react";
import {
  Plus, ArrowLeft, Loader2, HandHeart, X, AlertCircle,
  CheckCircle2, Clock, XCircle, Search, ShieldAlert, CalendarClock,
  Info,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const STATUTS = {
  en_attente: { label: "En attente",  color: C.textMuted, soft: PALETTE.grey200, Icon: Clock,
                texte: "Votre demande a été enregistrée et attend l'examen du Bureau." },
  en_examen:  { label: "En examen",   color: C.warning,   soft: "#FEF3C7", Icon: Search,
                texte: "Le Bureau étudie actuellement votre dossier." },
  validee:    { label: "Validée",     color: C.success,   soft: "#DCFCE7", Icon: CheckCircle2,
                texte: "Votre demande est acceptée. Le versement sera effectué prochainement." },
  payee:      { label: "Payée",       color: C.success,   soft: "#DCFCE7", Icon: CheckCircle2,
                texte: "L'aide vous a été versée." },
  rejetee:    { label: "Rejetée",     color: C.danger,    soft: "#FEE2E2", Icon: XCircle,
                texte: "Votre demande n'a pas pu être retenue." },
};

const CATEGORIES = [
  { id: "heureux",    titre: "Événements heureux" },
  { id: "malheureux", titre: "Événements malheureux" },
];

export default function MembreAides({ membre, onBack }) {
  const [aides, setAides] = useState([]);
  const [bareme, setBareme] = useState([]);
  const [suspendu, setSuspendu] = useState(false);
  const [eligibilite, setEligibilite] = useState(null);       // sans type : carence + arriérés
  const [eligibiliteType, setEligibiliteType] = useState(null); // pour le type choisi
  const [verifType, setVerifType] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formOuvert, setFormOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [form, setForm] = useState({ type_aide: "", description: "", montant: "" });

  async function charger() {
    const [aidesRes, sanctRes, baremeRes, eligRes] = await Promise.all([
      supabase.from("aides_sociales").select("*")
        .eq("membre_id", membre.id)
        .order("created_at", { ascending: false }),
      supabase.from("sanctions_acces").select("id")
        .eq("membre_id", membre.id)
        .eq("type_sanction", "aides_suspendues")
        .is("date_levee", null),
      supabase.from("bareme_prestations").select("*")
        .eq("actif", true)
        .order("ordre"),
      supabase.rpc("verifier_eligibilite_prestation", { p_membre_id: membre.id }),
    ]);

    setAides(aidesRes.data || []);
    setSuspendu((sanctRes.data || []).length > 0);
    setBareme(baremeRes.data || []);
    setEligibilite(eligRes.data?.[0] || null);
    setLoading(false);
  }

  useEffect(() => { charger(); }, [membre.id]);

  // Vérification propre au type choisi (prestation déjà accordée, mutation…)
  useEffect(() => {
    if (!formOuvert || !form.type_aide) { setEligibiliteType(null); return; }

    let annule = false;
    setVerifType(true);

    supabase
      .rpc("verifier_eligibilite_prestation", {
        p_membre_id: membre.id,
        p_type_aide: form.type_aide,
      })
      .then(({ data }) => {
        if (annule) return;
        setEligibiliteType(data?.[0] || null);
        setVerifType(false);
      });

    return () => { annule = true; };
  }, [formOuvert, form.type_aide, membre.id]);

  const ligneBareme = bareme.find((b) => b.type_aide === form.type_aide) || null;
  const eligibleGlobal = eligibilite?.eligible === true;
  const peutSoumettre =
    eligibleGlobal && eligibiliteType?.eligible === true && !verifType && !envoi;

  // Montant : fixe pour la plupart, calculé pour la mutation, libre pour l'article 29
  const montantLibre = ligneBareme && !ligneBareme.montant_calcule
    && ligneBareme.montant_membre === 0;
  const montantAffiche = ligneBareme?.montant_calcule
    ? (eligibiliteType?.montant_prevu ?? 0)
    : (ligneBareme?.montant_membre ?? 0);

  function ouvrirFormulaire() {
    const premier = bareme[0]?.type_aide || "";
    setForm({ type_aide: premier, description: "", montant: "" });
    setErreur("");
    setFormOuvert(true);
  }

  async function soumettre() {
    if (!form.type_aide) { setErreur("Choisissez le type d'événement."); return; }
    if (!form.description.trim()) {
      setErreur("Décrivez brièvement votre situation.");
      return;
    }

    setEnvoi(true);
    setErreur("");

    // Dernière vérification côté serveur, au cas où la situation aurait changé
    const { data: verif } = await supabase.rpc("verifier_eligibilite_prestation", {
      p_membre_id: membre.id,
      p_type_aide: form.type_aide,
    });

    if (!verif?.[0]?.eligible) {
      setEnvoi(false);
      setErreur(verif?.[0]?.motif || "Votre situation ne permet pas cette demande.");
      setEligibiliteType(verif?.[0] || null);
      return;
    }

    const montantDemande = montantLibre
      ? (parseInt(form.montant, 10) || null)
      : (verif[0].montant_prevu || null);

    const { error } = await supabase.from("aides_sociales").insert({
      membre_id: membre.id,
      organisation_id: membre.organisation_id,
      type_aide: form.type_aide,
      description: form.description.trim(),
      montant_demande: montantDemande,
    });

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }

    setForm({ type_aide: "", description: "", montant: "" });
    setFormOuvert(false);
    charger();
  }

  return (
    <div className="ma-wrap">
      <style>{CSS}</style>

      <button className="ma-back" onClick={onBack}>
        <ArrowLeft size={16} /> Retour
      </button>

      <header className="ma-head">
        <div>
          <h1 className="ma-titre">Mes demandes d'aide</h1>
          <p className="ma-sub">
            Sollicitez le soutien de la mutuelle en cas de besoin.
          </p>
        </div>
        {!suspendu && eligibleGlobal && (
          <button className="ma-btn-new" onClick={ouvrirFormulaire}>
            <Plus size={17} /> Nouvelle demande
          </button>
        )}
      </header>

      {/* ---- Accès suspendu ---- */}
      {suspendu && (
        <div className="ma-bloque">
          <ShieldAlert size={20} />
          <div>
            <strong>Accès temporairement suspendu</strong>
            <p>
              Votre retard de cotisation suspend l'accès aux aides sociales.
              Il sera rétabli automatiquement dès régularisation.
            </p>
          </div>
        </div>
      )}

      {/* ---- Conditions d'accès aux prestations ---- */}
      {!loading && !suspendu && eligibilite && !eligibilite.eligible && (
        <div className="ma-bloque">
          <CalendarClock size={20} />
          <div>
            <strong>Vous ne pouvez pas encore déposer de demande</strong>
            <p>{eligibilite.motif}</p>

            {eligibilite.date_eligibilite &&
              new Date(eligibilite.date_eligibilite) > new Date() && (
              <p>
                Vous deviendrez éligible à partir du{" "}
                <strong>
                  {new Date(eligibilite.date_eligibilite).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </strong>.
              </p>
            )}

            {eligibilite.periodes_dues?.length > 0 && (
              <p>
                Cotisations à régulariser :{" "}
                <strong>{eligibilite.periodes_dues.map(formatPeriode).join(", ")}</strong>.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---- Liste ---- */}
      {loading ? (
        <div className="ma-skel" />
      ) : aides.length === 0 ? (
        <div className="ma-empty">
          <HandHeart size={38} color={PALETTE.grey300} />
          <div className="ma-empty-titre">Aucune demande</div>
          <div className="ma-empty-sub">
            En cas de difficulté, la mutuelle peut vous accompagner.
            Vos demandes apparaîtront ici avec leur suivi.
          </div>
        </div>
      ) : (
        <ul className="ma-list">
          {aides.map((a) => {
            const st = STATUTS[a.statut] || STATUTS.en_attente;
            const ligne = bareme.find((b) => b.type_aide === a.type_aide);
            return (
              <li key={a.id} className="ma-card">
                <div className="ma-card-head">
                  <span className="ma-card-icon" style={{ background: st.soft, color: st.color }}>
                    <st.Icon size={19} />
                  </span>
                  <div className="ma-card-id">
                    <div className="ma-card-type">{ligne ? ligne.libelle : a.type_aide}</div>
                    <div className="ma-card-date">
                      Déposée le {new Date(a.created_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <span className="ma-chip" style={{ background: st.soft, color: st.color }}>
                    {st.label}
                  </span>
                </div>

                <p className="ma-etat">{st.texte}</p>

                {a.description && (
                  <p className="ma-desc">{a.description}</p>
                )}

                <div className="ma-montants">
                  {a.montant_demande ? (
                    <span className="ma-montant">
                      Prévu <strong>{montant(a.montant_demande)} F</strong>
                    </span>
                  ) : null}
                  {a.montant_valide ? (
                    <span className="ma-montant is-ok">
                      Accordé <strong>{montant(a.montant_valide)} F</strong>
                    </span>
                  ) : null}
                </div>

                {a.motif_rejet && (
                  <div className="ma-motif">
                    <strong>Motif :</strong> {a.motif_rejet}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* ---- Formulaire ---- */}
      {formOuvert && (
        <div className="ma-overlay" onClick={() => setFormOuvert(false)}>
          <div className="ma-modal" onClick={(e) => e.stopPropagation()}>
            <header className="ma-modal-head">
              <div>
                <h2 className="ma-modal-titre">Nouvelle demande</h2>
                <p className="ma-modal-sub">
                  Choisissez l'événement concerné. Les montants sont fixés par le
                  règlement intérieur de la mutuelle.
                </p>
              </div>
              <button
                className="ma-close"
                onClick={() => setFormOuvert(false)}
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </header>

            {/* Type d'événement, groupé comme à l'article 19 */}
            {CATEGORIES.map((cat) => {
              const lignes = bareme.filter((b) => b.categorie === cat.id);
              if (lignes.length === 0) return null;

              return (
                <div className="ma-field" key={cat.id}>
                  <span className="ma-label">{cat.titre}</span>
                  <div className="ma-types">
                    {lignes.map((b) => (
                      <button
                        key={b.type_aide}
                        className={`ma-type ${form.type_aide === b.type_aide ? "is-on" : ""}`}
                        onClick={() => setForm((f) => ({ ...f, type_aide: b.type_aide }))}
                      >
                        <span className="ma-radio">
                          {form.type_aide === b.type_aide && <span className="ma-radio-dot" />}
                        </span>
                        <span className="ma-type-text">
                          <strong>{b.libelle}</strong>
                          <em>{descriptionBareme(b)}</em>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Montant prévu par les textes */}
            {ligneBareme && (
              <div className="ma-field">
                <span className="ma-label">Montant prévu</span>

                {verifType ? (
                  <div className="ma-fixe">
                    <Loader2 size={16} className="ma-spin" /> Vérification…
                  </div>
                ) : montantLibre ? (
                  <>
                    <div className="ma-input-wrap">
                      <input
                        type="number"
                        value={form.montant}
                        onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
                        placeholder="0"
                        className="ma-input"
                      />
                      <span className="ma-devise">FCFA</span>
                    </div>
                    <p className="ma-note">
                      <Info size={13} /> {ligneBareme.article} : le montant de l'aide
                      est arrêté par l'Assemblée Générale. Le chiffre indiqué reste indicatif.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="ma-fixe">
                      <strong>{montant(montantAffiche)} FCFA</strong>
                      {eligibiliteType?.montant_don > 0 && (
                        <span>
                          {" "}+ don de {montant(eligibiliteType.montant_don)} FCFA à la famille
                        </span>
                      )}
                    </div>
                    <p className="ma-note">
                      <Info size={13} /> Montant fixé par {ligneBareme.article} du règlement
                      intérieur.
                      {ligneBareme.montant_calcule &&
                        " Il correspond à la moitié de vos cotisations versées."}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Blocage propre au type choisi */}
            {eligibiliteType && !eligibiliteType.eligible && !verifType && (
              <div className="ma-erreur">
                <AlertCircle size={16} /> {eligibiliteType.motif}
              </div>
            )}

            <div className="ma-field">
              <label className="ma-label" htmlFor="desc">Votre situation</label>
              <textarea
                id="desc"
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Précisez la date de l'événement et les éléments utiles au Bureau…"
                className="ma-textarea"
              />
            </div>

            {erreur && (
              <div className="ma-erreur">
                <AlertCircle size={16} /> {erreur}
              </div>
            )}

            <div className="ma-modal-actions">
              <button
                className="ma-btn ma-btn-ghost"
                onClick={() => setFormOuvert(false)}
                disabled={envoi}
              >
                Annuler
              </button>
              <button
                className="ma-btn ma-btn-primary"
                onClick={soumettre}
                disabled={!peutSoumettre}
              >
                {envoi
                  ? <><Loader2 size={17} className="ma-spin" /> Envoi…</>
                  : "Soumettre ma demande"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Utilitaires ---------------- */

function descriptionBareme(b) {
  if (b.montant_calcule) return `${b.article} · 50 % des cotisations versées`;
  if (b.montant_membre === 0) return `${b.article} · montant arrêté en Assemblée Générale`;

  const base = `${b.article} · ${montant(b.montant_membre)} F`;
  const don = b.montant_don > 0 ? ` + ${montant(b.montant_don)} F à la famille` : "";
  const unique = b.une_seule_fois ? " · une seule fois" : "";
  return base + don + unique;
}

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

const CSS = `
.ma-wrap{
  max-width:640px; margin:0 auto; padding:${S.lg}px ${S.lg}px ${S.xxxl}px;
  display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
.ma-back{
  display:flex; align-items:center; gap:7px; align-self:flex-start;
  background:none; border:none; padding:0; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; color:${C.primary};
}
.ma-back:hover{ text-decoration:underline; }

.ma-head{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:${S.md}px; flex-wrap:wrap;
}
.ma-titre{ font-size:22px; font-weight:700; letter-spacing:-.02em; margin:0; }
.ma-sub{ font-size:14px; color:${C.textSubtle}; margin:4px 0 0; }
.ma-btn-new{
  display:flex; align-items:center; gap:7px; flex-shrink:0;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.ma-btn-new:hover{ background:${C.primaryDark}; }

/* ---- Blocage ---- */
.ma-bloque{
  display:flex; align-items:flex-start; gap:${S.md}px;
  background:#FEF3C7; border:1px solid ${C.warning}44;
  border-radius:${R.lg}px; padding:${S.lg}px; color:#92400E;
}
.ma-bloque strong{ font-size:14.5px; }
.ma-bloque p{ font-size:13.5px; margin:4px 0 0; line-height:1.55; }

/* ---- Cartes ---- */
.ma-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:${S.md}px; }
.ma-card{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.ma-card-head{ display:flex; align-items:center; gap:${S.md}px; }
.ma-card-icon{
  width:42px; height:42px; border-radius:${R.md}px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.ma-card-id{ flex:1; min-width:0; }
.ma-card-type{ font-size:15.5px; font-weight:600; }
.ma-card-date{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }
.ma-chip{
  flex-shrink:0; padding:5px 12px; border-radius:${R.pill}px;
  font-size:12px; font-weight:600; white-space:nowrap;
}
.ma-etat{
  font-size:13.5px; color:${C.textMuted}; line-height:1.55;
  margin:${S.md}px 0 0;
}
.ma-desc{
  font-size:13.5px; color:${C.text}; line-height:1.6;
  background:${C.bg}; border-radius:${R.md}px;
  padding:12px 14px; margin:${S.md}px 0 0; white-space:pre-wrap;
}
.ma-montants{ display:flex; gap:${S.lg}px; margin-top:${S.md}px; flex-wrap:wrap; }
.ma-montant{ font-size:13px; color:${C.textSubtle}; }
.ma-montant strong{ color:${C.text}; margin-left:4px; }
.ma-montant.is-ok strong{ color:${C.success}; }
.ma-motif{
  margin-top:${S.md}px; background:#FEE2E2; color:${C.danger};
  border-radius:${R.md}px; padding:11px 14px; font-size:13px; line-height:1.5;
}

/* ---- Modale ---- */
.ma-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; animation:maFade .18s ease; overflow-y:auto;
}
.ma-modal{
  width:100%; max-width:500px; background:${C.surface};
  border-radius:${R.xxl}px; padding:${S.xl}px;
  box-shadow:${SHADOW.lg}; animation:maUp .22s cubic-bezier(.4,0,.2,1);
  margin:auto;
}
.ma-modal-head{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:${S.md}px; margin-bottom:${S.xl}px;
}
.ma-modal-titre{ font-size:20px; font-weight:700; letter-spacing:-.02em; margin:0; }
.ma-modal-sub{ font-size:13.5px; color:${C.textSubtle}; margin:4px 0 0; line-height:1.5; }
.ma-close{
  background:none; border:1px solid ${C.border}; border-radius:${R.sm}px;
  color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex;
}
.ma-close:hover{ color:${C.danger}; border-color:${C.danger}; }

/* ---- Champs ---- */
.ma-field{ margin-bottom:${S.lg}px; }
.ma-label{
  display:block; font-size:14px; font-weight:600;
  color:${C.textMuted}; margin-bottom:9px;
}
.ma-types{ display:flex; flex-direction:column; gap:${S.sm}px; }
.ma-type{
  display:flex; align-items:flex-start; gap:${S.md}px; width:100%;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:13px 15px; cursor:pointer;
  font-family:inherit; text-align:left; transition:all .16s ease;
}
.ma-type:hover{ border-color:${PALETTE.grey300}; }
.ma-type.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.ma-radio{
  width:19px; height:19px; border-radius:50%; flex-shrink:0; margin-top:1px;
  border:2px solid ${PALETTE.grey300};
  display:flex; align-items:center; justify-content:center;
  transition:border-color .16s ease;
}
.ma-type.is-on .ma-radio{ border-color:${C.primary}; }
.ma-radio-dot{ width:9px; height:9px; border-radius:50%; background:${C.primary}; }
.ma-type-text{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.ma-type-text strong{ font-size:14.5px; font-weight:600; }
.ma-type-text em{ font-style:normal; font-size:12.5px; color:${C.textSubtle}; line-height:1.45; }

.ma-fixe{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:14px 16px;
  font-size:15px; color:${C.text};
}
.ma-fixe strong{ font-size:19px; font-weight:700; color:${C.primary}; }
.ma-fixe span{ font-size:13.5px; color:${C.textMuted}; }

.ma-note{
  display:flex; align-items:flex-start; gap:6px;
  font-size:12.5px; color:${C.textSubtle};
  line-height:1.5; margin:8px 0 0;
}

.ma-textarea, .ma-input{
  width:100%; box-sizing:border-box; padding:13px 15px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:15px;
  color:${C.text}; outline:none; line-height:1.55;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.ma-textarea{ resize:vertical; }
.ma-textarea:focus, .ma-input:focus{
  border-color:${C.primary}; box-shadow:${SHADOW.focus};
}
.ma-input-wrap{ position:relative; }
.ma-input{ padding-right:60px; }
.ma-devise{
  position:absolute; right:15px; top:50%; transform:translateY(-50%);
  font-size:13px; font-weight:600; color:${C.textSubtle}; pointer-events:none;
}

.ma-erreur{
  display:flex; align-items:flex-start; gap:9px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:12px 14px; font-size:13.5px; line-height:1.5;
  margin-bottom:${S.lg}px;
}

.ma-modal-actions{ display:flex; gap:${S.md}px; }
.ma-btn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:14px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:15px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.ma-btn:disabled{ opacity:.6; cursor:not-allowed; }
.ma-btn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.ma-btn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.ma-btn-ghost{
  flex:1; background:${C.surface}; color:${C.textMuted};
  border:1.5px solid ${C.border};
}
.ma-btn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.ma-empty{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.ma-empty-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.ma-empty-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:40ch; line-height:1.6; }
.ma-skel{
  height:130px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:maShim 1.4s infinite;
}
.ma-spin{ animation:maSpin 1s linear infinite; }
@keyframes maSpin{ to{ transform:rotate(360deg); } }
@keyframes maShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
@keyframes maFade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes maUp{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;