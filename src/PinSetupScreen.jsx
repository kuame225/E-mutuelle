import React, { useState, useEffect } from "react";
import {
  Lock, Delete, ShieldCheck, ArrowLeft, Fingerprint, Loader2, Bell,
} from "lucide-react";
import { definirPin } from "./pinLock";
import { biometrieSupportee, activerBiometrie } from "./biometrie";
import { pushDisponible, activerNotifications } from "./push";
import { C, S, SHADOW } from "./theme";

export default function PinSetupScreen({ userId, membreId, nomAffiche, onTermine }) {
  const [etape, setEtape] = useState("saisie");  // saisie | confirmation | biometrie | notifications
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [bioPossible, setBioPossible] = useState(false);
  const [bioEnCours, setBioEnCours] = useState(false);
  const [notifEnCours, setNotifEnCours] = useState(false);

  useEffect(() => {
    biometrieSupportee().then(setBioPossible);
  }, []);

  const valeurActuelle = etape === "saisie" ? pin : confirmation;

  // Un navigateur n'accorde jamais l'autorisation d'envoyer des notifications
  // sans un geste explicite de la personne — impossible de l'activer toute
  // seule. Ce qu'on peut faire, c'est la proposer au moment le plus engagé :
  // juste après la dernière frappe qui termine la mise en route de l'espace,
  // plutôt que sur un bandeau qu'elle risque de ne jamais remarquer.
  function passerAuxNotifications() {
    if (pushDisponible() && membreId) {
      setEtape("notifications");
    } else {
      onTermine();
    }
  }

  async function saisirChiffre(chiffre) {
    setErreur("");
    const nouvelle = (valeurActuelle + chiffre).slice(0, 6);

    if (etape === "saisie") {
      setPin(nouvelle);
      if (nouvelle.length === 6) {
        setTimeout(() => setEtape("confirmation"), 150);
      }
      return;
    }

    setConfirmation(nouvelle);
    if (nouvelle.length === 6) {
      if (nouvelle !== pin) {
        setErreur("Les deux codes ne correspondent pas.");
        setTimeout(() => {
          setPin("");
          setConfirmation("");
          setEtape("saisie");
        }, 900);
        return;
      }

      setEnregistrement(true);
      await definirPin(nouvelle, userId);
      setEnregistrement(false);

      // Si l'appareil dispose d'un capteur, on propose la biométrie.
      // Sinon, on passe directement à l'étape suivante disponible.
      if (bioPossible) {
        setEtape("biometrie");
      } else {
        passerAuxNotifications();
      }
    }
  }

  function effacer() {
    if (etape === "saisie") setPin((p) => p.slice(0, -1));
    else setConfirmation((c) => c.slice(0, -1));
    setErreur("");
  }

  function retourEtapePrecedente() {
    setConfirmation("");
    setPin("");
    setErreur("");
    setEtape("saisie");
  }

  async function proposerBiometrie() {
    setBioEnCours(true);
    setErreur("");

    const r = await activerBiometrie(userId, nomAffiche);

    setBioEnCours(false);

    if (r.ok) {
      passerAuxNotifications();
      return;
    }

    if (r.motif === "annule") {
      setErreur("Activation annulée. Vous pourrez le faire plus tard.");
      return;
    }

    setErreur("Ce téléphone n'a pas pu enregistrer votre empreinte. Le code à 6 chiffres reste actif.");
  }

  async function proposerNotifications() {
    setNotifEnCours(true);
    setErreur("");

    const r = await activerNotifications(membreId);

    setNotifEnCours(false);

    if (r.ok) {
      onTermine();
      return;
    }

    if (r.motif === "refuse") {
      // Le navigateur n'affichera plus jamais cette demande de lui-même :
      // inutile d'insister, la personne pourra l'activer plus tard depuis
      // les paramètres du site si elle change d'avis.
      setErreur("Vous pourrez activer les alertes plus tard depuis votre espace.");
      setTimeout(onTermine, 1400);
      return;
    }

    onTermine();
  }

  /* ---------------- Étape biométrie ---------------- */

  if (etape === "biometrie") {
    return (
      <div className="pl-shell">
        <style>{CSS}</style>

        <div className="pl-icone pl-icone-bio"><Fingerprint size={28} /></div>
        <h1 className="pl-titre">Déverrouiller plus vite ?</h1>
        <p className="pl-sous">
          Utilisez votre empreinte pour ouvrir votre espace, sans saisir votre
          code à chaque fois. Le code reste disponible en secours.
        </p>

        {erreur && <p className="pl-erreur pl-erreur-large">{erreur}</p>}

        <button
          className="pl-btn-principal"
          onClick={proposerBiometrie}
          disabled={bioEnCours}
        >
          {bioEnCours
            ? <><Loader2 size={18} className="pl-spin" /> Enregistrement…</>
            : <><Fingerprint size={18} /> Activer l'empreinte</>}
        </button>

        <button className="pl-btn-texte" onClick={passerAuxNotifications} disabled={bioEnCours}>
          Plus tard
        </button>
      </div>
    );
  }

  /* ---------------- Étape notifications ---------------- */

  if (etape === "notifications") {
    return (
      <div className="pl-shell">
        <style>{CSS}</style>

        <div className="pl-icone pl-icone-notif"><Bell size={28} /></div>
        <h1 className="pl-titre">Recevoir les alertes ?</h1>
        <p className="pl-sous">
          Soyez prévenu de vos échéances de cotisation et des nouvelles de la
          mutuelle, directement sur votre téléphone.
        </p>

        {erreur && <p className="pl-erreur pl-erreur-large">{erreur}</p>}

        <button
          className="pl-btn-principal"
          onClick={proposerNotifications}
          disabled={notifEnCours}
        >
          {notifEnCours
            ? <><Loader2 size={18} className="pl-spin" /> Activation…</>
            : <><Bell size={18} /> Activer les alertes</>}
        </button>

        <button className="pl-btn-texte" onClick={onTermine} disabled={notifEnCours}>
          Plus tard
        </button>
      </div>
    );
  }

  /* ---------------- Étapes de saisie ---------------- */

  return (
    <div className="pl-shell">
      <style>{CSS}</style>

      {etape === "confirmation" && !enregistrement && (
        <button className="pl-retour" onClick={retourEtapePrecedente}>
          <ArrowLeft size={15} /> Recommencer
        </button>
      )}

      <div className="pl-icone">
        {etape === "saisie" ? <Lock size={26} /> : <ShieldCheck size={26} />}
      </div>
      <h1 className="pl-titre">
        {etape === "saisie" ? "Créez votre code PIN" : "Confirmez votre code"}
      </h1>
      <p className="pl-sous">
        {etape === "saisie"
          ? "Ce code à 6 chiffres déverrouillera votre espace au quotidien."
          : "Saisissez à nouveau le même code."}
      </p>

      <div className="pl-points">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`pl-point ${i < valeurActuelle.length ? "is-rempli" : ""}`} />
        ))}
      </div>

      {erreur && <p className="pl-erreur">{erreur}</p>}
      {enregistrement && <p className="pl-attente">Enregistrement…</p>}

      <div className="pl-clavier">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            className="pl-touche"
            onClick={() => saisirChiffre(String(n))}
            disabled={enregistrement}
          >
            {n}
          </button>
        ))}
        <span />
        <button
          className="pl-touche"
          onClick={() => saisirChiffre("0")}
          disabled={enregistrement}
        >
          0
        </button>
        <button
          className="pl-touche pl-touche-eff"
          onClick={effacer}
          disabled={enregistrement}
        >
          <Delete size={20} />
        </button>
      </div>
    </div>
  );
}

const CSS = `
.pl-shell{
  min-height:100vh; display:flex; flex-direction:column; align-items:center;
  justify-content:center; padding:${S.xl}px; background:${C.bg}; position:relative;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
.pl-retour{
  position:absolute; top:${S.lg}px; left:${S.lg}px; display:flex; align-items:center;
  gap:5px; background:none; border:none; color:${C.textMuted};
  font-family:inherit; font-size:13.5px; font-weight:600; cursor:pointer;
}
.pl-retour:hover{ color:${C.primary}; }

.pl-icone{
  width:56px; height:56px; border-radius:50%; background:${C.primary}14;
  color:${C.primary}; display:flex; align-items:center; justify-content:center;
  margin-bottom:${S.md}px;
}
.pl-icone-bio{ background:#DCFCE7; color:${C.success}; }
.pl-icone-notif{ background:#FEF3C7; color:${C.warning}; }

.pl-titre{ font-size:20px; font-weight:700; margin:0; text-align:center; }
.pl-sous{
  font-size:14px; color:${C.textMuted}; margin:6px 0 ${S.lg}px;
  text-align:center; max-width:34ch; line-height:1.6;
}

.pl-points{ display:flex; gap:14px; margin-bottom:${S.md}px; }
.pl-point{
  width:14px; height:14px; border-radius:50%; border:1.5px solid ${C.border};
  background:transparent; transition:background .15s, border-color .15s;
}
.pl-point.is-rempli{ background:${C.primary}; border-color:${C.primary}; }

.pl-erreur{ font-size:13.5px; color:${C.danger || "#B23B3B"}; margin:0 0 ${S.md}px; }
.pl-erreur-large{ max-width:34ch; text-align:center; line-height:1.5; }
.pl-attente{ font-size:13.5px; color:${C.textMuted}; margin:0 0 ${S.md}px; }

.pl-clavier{
  display:grid; grid-template-columns:repeat(3, 64px); gap:14px; margin-top:${S.sm}px;
}
.pl-touche{
  width:64px; height:64px; border-radius:50%; border:1px solid ${C.border};
  background:${C.surface}; font-family:inherit; font-size:22px; font-weight:600;
  color:${C.text}; cursor:pointer; box-shadow:${SHADOW.sm};
}
.pl-touche:disabled{ opacity:.5; }
.pl-touche-eff{ display:flex; align-items:center; justify-content:center; }

.pl-btn-principal{
  display:flex; align-items:center; justify-content:center; gap:9px;
  width:100%; max-width:320px; background:${C.primary}; color:#fff; border:none;
  border-radius:14px; padding:15px 0; cursor:pointer;
  font-family:inherit; font-size:15px; font-weight:600; box-shadow:${SHADOW.sm};
}
.pl-btn-principal:disabled{ opacity:.6; cursor:not-allowed; }

.pl-btn-texte{
  margin-top:${S.md}px; background:none; border:none; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; color:${C.textMuted};
}
.pl-btn-texte:hover{ color:${C.primary}; }

.pl-spin{ animation:plSpin 1s linear infinite; }
@keyframes plSpin{ to{ transform:rotate(360deg); } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;