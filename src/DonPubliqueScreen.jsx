import React, { useEffect, useState } from "react";
import { Heart, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const MONTANTS_PRESETS = [1000, 2500, 5000, 10000];

export default function DonPubliqueScreen({ slug }) {
  const [organisation, setOrganisation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [montant, setMontant] = useState(2500);
  const [montantPerso, setMontantPerso] = useState("");
  const [nomDonateur, setNomDonateur] = useState("");
  const [emailDonateur, setEmailDonateur] = useState("");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    async function charger() {
      const { data } = await supabase.rpc("organisation_don_par_slug", { p_slug: slug });
      setOrganisation(data || null);
      setLoading(false);
    }
    charger();
  }, [slug]);

  const montantFinal = montantPerso ? parseInt(montantPerso, 10) || 0 : montant;

  async function donner() {
    if (!montantFinal || montantFinal < 100) {
      setErreur("Indiquez un montant valide (100 FCFA minimum).");
      return;
    }
    setEnvoi(true);
    setErreur("");

    const { data, error } = await supabase.functions.invoke("creer-session-don", {
      body: {
        organisationId: organisation.organisation_id,
        montant: montantFinal,
        nomDonateur: nomDonateur.trim() || null,
        emailDonateur: emailDonateur.trim() || null,
        message: message.trim() || null,
        origine: window.location.origin + window.location.pathname,
      },
    });

    if (error || !data?.wave_launch_url) {
      setEnvoi(false);
      setErreur(data?.error || "Impossible de démarrer le paiement pour le moment.");
      return;
    }

    window.location.href = data.wave_launch_url;
  }

  if (loading) {
    return (
      <div className="don-shell">
        <style>{CSS}</style>
        <Loader2 size={28} className="don-spin" color={C.primary} />
      </div>
    );
  }

  if (!organisation || !organisation.module_dons) {
    return (
      <div className="don-shell">
        <style>{CSS}</style>
        <div className="don-carte don-carte-centree">
          <div className="don-icone don-icone-neutre"><AlertCircle size={26} /></div>
          <h1 className="don-titre">Page introuvable</h1>
          <p className="don-sous">
            Cette organisation n'accepte pas de dons pour le moment, ou le lien utilisé est incorrect.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="don-shell">
      <style>{CSS}</style>
      <div className="don-carte">
        <div className="don-icone"><Heart size={26} /></div>
        <h1 className="don-titre">Soutenir {organisation.nom}</h1>
        <p className="don-sous">Votre don est versé directement à {organisation.sigle}.</p>

        <div className="don-montants">
          {MONTANTS_PRESETS.map((m) => (
            <button
              key={m}
              className={`don-montant ${!montantPerso && montant === m ? "is-on" : ""}`}
              onClick={() => { setMontant(m); setMontantPerso(""); }}
            >
              {m.toLocaleString("fr-FR")} F
            </button>
          ))}
        </div>

        <input
          className="don-input"
          type="number"
          placeholder="Autre montant (FCFA)"
          value={montantPerso}
          onChange={(e) => setMontantPerso(e.target.value)}
        />

        <div className="don-section-titre">Vos informations — facultatives</div>

        <input
          className="don-input" placeholder="Votre nom"
          value={nomDonateur} onChange={(e) => setNomDonateur(e.target.value)}
        />
        <input
          className="don-input" type="email" placeholder="Votre e-mail"
          value={emailDonateur} onChange={(e) => setEmailDonateur(e.target.value)}
        />
        <textarea
          className="don-input" rows={2} placeholder="Un message d'encouragement"
          value={message} onChange={(e) => setMessage(e.target.value)}
        />

        {erreur && <div className="don-erreur"><AlertCircle size={15} /> {erreur}</div>}

        <button className="don-btn" onClick={donner} disabled={envoi}>
          {envoi
            ? <><Loader2 size={17} className="don-spin" /> Redirection…</>
            : <>Faire un don de {montantFinal.toLocaleString("fr-FR")} F <ArrowRight size={16} /></>}
        </button>

        <p className="don-legal">
          Paiement sécurisé via Wave. Babamoo ne conserve aucune donnée bancaire.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Styles ---------------- */

const CSS = `
.don-shell{
  min-height:100vh; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(160deg, ${PALETTE.blue50} 0%, ${C.bg} 55%);
  padding:${S.xl}px; font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
.don-carte{
  width:100%; max-width:440px; background:${C.surface};
  border:1px solid ${C.border}; border-radius:${R.xxl}px;
  padding:${S.xxl}px ${S.xl}px; box-shadow:${SHADOW.md};
}
.don-carte-centree{ text-align:center; }
.don-icone{
  width:56px; height:56px; border-radius:16px; margin:0 auto ${S.lg}px;
  background:#FEE2E2; color:#DC2626;
  display:flex; align-items:center; justify-content:center;
}
.don-icone-neutre{ background:${PALETTE.grey200}; color:${C.textSubtle}; }
.don-titre{ font-size:21px; font-weight:700; text-align:center; letter-spacing:-.02em; margin:0 0 6px; }
.don-sous{ font-size:13.5px; color:${C.textSubtle}; text-align:center; line-height:1.55; margin:0 0 ${S.lg}px; }

.don-montants{ display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:${S.sm}px; }
.don-montant{
  padding:12px 0; border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; color:${C.text}; font-family:inherit; font-size:15px; font-weight:700;
  cursor:pointer; transition:all .15s ease;
}
.don-montant:hover{ border-color:${PALETTE.grey300}; }
.don-montant.is-on{ border-color:#DC2626; background:#FEF2F2; color:#DC2626; }

.don-input{
  width:100%; box-sizing:border-box; padding:12px 14px; margin-bottom:8px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; color:${C.text}; font-family:inherit; font-size:14px; outline:none;
}
.don-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }

.don-section-titre{
  font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em;
  color:${C.textSubtle}; margin:${S.md}px 0 8px;
}

.don-erreur{
  display:flex; align-items:center; gap:8px; background:#FEE2E2; color:#DC2626;
  border-radius:${R.md}px; padding:11px 14px; font-size:13px; margin:8px 0;
}

.don-btn{
  display:flex; align-items:center; justify-content:center; gap:9px;
  width:100%; background:#DC2626; color:#fff; border:none;
  border-radius:${R.md}px; padding:15px 0; cursor:pointer; margin-top:6px;
  font-family:inherit; font-size:15px; font-weight:700;
  box-shadow:0 4px 14px -4px #DC262688; transition:transform .15s ease;
}
.don-btn:hover:not(:disabled){ transform:translateY(-1px); }
.don-btn:disabled{ opacity:.65; cursor:not-allowed; }

.don-legal{ font-size:11.5px; color:${C.textSubtle}; text-align:center; line-height:1.5; margin:${S.sm}px 0 0; }

.don-spin{ animation:donSpin 1s linear infinite; }
@keyframes donSpin{ to{ transform:rotate(360deg); } }
`;