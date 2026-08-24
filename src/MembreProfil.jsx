import React, { useState, } from "react";
import {
  ArrowLeft, User, Phone, Mail, Briefcase, CalendarDays,
  Lock, LogOut, Check, Loader2, AlertCircle, Pencil, X,
  CheckCircle2, Clock, AlertTriangle, ShieldCheck, UserPlus,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage, construireMatricule } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const STATUT = {
  nouveau:  { label: "Nouveau",   color: C.primaryLight, soft: PALETTE.blue100, Icon: UserPlus },
  a_jour:   { label: "À jour",    color: C.success, soft: "#DCFCE7", Icon: CheckCircle2 },
  partiel:  { label: "Partiel",   color: C.warning, soft: "#FEF3C7", Icon: Clock },
  retard:   { label: "En retard", color: C.danger,  soft: "#FEE2E2", Icon: AlertTriangle },
  suspendu: { label: "Suspendu",  color: C.danger,  soft: "#FEE2E2", Icon: AlertTriangle },
};

export default function MembreProfil({ membre, onBack, onSignOut }) {
  const { params } = useParametrage();
  const [fiche, setFiche] = useState(membre);
  const [edition, setEdition] = useState(false);
  const [form, setForm] = useState({
    nom: membre.nom,
    telephone: membre.telephone || "",
    email: membre.email || "",
  });
  const [pw, setPw] = useState({ nouveau: "", confirmer: "" });
  const [pwOuvert, setPwOuvert] = useState(false);
  const [enCours, setEnCours] = useState(null);   // "profil" | "pw"
  const [succes, setSucces] = useState("");
  const [erreur, setErreur] = useState("");
  const [deconnexion, setDeconnexion] = useState(false);

  const st = STATUT[fiche.statut_cotisation] || STATUT.a_jour;
  const initiales = fiche.nom.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase();
  const matricule = construireMatricule(params, fiche);

  function notifier(message) {
    setSucces(message);
    setErreur("");
    setTimeout(() => setSucces(""), 3500);
  }

  async function enregistrerProfil() {
    if (!form.nom.trim()) { setErreur("Le nom ne peut pas être vide."); return; }
    if (!form.telephone.trim()) { setErreur("Le téléphone est obligatoire."); return; }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      setErreur("Adresse e-mail invalide.");
      return;
    }

    setEnCours("profil");
    setErreur("");

    const maj = {
      nom: form.nom.trim(),
      telephone: form.telephone.trim(),
      email: form.email.trim().toLowerCase() || null,
    };

    const { error } = await supabase.from("membres").update(maj).eq("id", fiche.id);
    setEnCours(null);

    if (error) { setErreur(error.message); return; }

    setFiche({ ...fiche, ...maj });
    setEdition(false);
    notifier("Vos informations ont été mises à jour.");
  }

  async function changerMotDePasse() {
    if (pw.nouveau.length < 8) {
      setErreur("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (pw.nouveau !== pw.confirmer) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setEnCours("pw");
    setErreur("");
    const { error } = await supabase.auth.updateUser({ password: pw.nouveau });
    setEnCours(null);

    if (error) { setErreur(error.message); return; }

    setPw({ nouveau: "", confirmer: "" });
    setPwOuvert(false);
    notifier("Votre mot de passe a été modifié.");
  }

  return (
    <div className="pf-wrap">
      <style>{CSS}</style>

      <button className="pf-back" onClick={onBack}>
        <ArrowLeft size={16} /> Retour
      </button>

      {/* ---- Identité ---- */}
      <section className="pf-identite">
        {fiche.photo_url ? (
          <img src={fiche.photo_url} alt={fiche.nom} className="pf-photo" />
        ) : (
          <div className="pf-photo pf-photo-init">{initiales}</div>
        )}

        <h1 className="pf-nom">{fiche.nom}</h1>
        <p className="pf-poste">{fiche.poste || "—"}</p>

        <span className="pf-chip" style={{ background: st.soft, color: st.color }}>
          <st.Icon size={14} /> {st.label}
        </span>

        <div className="pf-matricule">{matricule}</div>
      </section>

      {succes && (
        <div className="pf-succes">
          <Check size={16} /> {succes}
        </div>
      )}
      {erreur && !edition && !pwOuvert && (
        <div className="pf-erreur">
          <AlertCircle size={16} /> {erreur}
        </div>
      )}

      {/* ---- Informations ---- */}
      <section className="pf-bloc">
        <header className="pf-bloc-head">
          <h2 className="pf-bloc-titre">Mes informations</h2>
          {!edition && (
            <button className="pf-lien" onClick={() => { setEdition(true); setErreur(""); }}>
              <Pencil size={14} /> Modifier
            </button>
          )}
        </header>

        {edition ? (
          <div className="pf-form">
            <Champ label="Nom et prénoms" id="nom" Icon={User}
              value={form.nom} onChange={(v) => setForm((f) => ({ ...f, nom: v }))} />

            <Champ label="Téléphone" id="tel" Icon={Phone} type="tel"
              value={form.telephone} onChange={(v) => setForm((f) => ({ ...f, telephone: v }))} />

            <Champ label="Adresse e-mail" id="mail" Icon={Mail} type="email"
              value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))}
              aide={!fiche.email
                ? "En renseignant une adresse, vous pourrez recevoir vos reçus et notifications."
                : null} />

            {erreur && (
              <div className="pf-erreur">
                <AlertCircle size={16} /> {erreur}
              </div>
            )}

            <div className="pf-actions">
              <button
                className="pf-btn pf-btn-ghost"
                onClick={() => {
                  setEdition(false);
                  setErreur("");
                  setForm({
                    nom: fiche.nom,
                    telephone: fiche.telephone || "",
                    email: fiche.email || "",
                  });
                }}
                disabled={enCours === "profil"}
              >
                Annuler
              </button>
              <button
                className="pf-btn pf-btn-primary"
                onClick={enregistrerProfil}
                disabled={enCours === "profil"}
              >
                {enCours === "profil"
                  ? <><Loader2 size={16} className="pf-spin" /> Enregistrement…</>
                  : "Enregistrer"}
              </button>
            </div>
          </div>
        ) : (
          <dl className="pf-infos">
            <Info Icon={User} label="Nom et prénoms" valeur={fiche.nom} />
            <Info Icon={Phone} label="Téléphone" valeur={fiche.telephone || "—"} />
            <Info Icon={Mail} label="Adresse e-mail"
              valeur={fiche.email || "Non renseignée"}
              alerte={!fiche.email} />
            <Info Icon={Briefcase} label="Poste" valeur={fiche.poste || "—"} />
            <Info Icon={Briefcase} label="Service" valeur={fiche.service || "—"} />
            <Info Icon={CalendarDays} label="Membre depuis"
              valeur={fiche.date_adhesion
                ? new Date(fiche.date_adhesion).toLocaleDateString("fr-FR")
                : "—"} />
          </dl>
        )}
      </section>

      {/* ---- Sécurité ---- */}
      <section className="pf-bloc">
        <header className="pf-bloc-head">
          <h2 className="pf-bloc-titre">
            <ShieldCheck size={17} /> Sécurité
          </h2>
        </header>

        {!pwOuvert ? (
          <button className="pf-ligne-btn" onClick={() => { setPwOuvert(true); setErreur(""); }}>
            <span className="pf-ligne-icon"><Lock size={17} /></span>
            <span className="pf-ligne-text">
              <strong>Modifier mon mot de passe</strong>
              <em>Recommandé tous les six mois</em>
            </span>
          </button>
        ) : (
          <div className="pf-form">
            <Champ label="Nouveau mot de passe" id="pw1" Icon={Lock} type="password"
              value={pw.nouveau} onChange={(v) => setPw((p) => ({ ...p, nouveau: v }))}
              aide="Huit caractères minimum." />

            <Champ label="Confirmer le mot de passe" id="pw2" Icon={Lock} type="password"
              value={pw.confirmer} onChange={(v) => setPw((p) => ({ ...p, confirmer: v }))} />

            {erreur && (
              <div className="pf-erreur">
                <AlertCircle size={16} /> {erreur}
              </div>
            )}

            <div className="pf-actions">
              <button
                className="pf-btn pf-btn-ghost"
                onClick={() => { setPwOuvert(false); setPw({ nouveau: "", confirmer: "" }); setErreur(""); }}
                disabled={enCours === "pw"}
              >
                Annuler
              </button>
              <button
                className="pf-btn pf-btn-primary"
                onClick={changerMotDePasse}
                disabled={enCours === "pw"}
              >
                {enCours === "pw"
                  ? <><Loader2 size={16} className="pf-spin" /> Modification…</>
                  : "Valider"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---- Déconnexion ---- */}
      <button className="pf-logout" onClick={() => setDeconnexion(true)}>
        <LogOut size={17} /> Se déconnecter
      </button>

      {deconnexion && (
        <div className="pf-overlay" onClick={() => setDeconnexion(false)}>
          <div className="pf-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="pf-modal-titre">Se déconnecter ?</h2>
            <p className="pf-modal-texte">
              Vous devrez saisir à nouveau vos identifiants lors de votre
              prochaine visite.
            </p>
            <div className="pf-actions">
              <button className="pf-btn pf-btn-ghost" onClick={() => setDeconnexion(false)}>
                Annuler
              </button>
              <button className="pf-btn pf-btn-danger" onClick={onSignOut}>
                <LogOut size={16} /> Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Sous-composants ---------------- */

function Champ({ label, id, value, onChange, Icon, type = "text", aide }) {
  return (
    <div className="pf-champ">
      <label htmlFor={id} className="pf-label">{label}</label>
      <div className="pf-input-wrap">
        {Icon && <Icon size={16} className="pf-input-icon" />}
        <input
          id={id} type={type} value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pf-input"
        />
      </div>
      {aide && <span className="pf-aide">{aide}</span>}
    </div>
  );
}

function Info({ Icon, label, valeur, alerte }) {
  return (
    <div className="pf-info">
      <span className="pf-info-icon" style={alerte ? { background: "#FEE2E2", color: C.danger } : {}}>
        <Icon size={16} />
      </span>
      <div>
        <dt>{label}</dt>
        <dd style={alerte ? { color: C.danger } : {}}>{valeur}</dd>
      </div>
    </div>
  );
}

const CSS = `
.pf-wrap{
  max-width:600px; margin:0 auto; padding:${S.lg}px ${S.lg}px ${S.xxxl}px;
  display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
.pf-back{
  display:flex; align-items:center; gap:7px; align-self:flex-start;
  background:none; border:none; padding:0; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; color:${C.primary};
}
.pf-back:hover{ text-decoration:underline; }

/* ---- Identité ---- */
.pf-identite{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xxl}px; padding:${S.xxl}px ${S.lg}px ${S.xl}px;
  box-shadow:${SHADOW.xs};
}
.pf-photo{
  width:96px; height:96px; border-radius:50%; object-fit:cover;
  border:3px solid ${C.surface}; box-shadow:${SHADOW.md};
  background:${PALETTE.grey200};
}
.pf-photo-init{
  display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg, ${PALETTE.blue800}, ${PALETTE.blue600});
  color:#fff; font-size:34px; font-weight:700; letter-spacing:-.02em;
}
.pf-nom{ font-size:22px; font-weight:700; letter-spacing:-.02em; margin:${S.md}px 0 0; }
.pf-poste{ font-size:14.5px; color:${C.textSubtle}; margin:3px 0 ${S.md}px; }
.pf-chip{
  display:inline-flex; align-items:center; gap:6px;
  padding:6px 14px; border-radius:${R.pill}px;
  font-size:13px; font-weight:600;
}
.pf-matricule{
  font-family:'JetBrains Mono',monospace; font-size:12px;
  color:${C.textSubtle}; letter-spacing:.06em; margin-top:${S.md}px;
}

/* ---- Messages ---- */
.pf-succes, .pf-erreur{
  display:flex; align-items:center; gap:9px;
  border-radius:${R.md}px; padding:12px 15px; font-size:13.5px;
  animation:pfIn .2s ease;
}
.pf-succes{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.pf-erreur{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }

/* ---- Blocs ---- */
.pf-bloc{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.pf-bloc-head{
  display:flex; align-items:center; justify-content:space-between;
  gap:${S.md}px; margin-bottom:${S.lg}px;
}
.pf-bloc-titre{
  display:flex; align-items:center; gap:8px;
  font-size:16px; font-weight:600; margin:0; letter-spacing:-.01em;
}
.pf-lien{
  display:flex; align-items:center; gap:6px;
  background:none; border:none; padding:0; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; color:${C.primary};
}
.pf-lien:hover{ text-decoration:underline; }

/* ---- Informations ---- */
.pf-infos{ display:grid; gap:${S.lg}px; margin:0; padding:0; grid-template-columns:1fr; }
@media (min-width:480px){ .pf-infos{ grid-template-columns:1fr 1fr; } }
.pf-info{ display:flex; align-items:flex-start; gap:${S.md}px; }
.pf-info-icon{
  width:36px; height:36px; border-radius:${R.sm}px; flex-shrink:0;
  background:${PALETTE.blue50}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.pf-info dt{ font-size:12px; color:${C.textSubtle}; }
.pf-info dd{ font-size:14.5px; font-weight:600; margin:2px 0 0; word-break:break-word; }

/* ---- Formulaire ---- */
.pf-form{ display:flex; flex-direction:column; gap:${S.lg}px; }
.pf-champ{ display:flex; flex-direction:column; gap:7px; }
.pf-label{ font-size:13.5px; font-weight:600; color:${C.textMuted}; }
.pf-input-wrap{
  position:relative; display:flex; align-items:center;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.pf-input-wrap:focus-within{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.pf-input-icon{ position:absolute; left:14px; color:${C.textSubtle}; pointer-events:none; }
.pf-input{
  width:100%; box-sizing:border-box; padding:13px 15px 13px 42px;
  border:none; background:transparent; outline:none;
  font-family:inherit; font-size:15px; color:${C.text};
}
.pf-aide{ font-size:12.5px; color:${C.textSubtle}; line-height:1.5; }

/* ---- Ligne cliquable ---- */
.pf-ligne-btn{
  display:flex; align-items:center; gap:${S.md}px; width:100%;
  background:${C.bg}; border:1px solid transparent;
  border-radius:${R.md}px; padding:${S.md}px ${S.lg}px;
  cursor:pointer; font-family:inherit; text-align:left;
  transition:border-color .16s ease;
}
.pf-ligne-btn:hover{ border-color:${C.primary}44; }
.pf-ligne-icon{
  width:38px; height:38px; border-radius:${R.sm}px; flex-shrink:0;
  background:${C.surface}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.pf-ligne-text{ display:flex; flex-direction:column; gap:2px; }
.pf-ligne-text strong{ font-size:14.5px; font-weight:600; }
.pf-ligne-text em{ font-style:normal; font-size:12.5px; color:${C.textSubtle}; }

/* ---- Boutons ---- */
.pf-actions{ display:flex; gap:${S.md}px; }
.pf-btn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.pf-btn:disabled{ opacity:.6; cursor:not-allowed; }
.pf-btn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.pf-btn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.pf-btn-danger{ flex:2; background:${C.danger}; color:#fff; }
.pf-btn-danger:hover{ background:#B91C1C; }
.pf-btn-ghost{
  flex:1; background:${C.surface}; color:${C.textMuted};
  border:1.5px solid ${C.border};
}
.pf-btn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

.pf-logout{
  display:flex; align-items:center; justify-content:center; gap:9px;
  width:100%; background:${C.surface}; color:${C.danger};
  border:1.5px solid ${C.danger}44; border-radius:${R.md}px;
  padding:15px 0; cursor:pointer;
  font-family:inherit; font-size:15px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.pf-logout:hover{ background:#FEE2E2; border-color:${C.danger}; }

/* ---- Modale ---- */
.pf-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; animation:pfFade .18s ease;
}
.pf-modal{
  width:100%; max-width:400px; background:${C.surface};
  border-radius:${R.xxl}px; padding:${S.xl}px;
  box-shadow:${SHADOW.lg}; animation:pfUp .22s cubic-bezier(.4,0,.2,1);
}
.pf-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0 0 8px; }
.pf-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:0 0 ${S.xl}px; }

/* ---- Divers ---- */
.pf-spin{ animation:pfSpin 1s linear infinite; }
@keyframes pfSpin{ to{ transform:rotate(360deg); } }
@keyframes pfFade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes pfUp{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
@keyframes pfIn{ from{ opacity:0; transform:translateY(-4px); } to{ opacity:1; transform:none; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;