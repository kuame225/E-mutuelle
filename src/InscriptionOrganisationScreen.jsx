import React, { useState } from "react";
import {
  Building2, ArrowLeft, ArrowRight, Loader2, AlertCircle,
  CheckCircle2, Mail, Lock, MapPin, Briefcase, ShieldCheck,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { TYPES_ORGANISATION, motPourType } from "./vocabulaire";
import { C, R, S, SHADOW, PALETTE } from "./theme";

/**
 * Inscription d'une nouvelle organisation.
 *
 * Deux temps : le compte de la personne se crée d'abord (signUp), puis une
 * fonction serveur crée l'organisation, son paramétrage et le rattachement
 * en une seule transaction — voir creer_organisation en base.
 *
 * Si la création du compte réussit mais que celle de l'organisation
 * échoue (sigle déjà pris, par exemple), la personne garde sa session :
 * on lui redemande seulement un sigle, sans repasser par le mot de passe.
 */
export default function InscriptionOrganisationScreen({ onBack }) {
  // Le choix du type vient en premier : il détermine le vocabulaire et les
  // modules de toute l'organisation, et donne au formulaire suivant des
  // libellés déjà adaptés (« Sigle de l'association », etc.).
  const [etape, setEtape] = useState("type"); // type | formulaire | sigle_seul | succes

  const [type, setType] = useState(null);
  const [nom, setNom] = useState("");
  const [sigle, setSigle] = useState("");
  const [secteur, setSecteur] = useState("");
  const [localite, setLocalite] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  // Le champ Contact accepte un numéro OU une adresse e-mail : on ne peut
  // pas filtrer les caractères non numériques sans casser la saisie d'un
  // e-mail. Tant que la saisie ne contient que des chiffres (un numéro en
  // cours de frappe), on la limite à 10 — la longueur d'un numéro ivoirien.
  // Dès qu'une lettre ou un @ apparaît, la limite ne s'applique plus.
  function onChangerContact(v) {
    const estUniquementChiffres = /^\d*$/.test(v);
    setContact(estUniquementChiffres ? v.slice(0, 10) : v);
  }

  function validerFormulaire() {
    if (!nom.trim()) return "Indiquez la dénomination complète de l'organisation.";
    if (!sigle.trim()) return "Indiquez un sigle.";
    if (sigle.trim().length > 20) return "Le sigle doit rester court : 20 caractères au maximum.";
    if (!email.trim()) return "Indiquez une adresse e-mail.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return "Adresse e-mail invalide.";
    if (motDePasse.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
    if (motDePasse !== confirmation) return "Les deux mots de passe ne correspondent pas.";
    return null;
  }

  async function creerOrganisation() {
    const { data, error } = await supabase.rpc("creer_organisation", {
      p_nom: nom,
      p_sigle: sigle,
      p_secteur: secteur || null,
      p_localite: localite || null,
      p_contact: contact || null,
      p_type: type || "mutuelle",
    });

    if (error) {
      // Le compte existe déjà, mais pas encore d'organisation : on ne
      // redemande que le sigle, la session reste acquise.
      setErreur(error.message);
      setEtape("sigle_seul");
      return;
    }

    // Notification au représentant — indépendante du système d'e-mails
    // d'authentification (voir notifier-inscription). Ne bloque jamais la
    // suite : un échec d'envoi ne doit pas empêcher l'inscription elle-même,
    // qui a déjà réussi à ce stade.
    supabase.functions.invoke("notifier-inscription", {
      body: { nom: nom.trim(), sigle: sigle.trim(), email: email.trim().toLowerCase() },
    }).catch((e) => console.error("[InscriptionOrganisationScreen] notifier-inscription a échoué :", e));

    // Drapeau explicite plutôt qu'un pari sur la vitesse de résolution de
    // l'organisation : Shell() (App.jsx) le lit pour ne jamais proposer la
    // configuration du PIN à un compte qui vient tout juste de s'inscrire,
    // quelle que soit la rapidité de useParametrage à ce moment précis.
    // Retiré par Shell() lui-même dès que l'état de l'organisation est connu.
    sessionStorage.setItem("post_inscription_org", "1");

    setEtape("succes");
    // Délai allongé (5s au lieu de 2,2s) pour laisser le temps de lire le
    // rappel des conditions tarifaires, désormais affiché sur cet écran.
    // Note : en pratique, l'ouverture de session par signUp() bascule
    // généralement l'application vers l'écran "Espace non actif" (App.jsx)
    // avant même ce délai — c'est cet écran-là qui sert de confirmation
    // fiable, celui-ci n'étant vu que si la bascule tarde un peu.
    setTimeout(() => window.location.reload(), 5000);
  }

  async function soumettre(e) {
    e.preventDefault();
    const probleme = validerFormulaire();
    if (probleme) { setErreur(probleme); return; }

    setEnvoi(true);
    setErreur("");

    // Posé ICI, avant tout appel à Supabase — pas après creerOrganisation()
    // comme précédemment. signUp() ouvre la session presque instantanément,
    // et Shell() peut y réagir avant même que le code n'atteigne la ligne
    // suivante : pour que le drapeau serve à quelque chose, il doit exister
    // avant la moindre chance qu'une session apparaisse.
    sessionStorage.setItem("post_inscription_org", "1");

    const courriel = email.trim().toLowerCase();

    const { error: erreurCompte } = await supabase.auth.signUp({
      email: courriel,
      password: motDePasse,
    });

    if (erreurCompte) {
      const dejaInscrit = /already registered|already exists/i.test(erreurCompte.message);

      if (!dejaInscrit) {
        setEnvoi(false);
        setErreur(traduireErreurCompte(erreurCompte.message));
        return;
      }

      // Tous les comptes de la plateforme partagent la même base : cette
      // adresse appartient sans doute déjà à quelqu'un qui administre ou
      // est membre d'une autre organisation. Plutôt que de bloquer, on tente
      // de se connecter avec le mot de passe saisi — la même personne
      // peut ainsi rattacher une seconde organisation à son compte.
      const { error: erreurConnexion } = await supabase.auth.signInWithPassword({
        email: courriel,
        password: motDePasse,
      });

      if (erreurConnexion) {
        setEnvoi(false);
        setErreur(
          "Un compte existe déjà avec cette adresse, et ce mot de passe ne " +
          "correspond pas à ce compte. Connectez-vous d'abord avec votre " +
          "mot de passe habituel, puis revenez créer l'espace de votre " +
          "nouvelle organisation."
        );
        return;
      }
    }

    await creerOrganisation();
    setEnvoi(false);
  }

  async function reessayerAvecAutreSigle(e) {
    e.preventDefault();
    if (!sigle.trim()) { setErreur("Indiquez un sigle."); return; }
    if (sigle.trim().length > 20) { setErreur("Le sigle doit rester court : 20 caractères au maximum."); return; }

    // Toujours reposé ici aussi, par précaution : la session existe déjà
    // à ce stade (compte créé lors du premier essai), donc le risque est
    // moindre, mais rien ne coûte à s'assurer que le drapeau est bien là.
    sessionStorage.setItem("post_inscription_org", "1");

    setEnvoi(true);
    setErreur("");
    await creerOrganisation();
    setEnvoi(false);
  }

  /* ---------------- Choix du type ---------------- */
  if (etape === "type") {
    return (
      <div className="io-shell">
        <style>{CSS}</style>
        <div className="io-carte io-carte-large">
          {onBack && (
            <button className="io-retour" onClick={onBack}>
              <ArrowLeft size={15} /> Retour
            </button>
          )}

          <div className="io-icone"><Building2 size={26} /></div>
          <h1 className="io-titre">Quel type d'organisation ?</h1>
          <p className="io-sous">
            Ce choix adapte le vocabulaire et les fonctions proposées.
            Il reste modifiable plus tard depuis les paramètres.
          </p>

          <div className="io-types">
            {TYPES_ORGANISATION.map((t) => (
              <button
                key={t.id}
                className={`io-type ${type === t.id ? "is-on" : ""}`}
                onClick={() => setType(t.id)}
              >
                <span className="io-type-nom">{t.label}</span>
                <span className="io-type-desc">{t.description}</span>
              </button>
            ))}
          </div>

          <button
            className="io-btn"
            onClick={() => setEtape("formulaire")}
            disabled={!type}
          >
            Continuer <ArrowRight size={17} />
          </button>
        </div>
      </div>
    );
  }

  if (etape === "succes") {
    return (
      <div className="io-shell">
        <style>{CSS}</style>
        <div className="io-carte io-carte-centree">
          <div className="io-icone io-icone-ok"><CheckCircle2 size={30} /></div>
          <h1 className="io-titre">Demande envoyée</h1>
          <p className="io-sous">
            Votre demande d'inscription pour {nom} a bien été enregistrée.
            Notre équipe la valide sous peu et vous préviendra dès que
            votre espace sera actif.
          </p>
          <div className="io-rappel-tarif io-rappel-succes">
            <ShieldCheck size={16} />
            <p>
              Dès l'activation : 2 mois d'essai gratuit et complet. La
              facturation (forfait + variable, et frais de mise en service
              éventuels) ne commence qu'à l'issue de cet essai.
            </p>
          </div>
          <div className="io-barre"><span /></div>
        </div>
      </div>
    );
  }

  if (etape === "sigle_seul") {
    return (
      <div className="io-shell">
        <style>{CSS}</style>
        <div className="io-carte">
          <div className="io-icone"><Building2 size={26} /></div>
          <h1 className="io-titre">Un autre sigle</h1>
          <p className="io-sous">
            Votre compte est créé. Il ne manque qu'un sigle disponible pour
            ouvrir l'espace de votre organisation.
          </p>

          <form onSubmit={reessayerAvecAutreSigle} className="io-form">
            <Champ label="Sigle" value={sigle} onChange={setSigle}
              placeholder="Ex : MUGEFCI" maxLength={20} />

            {erreur && (
              <div className="io-erreur"><AlertCircle size={16} /> {erreur}</div>
            )}

            <button type="submit" className="io-btn" disabled={envoi}>
              {envoi
                ? <><Loader2 size={17} className="io-spin" /> Création…</>
                : <>Créer l'espace <ArrowRight size={17} /></>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="io-shell">
      <style>{CSS}</style>
      <div className="io-carte">
        <button className="io-retour" onClick={() => setEtape("type")}>
          <ArrowLeft size={15} /> Changer de type
        </button>

        <div className="io-icone"><Building2 size={26} /></div>
        <h1 className="io-titre">
          Ouvrir l'espace de {motPourType(type, "organisation_votre")}
        </h1>
        <p className="io-sous">
          Créez l'espace de votre organisation et votre propre accès administrateur.
        </p>

        <form onSubmit={soumettre} className="io-form">
          <div className="io-section-titre">
            {motPourType(type, "organisation").toUpperCase()}
          </div>

          <Champ label="Sigle" value={sigle} onChange={setSigle}
            placeholder="Ex : MUGEFCI" maxLength={20}
            aide={`Nom court, affiché aux membres. Sert aussi d'adresse propre à ${motPourType(type, "organisation_votre")}.`} />

          <Champ label="Dénomination complète" value={nom} onChange={setNom}
            placeholder="Ex : Mutuelle Générale des Fonctionnaires..." />

          <div className="io-duo">
            <Champ label="Secteur" value={secteur} onChange={setSecteur}
              placeholder="Ex : Santé" Icon={Briefcase} />
            <Champ label="Localité" value={localite} onChange={setLocalite}
              placeholder="Ex : Abidjan" Icon={MapPin} />
          </div>

          <Champ label="Contact" value={contact} onChange={onChangerContact}
            placeholder="Téléphone ou e-mail du Bureau"
            aide="Facultatif — affiché aux membres en cas de besoin. Un numéro de téléphone est limité à 10 chiffres." />

          <div className="io-section-titre io-section-suite">Votre accès</div>

          <Champ label="Votre adresse e-mail" value={email} onChange={setEmail}
            type="email" Icon={Mail} placeholder="vous@exemple.com" />

          <div className="io-duo">
            <Champ label="Mot de passe" value={motDePasse} onChange={setMotDePasse}
              type="password" Icon={Lock} placeholder="••••••••" />
            <Champ label="Confirmer" value={confirmation} onChange={setConfirmation}
              type="password" Icon={Lock} placeholder="••••••••" />
          </div>

          {erreur && (
            <div className="io-erreur"><AlertCircle size={16} /> {erreur}</div>
          )}

          <div className="io-rappel-tarif">
            <ShieldCheck size={16} />
            <p>
              <strong>2 mois d'essai gratuit</strong>, accès complet, sans paiement.
              À l'issue de l'essai : forfait + composante variable selon votre
              activité, et d'éventuels frais de mise en service (facturés une
              seule fois). Votre demande doit d'abord être validée par notre
              équipe avant toute activation.
            </p>
          </div>

          <button type="submit" className="io-btn" disabled={envoi}>
            {envoi
              ? <><Loader2 size={17} className="io-spin" /> Création…</>
              : <>Créer l'espace <ArrowRight size={17} /></>}
          </button>

          <p className="io-legal">
            Vous devenez administrateur de cette organisation. Vous pourrez ensuite
            régler ses cotisations, son barème d'aides et les fonctions
            activées depuis les paramètres.
          </p>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Sous-composants ---------------- */

function Champ({ label, value, onChange, placeholder, type = "text", Icon, maxLength, aide }) {
  return (
    <div className="io-champ">
      <label className="io-label">{label}</label>
      <div className="io-input-wrap">
        {Icon && <Icon size={16} className="io-input-icon" />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`io-input ${Icon ? "io-input-avec-icone" : ""}`}
        />
      </div>
      {aide && <span className="io-aide">{aide}</span>}
    </div>
  );
}

/* ---------------- Utilitaires ---------------- */

function traduireErreurCompte(message = "") {
  if (message.includes("already registered") || message.includes("already exists"))
    return "Un compte existe déjà avec cette adresse e-mail. Connectez-vous plutôt.";
  if (message.includes("Password"))
    return "Le mot de passe est trop simple. Choisissez-en un de 8 caractères au moins.";
  return message;
}

/* ---------------- Styles ---------------- */

const CSS = `
.io-shell{
  min-height:100vh; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(160deg, ${PALETTE.blue50} 0%, ${C.bg} 55%);
  padding:${S.xl}px; font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
.io-carte{
  width:100%; max-width:460px; background:${C.surface};
  border:1px solid ${C.border}; border-radius:${R.xxl}px;
  padding:${S.xxl}px ${S.xl}px; box-shadow:${SHADOW.md};
  animation:ioIn .3s ease;
}
.io-carte-centree{ text-align:center; }
.io-carte-large{ max-width:620px; }

/* ---- Choix du type d'organisation ---- */
.io-types{
  display:grid; grid-template-columns:1fr 1fr; gap:${S.md}px;
  margin-bottom:${S.xl}px;
}
@media (max-width:520px){ .io-types{ grid-template-columns:1fr; } }
.io-type{
  display:flex; flex-direction:column; gap:4px; text-align:left;
  padding:${S.md}px ${S.lg}px; cursor:pointer;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.lg}px; font-family:inherit;
  transition:border-color .15s ease, background .15s ease, box-shadow .15s ease;
}
.io-type:hover{ border-color:${PALETTE.grey300}; background:${C.bg}; }
.io-type.is-on{
  border-color:${C.primary}; background:${PALETTE.blue50};
  box-shadow:${SHADOW.focus};
}
.io-type-nom{ font-size:14.5px; font-weight:600; color:${C.text}; }
.io-type-desc{ font-size:12px; color:${C.textSubtle}; line-height:1.45; }

.io-retour{
  display:flex; align-items:center; gap:6px;
  background:none; border:none; padding:0; margin-bottom:${S.lg}px;
  cursor:pointer; font-family:inherit; font-size:14px;
  font-weight:600; color:${C.primary};
}
.io-retour:hover{ text-decoration:underline; }

.io-icone{
  width:56px; height:56px; border-radius:16px; margin:0 auto ${S.lg}px;
  background:${PALETTE.blue100}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.io-icone-ok{ background:#DCFCE7; color:${C.success}; }

.io-titre{ font-size:21px; font-weight:700; letter-spacing:-.02em; margin:0; }
.io-sous{
  font-size:14px; color:${C.textSubtle}; line-height:1.6;
  margin:${S.sm}px 0 ${S.xl}px; max-width:36ch;
}
.io-carte:not(.io-carte-centree) .io-titre{ text-align:left; }
.io-carte:not(.io-carte-centree) .io-sous{ text-align:left; margin-left:0; }

.io-form{ display:flex; flex-direction:column; gap:${S.md}px; text-align:left; }
.io-section-titre{
  font-size:11.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
  color:${C.textSubtle}; margin:0 0 -4px;
}
.io-section-suite{ margin-top:${S.sm}px; padding-top:${S.md}px; border-top:1px solid ${C.border}; }

.io-duo{ display:grid; gap:${S.md}px; grid-template-columns:1fr 1fr; }
@media (max-width:420px){ .io-duo{ grid-template-columns:1fr; } }

.io-champ{ display:flex; flex-direction:column; gap:6px; }
.io-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.io-input-wrap{ position:relative; display:flex; align-items:center; }
.io-input-icon{ position:absolute; left:14px; color:${C.textSubtle}; pointer-events:none; }
.io-input{
  width:100%; box-sizing:border-box; padding:12px 14px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; color:${C.text};
  font-family:inherit; font-size:14.5px; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.io-input-avec-icone{ padding-left:40px; }
.io-input::placeholder{ color:${PALETTE.grey300}; }
.io-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.io-aide{ font-size:12px; color:${C.textSubtle}; line-height:1.5; }

.io-erreur{
  display:flex; align-items:flex-start; gap:9px; text-align:left;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:12px 14px; font-size:13.5px; line-height:1.5;
  animation:ioIn .2s ease;
}

.io-btn{
  display:flex; align-items:center; justify-content:center; gap:9px;
  width:100%; background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:15px 0; cursor:pointer;
  font-family:inherit; font-size:15px; font-weight:600;
  box-shadow:${SHADOW.sm}; transition:background .18s ease; margin-top:4px;
}
.io-btn:hover:not(:disabled){ background:${C.primaryDark}; }
.io-btn:disabled{ opacity:.6; cursor:not-allowed; }

.io-legal{
  font-size:12px; color:${C.textSubtle}; line-height:1.55;
  text-align:center; margin:${S.sm}px 0 0;
}

.io-rappel-tarif{
  display:flex; align-items:flex-start; gap:10px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:13px 15px; color:${C.primary};
}
.io-rappel-tarif p{ margin:0; font-size:12.5px; line-height:1.55; color:${C.textMuted}; }
.io-rappel-tarif strong{ color:${C.text}; }

.io-barre{
  height:4px; border-radius:4px; background:${PALETTE.grey200};
  overflow:hidden; margin-top:${S.lg}px;
}
.io-barre span{
  display:block; height:100%; border-radius:4px;
  background:${C.success}; animation:ioProgres 5s linear forwards;
}

.io-spin{ animation:ioSpin 1s linear infinite; }
@keyframes ioSpin{ to{ transform:rotate(360deg); } }
@keyframes ioIn{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:none; } }
@keyframes ioProgres{ from{ width:0; } to{ width:100%; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;