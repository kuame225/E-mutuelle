import React, { useState } from "react";
import {
  ArrowRight, ArrowLeft, ShieldCheck,
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
  const [identifiant, setIdentifiant] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const { signInWithIdentifiant } = useAuth();

  const sigle = params.nom_mutuelle;
  const denomination = params.adresse;
  const logo = params.logo_url || LOGO_DEFAUT;
  // Capitalisé à la main plutôt que de supposer le comportement exact
  // d'une éventuelle variante déjà majusculée du système de vocabulaire —
  // mot("organisation_la") est le seul usage déjà confirmé ce soir
  // (WelcomeScreen.jsx), donc le seul sur lequel je m'appuie ici.
  const organisationLa = mot("organisation_la");
  const organisationLaMaj = organisationLa.charAt(0).toUpperCase() + organisationLa.slice(1);

  // "Mot de passe oublié" n'a de sens que pour une identification par
  // e-mail — resetPasswordForEmail n'a aucun équivalent téléphone ici.
  const ressembleAUnEmail = identifiant.includes("@");

  const reset = () => { setError(""); setNotice(""); };

  async function handleLogin(e) {
    e.preventDefault();
    reset(); setLoading(true);
    const { error } = await signInWithIdentifiant(identifiant, password);
    setLoading(false);
    if (error) setError(traduireErreur(error.message));
  }

  async function handleForgotPassword() {
    if (!identifiant.trim()) { setError("Saisissez d'abord votre adresse e-mail."); return; }
    reset(); setLoadingLink(true);

    // Aucun redirectTo précisé : comme pour les autres appels, Supabase
    // utilise la « Site URL » configurée dans son tableau de bord plutôt
    // que l'adresse locale du poste depuis lequel la demande est faite.
    const { error } = await supabase.auth.resetPasswordForEmail(identifiant.trim());

    setLoadingLink(false);
    if (error) setError(traduireErreur(error.message));
    else setNotice("E-mail de réinitialisation envoyé. Consultez votre boîte e-mail.");
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

  return (
    <div className="auth-shell">
      <style>{CSS}</style>

      {/* ---------- Panneau de marque — masqué sur téléphone ---------- */}
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

          <IllustrationTableauBord />
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

          <header className="card-header">
            <h2 className="card-title">Connexion</h2>
            <p className="card-subtitle">Accédez à votre espace mutualiste</p>
          </header>

          <form onSubmit={handleLogin} className="form">
            <Field label="E-mail ou téléphone" htmlFor="identifiant">
              <input
                id="identifiant" type="text" required autoComplete="username"
                value={identifiant} onChange={(e) => setIdentifiant(e.target.value)}
                placeholder="Entrez votre email ou numéro de téléphone" className="input"
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

            {ressembleAUnEmail && (
              <button
                type="button" className="lien-mdp-oublie"
                onClick={handleForgotPassword} disabled={loadingLink}
              >
                {loadingLink
                  ? <><Loader2 size={13} className="spin" /> Envoi…</>
                  : "Mot de passe oublié ?"}
              </button>
            )}

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

// Illustration décorative — deux aperçus de tableau de bord qui
// s'enchaînent en boucle, uniquement pour donner vie au panneau de
// marque sur grand écran. Chiffres et graphique fictifs, jamais de
// vraie donnée : purement visuel, jamais connecté à la base.
function IllustrationTableauBord() {
  return (
    <div className="illus-scene" aria-hidden="true">
      <div className="illus-laptop">
        <div className="illus-laptop-ecran">
          <div className="illus-barre-titre"><span /><span /><span /></div>

          <div className="illus-vue illus-vue-a">
            <div className="illus-titre-ecran">Tableau de bord</div>
            <div className="illus-stats">
              <div className="illus-stat">
                <span className="illus-stat-val">250</span>
                <span className="illus-stat-label">Membres</span>
              </div>
              <div className="illus-stat">
                <span className="illus-stat-val">2 450 000</span>
                <span className="illus-stat-label">FCFA</span>
              </div>
              <div className="illus-stat">
                <span className="illus-stat-val">15</span>
                <span className="illus-stat-label">Prestations</span>
              </div>
            </div>
            <div className="illus-corps">
              <div className="illus-lignes">
                <div className="illus-lignes-titre">Activités récentes</div>
                <div className="illus-ligne"><span className="illus-puce illus-puce-verte" />Paiement cotisation — Mai 2026</div>
                <div className="illus-ligne"><span className="illus-puce illus-puce-bleue" />Demande de promotion — K. Marie</div>
                <div className="illus-ligne"><span className="illus-puce illus-puce-orange" />Réunion Conseil d'administration</div>
              </div>
              <div className="illus-donut-bloc">
                <div className="illus-lignes-titre">Répartition</div>
                <svg viewBox="0 0 36 36" className="illus-donut">
                  <circle className="illus-donut-fond" cx="18" cy="18" r="15.5" />
                  <circle className="illus-donut-remplissage" cx="18" cy="18" r="15.5" />
                </svg>
              </div>
            </div>
          </div>

          <div className="illus-vue illus-vue-b">
            <div className="illus-titre-ecran">Évolution des cotisations</div>
            <div className="illus-stats">
              <div className="illus-stat">
                <span className="illus-stat-val">98%</span>
                <span className="illus-stat-label">À jour</span>
              </div>
              <div className="illus-stat">
                <span className="illus-stat-val">12</span>
                <span className="illus-stat-label">Formations</span>
              </div>
            </div>
            <div className="illus-barres-bloc">
              <div className="illus-barres">
                <div className="illus-barre-1" />
                <div className="illus-barre-2" />
                <div className="illus-barre-3" />
                <div className="illus-barre-4" />
              </div>
              <div className="illus-barres-legende">
                <span>2024</span><span>2025</span><span>2026</span>
              </div>
            </div>
          </div>
        </div>
        <div className="illus-laptop-base" />
      </div>

      <div className="illus-phone">
        <div className="illus-phone-statut">
          <span>9:41</span>
          <span className="illus-phone-statut-icones">
            <span className="illus-phone-signal"><span /><span /><span /></span>
            <span className="illus-phone-batterie" />
          </span>
        </div>
        <div className="illus-phone-ecran">
          <div className="illus-phone-salut">Bonjour Koffi 👋</div>
          <div className="illus-phone-notif">
            <div className="illus-phone-notif-icone">✓</div>
            <div>
              <div className="illus-phone-notif-titre">Demande validée</div>
              <div className="illus-phone-notif-texte">Votre aide sociale a été acceptée</div>
            </div>
          </div>
          <div className="illus-phone-carte">
            <div className="illus-phone-val">250</div>
            <div className="illus-phone-label">membres actifs</div>
          </div>
          <div className="illus-phone-bouton">Voir mes notifications</div>
          <div className="illus-phone-nav" />
        </div>
      </div>
    </div>
  );
}

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
/* Sur téléphone : masqué, formulaire seul visible — demande explicite
   pour l'écran de connexion, contrairement au reste du parcours. Le
   panneau ne réapparaît qu'à partir de 960px. */
.auth-brand{
  display:none; position:relative; overflow:hidden;
  background:linear-gradient(150deg, ${PALETTE.blue900} 0%, ${PALETTE.blue800} 55%, ${PALETTE.blue600} 130%);
  color:#fff; padding:${S.xxxl}px;
}
@media (min-width:960px){ .auth-brand{ display:flex; flex-direction:column; justify-content:center; align-items:center; } }
.brand-glow{ position:absolute; border-radius:50%; filter:blur(4px); }
.brand-glow-1{ width:280px; height:280px; right:-90px; top:-90px; background:rgba(255,255,255,.06); }
.brand-glow-2{ width:200px; height:200px; left:-70px; bottom:-60px; background:rgba(255,255,255,.05); }
@media (min-width:960px){
  .brand-glow-1{ width:420px; height:420px; right:-140px; top:-120px; }
  .brand-glow-2{ width:300px; height:300px; left:-100px; bottom:-90px; }
}
.brand-content{ position:relative; z-index:1; max-width:600px; margin:0 auto; width:100%; }
.brand-mark{ display:flex; align-items:center; gap:${S.md}px; margin-bottom:${S.xxxl}px; }
.brand-logo-img{
  width:52px; height:52px; object-fit:contain; flex-shrink:0;
  background:#fff; border-radius:${R.md}px; padding:6px;
  box-shadow:0 2px 10px rgba(0,0,0,.12);
}
.brand-name{
  font-size:20px; font-weight:700; letter-spacing:.02em; line-height:1.1;
  overflow-wrap:anywhere;
}
.brand-tagline{ font-size:13px; opacity:.75; max-width:26ch; line-height:1.4; }
.brand-title{ font-size:40px; font-weight:700; line-height:1.2; letter-spacing:-.02em; margin:0 0 ${S.lg}px; }
.brand-subtitle{ font-size:17px; line-height:1.55; opacity:.85; margin:0 0 ${S.xxxl}px; max-width:38ch; }
.brand-features{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:${S.lg}px; }
.brand-features li{ display:flex; align-items:center; gap:${S.md}px; font-size:15px; opacity:.92; }
.feature-icon{
  width:38px; height:38px; border-radius:${R.sm}px; flex-shrink:0;
  background:rgba(255,255,255,.12); display:flex; align-items:center; justify-content:center;
}

/* ---- Illustration animée (décorative, aucune vraie donnée) ---- */
/* Écrans blancs, comme de vraies captures — coque sombre pour se
   détacher du panneau bleu derrière. Les deux appareils sont ancrés au
   même bas (bottom:0) plutôt que l'un depuis le haut et l'autre depuis
   le bas : sans ça, garantir leur alignement exige un calcul de pixels
   fragile, jamais vérifiable sans pouvoir observer le rendu réel. */
.illus-scene{
  position:relative; margin-top:${S.xxxl}px; height:300px;
  display:none;
}
@media (min-width:960px){ .illus-scene{ display:block; } }

.illus-laptop{
  position:absolute; left:0; bottom:0; width:420px;
  filter:drop-shadow(0 22px 40px rgba(0,0,0,.45));
}
.illus-laptop-ecran{
  position:relative; height:250px; background:#fff;
  border:3px solid #12172A; border-bottom:2px solid #2A3352;
  border-radius:10px 10px 0 0;
  overflow:hidden; padding:16px 18px;
}
.illus-laptop-base{
  position:relative; height:20px; margin:0 -16px;
  background:linear-gradient(180deg, #1E2648, #10142A);
  border:3px solid #12172A; border-top:none;
  border-radius:6px 6px 18px 18px;
}
.illus-laptop-base::after{
  content:""; position:absolute; left:50%; top:5px; transform:translateX(-50%);
  width:60px; height:3px; background:#3A4368; border-radius:2px;
}
.illus-barre-titre{ display:flex; gap:5px; margin-bottom:14px; }
.illus-barre-titre span{
  width:8px; height:8px; border-radius:50%; background:${PALETTE.grey200};
}

.illus-vue{ position:absolute; inset:42px 18px 16px; }
.illus-vue-a{ animation:illusVueA 10s ease-in-out infinite; }
.illus-vue-b{ animation:illusVueB 10s ease-in-out infinite; }
@keyframes illusVueA{
  0%,40%{ opacity:1; } 50%,90%{ opacity:0; } 100%{ opacity:1; }
}
@keyframes illusVueB{
  0%,40%{ opacity:0; } 50%,90%{ opacity:1; } 100%{ opacity:0; }
}

.illus-titre-ecran{ font-size:15px; font-weight:700; margin-bottom:14px; color:${C.text}; }
.illus-stats{ display:flex; gap:26px; margin-bottom:16px; }
.illus-stat{ display:flex; flex-direction:column; }
.illus-stat-val{ font-size:19px; font-weight:700; color:${C.primary}; }
.illus-stat-label{ font-size:11px; color:${C.textSubtle}; }

.illus-corps{ display:flex; gap:20px; align-items:flex-start; }
.illus-lignes-titre{ font-size:11px; font-weight:700; color:${C.text}; margin-bottom:9px; }
.illus-lignes{ flex:1.3; min-width:0; }
.illus-ligne{
  display:flex; align-items:center; gap:7px; font-size:10.5px; color:${C.textMuted};
  padding:5px 0; border-bottom:1px solid ${C.border};
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.illus-ligne:last-child{ border-bottom:none; }
.illus-puce{ width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.illus-puce-verte{ background:${C.success}; }
.illus-puce-bleue{ background:${C.primary}; }
.illus-puce-orange{ background:${C.warning}; }

.illus-donut-bloc{ flex:1; display:flex; flex-direction:column; align-items:center; }
.illus-donut{ width:78px; height:78px; }
.illus-donut-fond{ fill:none; stroke:${PALETTE.grey200}; stroke-width:3; }
.illus-donut-remplissage{
  fill:none; stroke:${C.primary}; stroke-width:3; stroke-linecap:round;
  stroke-dasharray:97.4; stroke-dashoffset:97.4;
  transform:rotate(-90deg); transform-origin:50% 50%;
  animation:illusDonut 3s ease-in-out infinite;
}
@keyframes illusDonut{
  0%{ stroke-dashoffset:97.4; } 60%{ stroke-dashoffset:34; } 100%{ stroke-dashoffset:34; }
}

.illus-barres-bloc{ display:flex; flex-direction:column; gap:8px; }
.illus-barres{ display:flex; align-items:flex-end; gap:10px; height:80px; }
.illus-barres > div{ width:26px; background:${C.primary}; border-radius:3px 3px 0 0; opacity:.85; }
.illus-barre-4{ opacity:1; }
.illus-barre-1{ animation:illusB1 3s ease-in-out infinite; }
.illus-barre-2{ animation:illusB2 3s ease-in-out infinite .1s; }
.illus-barre-3{ animation:illusB3 3s ease-in-out infinite .2s; }
.illus-barre-4{ animation:illusB4 3s ease-in-out infinite .3s; }
@keyframes illusB1{ 0%{ height:0; } 60%,100%{ height:40%; } }
@keyframes illusB2{ 0%{ height:0; } 60%,100%{ height:75%; } }
@keyframes illusB3{ 0%{ height:0; } 60%,100%{ height:55%; } }
@keyframes illusB4{ 0%{ height:0; } 60%,100%{ height:100%; } }
.illus-barres-legende{ display:flex; gap:36px; font-size:9.5px; color:${C.textSubtle}; }

.illus-phone{
  position:absolute; left:452px; bottom:0; width:118px; height:242px;
  background:#fff; border:3px solid #12172A;
  border-radius:20px; padding:8px 9px 14px;
  box-shadow:0 22px 44px -10px rgba(0,0,0,.5);
  display:flex; flex-direction:column;
}
.illus-phone-statut{
  display:flex; align-items:center; justify-content:space-between;
  font-size:8px; font-weight:700; color:${C.text}; margin-bottom:8px; flex-shrink:0;
}
.illus-phone-statut-icones{ display:flex; align-items:center; gap:3px; }
.illus-phone-signal{ display:flex; align-items:flex-end; gap:1.5px; height:7px; }
.illus-phone-signal span{ width:2px; background:${C.text}; border-radius:1px; }
.illus-phone-signal span:nth-child(1){ height:3px; }
.illus-phone-signal span:nth-child(2){ height:5px; }
.illus-phone-signal span:nth-child(3){ height:7px; }
.illus-phone-batterie{
  width:15px; height:7px; border:1px solid ${C.text}; border-radius:2px;
  position:relative; margin-left:2px;
}
.illus-phone-batterie::after{
  content:""; position:absolute; top:1px; left:1px; bottom:1px; width:70%;
  background:${C.text}; border-radius:1px;
}
.illus-phone-ecran{ display:flex; flex-direction:column; gap:8px; flex:1; min-height:0; }
.illus-phone-nav{
  margin-top:auto; width:42px; height:3px; border-radius:2px;
  background:${PALETTE.grey300}; align-self:center;
}
.illus-phone-salut{ font-size:10.5px; font-weight:700; color:${C.text}; }
.illus-phone-notif{
  display:flex; align-items:flex-start; gap:6px;
  background:${PALETTE.blue50}; border-radius:8px; padding:7px 8px;
}
.illus-phone-notif-icone{
  width:16px; height:16px; border-radius:50%; flex-shrink:0;
  background:${C.success}; color:#fff; font-size:9px; font-weight:700;
  display:flex; align-items:center; justify-content:center;
}
.illus-phone-notif-titre{ font-size:8.5px; font-weight:700; color:${C.text}; }
.illus-phone-notif-texte{ font-size:7px; color:${C.textSubtle}; margin-top:1px; line-height:1.3; }
.illus-phone-carte{
  background:${C.bg}; border:1px solid ${C.border}; border-radius:8px; padding:8px;
  display:flex; flex-direction:column; align-items:center; gap:2px;
}
.illus-phone-val{ font-size:18px; font-weight:700; color:${C.primary}; }
.illus-phone-label{ font-size:8px; color:${C.textSubtle}; }
.illus-phone-bouton{
  margin-top:auto; background:${C.primary}; color:#fff;
  border-radius:7px; padding:9px 0; text-align:center;
  font-size:9.5px; font-weight:700;
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

.card-header{ margin-bottom:${S.xl}px; }
.card-title{ font-size:28px; font-weight:700; letter-spacing:-.02em; margin:0 0 6px; }
.card-subtitle{ font-size:15px; color:${C.textSubtle}; margin:0; }

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