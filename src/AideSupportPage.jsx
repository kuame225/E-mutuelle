import React, { useState } from "react";
import {
  HelpCircle, ChevronDown, MessageCircle, Send, Loader2, CheckCircle2, Phone,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW } from "./theme";

// À remplacer par le vrai numéro WhatsApp/téléphone de Babamoo.
const NUMERO_SUPPORT = "+225 00 00 00 00 00";

const FAQ = [
  {
    q: "Comment payer ma cotisation ?",
    r: "Depuis « Mes cotisations », choisissez une échéance et suivez le moyen de paiement proposé par votre organisation (Wave, ou une déclaration manuelle à confirmer par le Bureau). Le statut se met à jour automatiquement dès que le paiement est confirmé.",
  },
  {
    q: "Comment savoir si mon paiement a bien été reçu ?",
    r: "Le statut de chaque cotisation change dès la confirmation du paiement — « À jour » une fois réglée. En cas de doute après un délai raisonnable, contactez le Bureau de votre organisation.",
  },
  {
    q: "J'ai un souci pour accéder à mon compte, que faire ?",
    r: "Utilisez le lien fourni par votre Bureau pour rejoindre votre espace, ou contactez-le directement s'il vous a été remis un code d'activation que vous ne retrouvez plus.",
  },
  {
    q: "Mes informations sont-elles visibles par d'autres organisations ?",
    r: "Non — chaque organisation cliente de Babamoo est cloisonnée. Aucune autre organisation ne peut voir vos données, et Babamoo ne les partage jamais.",
  },
  {
    q: "Comment contacter le Bureau de mon organisation ?",
    r: "Directement via l'écran « Communications » de votre espace si votre organisation l'utilise, ou par les moyens habituels (téléphone, réunion) — Babamoo n'intervient pas dans la gestion interne de votre organisation.",
  },
];

export default function AideSupportPage({ membre }) {
  const { params } = useParametrage();
  const [ouvert, setOuvert] = useState(null);
  const [form, setForm] = useState({ nom: membre?.nom || "", contact: "", sujet: "", message: "" });
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState("");

  async function envoyer() {
    if (!form.nom.trim() || !form.sujet.trim() || !form.message.trim()) {
      setErreur("Le nom, le sujet et le message sont obligatoires.");
      return;
    }

    setEnvoi(true);
    setErreur("");

    const { error } = await supabase.from("messages_support").insert({
      organisation_id: params.organisation_id || null,
      nom: form.nom.trim(),
      contact: form.contact.trim() || null,
      sujet: form.sujet.trim(),
      message: form.message.trim(),
    });

    setEnvoi(false);
    if (error) { setErreur("Échec de l'envoi : " + error.message); return; }

    setEnvoye(true);
    setForm({ nom: membre?.nom || "", contact: "", sujet: "", message: "" });
  }

  const numeroWa = NUMERO_SUPPORT.replace(/[^\d]/g, "");

  return (
    <div className="as-wrap">
      <style>{CSS}</style>

      <header className="as-head">
        <h1 className="as-titre"><HelpCircle size={20} /> Aide et support</h1>
        <p className="as-sous">Une question sur la plateforme elle-même — pas sur votre organisation.</p>
      </header>

      {/* ---- Contact direct ---- */}
      <section className="as-card as-contact-rapide">
        <MessageCircle size={20} color={C.success} />
        <div>
          <div className="as-contact-titre">Besoin d'une réponse rapide ?</div>
          <div className="as-contact-texte">Écrivez-nous directement sur WhatsApp.</div>
        </div>
        <a
          className="as-btn-wa"
          href={`https://wa.me/${numeroWa}`}
          target="_blank" rel="noopener noreferrer"
        >
          <Phone size={15} /> {NUMERO_SUPPORT}
        </a>
      </section>

      {/* ---- FAQ ---- */}
      <section className="as-section">
        <h2 className="as-section-titre">Questions fréquentes</h2>
        <div className="as-faq">
          {FAQ.map((f, i) => (
            <div key={i} className="as-faq-item">
              <button className="as-faq-q" onClick={() => setOuvert(ouvert === i ? null : i)}>
                {f.q}
                <ChevronDown size={16} className={`as-faq-chevron ${ouvert === i ? "is-ouvert" : ""}`} />
              </button>
              {ouvert === i && <div className="as-faq-r">{f.r}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ---- Formulaire de contact ---- */}
      <section className="as-section">
        <h2 className="as-section-titre">Nous écrire</h2>

        {envoye ? (
          <div className="as-envoye">
            <CheckCircle2 size={20} color={C.success} />
            Votre message a bien été envoyé. Nous reviendrons vers vous dès que possible.
          </div>
        ) : (
          <div className="as-card as-form">
            <label className="as-label">Votre nom</label>
            <input
              className="as-input" value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
            />

            <label className="as-label">Téléphone ou e-mail (facultatif)</label>
            <input
              className="as-input" value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="Pour qu'on puisse vous répondre"
            />

            <label className="as-label">Sujet</label>
            <input
              className="as-input" value={form.sujet}
              onChange={(e) => setForm({ ...form, sujet: e.target.value })}
            />

            <label className="as-label">Message</label>
            <textarea
              className="as-textarea" rows={4} value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />

            {erreur && <div className="as-erreur">{erreur}</div>}

            <button className="as-btn-envoyer" onClick={envoyer} disabled={envoi}>
              {envoi ? <><Loader2 size={16} className="as-spin" /> Envoi…</> : <><Send size={15} /> Envoyer</>}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

const CSS = `
.as-wrap{ padding:${S.xl}px; max-width:720px; }
.as-head{ margin-bottom:${S.lg}px; }
.as-titre{ display:flex; align-items:center; gap:9px; font-size:20px; font-weight:700; margin:0; }
.as-sous{ font-size:13.5px; color:${C.textSubtle}; margin:6px 0 0; }

.as-card{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:18px; box-shadow:${SHADOW.xs};
}
.as-contact-rapide{
  display:flex; align-items:center; gap:14px; margin-bottom:${S.xl}px;
}
.as-contact-titre{ font-size:14px; font-weight:700; }
.as-contact-texte{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }
.as-btn-wa{
  margin-left:auto; flex-shrink:0; display:flex; align-items:center; gap:7px;
  background:${C.success}; color:#fff; border-radius:${R.pill}px;
  padding:10px 16px; font-size:13px; font-weight:700; text-decoration:none;
  white-space:nowrap;
}

.as-section{ margin-bottom:${S.xl}px; }
.as-section-titre{ font-size:15px; font-weight:700; margin:0 0 12px; }

.as-faq{ display:flex; flex-direction:column; gap:8px; }
.as-faq-item{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px; overflow:hidden;
}
.as-faq-q{
  width:100%; display:flex; align-items:center; justify-content:space-between;
  background:none; border:none; cursor:pointer; text-align:left;
  padding:14px 16px; font-family:inherit; font-size:13.5px; font-weight:600; color:${C.text};
}
.as-faq-chevron{ transition:transform .18s ease; color:${C.textSubtle}; flex-shrink:0; }
.as-faq-chevron.is-ouvert{ transform:rotate(180deg); }
.as-faq-r{
  padding:0 16px 16px; font-size:13px; color:${C.textMuted}; line-height:1.6;
}

.as-form{ display:flex; flex-direction:column; gap:12px; }
.as-label{ font-size:12.5px; font-weight:600; color:${C.textMuted}; }
.as-input, .as-textarea{
  width:100%; box-sizing:border-box; padding:11px 14px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  font-family:inherit; font-size:14px; outline:none; resize:vertical;
}
.as-erreur{ background:${C.dangerSoft}; color:${C.danger}; border-radius:${R.md}px; padding:10px 13px; font-size:13px; }
.as-btn-envoyer{
  display:flex; align-items:center; justify-content:center; gap:8px;
  background:${C.primary}; color:#fff; border:none; border-radius:${R.md}px;
  padding:12px 0; cursor:pointer; font-family:inherit; font-size:14px; font-weight:700;
}
.as-btn-envoyer:disabled{ opacity:.65; cursor:not-allowed; }
.as-spin{ animation:asSpin 1s linear infinite; }
@keyframes asSpin{ to{ transform:rotate(360deg); } }

.as-envoye{
  display:flex; align-items:center; gap:10px;
  background:#DCFCE7; color:${C.success}; border-radius:${R.xl}px;
  padding:18px; font-size:13.5px; font-weight:600;
}
`;