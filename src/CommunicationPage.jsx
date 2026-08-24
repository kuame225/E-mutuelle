import React, { useEffect, useState } from "react";
import {
  Megaphone, Send, X, Loader2, Users, CheckCircle2, Clock,
  AlertCircle, Trash2, Bell, Eye,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { diffuserCommunique } from "./notifier";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const CIBLES = {
  tous:   { label: "Tous les membres", court: "Tous",     Icon: Users,        color: C.primary },
  a_jour: { label: "Membres à jour",   court: "À jour",   Icon: CheckCircle2, color: C.success },
  retard: { label: "Membres en retard", court: "Retard",  Icon: Clock,        color: C.danger },
};

const MODELES = [
  {
    id: "rappel",
    label: "Rappel d'échéance",
    cible: "retard",
    titre: "Rappel de cotisation",
    message:
      "Chers membres,\n\nNous vous rappelons que votre cotisation reste à régler. " +
      "Vous pouvez vous rapprocher du trésorier pour régulariser votre situation.\n\n" +
      "Merci de votre engagement au sein de la mutuelle.",
  },
  {
    id: "assemblee",
    label: "Convocation à l'assemblée",
    cible: "tous",
    titre: "Convocation à l'assemblée générale",
    message:
      "Chers membres,\n\nLe Bureau vous convie à l'assemblée générale qui se tiendra " +
      "le [date] à [heure], à [lieu].\n\nVotre présence est vivement souhaitée.",
  },
  {
    id: "tombola",
    label: "Annonce de tombola",
    cible: "tous",
    titre: "Tombola du trimestre",
    message:
      "Chers membres,\n\nLa tombola du trimestre est ouverte. Tout membre à jour " +
      "de ses cotisations reçoit automatiquement un ticket bonus gratuit.\n\n" +
      "Des tickets supplémentaires sont disponibles auprès du trésorier.",
  },
];

export default function CommunicationPage() {
  const { params } = useParametrage();
  const [messages, setMessages] = useState([]);
  const [effectifs, setEffectifs] = useState({ tous: 0, a_jour: 0, retard: 0 });
  const [loading, setLoading] = useState(true);
  const [redaction, setRedaction] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [form, setForm] = useState({ titre: "", message: "", cible: "tous" });

  async function charger() {
    const [msgRes, memRes] = await Promise.all([
      supabase.from("communications_mutuelle").select("*")
        .eq("organisation_id", params.organisation_id)
        .order("created_at", { ascending: false }),
      supabase.from("membres").select("statut_cotisation")
        .eq("organisation_id", params.organisation_id)
        .eq("actif", true),
    ]);

    const membres = memRes.data || [];
    setEffectifs({
      tous: membres.length,
      a_jour: membres.filter((m) => m.statut_cotisation === "a_jour").length,
      retard: membres.filter((m) => m.statut_cotisation !== "a_jour").length,
    });
    setMessages(msgRes.data || []);
    setLoading(false);
  }

  useEffect(() => { charger(); }, []);

  async function publier() {
    if (!form.titre.trim()) { setErreur("Le titre est obligatoire."); return; }
    if (!form.message.trim()) { setErreur("Le message ne peut pas être vide."); return; }

    setEnvoi(true);
    setErreur("");

    const titre = form.titre.trim();
    const message = form.message.trim();
    const cible = form.cible;

    const { error } = await supabase.from("communications_mutuelle").insert({
      organisation_id: params.organisation_id,
      titre,
      message,
      cible,
    });

    if (error) {
      setEnvoi(false);
      setErreur(error.message);
      return;
    }

    // Notification push aux membres concernés.
    // Un échec de diffusion ne remet pas en cause la publication du communiqué.
    const diffusion = await diffuserCommunique({
      cible, titre, message,
      organisationId: params.organisation_id,
    });

    setEnvoi(false);
    setForm({ titre: "", message: "", cible: "tous" });
    setRedaction(false);

    const alertes = diffusion?.envoyes ?? 0;
    setSucces(
      `Communiqué publié pour ${effectifs[cible]} membre(s).` +
      (alertes > 0 ? ` Alerte envoyée sur ${alertes} appareil(s).` : "")
    );
    setTimeout(() => setSucces(""), 4000);
    charger();
  }

  async function supprimer(id) {
    setEnvoi(true);
    await supabase.from("communications_mutuelle").delete().eq("id", id);
    setEnvoi(false);
    setConfirmation(null);
    charger();
  }

  function appliquerModele(m) {
    setForm({ titre: m.titre, message: m.message, cible: m.cible });
    setErreur("");
  }

  if (loading) {
    return (
      <div className="cm-wrap">
        <style>{CSS}</style>
        <div className="cm-skel" /><div className="cm-skel" />
      </div>
    );
  }

  return (
    <div className="cm-wrap">
      <style>{CSS}</style>

      <header className="cm-head">
        <div>
          <h1 className="cm-titre">Communications</h1>
          <p className="cm-sub">
            Les communiqués s'affichent dans l'espace personnel des membres concernés.
          </p>
        </div>
        {!redaction && (
          <button className="cm-btn" onClick={() => { setRedaction(true); setErreur(""); }}>
            <Megaphone size={17} /> Rédiger un communiqué
          </button>
        )}
      </header>

      {succes && (
        <div className="cm-succes"><CheckCircle2 size={17} /> {succes}</div>
      )}

      {/* ---- Rédaction ---- */}
      {redaction && (
        <section className="cm-card cm-redaction">
          <header className="cm-red-head">
            <h2 className="cm-card-titre">Nouveau communiqué</h2>
            <button
              className="cm-close"
              onClick={() => { setRedaction(false); setErreur(""); }}
              aria-label="Fermer"
            >
              <X size={19} />
            </button>
          </header>

          {/* Modèles */}
          <div className="cm-field">
            <span className="cm-label">Partir d'un modèle</span>
            <div className="cm-modeles">
              {MODELES.map((m) => (
                <button key={m.id} className="cm-modele" onClick={() => appliquerModele(m)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Destinataires */}
          <div className="cm-field">
            <span className="cm-label">Destinataires</span>
            <div className="cm-cibles">
              {Object.entries(CIBLES).map(([id, c]) => (
                <button
                  key={id}
                  className={`cm-cible ${form.cible === id ? "is-on" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, cible: id }))}
                  style={form.cible === id
                    ? { borderColor: c.color, background: c.color + "10" }
                    : {}}
                >
                  <span
                    className="cm-cible-icon"
                    style={{ background: c.color + "18", color: c.color }}
                  >
                    <c.Icon size={17} />
                  </span>
                  <span className="cm-cible-text">
                    <strong>{c.label}</strong>
                    <em>{effectifs[id]} membre{effectifs[id] > 1 ? "s" : ""}</em>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="cm-field">
            <label className="cm-label" htmlFor="titre">Titre</label>
            <input
              id="titre"
              value={form.titre}
              onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
              placeholder="Ex : Convocation à l'assemblée générale"
              className="cm-input"
            />
          </div>

          <div className="cm-field">
            <label className="cm-label" htmlFor="msg">Message</label>
            <textarea
              id="msg"
              rows={7}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="Rédigez votre message…"
              className="cm-input cm-textarea"
            />
            <span className="cm-compteur">{form.message.length} caractères</span>
          </div>

          {erreur && (
            <div className="cm-erreur"><AlertCircle size={16} /> {erreur}</div>
          )}

          {/* Aperçu */}
          {(form.titre || form.message) && (
            <div className="cm-apercu">
              <div className="cm-apercu-label"><Eye size={13} /> Aperçu côté membre</div>
              <div className="cm-apercu-carte">
                <div className="cm-apercu-titre">{form.titre || "Sans titre"}</div>
                <div className="cm-apercu-msg">{form.message || "…"}</div>
                <div className="cm-apercu-date">
                  {new Date().toLocaleDateString("fr-FR")}
                </div>
              </div>
            </div>
          )}

          <div className="cm-actions">
            <button
              className="cm-mbtn cm-mbtn-ghost"
              onClick={() => { setRedaction(false); setErreur(""); }}
              disabled={envoi}
            >
              Annuler
            </button>
            <button className="cm-mbtn cm-mbtn-primary" onClick={publier} disabled={envoi}>
              {envoi
                ? <><Loader2 size={17} className="cm-spin" /> Publication…</>
                : <><Send size={17} /> Publier</>}
            </button>
          </div>
        </section>
      )}

      {/* ---- Historique ---- */}
      {messages.length === 0 ? (
        <div className="cm-vide">
          <Megaphone size={38} color={PALETTE.grey300} />
          <div className="cm-vide-titre">Aucun communiqué</div>
          <div className="cm-vide-sub">
            Les messages publiés apparaîtront dans l'espace personnel des membres
            concernés et dans leur fil de notifications.
          </div>
        </div>
      ) : (
        <ul className="cm-liste">
          {messages.map((m) => {
            const c = CIBLES[m.cible] || CIBLES.tous;
            return (
              <li key={m.id} className="cm-item">
                <div className="cm-item-head">
                  <span
                    className="cm-item-icon"
                    style={{ background: c.color + "14", color: c.color }}
                  >
                    <Bell size={18} />
                  </span>

                  <div className="cm-item-id">
                    <div className="cm-item-titre">{m.titre}</div>
                    <div className="cm-item-meta">
                      <span className="cm-tag" style={{ background: c.color + "14", color: c.color }}>
                        <c.Icon size={11} /> {c.court}
                      </span>
                      {new Date(m.created_at).toLocaleDateString("fr-FR")} à{" "}
                      {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>

                  <button
                    className="cm-icon-btn"
                    onClick={() => setConfirmation(m)}
                    aria-label="Supprimer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <p className="cm-item-msg">{m.message}</p>
              </li>
            );
          })}
        </ul>
      )}

      {/* ---- Confirmation ---- */}
      {confirmation && (
        <div className="cm-overlay" onClick={() => setConfirmation(null)}>
          <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cm-modal-titre">Retirer ce communiqué ?</h3>
            <p className="cm-modal-texte">
              <strong>{confirmation.titre}</strong> ne sera plus visible par les membres.
            </p>
            <div className="cm-actions">
              <button
                className="cm-mbtn cm-mbtn-ghost"
                onClick={() => setConfirmation(null)}
                disabled={envoi}
              >
                Annuler
              </button>
              <button
                className="cm-mbtn cm-mbtn-danger"
                onClick={() => supprimer(confirmation.id)}
                disabled={envoi}
              >
                {envoi ? <><Loader2 size={16} className="cm-spin" /> Suppression…</> : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.cm-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .cm-wrap{ padding:${S.lg}px; } }

.cm-head{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:${S.md}px; flex-wrap:wrap;
}
.cm-titre{ font-size:22px; font-weight:700; letter-spacing:-.02em; margin:0; }
.cm-sub{ font-size:14px; color:${C.textSubtle}; margin:4px 0 0; max-width:52ch; line-height:1.5; }
.cm-btn{
  display:flex; align-items:center; gap:7px; flex-shrink:0;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.cm-btn:hover{ background:${C.primaryDark}; }

.cm-succes{
  display:flex; align-items:center; gap:9px;
  background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
  animation:cmIn .2s ease;
}

/* ---- Rédaction ---- */
.cm-card{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.cm-redaction{ animation:cmIn .25s ease; }
.cm-red-head{
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:${S.lg}px;
}
.cm-card-titre{ font-size:17px; font-weight:600; margin:0; letter-spacing:-.01em; }
.cm-close{
  background:none; border:1px solid ${C.border}; border-radius:${R.sm}px;
  color:${C.textSubtle}; cursor:pointer; padding:6px; display:flex;
}
.cm-close:hover{ color:${C.danger}; border-color:${C.danger}; }

.cm-field{ margin-bottom:${S.lg}px; }
.cm-label{ display:block; font-size:13.5px; font-weight:600; color:${C.textMuted}; margin-bottom:9px; }

.cm-modeles{ display:flex; flex-wrap:wrap; gap:${S.sm}px; }
.cm-modele{
  background:${C.bg}; border:1px solid ${C.border};
  border-radius:${R.pill}px; padding:8px 14px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600; color:${C.textMuted};
  transition:all .16s ease;
}
.cm-modele:hover{ border-color:${C.primary}; color:${C.primary}; background:${PALETTE.blue50}; }

.cm-cibles{ display:grid; gap:${S.sm}px; grid-template-columns:1fr; }
@media (min-width:620px){ .cm-cibles{ grid-template-columns:repeat(3, 1fr); } }
.cm-cible{
  display:flex; align-items:center; gap:${S.md}px;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:12px 14px; cursor:pointer;
  font-family:inherit; text-align:left; transition:all .16s ease;
}
.cm-cible:hover{ border-color:${PALETTE.grey300}; }
.cm-cible-icon{
  width:36px; height:36px; border-radius:${R.sm}px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.cm-cible-text{ display:flex; flex-direction:column; min-width:0; }
.cm-cible-text strong{ font-size:13.5px; font-weight:600; }
.cm-cible-text em{ font-style:normal; font-size:12px; color:${C.textSubtle}; margin-top:1px; }

.cm-input{
  width:100%; box-sizing:border-box; padding:13px 15px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:15px;
  color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.cm-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.cm-textarea{ resize:vertical; line-height:1.6; }
.cm-compteur{
  display:block; text-align:right; font-size:12px;
  color:${C.textSubtle}; margin-top:5px;
}

.cm-erreur{
  display:flex; align-items:center; gap:9px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:12px 14px; font-size:13.5px; margin-bottom:${S.lg}px;
}

/* ---- Aperçu ---- */
.cm-apercu{ margin-bottom:${S.lg}px; }
.cm-apercu-label{
  display:flex; align-items:center; gap:6px;
  font-size:12px; font-weight:600; color:${C.textSubtle};
  text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px;
}
.cm-apercu-carte{
  background:${C.bg}; border:1px dashed ${C.border};
  border-radius:${R.md}px; padding:${S.md}px ${S.lg}px;
}
.cm-apercu-titre{ font-size:14px; font-weight:700; }
.cm-apercu-msg{
  font-size:13px; color:${C.textMuted}; line-height:1.55;
  margin-top:5px; white-space:pre-wrap;
}
.cm-apercu-date{ font-size:11.5px; color:${C.textSubtle}; margin-top:7px; }

.cm-actions{ display:flex; gap:${S.md}px; }
.cm-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.cm-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.cm-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.cm-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.cm-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.cm-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.cm-mbtn-ghost{
  flex:1; background:${C.surface}; color:${C.textMuted};
  border:1.5px solid ${C.border};
}
.cm-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Historique ---- */
.cm-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:${S.md}px; }
.cm-item{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.cm-item-head{ display:flex; align-items:flex-start; gap:${S.md}px; }
.cm-item-icon{
  width:40px; height:40px; border-radius:${R.md}px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.cm-item-id{ flex:1; min-width:0; }
.cm-item-titre{ font-size:15.5px; font-weight:700; letter-spacing:-.01em; }
.cm-item-meta{
  display:flex; align-items:center; gap:9px; flex-wrap:wrap;
  font-size:12.5px; color:${C.textSubtle}; margin-top:4px;
}
.cm-tag{
  display:inline-flex; align-items:center; gap:4px;
  padding:3px 9px; border-radius:${R.pill}px;
  font-size:11px; font-weight:600;
}
.cm-icon-btn{
  width:32px; height:32px; border-radius:${R.sm}px; flex-shrink:0;
  background:${C.surface}; border:1px solid ${C.border};
  color:${C.textSubtle}; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .16s ease;
}
.cm-icon-btn:hover{ border-color:${C.danger}; color:${C.danger}; background:#FEE2E2; }
.cm-item-msg{
  font-size:13.5px; color:${C.textMuted}; line-height:1.65;
  white-space:pre-wrap; margin:${S.md}px 0 0;
  background:${C.bg}; border-radius:${R.md}px; padding:13px 15px;
}

/* ---- Modale ---- */
.cm-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; animation:cmFade .18s ease;
}
.cm-modal{
  width:100%; max-width:410px; background:${C.surface};
  border-radius:${R.xxl}px; padding:${S.xl}px;
  box-shadow:${SHADOW.lg}; animation:cmUp .22s cubic-bezier(.4,0,.2,1);
}
.cm-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0 0 8px; }
.cm-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:0 0 ${S.xl}px; }

/* ---- Divers ---- */
.cm-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.cm-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.cm-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:44ch; line-height:1.6; }
.cm-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:cmShim 1.4s infinite;
}
.cm-spin{ animation:cmSpin 1s linear infinite; }
@keyframes cmSpin{ to{ transform:rotate(360deg); } }
@keyframes cmShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
@keyframes cmFade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes cmUp{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
@keyframes cmIn{ from{ opacity:0; transform:translateY(-5px); } to{ opacity:1; transform:none; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;