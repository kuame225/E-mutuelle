import React, { useState, useEffect } from "react";
import {
  LogIn, UserPlus, HandHeart, Gift, ShieldCheck, KeyRound, Smartphone, Building2,
} from "lucide-react";
import { useParametrage, LOGO_DEFAUT } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const ATOUTS = [
  {
    Icon: HandHeart,
    titre: "Pourquoi adhérer ?",
    texte: "Profitez d'aides sociales, de récompenses et d'une protection solidaire.",
  },
  {
    Icon: ShieldCheck,
    titre: "Une gestion transparente",
    texte: "Suivez vos cotisations et l'usage des fonds à tout moment.",
  },
  {
    Icon: Gift,
    titre: "Une entraide organisée",
    texte: "Chaque cotisation alimente le fonds qui soutient les membres.",
  },
];

export default function WelcomeScreen({ onLogin, onAdhesion, onActivation, onRecuperation, onCreationMutuelle }) {
  const { params } = useParametrage();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % ATOUTS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const atout = ATOUTS[slide];
  const sigle = params.nom_mutuelle;
  const denomination = params.adresse;
  const logo = params.logo_url || LOGO_DEFAUT;

  return (
    <div className="wl-shell">
      <style>{CSS}</style>

      {/* ---- Partie haute ---- */}
      <section className="wl-top">
        <img
          src={logo}
          alt={`Logo ${sigle}`}
          className="wl-logo"
          onError={(e) => { e.currentTarget.src = LOGO_DEFAUT; }}
        />
        {denomination && <div className="wl-org">{denomination}</div>}

        <h1 className="wl-title">
          Bienvenue à la<br />
          <span>{sigle}</span>
        </h1>
        <p className="wl-lead">
          Ensemble pour votre bien-être,<br />
          celui de votre famille et un avenir plus sûr.
        </p>

        <div className="wl-visual">
          <div className="wl-orb wl-orb-1" />
          <div className="wl-orb wl-orb-2" />
          <div className="wl-emblem">
            <ShieldCheck size={54} strokeWidth={1.5} />
          </div>
        </div>
      </section>

      {/* ---- Panneau bas ---- */}
      <section className="wl-panel">
        <button className="wl-btn wl-btn-primary" onClick={onLogin}>
          <LogIn size={19} /> Se connecter
        </button>

        <button className="wl-btn wl-btn-outline" onClick={onAdhesion}>
          <UserPlus size={19} /> Adhérer à la mutuelle
        </button>

        <div className="wl-liens">
          <button className="wl-btn wl-btn-texte" onClick={onActivation}>
            <KeyRound size={17} /> J'ai un code d'activation
          </button>

          <span className="wl-sep" />

          <button className="wl-btn wl-btn-texte" onClick={onRecuperation}>
            <Smartphone size={17} /> J'ai changé de téléphone
          </button>
        </div>

        {onCreationMutuelle && (
          <button className="wl-btn-creation" onClick={onCreationMutuelle}>
            <Building2 size={16} /> Représenter une autre mutuelle
          </button>
        )}

        <article className="wl-atout" key={slide}>
          <span className="wl-atout-icon"><atout.Icon size={21} /></span>
          <div>
            <div className="wl-atout-titre">{atout.titre}</div>
            <div className="wl-atout-texte">{atout.texte}</div>
          </div>
        </article>

        <div className="wl-dots">
          {ATOUTS.map((_, i) => (
            <button
              key={i}
              className={`wl-dot ${i === slide ? "is-on" : ""}`}
              onClick={() => setSlide(i)}
              aria-label={`Point ${i + 1}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

const CSS = `
.wl-shell{
  min-height:100vh; display:flex; flex-direction:column;
  background:linear-gradient(170deg, ${PALETTE.blue50} 0%, ${C.surface} 42%);
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}

/* ---- Haut ---- */
.wl-top{
  flex:1; display:flex; flex-direction:column; align-items:center;
  text-align:center; padding:${S.xxl}px ${S.xl}px ${S.lg}px;
  max-width:560px; margin:0 auto; width:100%;
}
.wl-logo{ width:96px; height:96px; object-fit:contain; }
.wl-org{
  font-size:11px; font-weight:600; color:${C.primary};
  line-height:1.45; margin-top:${S.sm}px; letter-spacing:.01em;
  max-width:38ch;
}
.wl-title{
  font-size:29px; font-weight:700; letter-spacing:-.025em;
  line-height:1.25; margin:${S.xl}px 0 0; color:${C.text};
}
.wl-title span{ color:${C.primary}; overflow-wrap:anywhere; }
.wl-lead{
  font-size:15.5px; line-height:1.65; color:${C.textMuted};
  margin:${S.md}px 0 0; max-width:34ch;
}

/* ---- Visuel ---- */
.wl-visual{
  position:relative; width:100%; max-width:300px;
  aspect-ratio:1.35; margin-top:${S.xl}px;
  display:flex; align-items:center; justify-content:center;
}
.wl-orb{ position:absolute; border-radius:50%; }
.wl-orb-1{
  width:190px; height:190px;
  background:radial-gradient(circle at 32% 28%, ${PALETTE.blue600}, ${PALETTE.blue900});
  opacity:.12;
}
.wl-orb-2{
  width:128px; height:128px; right:14%; bottom:6%;
  background:${C.warning}; opacity:.1;
}
.wl-emblem{
  position:relative; width:96px; height:96px; border-radius:28px;
  background:linear-gradient(140deg, ${PALETTE.blue800}, ${PALETTE.blue600});
  color:#fff; display:flex; align-items:center; justify-content:center;
  box-shadow:0 16px 34px rgba(13,71,161,.28);
}

/* ---- Panneau bas ---- */
.wl-panel{
  background:${C.surface};
  border-top-left-radius:32px; border-top-right-radius:32px;
  box-shadow:0 -8px 32px rgba(16,24,40,.07);
  padding:${S.xxl}px ${S.xl}px ${S.xl}px;
  display:flex; flex-direction:column; gap:${S.md}px;
  max-width:560px; width:100%; margin:0 auto;
}
@media (min-width:600px){
  .wl-panel{ border-radius:32px; margin-bottom:${S.xl}px; }
}

.wl-btn{
  display:flex; align-items:center; justify-content:center; gap:10px;
  width:100%; padding:16px 0; border-radius:${R.lg}px;
  font-family:inherit; font-size:16px; font-weight:600; cursor:pointer;
  transition:transform .12s ease, box-shadow .18s ease, background .18s ease;
}
.wl-btn:active{ transform:translateY(1px); }
.wl-btn-primary{
  background:${C.primary}; color:#fff; border:none; box-shadow:${SHADOW.sm};
}
.wl-btn-primary:hover{ background:${C.primaryDark}; box-shadow:${SHADOW.md}; }
.wl-btn-outline{
  background:${C.surface}; color:${C.success};
  border:1.5px solid ${C.success}55;
}
.wl-btn-outline:hover{ background:${C.successSoft}; border-color:${C.success}; }

/* ---- Liens secondaires ---- */
.wl-liens{
  display:flex; align-items:center; justify-content:center;
  gap:${S.xs}px; flex-wrap:wrap;
}
.wl-btn-creation{
  display:flex; align-items:center; justify-content:center; gap:8px;
  width:100%; margin-top:${S.lg}px; padding:13px 0;
  background:${PALETTE.blue50}; border:1.5px dashed ${C.primary}55;
  border-radius:${R.lg}px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; color:${C.primary};
  transition:background .18s ease, border-color .18s ease;
}
.wl-btn-creation:hover{ background:${PALETTE.blue100}; border-color:${C.primary}; }

.wl-sep{
  width:1px; height:16px; background:${C.border}; flex-shrink:0;
}
@media (max-width:440px){
  .wl-liens{ flex-direction:column; gap:0; }
  .wl-sep{ display:none; }
}
.wl-btn-texte{
  background:transparent; color:${C.textMuted};
  border:none; font-size:13.5px; font-weight:600;
  padding:11px ${S.md}px; width:auto; white-space:nowrap;
}
.wl-btn-texte:hover{ color:${C.primary}; }

/* ---- Atout ---- */
.wl-atout{
  display:flex; align-items:flex-start; gap:${S.md}px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.lg}px; padding:${S.lg}px; margin-top:${S.sm}px;
  animation:wlIn .32s ease;
}
.wl-atout-icon{
  width:40px; height:40px; border-radius:${R.md}px; flex-shrink:0;
  background:${C.surface}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
  box-shadow:${SHADOW.xs};
}
.wl-atout-titre{ font-size:14.5px; font-weight:600; }
.wl-atout-texte{ font-size:13.5px; color:${C.textMuted}; line-height:1.55; margin-top:3px; }

/* ---- Points ---- */
.wl-dots{ display:flex; justify-content:center; gap:7px; margin-top:${S.sm}px; }
.wl-dot{
  width:7px; height:7px; border-radius:50%; border:none; padding:0;
  background:${PALETTE.grey300}; cursor:pointer; transition:all .22s ease;
}
.wl-dot.is-on{ width:22px; border-radius:4px; background:${C.primary}; }

@keyframes wlIn{ from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:none; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;