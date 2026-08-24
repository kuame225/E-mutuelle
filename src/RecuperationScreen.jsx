import React, { useState } from "react";
import {
  Smartphone, ArrowLeft, ArrowRight, Loader2, AlertCircle,
  UserCheck, ShieldCheck, CheckCircle2,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, R, S, SHADOW, PALETTE } from "./theme";

export default function RecuperationScreen({ onBack, onConnecte }) {
  const [etape, setEtape] = useState("code");   // code | confirmation | succes
  const [code, setCode] = useState("");
  const [membre, setMembre] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  async function verifier(e) {
    e.preventDefault();
    const saisi = code.trim().toUpperCase();

    if (saisi.length !== 8) {
      setErreur("Le code comporte 8 caractères.");
      return;
    }

    setChargement(true);
    setErreur("");

    const { data, error } = await supabase.rpc("verifier_code_recuperation", {
      p_code: saisi,
    });

    setChargement(false);

    if (error || !data || data.length === 0) {
      setErreur("Ce code est invalide ou a expiré. Rapprochez-vous du Bureau.");
      return;
    }

    setMembre(data[0]);
    setEtape("confirmation");
  }

  async function recuperer() {
    setChargement(true);
    setErreur("");

    try {
      const { data, error } = await supabase.functions.invoke("recuperer-acces", {
        body: { code: code.trim().toUpperCase() },
      });

      if (error || !data || data.error) {
        setChargement(false);
        setErreur(data?.error || "La récupération a échoué. Réessayez ou contactez le Bureau.");
        return;
      }

      const { error: connexionErr } = await supabase.auth.signInWithPassword({
        email: data.identifiant,
        password: data.motDePasse,
      });

      setChargement(false);

      if (connexionErr) {
        setErreur("L'accès a été réinitialisé mais la connexion a échoué : " + connexionErr.message);
        return;
      }

      setEtape("succes");
      setTimeout(() => onConnecte(), 2000);
    } catch (e) {
      setChargement(false);
      setErreur("Erreur réseau : " + e.message);
    }
  }

  return (
    <div className="rc-shell">
      <style>{CSS}</style>

      <div className="rc-carte">
        {etape !== "succes" && (
          <button className="rc-retour" onClick={onBack}>
            <ArrowLeft size={15} /> Retour
          </button>
        )}

        {/* ---- Saisie du code ---- */}
        {etape === "code" && (
          <>
            <div className="rc-icone"><Smartphone size={26} /></div>
            <h1 className="rc-titre">Nouveau téléphone ?</h1>
            <p className="rc-sous">
              Saisissez le code de récupération que le Bureau vous a remis.
            </p>

            <form onSubmit={verifier} className="rc-form">
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().slice(0, 8));
                  setErreur("");
                }}
                placeholder="XXXXXXXX"
                autoCapitalize="characters"
                autoComplete="off"
                className="rc-input"
              />

              {erreur && (
                <div className="rc-erreur"><AlertCircle size={16} /> {erreur}</div>
              )}

              <button
                type="submit"
                className="rc-btn"
                disabled={chargement || code.length !== 8}
              >
                {chargement
                  ? <><Loader2 size={17} className="rc-spin" /> Vérification…</>
                  : <>Continuer <ArrowRight size={17} /></>}
              </button>
            </form>
          </>
        )}

        {/* ---- Confirmation d'identité ---- */}
        {etape === "confirmation" && (
          <>
            <div className="rc-icone rc-icone-ok"><UserCheck size={26} /></div>
            <h1 className="rc-titre">Confirmez votre identité</h1>
            <p className="rc-sous">
              Ce code correspond à la fiche suivante.
            </p>

            <div className="rc-identite">
              <div className="rc-identite-nom">{membre.nom}</div>
              <div className="rc-identite-tel">{membre.telephone || "—"}</div>
            </div>

            <p className="rc-avertissement">
              En continuant, l'accès sera transféré sur cet appareil. Votre ancien
              téléphone sera automatiquement déconnecté.
            </p>

            {erreur && (
              <div className="rc-erreur"><AlertCircle size={16} /> {erreur}</div>
            )}

            <button className="rc-btn" onClick={recuperer} disabled={chargement}>
              {chargement
                ? <><Loader2 size={17} className="rc-spin" /> Récupération…</>
                : <><ShieldCheck size={17} /> C'est bien moi</>}
            </button>
          </>
        )}

        {/* ---- Succès ---- */}
        {etape === "succes" && (
          <>
            <div className="rc-icone rc-icone-ok"><CheckCircle2 size={30} /></div>
            <h1 className="rc-titre">Accès restauré</h1>
            <p className="rc-sous">
              Bienvenue {membre?.nom?.split(" ")[0]}. Vous allez pouvoir définir
              un nouveau code à 6 chiffres pour cet appareil.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.rc-shell{
  min-height:100vh; display:flex; align-items:center; justify-content:center;
  background:${C.bg}; padding:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
.rc-carte{
  position:relative; width:100%; max-width:420px;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xxl}px; padding:${S.xxl}px ${S.xl}px ${S.xl}px;
  box-shadow:${SHADOW.md}; text-align:center;
  display:flex; flex-direction:column; align-items:center;
}
.rc-retour{
  position:absolute; top:${S.lg}px; left:${S.lg}px;
  display:flex; align-items:center; gap:5px;
  background:none; border:none; padding:0; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; color:${C.textMuted};
}
.rc-retour:hover{ color:${C.primary}; }

.rc-icone{
  width:58px; height:58px; border-radius:50%;
  background:${PALETTE.blue100}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
  margin-bottom:${S.md}px;
}
.rc-icone-ok{ background:#DCFCE7; color:${C.success}; }

.rc-titre{ font-size:21px; font-weight:700; letter-spacing:-.02em; margin:0; }
.rc-sous{
  font-size:14px; color:${C.textSubtle}; line-height:1.6;
  margin:8px 0 ${S.lg}px; max-width:34ch;
}

.rc-form{ width:100%; display:flex; flex-direction:column; gap:${S.md}px; }
.rc-input{
  width:100%; box-sizing:border-box; padding:15px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; outline:none;
  font-family:'JetBrains Mono',monospace; font-size:21px; font-weight:600;
  text-align:center; letter-spacing:.22em; color:${C.text};
  transition:border-color .15s ease, box-shadow .15s ease;
}
.rc-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.rc-input::placeholder{ color:${PALETTE.grey300}; letter-spacing:.22em; }

.rc-identite{
  width:100%; background:${C.bg}; border:1px solid ${C.border};
  border-radius:${R.md}px; padding:${S.md}px; margin-bottom:${S.md}px;
}
.rc-identite-nom{ font-size:16px; font-weight:700; }
.rc-identite-tel{
  font-family:'JetBrains Mono',monospace; font-size:13px;
  color:${C.textSubtle}; margin-top:4px;
}
.rc-avertissement{
  width:100%; box-sizing:border-box;
  background:#FEF3C7; color:#B45309; border-radius:${R.md}px;
  padding:11px 13px; font-size:12.5px; line-height:1.55;
  margin:0 0 ${S.md}px; text-align:left;
}

.rc-erreur{
  display:flex; align-items:flex-start; gap:8px; text-align:left;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:11px 13px; font-size:13px; line-height:1.5;
}

.rc-btn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  width:100%; background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:14px 0; cursor:pointer;
  font-family:inherit; font-size:15px; font-weight:600;
  box-shadow:${SHADOW.sm}; transition:background .18s ease;
}
.rc-btn:hover:not(:disabled){ background:${C.primaryDark}; }
.rc-btn:disabled{ opacity:.55; cursor:not-allowed; }

.rc-spin{ animation:rcSpin 1s linear infinite; }
@keyframes rcSpin{ to{ transform:rotate(360deg); } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;