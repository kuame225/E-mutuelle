import React, { useState } from "react";
import {
  Check, Clock, User, Briefcase, ClipboardCheck, ArrowRight,
  ArrowLeft, Loader2, AlertCircle, Mail, Phone, Paperclip,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";
import { useParametrage } from "./useParametrage";
import { useVocabulaire } from "./useVocabulaire";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const ETAPES = [
  { titre: "Identité",  Icon: User },
  { titre: "Fonction",  Icon: Briefcase },
  { titre: "Validation", Icon: ClipboardCheck },
];

export default function AdhesionFlow() {
  const { session } = useAuth();
  const { params } = useParametrage();
  const { mot, motMaj } = useVocabulaire();
  const [etape, setEtape] = useState(0);
  const [form, setForm] = useState({
    nom: "", tel: "", email: "", poste: "", service: "", justificatif: false,
  });
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const [erreurGlobale, setErreurGlobale] = useState("");
  const [termine, setTermine] = useState(false);

  const maj = (champ, valeur) => {
    setForm((f) => ({ ...f, [champ]: valeur }));
    if (erreurs[champ]) setErreurs((e) => ({ ...e, [champ]: null }));
  };

  function validerEtape(n) {
    const e = {};

if (n === 0) {
  if (!form.nom.trim()) e.nom = "Le nom est obligatoire.";
  else if (form.nom.trim().length < 3) e.nom = "Nom trop court.";

  if (!form.tel.trim()) e.tel = "Le numéro est obligatoire.";
  else if (form.tel.replace(/\D/g, "").length < 8) e.tel = "Numéro incomplet.";

  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()))
    e.email = "Adresse e-mail invalide.";
}

    if (n === 1) {
      if (!form.poste.trim()) e.poste = "Le poste est obligatoire.";
      if (!form.service.trim()) e.service = "Le service est obligatoire.";
    }

    setErreurs(e);
    return Object.keys(e).length === 0;
  }

  function suivant() {
    if (!validerEtape(etape)) return;
    setEtape((n) => n + 1);
  }

  async function soumettre() {
    setEnvoi(true);
    setErreurGlobale("");

    const email = form.email.trim().toLowerCase();
    const telephone = form.tel.trim();

    if (!params.organisation_id) {
      setEnvoi(false);
      setErreurGlobale(
        "L'organisation n'a pas pu être identifiée. Rechargez la page et réessayez."
      );
      return;
    }

    // Refuser un doublon déjà en attente. L'adresse e-mail étant facultative,
    // la recherche porte sur le téléphone lorsqu'elle n'est pas renseignée —
    // sans quoi une chaîne vide correspondrait à toutes les demandes sans
    // adresse.
    let requete = supabase
      .from("adhesions")
      .select("id, statut")
      .eq("organisation_id", params.organisation_id)
      .eq("statut", "en_attente");

    requete = email
      ? requete.eq("email", email)
      : requete.eq("telephone", telephone);

    const { data: existante } = await requete.maybeSingle();

    if (existante) {
      setEnvoi(false);
      setErreurGlobale(
        email
          ? "Une demande est déjà en cours avec cette adresse e-mail. " +
            `${motMaj("bureau_le")} la traitera prochainement.`
          : "Une demande est déjà en cours avec ce numéro de téléphone. " +
            `${motMaj("bureau_le")} la traitera prochainement.`
      );
      return;
    }

    const { error } = await supabase.from("adhesions").insert({
      user_id: session?.user?.id ?? null,
      organisation_id: params.organisation_id,
      nom: form.nom.trim(),
      telephone,
      email: email || null,
      poste: form.poste.trim(),
      service: form.service.trim(),
      a_justificatif: form.justificatif,
    });

    setEnvoi(false);
    if (error) {
      setErreurGlobale("Une erreur est survenue : " + error.message);
      return;
    }
    setTermine(true);
  }

  /* ---------- Écran de confirmation ---------- */
  if (termine) {
    return (
      <div className="af-wrap">
        <style>{CSS}</style>
        <div className="af-done">
          <div className="af-done-icon"><Clock size={34} /></div>
          <h2 className="af-done-titre">Demande transmise</h2>
          <p className="af-done-texte">
            Votre pré-inscription a bien été enregistrée. {motMaj("bureau_le")} l'examinera
            dans les prochains jours.
          </p>

          <div className="af-done-recap">
            <RecapLigne label="Nom" valeur={form.nom} />
            <RecapLigne label="Poste" valeur={form.poste} />
            <RecapLigne label="Service" valeur={form.service} />
            <RecapLigne label="Adresse e-mail" valeur={form.email} />
          </div>

          <div className="af-done-next">
            <Mail size={17} />
            <span>
              Dès validation, un lien de connexion vous sera envoyé à
              l'adresse <strong>{form.email}</strong>.
            </span>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Formulaire ---------- */
  return (
    <div className="af-wrap">
      <style>{CSS}</style>

      <header className="af-head">
        <h1 className="af-titre">{mot("adherer")}</h1>
        <p className="af-sous-titre">
          Trois étapes suffisent. Votre demande sera ensuite validée par {mot("bureau_le")}.
        </p>
      </header>

      {/* ---- Progression ---- */}
      <ol className="af-steps">
        {ETAPES.map((e, i) => {
          const fait = i < etape;
          const actif = i === etape;
          return (
            <li key={e.titre} className="af-step">
              <div className={`af-step-dot ${fait ? "is-done" : actif ? "is-on" : ""}`}>
                {fait ? <Check size={15} /> : <e.Icon size={15} />}
              </div>
              <span className={`af-step-label ${actif ? "is-on" : ""}`}>{e.titre}</span>
              {i < ETAPES.length - 1 && (
                <div className={`af-step-line ${fait ? "is-done" : ""}`} />
              )}
            </li>
          );
        })}
      </ol>

      <div className="af-card">

        {/* ---- Étape 1 ---- */}
        {etape === 0 && (
          <div className="af-form">
            <h2 className="af-card-titre">Vos informations</h2>
            <p className="af-card-sub">
              Ces coordonnées permettront de vous contacter et
              de créer votre accès.
            </p>

            <Champ
              label="Nom et prénoms" id="nom" erreur={erreurs.nom} Icon={User}
              value={form.nom} onChange={(v) => maj("nom", v)}
              placeholder="Ex : Koné Aïssata"
            />

            <Champ
              label="Numéro de téléphone" id="tel" erreur={erreurs.tel} Icon={Phone}
              value={form.tel} onChange={(v) => maj("tel", v)}
              placeholder="Ex : 07 12 34 56 78" type="tel"
            />

            <Champ
              label="Adresse e-mail" id="email" erreur={erreurs.email} Icon={Mail}
              value={form.email} onChange={(v) => maj("email", v)}
              placeholder="Ex : vous@exemple.com" type="email"
              aide="Indispensable pour accéder à votre espace personnel."
            />
          </div>
        )}

        {/* ---- Étape 2 ---- */}
        {etape === 1 && (
          <div className="af-form">
            <h2 className="af-card-titre">Votre fonction</h2>
            <p className="af-card-sub">
              Ces éléments permettent de vérifier votre rattachement à
              l'établissement.
            </p>

            <Champ
              label="Poste occupé" id="poste" erreur={erreurs.poste} Icon={Briefcase}
              value={form.poste} onChange={(v) => maj("poste", v)}
              placeholder="Ex : Infirmier, Sage-femme, Agent d'entretien…"
            />

            <Champ
              label="Service ou département" id="service" erreur={erreurs.service} Icon={Briefcase}
              value={form.service} onChange={(v) => maj("service", v)}
              placeholder="Ex : Pédiatrie, Maternité, Laboratoire…"
            />

            <label className="af-check">
              <input
                type="checkbox"
                checked={form.justificatif}
                onChange={(e) => maj("justificatif", e.target.checked)}
              />
              <span className="af-check-box">
                {form.justificatif && <Check size={13} strokeWidth={3} />}
              </span>
              <span className="af-check-text">
                <Paperclip size={14} /> Je dispose d'une pièce justificative d'emploi
                <em>Elle vous sera demandée lors de la validation.</em>
              </span>
            </label>
          </div>
        )}

        {/* ---- Étape 3 ---- */}
        {etape === 2 && (
          <div className="af-form">
            <h2 className="af-card-titre">Vérifiez vos informations</h2>
            <p className="af-card-sub">
              Une fois envoyée, votre demande sera examinée par {mot("bureau_le")}.
            </p>

            <div className="af-recap">
              <RecapLigne label="Nom et prénoms" valeur={form.nom} />
              <RecapLigne label="Téléphone" valeur={form.tel} />
              <RecapLigne label="Adresse e-mail" valeur={form.email} />
              <RecapLigne label="Poste" valeur={form.poste} />
              <RecapLigne label="Service" valeur={form.service} />
              <RecapLigne
                label="Pièce justificative"
                valeur={form.justificatif ? "Disponible" : "Non fournie"}
              />
            </div>

            {erreurGlobale && (
              <div className="af-alerte">
                <AlertCircle size={17} />
                <span>{erreurGlobale}</span>
              </div>
            )}
          </div>
        )}

        {/* ---- Navigation ---- */}
        <div className="af-actions">
          {etape > 0 && (
            <button
              className="af-btn af-btn-ghost"
              onClick={() => { setEtape((n) => n - 1); setErreurGlobale(""); }}
              disabled={envoi}
            >
              <ArrowLeft size={17} /> Retour
            </button>
          )}

          {etape < 2 ? (
            <button className="af-btn af-btn-primary" onClick={suivant}>
              Continuer <ArrowRight size={17} />
            </button>
          ) : (
            <button
              className="af-btn af-btn-primary"
              onClick={soumettre}
              disabled={envoi}
            >
              {envoi
                ? <><Loader2 size={17} className="af-spin" /> Envoi en cours…</>
                : <><Check size={17} /> Envoyer ma demande</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Sous-composants ---------------- */

function Champ({ label, id, value, onChange, placeholder, erreur, Icon, type = "text", aide }) {
  return (
    <div className="af-champ">
      <label htmlFor={id} className="af-label">{label}</label>
      <div className={`af-input-wrap ${erreur ? "is-err" : ""}`}>
        {Icon && <Icon size={17} className="af-input-icon" />}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="af-input"
        />
      </div>
      {erreur ? (
        <span className="af-err"><AlertCircle size={13} /> {erreur}</span>
      ) : aide ? (
        <span className="af-aide">{aide}</span>
      ) : null}
    </div>
  );
}

function RecapLigne({ label, valeur }) {
  return (
    <div className="af-recap-ligne">
      <span className="af-recap-label">{label}</span>
      <span className="af-recap-valeur">{valeur || "—"}</span>
    </div>
  );
}

/* ---------------- Styles ---------------- */

const CSS = `
.af-wrap{
  max-width:540px; margin:0 auto; width:100%;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}

/* ---- En-tête ---- */
.af-head{ margin-bottom:${S.xl}px; }
.af-titre{ font-size:26px; font-weight:700; letter-spacing:-.025em; margin:0; }
.af-sous-titre{ font-size:15px; color:${C.textSubtle}; margin:6px 0 0; line-height:1.55; }

/* ---- Progression ---- */
.af-steps{
  list-style:none; margin:0 0 ${S.xl}px; padding:0;
  display:flex; justify-content:space-between;
}
.af-step{
  position:relative; flex:1; display:flex; flex-direction:column;
  align-items:center; gap:7px;
}
.af-step-dot{
  width:38px; height:38px; border-radius:50%; z-index:1;
  background:${C.surface}; border:2px solid ${C.border}; color:${PALETTE.grey300};
  display:flex; align-items:center; justify-content:center;
  transition:all .25s ease;
}
.af-step-dot.is-on{
  background:${C.primary}; border-color:${C.primary}; color:#fff;
  box-shadow:0 0 0 5px ${PALETTE.blue100};
}
.af-step-dot.is-done{ background:${C.success}; border-color:${C.success}; color:#fff; }
.af-step-label{ font-size:12.5px; font-weight:600; color:${C.textSubtle}; }
.af-step-label.is-on{ color:${C.primary}; }
.af-step-line{
  position:absolute; top:19px; left:50%; width:100%; height:2px;
  background:${C.border}; z-index:0; transition:background .3s ease;
}
.af-step-line.is-done{ background:${C.success}; }

/* ---- Carte ---- */
.af-card{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xxl}px; padding:${S.xl}px; box-shadow:${SHADOW.md};
}
@media (min-width:560px){ .af-card{ padding:${S.xxl}px; } }
.af-card-titre{ font-size:19px; font-weight:700; letter-spacing:-.015em; margin:0; }
.af-card-sub{ font-size:14px; color:${C.textSubtle}; margin:5px 0 ${S.xl}px; line-height:1.55; }
.af-form{ display:flex; flex-direction:column; }

/* ---- Champs ---- */
.af-champ{ display:flex; flex-direction:column; gap:7px; margin-bottom:${S.lg}px; }
.af-label{ font-size:14px; font-weight:600; color:${C.textMuted}; }
.af-input-wrap{
  position:relative; display:flex; align-items:center;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface};
  transition:border-color .15s ease, box-shadow .15s ease;
}
.af-input-wrap:hover{ border-color:${PALETTE.grey300}; }
.af-input-wrap:focus-within{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.af-input-wrap.is-err{ border-color:${C.danger}; }
.af-input-wrap.is-err:focus-within{ box-shadow:0 0 0 4px ${C.dangerSoft}; }
.af-input-icon{ position:absolute; left:15px; color:${C.textSubtle}; pointer-events:none; }
.af-input{
  width:100%; box-sizing:border-box; padding:14px 16px 14px 44px;
  border:none; background:transparent; outline:none;
  font-family:inherit; font-size:16px; color:${C.text};
}
.af-input::placeholder{ color:${PALETTE.grey300}; }
.af-err{
  display:flex; align-items:center; gap:5px;
  font-size:13px; color:${C.danger}; font-weight:500;
}
.af-aide{ font-size:12.5px; color:${C.textSubtle}; }

/* ---- Case à cocher ---- */
.af-check{
  display:flex; align-items:flex-start; gap:${S.md}px;
  background:${C.bg}; border-radius:${R.md}px; padding:${S.lg}px;
  cursor:pointer; margin-top:${S.xs}px;
}
.af-check input{ position:absolute; opacity:0; width:0; height:0; }
.af-check-box{
  width:22px; height:22px; border-radius:6px; flex-shrink:0; margin-top:1px;
  border:2px solid ${PALETTE.grey300}; background:${C.surface};
  display:flex; align-items:center; justify-content:center;
  color:#fff; transition:all .18s ease;
}
.af-check input:checked + .af-check-box{
  background:${C.primary}; border-color:${C.primary};
}
.af-check-text{
  display:flex; flex-direction:column; gap:3px;
  font-size:14px; font-weight:500; color:${C.text};
}
.af-check-text em{ font-style:normal; font-size:12.5px; color:${C.textSubtle}; }

/* ---- Récapitulatif ---- */
.af-recap{
  background:${C.bg}; border-radius:${R.lg}px; padding:${S.lg}px;
}
.af-recap-ligne{
  display:flex; justify-content:space-between; gap:${S.md}px;
  padding:11px 0; border-bottom:1px solid ${C.border};
}
.af-recap-ligne:last-child{ border-bottom:none; }
.af-recap-label{ font-size:13.5px; color:${C.textSubtle}; flex-shrink:0; }
.af-recap-valeur{ font-size:14px; font-weight:600; text-align:right; word-break:break-word; }

/* ---- Alerte ---- */
.af-alerte{
  display:flex; align-items:flex-start; gap:10px; margin-top:${S.lg}px;
  background:${C.dangerSoft}; color:${C.danger};
  border:1px solid ${C.danger}33; border-radius:${R.md}px;
  padding:13px 15px; font-size:14px; line-height:1.5;
}

/* ---- Actions ---- */
.af-actions{ display:flex; gap:${S.md}px; margin-top:${S.xl}px; }
.af-btn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:15px 22px; cursor:pointer; border:none;
  font-family:inherit; font-size:15px; font-weight:600;
  transition:background .18s ease, border-color .18s ease, transform .12s ease;
}
.af-btn:active:not(:disabled){ transform:translateY(1px); }
.af-btn:disabled{ opacity:.6; cursor:not-allowed; }
.af-btn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.af-btn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.af-btn-ghost{
  flex:1; background:${C.surface}; color:${C.textMuted};
  border:1.5px solid ${C.border};
}
.af-btn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Confirmation ---- */
.af-done{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xxl}px; padding:${S.xxl}px ${S.xl}px;
  box-shadow:${SHADOW.md}; text-align:center;
  animation:afIn .35s ease;
}
.af-done-icon{
  width:74px; height:74px; border-radius:50%; margin:0 auto ${S.lg}px;
  background:${C.warningSoft}; color:${C.warning};
  border:2px dashed ${C.warning}66;
  display:flex; align-items:center; justify-content:center;
}
.af-done-titre{ font-size:23px; font-weight:700; letter-spacing:-.02em; margin:0; }
.af-done-texte{
  font-size:15px; color:${C.textMuted}; line-height:1.6;
  margin:${S.md}px auto ${S.xl}px; max-width:38ch;
}
.af-done-recap{
  background:${C.bg}; border-radius:${R.lg}px;
  padding:${S.lg}px; text-align:left;
}
.af-done-recap .af-recap-ligne{ border-color:${C.border}; }
.af-done-next{
  display:flex; align-items:flex-start; gap:10px; text-align:left;
  margin-top:${S.lg}px; background:${PALETTE.blue50};
  border:1px solid ${PALETTE.blue100}; border-radius:${R.md}px;
  padding:13px 15px; font-size:13.5px; color:${C.primary}; line-height:1.55;
}

/* ---- Divers ---- */
.af-spin{ animation:afSpin 1s linear infinite; }
@keyframes afSpin{ to{ transform:rotate(360deg); } }
@keyframes afIn{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:none; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;