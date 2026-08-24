import React, { useState, useEffect, useRef } from "react";
import { Lock, Delete, LogOut, Fingerprint } from "lucide-react";
import { supabase } from "./supabaseClient";
import { verifierPin, supprimerPin } from "./pinLock";
import {
  biometrieActivee, deverrouillerParBiometrie, desactiverBiometrie,
} from "./biometrie";
import { consigner, EVENEMENTS } from "./journal";
import { C, S, SHADOW } from "./theme";

export default function PinLockScreen({ userId, nomAffiche, onDeverrouille }) {
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState("");
  const [attente, setAttente] = useState(0);
  const [bioDisponible, setBioDisponible] = useState(false);
  const [bioEnCours, setBioEnCours] = useState(false);
  const timerRef = useRef(null);
  const tenteRef = useRef(false);

  useEffect(() => {
    const active = biometrieActivee(userId);
    setBioDisponible(active);

    // Proposition automatique à l'ouverture, une seule fois par affichage
    if (active && !tenteRef.current) {
      tenteRef.current = true;
      lancerBiometrie();
    }

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function decompte(secondes) {
    setAttente(secondes);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setAttente((s) => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  async function lancerBiometrie() {
    if (bioEnCours) return;
    setBioEnCours(true);
    setErreur("");

    const r = await deverrouillerParBiometrie(userId);

    setBioEnCours(false);

    if (r.ok) {
      onDeverrouille();
      return;
    }

    if (r.motif === "introuvable") {
      // La clé n'existe plus sur l'appareil : on retombe sur le code PIN
      desactiverBiometrie(userId);
      setBioDisponible(false);
      setErreur("Empreinte non reconnue par l'appareil. Utilisez votre code.");
      return;
    }

    // "annule" : l'utilisateur a fermé la demande — pas de message, il saisit son code
    if (r.motif !== "annule") {
      setErreur("Déverrouillage par empreinte indisponible. Utilisez votre code.");
    }
  }

  async function saisirChiffre(chiffre) {
    if (attente > 0) return;

    const nouvelle = (saisie + chiffre).slice(0, 6);
    setSaisie(nouvelle);
    setErreur("");

    if (nouvelle.length === 6) {
      const resultat = await verifierPin(nouvelle, userId);

      if (resultat.ok) {
        onDeverrouille();
        return;
      }

      if (resultat.deconnexion) {
        await consigner(EVENEMENTS.PIN_DECONNEXION_FORCEE);
        desactiverBiometrie(userId);
        await supabase.auth.signOut();
        window.location.reload();
        return;
      }

      setSaisie("");

      if (resultat.bloque) {
        await consigner(EVENEMENTS.PIN_BLOCAGE, { tentatives_avant_blocage: true });
        decompte(resultat.secondesRestantes);
        setErreur("Trop d'essais. Réessayez dans un instant.");
      } else {
        await consigner(EVENEMENTS.PIN_ECHEC);
        setErreur("Code incorrect.");
      }
    }
  }

  function effacer() {
    setSaisie((s) => s.slice(0, -1));
    setErreur("");
  }

  async function oublier() {
    supprimerPin(userId);
    desactiverBiometrie(userId);
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <div className="pl-shell">
      <style>{CSS}</style>

      <div className="pl-icone"><Lock size={26} /></div>
      <h1 className="pl-titre">
        {nomAffiche ? `Bonjour ${nomAffiche.split(" ")[0]}` : "Espace verrouillé"}
      </h1>
      <p className="pl-sous">Saisissez votre code à 6 chiffres</p>

      <div className="pl-points">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`pl-point ${i < saisie.length ? "is-rempli" : ""}`} />
        ))}
      </div>

      {attente > 0 && <p className="pl-attente">Réessayez dans {attente}s</p>}
      {erreur && attente === 0 && <p className="pl-erreur">{erreur}</p>}

      <div className="pl-clavier">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            className="pl-touche"
            onClick={() => saisirChiffre(String(n))}
            disabled={attente > 0}
          >
            {n}
          </button>
        ))}

        {bioDisponible ? (
          <button
            className="pl-touche pl-touche-bio"
            onClick={lancerBiometrie}
            disabled={attente > 0 || bioEnCours}
            aria-label="Déverrouiller avec l'empreinte"
          >
            <Fingerprint size={24} />
          </button>
        ) : (
          <span />
        )}

        <button
          className="pl-touche"
          onClick={() => saisirChiffre("0")}
          disabled={attente > 0}
        >
          0
        </button>

        <button
          className="pl-touche pl-touche-eff"
          onClick={effacer}
          disabled={attente > 0}
        >
          <Delete size={20} />
        </button>
      </div>

      <button className="pl-deconnexion" onClick={oublier}>
        <LogOut size={15} /> J'ai oublié mon code
      </button>
    </div>
  );
}

const CSS = `
.pl-shell{
  min-height:100vh; display:flex; flex-direction:column; align-items:center;
  justify-content:center; padding:${S.xl}px; background:${C.bg};
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
.pl-icone{
  width:56px; height:56px; border-radius:50%; background:${C.primary}14;
  color:${C.primary}; display:flex; align-items:center; justify-content:center;
  margin-bottom:${S.md}px;
}
.pl-titre{ font-size:20px; font-weight:700; margin:0; text-align:center; }
.pl-sous{ font-size:14px; color:${C.textMuted}; margin:6px 0 ${S.lg}px; }

.pl-points{ display:flex; gap:14px; margin-bottom:${S.md}px; }
.pl-point{
  width:14px; height:14px; border-radius:50%; border:1.5px solid ${C.border};
  background:transparent; transition:background .15s, border-color .15s;
}
.pl-point.is-rempli{ background:${C.primary}; border-color:${C.primary}; }

.pl-attente, .pl-erreur{
  font-size:13.5px; color:${C.danger || "#B23B3B"};
  margin:0 0 ${S.md}px; text-align:center; max-width:32ch; line-height:1.5;
}

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
.pl-touche-bio{
  display:flex; align-items:center; justify-content:center;
  color:${C.success}; border-color:${C.success}55;
}

.pl-deconnexion{
  margin-top:${S.xl}px; display:flex; align-items:center; gap:6px;
  background:none; border:none; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; color:${C.textMuted};
}
.pl-deconnexion:hover{ color:${C.primary}; }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;