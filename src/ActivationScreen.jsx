import React, { useState } from "react";
import {
  KeyRound, ArrowLeft, ArrowRight, Loader2, AlertCircle,
  CheckCircle2, UserCheck, ShieldCheck, Mail,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, R, S, SHADOW, PALETTE } from "./theme";
import { consigner, EVENEMENTS } from "./journal";

export default function ActivationScreen({ onBack }) {
  const [etape, setEtape] = useState("code");   // code | confirmation | lien-envoye | succes
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

    const { data, error } = await supabase.rpc("verifier_code_activation", {
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

  async function activer() {
    setChargement(true);
    setErreur("");

    const saisi = code.trim().toUpperCase();
    const tel = (membre.telephone || "").replace(/\D/g, "");

    // Le domaine appartient à la mutuelle, il n'est plus fixé dans le code :
    // deux membres de mutuelles différentes portant le même numéro de
    // téléphone obtiendraient sinon le même identifiant de compte.
    // Cet écran s'utilise sans session, d'où la fonction serveur.
    let identifiant = membre.email?.trim()?.toLowerCase() || null;

    if (!identifiant) {
      const { data: domaine } = await supabase.rpc("domaine_technique_membre", {
        p_membre_id: membre.id || membre.membre_id,
      });
      identifiant = `${tel}@${domaine || "mephda.local"}`;
    }

    const motDePasse = crypto.randomUUID() + crypto.randomUUID();

    const { data, error } = await supabase.auth.signUp({
      email: identifiant,
      password: motDePasse,
    });

    if (error) {
      const dejaExistant = error.message.toLowerCase().includes("already registered");

      if (dejaExistant && membre.email?.trim()) {
        // Un compte existe déjà mais le membre a un e-mail réel : on lui envoie
        // un lien de connexion plutôt que de le bloquer.
        const { error: otpErr } = await supabase.auth.signInWithOtp({
          email: identifiant,
          options: { shouldCreateUser: false },
        });

        setChargement(false);

        if (otpErr) {
          setErreur(
            "Un accès existe déjà, et l'envoi du lien de connexion a échoué : " +
            otpErr.message + ". Rapprochez-vous du Bureau."
          );
          return;
        }

        setEtape("lien-envoye");
        return;
      }

      setChargement(false);

      if (dejaExistant) {
        // Pas d'e-mail réel : sans e-mail ni SMS Orange encore branché,
        // il n'y a aujourd'hui aucun canal automatique pour ce membre.
        setErreur(
          "Un accès existe déjà pour ce membre, mais sans adresse e-mail il n'est " +
          "pas possible de le lui renvoyer automatiquement. Le Bureau doit " +
          "réinitialiser son accès manuellement."
        );
      } else {
        setErreur("Activation impossible : " + error.message);
      }
      return;
    }

    const utilisateur = data.user;
    if (!utilisateur) {
      setChargement(false);
      setErreur("Le compte n'a pas pu être créé. Contactez le Bureau.");
      return;
    }

    const { error: lienErr } = await supabase.rpc("consommer_code_activation", {
      p_code: saisi,
      p_user_id: utilisateur.id,
    });

    setChargement(false);

    if (lienErr) {
      setErreur("Le compte a été créé mais la liaison a échoué : " + lienErr.message);
      return;
    }

    await consigner(EVENEMENTS.ACTIVATION_COMPTE, { membre_id: membre.id });

    setEtape("succes");
    setTimeout(() => window.location.reload(), 2600);
  }

  return (
    <div className="ac-shell">
      <style>{CSS}</style>

      <div className="ac-carte">
        {etape !== "succes" && etape !== "lien-envoye" && (
          <button className="ac-retour" onClick={onBack}>
            <ArrowLeft size={15} /> Retour
          </button>
        )}

        {/* ---- Saisie du code ---- */}
        {etape === "code" && (
          <>
            <div className="ac-icone"><KeyRound size={26} /></div>
            <h1 className="ac-titre">Activer mon espace</h1>
            <p className="ac-sous">
              Saisissez le code d'activation que le Bureau vous a remis.
            </p>

            <form onSubmit={verifier} className="ac-form">
              <label className="ac-label" htmlFor="code">Code d'activation</label>
              <input
                id="code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().slice(0, 8));
                  setErreur("");
                }}
                placeholder="XXXXXXXX"
                autoComplete="off"
                autoCapitalize="characters"
                className="ac-input"
              />

              {erreur && (
                <div className="ac-erreur"><AlertCircle size={16} /> {erreur}</div>
              )}

              <button
                type="submit"
                className="ac-btn"
                disabled={chargement || code.length !== 8}
              >
                {chargement
                  ? <><Loader2 size={17} className="ac-spin" /> Vérification…</>
                  : <>Continuer <ArrowRight size={17} /></>}
              </button>
            </form>

            <p className="ac-aide">
              Vous n'avez pas de code ? Demandez-le au trésorier ou à un membre du Bureau.
            </p>
          </>
        )}

        {/* ---- Confirmation d'identité ---- */}
        {etape === "confirmation" && (
          <>
            <div className="ac-icone ac-icone-ok"><UserCheck size={26} /></div>
            <h1 className="ac-titre">Confirmez votre identité</h1>
            <p className="ac-sous">
              Ce code correspond au membre suivant.
            </p>

            <div className="ac-identite">
              <div className="ac-identite-nom">{membre.nom}</div>
              <div className="ac-identite-tel">{membre.telephone}</div>
              {membre.email && (
                <div className="ac-identite-mail">{membre.email}</div>
              )}
            </div>

            {erreur && (
              <div className="ac-erreur"><AlertCircle size={16} /> {erreur}</div>
            )}

            <button className="ac-btn" onClick={activer} disabled={chargement}>
              {chargement
                ? <><Loader2 size={17} className="ac-spin" /> Activation…</>
                : <><ShieldCheck size={17} /> C'est bien moi, activer</>}
            </button>

            <button
              className="ac-lien"
              onClick={() => { setEtape("code"); setErreur(""); setMembre(null); }}
              disabled={chargement}
            >
              Ce n'est pas moi
            </button>
          </>
        )}

        {/* ---- Lien de connexion envoyé ---- */}
        {etape === "lien-envoye" && (
          <>
            <div className="ac-icone ac-icone-ok"><Mail size={26} /></div>
            <h1 className="ac-titre">Lien envoyé</h1>
            <p className="ac-sous">
              Un accès existait déjà pour {membre?.nom?.split(" ")[0]}. Un lien de
              connexion vient d'être envoyé à son adresse e-mail : ouvrez-le pour
              accéder à votre espace.
            </p>

            <button className="ac-btn" onClick={onBack}>
              Revenir à l'accueil
            </button>
          </>
        )}

        {/* ---- Succès ---- */}
        {etape === "succes" && (
          <>
            <div className="ac-icone ac-icone-ok"><CheckCircle2 size={30} /></div>
            <h1 className="ac-titre">Espace activé</h1>
            <p className="ac-sous">
              Bienvenue {membre?.nom?.split(" ")[0]}. Votre espace personnel s'ouvre…
            </p>
            <div className="ac-barre"><span /></div>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.ac-shell{
  min-height:100vh; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(160deg, ${PALETTE.blue50} 0%, ${C.bg} 55%);
  padding:${S.xl}px; font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
.ac-carte{
  width:100%; max-width:420px; background:${C.surface};
  border:1px solid ${C.border}; border-radius:${R.xxl}px;
  padding:${S.xxl}px ${S.xl}px; box-shadow:${SHADOW.md};
  text-align:center; animation:acIn .3s ease;
}
.ac-retour{
  display:flex; align-items:center; gap:6px; align-self:flex-start;
  background:none; border:none; padding:0; margin-bottom:${S.lg}px;
  cursor:pointer; font-family:inherit; font-size:14px;
  font-weight:600; color:${C.primary};
}
.ac-retour:hover{ text-decoration:underline; }

.ac-icone{
  width:64px; height:64px; border-radius:50%; margin:0 auto ${S.lg}px;
  background:${PALETTE.blue100}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.ac-icone-ok{ background:#DCFCE7; color:${C.success}; }

.ac-titre{ font-size:23px; font-weight:700; letter-spacing:-.02em; margin:0; }
.ac-sous{
  font-size:14.5px; color:${C.textSubtle}; line-height:1.6;
  margin:${S.sm}px auto ${S.xl}px; max-width:34ch;
}

.ac-form{ display:flex; flex-direction:column; gap:${S.md}px; text-align:left; }
.ac-label{ font-size:13.5px; font-weight:600; color:${C.textMuted}; }
.ac-input{
  width:100%; box-sizing:border-box; padding:16px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; color:${C.text}; outline:none;
  font-family:'JetBrains Mono',monospace; font-size:26px; font-weight:700;
  text-align:center; letter-spacing:.28em; text-indent:.28em;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.ac-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.ac-input::placeholder{ color:${PALETTE.grey300}; letter-spacing:.28em; }

.ac-identite{
  background:${C.bg}; border-radius:${R.lg}px;
  padding:${S.lg}px; margin-bottom:${S.lg}px;
}
.ac-identite-nom{ font-size:19px; font-weight:700; letter-spacing:-.01em; }
.ac-identite-tel{ font-size:14px; color:${C.textMuted}; margin-top:4px; }
.ac-identite-mail{ font-size:13px; color:${C.textSubtle}; margin-top:2px; }

.ac-erreur{
  display:flex; align-items:flex-start; gap:9px; text-align:left;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:12px 14px; font-size:13.5px; line-height:1.5;
  margin-bottom:${S.md}px; animation:acIn .2s ease;
}

.ac-btn{
  display:flex; align-items:center; justify-content:center; gap:9px;
  width:100%; background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:15px 0; cursor:pointer;
  font-family:inherit; font-size:15px; font-weight:600;
  box-shadow:${SHADOW.sm}; transition:background .18s ease;
}
.ac-btn:hover:not(:disabled){ background:${C.primaryDark}; }
.ac-btn:disabled{ opacity:.55; cursor:not-allowed; }

.ac-lien{
  background:none; border:none; padding:0; margin-top:${S.md}px;
  cursor:pointer; font-family:inherit; font-size:13.5px;
  font-weight:600; color:${C.textSubtle};
}
.ac-lien:hover{ color:${C.danger}; }

.ac-aide{
  font-size:12.5px; color:${C.textSubtle}; line-height:1.55;
  margin:${S.xl}px 0 0; padding-top:${S.lg}px;
  border-top:1px solid ${C.border};
}

.ac-barre{
  height:4px; border-radius:4px; background:${PALETTE.grey200};
  overflow:hidden; margin-top:${S.lg}px;
}
.ac-barre span{
  display:block; height:100%; border-radius:4px;
  background:${C.success}; animation:acProgres 2.6s linear forwards;
}

.ac-spin{ animation:acSpin 1s linear infinite; }
@keyframes acSpin{ to{ transform:rotate(360deg); } }
@keyframes acIn{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:none; } }
@keyframes acProgres{ from{ width:0; } to{ width:100%; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;