import React, { useState } from "react";
import {
  Mail, Smartphone, ArrowRight, ArrowLeft, ShieldCheck,
  HandHeart, Users, Loader2, AlertCircle, CheckCircle2,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { supabase } from "./supabaseClient";
import { useParametrage, LOGO_DEFAUT } from "./useParametrage";
import { useVocabulaire } from "./useVocabulaire";
import { C, S, R, SHADOW, PALETTE } from "./theme";

export default function LoginScreen({ onAdhesion, onBack }) {
  const { params } = useParametrage();
  const { mot } = useVocabulaire();
  const [mode, setMode] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const { signInWithEmail, signInWithPhone, verifyPhoneOtp } = useAuth();

  const sigle = params.nom_mutuelle;
  const denomination = params.adresse;
  const logo = params.logo_url || LOGO_DEFAUT;
  // Capitalisé à la main plutôt que de supposer le comportement exact
  // d'une éventuelle variante déjà majusculée du système de vocabulaire —
  // mot("organisation_la") est le seul usage déjà confirmé ce soir
  // (WelcomeScreen.jsx), donc le seul sur lequel je m'appuie ici.
  const organisationLa = mot("organisation_la");
  const organisationLaMaj = organisationLa.charAt(0).toUpperCase() + organisationLa.slice(1);

  const reset = () => { setError(""); setNotice(""); };

  async function handleEmailLogin(e) {
    e.preventDefault();
    reset(); setLoading(true);
    const { error } = await signInWithEmail(email, password);
    setLoading(false);
    if (error) setError(traduireErreur(error.message));
  }

  async function handleForgotPassword() {
    if (!email) { setError("Saisissez d'abord votre adresse e-mail."); return; }
    reset(); setLoadingLink(true);

    // Aucun redirectTo précisé : comme pour les autres appels, Supabase
    // utilise la « Site URL » configurée dans son tableau de bord plutôt
    // que l'adresse locale du poste depuis lequel la demande est faite.
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    setLoadingLink(false);
    if (error) setError(traduireErreur(error.message));
    else setNotice("E-mail de réinitialisation envoyé. Consultez votre boîte e-mail.");
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    reset(); setLoading(true);
    const { error } = await signInWithPhone(phone);
    setLoading(false);
    if (error) setError(traduireErreur(error.message));
    else setOtpSent(true);
  }

  async function handleGoogleLogin() {
    reset(); setLoadingGoogle(true);
    // Aucun redirectTo précisé : comme pour le lien de connexion,
    // Supabase utilise la « Site URL » configurée dans son tableau de
    // bord — éviter de renvoyer l'adresse locale du poste de développement.
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
    setLoadingGoogle(false);
    if (error) setError(traduireErreur(error.message));
    // Sans erreur, le navigateur est redirigé vers Google — rien d'autre
    // à faire ici, le retour se fera sur une nouvelle page.
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    reset(); setLoading(true);
    const { error } = await verifyPhoneOtp(phone, otp);
    setLoading(false);
    if (error) setError(traduireErreur(error.message));
  }

  return (
    <div className="auth-shell">
      <style>{CSS}</style>

      {/* ---------- Panneau de marque ---------- */}
      <aside className="auth-brand">
        <div className="brand-glow brand-glow-1" />
        <div className="brand-glow brand-glow-2" />

        <div className="brand-content">
          <div className="brand-mark">
            <img
              src={logo}
              alt={`Logo ${sigle}`}
              className="brand-logo-img"
              onError={(e) => { e.currentTarget.src = LOGO_DEFAUT; }}
            />
            <div>
              <div className="brand-name">{sigle}</div>
              {denomination && <div className="brand-tagline">{denomination}</div>}
            </div>
          </div>

          <div className="brand-hero">
            <h1 className="brand-title">
              Plus simple,<br />plus proche,<br />plus solidaire.
            </h1>
            <p className="brand-subtitle">
              {organisationLaMaj} vous accompagne, vous et votre famille,
              vers un avenir plus sûr.
            </p>
          </div>

          <ul className="brand-features">
            {[
              { Icon: ShieldCheck, text: "Cotisations suivies en toute transparence" },
              { Icon: HandHeart, text: "Aides sociales accessibles en quelques clics" },
              { Icon: Users, text: "Une entraide organisée entre membres" },
            ].map(({ Icon, text }) => (
              <li key={text}>
                <span className="feature-icon"><Icon size={18} /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ---------- Formulaire ---------- */}
      <main className="auth-main">
        <div className="auth-card">

          {onBack && (
            <button type="button" className="back-top" onClick={onBack}>
              <ArrowLeft size={15} /> Retour
            </button>
          )}

          <div className="mobile-mark">
            <img
              src={logo}
              alt={`Logo ${sigle}`}
              className="brand-logo-img brand-logo-img-sm"
              onError={(e) => { e.currentTarget.src = LOGO_DEFAUT; }}
            />
            <div className="mobile-mark-text">{sigle}</div>
          </div>

          <header className="card-header">
            <h2 className="card-title">Connexion</h2>
            <p className="card-subtitle">Accédez à votre espace mutualiste</p>
          </header>

          <div className="segmented" role="tablist">
            <button
              role="tab"
              aria-selected={mode === "email"}
              className={`segment ${mode === "email" ? "is-active" : ""}`}
              onClick={() => { setMode("email"); reset(); }}
            >
              <Mail size={16} /> E-mail
            </button>
            <button
              role="tab"
              aria-selected={mode === "phone"}
              className={`segment ${mode === "phone" ? "is-active" : ""}`}
              onClick={() => { setMode("phone"); reset(); setOtpSent(false); }}
            >
              <Smartphone size={16} /> Téléphone
            </button>
          </div>

          {/* --- E-mail --- */}
          {mode === "email" && (
            <form onSubmit={handleEmailLogin} className="form">
              <Field label="Adresse e-mail" htmlFor="email">
                <input
                  id="email" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com" className="input"
                />
              </Field>

              <Field label="Mot de passe" htmlFor="password">
                <input
                  id="password" type="password" required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" className="input"
                />
              </Field>

              <Alerts error={error} notice={notice} />

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading
                  ? <><Loader2 size={18} className="spin" /> Connexion…</>
                  : <>Se connecter <ArrowRight size={18} /></>}
              </button>

              <button
                type="button" className="lien-mdp-oublie"
                onClick={handleForgotPassword} disabled={loadingLink}
              >
                {loadingLink
                  ? <><Loader2 size={13} className="spin" /> Envoi…</>
                  : "Mot de passe oublié ?"}
              </button>

              <div className="divider"><span>ou</span></div>

              <button
                type="button" className="btn btn-google"
                onClick={handleGoogleLogin} disabled={loadingGoogle}
              >
                {loadingGoogle
                  ? <><Loader2 size={18} className="spin" /> Redirection…</>
                  : <><GoogleIcon /> Continuer avec Google</>}
              </button>
            </form>
          )}

          {/* --- Téléphone : numéro --- */}
          {mode === "phone" && !otpSent && (
            <form onSubmit={handleSendOtp} className="form">
              <Field label="Numéro de téléphone" htmlFor="phone">
                <input
                  id="phone" type="tel" required autoComplete="tel"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+225 07 12 34 56 78" className="input"
                />
              </Field>
              <p className="hint">Un code à 6 chiffres vous sera envoyé par SMS.</p>

              <Alerts error={error} notice={notice} />

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading
                  ? <><Loader2 size={18} className="spin" /> Envoi…</>
                  : <>Recevoir le code <ArrowRight size={18} /></>}
              </button>
            </form>
          )}

          {/* --- Téléphone : code --- */}
          {mode === "phone" && otpSent && (
            <form onSubmit={handleVerifyOtp} className="form">
              <button
                type="button" className="back-link"
                onClick={() => { setOtpSent(false); reset(); }}
              >
                <ArrowLeft size={15} /> Modifier le numéro
              </button>

              <p className="hint hint-strong">
                Code envoyé au <strong>{phone}</strong>
              </p>

              <Field label="Code de vérification" htmlFor="otp">
                <input
                  id="otp" type="text" inputMode="numeric" required
                  maxLength={6} value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000" className="input input-otp"
                />
              </Field>

              <Alerts error={error} notice={notice} />

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading
                  ? <><Loader2 size={18} className="spin" /> Vérification…</>
                  : <>Valider le code <ArrowRight size={18} /></>}
              </button>
            </form>
          )}

          <footer className="card-footer">
            Pas encore {mot("membre_singulier").toLowerCase()} ?{" "}
            <button
              type="button" className="link"
              onClick={() => onAdhesion && onAdhesion()}
            >
              {mot("adherer")}
            </button>
          </footer>
        </div>

        <p className="legal">
          Plateforme sécurisée — vos données restent confidentielles.
        </p>
      </main>
    </div>
  );
}

/* ---------------- Sous-composants ---------------- */

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.71v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.61z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 009 18z"/>
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.27-1.7V4.97H.98A9 9 0 000 9c0 1.45.35 2.83.98 4.03l2.97-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
    </svg>
  );
}

function Field({ label, htmlFor, children }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
    </div>
  );
}

function Alerts({ error, notice }) {
  if (!error && !notice) return null;
  return (
    <div className={`alert ${error ? "alert-error" : "alert-success"}`}>
      {error ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
      <span>{error || notice}</span>
    </div>
  );
}

function traduireErreur(message = "") {
  if (message.includes("Invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (message.includes("Invalid phone")) return "Numéro invalide. Ajoutez l'indicatif pays (+225…).";
  if (message.includes("Token has expired")) return "Ce code a expiré. Demandez-en un nouveau.";
  if (message.includes("Invalid token")) return "Code incorrect. Vérifiez et réessayez.";
  if (message.includes("rate limit")) return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (message.includes("Email not confirmed")) return "Adresse e-mail non confirmée.";
  if (message.includes("Signups not allowed") || message.includes("User not found"))
    return "Aucun compte n'est associé à cette adresse. Rapprochez-vous du Bureau.";
  return message;
}

/* ---------------- Styles ---------------- */

const CSS = `
.auth-shell{
  min-height:100vh; display:grid; grid-template-columns:1fr;
  background:${C.bg}; color:${C.text};
  font-family:'Inter','Poppins',system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
}
@media (min-width:960px){ .auth-shell{ grid-template-columns:1.05fr 1fr; } }

/* ---- Marque ---- */
.auth-brand{
  display:none; position:relative; overflow:hidden;
  background:linear-gradient(150deg, ${PALETTE.blue900} 0%, ${PALETTE.blue800} 55%, ${PALETTE.blue600} 130%);
  color:#fff; padding:${S.xxxl}px;
}
@media (min-width:960px){ .auth-brand{ display:flex; align-items:center; } }
.brand-glow{ position:absolute; border-radius:50%; filter:blur(4px); }
.brand-glow-1{ width:420px; height:420px; right:-140px; top:-120px; background:rgba(255,255,255,.06); }
.brand-glow-2{ width:300px; height:300px; left:-100px; bottom:-90px; background:rgba(255,255,255,.05); }
.brand-content{ position:relative; z-index:1; max-width:440px; margin:0 auto; width:100%; }
.brand-mark{ display:flex; align-items:center; gap:${S.md}px; margin-bottom:${S.xxxl}px; }
.brand-logo-img{
  width:52px; height:52px; object-fit:contain; flex-shrink:0;
  background:#fff; border-radius:${R.md}px; padding:6px;
  box-shadow:0 2px 10px rgba(0,0,0,.12);
}
.brand-logo-img-sm{ width:42px; height:42px; padding:4px; box-shadow:none; }
.brand-name{
  font-size:20px; font-weight:700; letter-spacing:.02em; line-height:1.1;
  overflow-wrap:anywhere;
}
.brand-tagline{ font-size:13px; opacity:.75; max-width:26ch; line-height:1.4; }
.brand-title{ font-size:40px; font-weight:700; line-height:1.15; letter-spacing:-.03em; margin:0 0 ${S.lg}px; }
.brand-subtitle{ font-size:17px; line-height:1.6; opacity:.82; margin:0 0 ${S.xxxl}px; max-width:38ch; }
.brand-features{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:${S.lg}px; }
.brand-features li{ display:flex; align-items:center; gap:${S.md}px; font-size:15px; opacity:.92; }
.feature-icon{
  width:38px; height:38px; border-radius:${R.sm}px; flex-shrink:0;
  background:rgba(255,255,255,.12); display:flex; align-items:center; justify-content:center;
}

/* ---- Formulaire ---- */
.auth-main{
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:${S.xl}px; gap:${S.lg}px;
}
.auth-card{
  width:100%; max-width:440px; background:${C.surface};
  border:1px solid ${C.border}; border-radius:${R.xxl}px;
  box-shadow:${SHADOW.md}; padding:${S.xxl}px;
}
@media (min-width:600px){ .auth-card{ padding:40px; } }

.back-top{
  display:flex; align-items:center; gap:6px;
  background:none; border:none; padding:0; margin-bottom:${S.lg}px;
  cursor:pointer; font-family:inherit; font-size:14px;
  font-weight:600; color:${C.primary};
}
.back-top:hover{ text-decoration:underline; }

.mobile-mark{ display:flex; align-items:center; gap:${S.sm}px; margin-bottom:${S.xl}px; }
@media (min-width:960px){ .mobile-mark{ display:none; } }
.mobile-mark-text{
  font-size:17px; font-weight:700; color:${C.primary}; letter-spacing:.02em;
  overflow-wrap:anywhere;
}

.card-header{ margin-bottom:${S.xl}px; }
.card-title{ font-size:28px; font-weight:700; letter-spacing:-.02em; margin:0 0 6px; }
.card-subtitle{ font-size:15px; color:${C.textSubtle}; margin:0; }

.segmented{
  display:grid; grid-template-columns:1fr 1fr; gap:4px;
  background:${C.bg}; border:1px solid ${C.border};
  border-radius:${R.md}px; padding:4px; margin-bottom:${S.xl}px;
}
.segment{
  display:flex; align-items:center; justify-content:center; gap:7px;
  border:none; background:transparent; cursor:pointer;
  padding:11px 0; border-radius:${R.sm}px;
  font-family:inherit; font-size:14px; font-weight:600; color:${C.textSubtle};
  transition:all .18s ease;
}
.segment:hover{ color:${C.primary}; }
.segment.is-active{ background:${C.surface}; color:${C.primary}; box-shadow:${SHADOW.xs}; }

.form{ display:flex; flex-direction:column; gap:${S.lg}px; }
.field{ display:flex; flex-direction:column; gap:7px; }
.label{ font-size:14px; font-weight:600; color:${C.textMuted}; }
.input{
  width:100%; box-sizing:border-box; padding:14px 16px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; color:${C.text};
  font-family:inherit; font-size:16px; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.input::placeholder{ color:${PALETTE.grey300}; }
.input:hover{ border-color:${PALETTE.grey300}; }
.input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.input-otp{
  text-align:center; font-size:24px; font-weight:700;
  letter-spacing:.4em; padding-left:.4em;
}
.hint{ font-size:14px; color:${C.textSubtle}; margin:-6px 0 0; }
.hint-strong{ margin:0; }

.btn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  width:100%; padding:15px 20px; border-radius:${R.md}px;
  font-family:inherit; font-size:16px; font-weight:600;
  cursor:pointer; border:none;
  transition:transform .12s ease, box-shadow .18s ease, background .18s ease;
}
.btn:disabled{ opacity:.65; cursor:not-allowed; }
.btn:not(:disabled):active{ transform:translateY(1px); }
.btn-primary{ background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.btn-primary:not(:disabled):hover{ background:${C.primaryDark}; box-shadow:${SHADOW.md}; }
.btn-ghost{ background:${C.surface}; color:${C.primary}; border:1.5px solid ${C.border}; }
.btn-ghost:not(:disabled):hover{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.btn-google{
  background:${C.surface}; color:${C.text}; border:1.5px solid ${C.border};
  margin-top:-4px;
}
.btn-google:not(:disabled):hover{ border-color:${PALETTE.grey300}; background:${C.bg}; }
.lien-mdp-oublie{
  background:none; border:none; color:${C.textSubtle}; font-family:inherit;
  font-size:12.5px; cursor:pointer; text-align:center; padding:2px 0 0;
  display:flex; align-items:center; justify-content:center; gap:6px;
}
.lien-mdp-oublie:not(:disabled):hover{ color:${C.primary}; text-decoration:underline; }

.divider{ display:flex; align-items:center; gap:${S.md}px; color:${C.textSubtle}; font-size:13px; }
.divider::before,.divider::after{ content:""; flex:1; height:1px; background:${C.border}; }

.alert{
  display:flex; align-items:flex-start; gap:10px;
  padding:12px 14px; border-radius:${R.md}px;
  font-size:14px; line-height:1.45; animation:slideIn .22s ease;
}
.alert-error{ background:${C.dangerSoft}; color:${C.danger}; border:1px solid ${C.danger}22; }
.alert-success{ background:${C.successSoft}; color:${C.success}; border:1px solid ${C.success}22; }

.back-link{
  display:flex; align-items:center; gap:6px; align-self:flex-start;
  background:none; border:none; padding:0; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; color:${C.primary};
}
.card-footer{
  margin-top:${S.xl}px; padding-top:${S.lg}px;
  border-top:1px solid ${C.border};
  text-align:center; font-size:14px; color:${C.textSubtle};
}
.link{
  background:none; border:none; padding:0; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; color:${C.primary};
}
.link:hover{ text-decoration:underline; }
.legal{ font-size:12px; color:${C.textSubtle}; text-align:center; margin:0; }

.spin{ animation:spin 1s linear infinite; }
@keyframes spin{ to{ transform:rotate(360deg); } }
@keyframes slideIn{ from{ opacity:0; transform:translateY(-4px); } to{ opacity:1; transform:none; } }

*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;