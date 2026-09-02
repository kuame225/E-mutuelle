import React, { useEffect, useRef, useState } from "react";
import {
  Building2, ArrowRight, AlertTriangle, Sigma, Eye, RefreshCw, Users,
  CreditCard, HandHeart, ClipboardList, Wallet, Megaphone, ShieldCheck,
  KeyRound, Sliders, ScrollText, Download, CheckCircle2,
  PiggyBank, ShoppingCart, FolderKanban, GraduationCap,
} from "lucide-react";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const NOM_PLATEFORME = import.meta.env.VITE_NOM_PLATEFORME || "Babamoo";

// Contenu qui change selon le type d'organisation choisi par le visiteur —
// via le sélecteur sur la page, ou un paramètre d'URL (?type=cooperative)
// pour une campagne ciblée. Sans sélection, TYPES_LANDING.defaut s'applique :
// un discours neutre, plus aucun type mis en avant par défaut.
const TYPES_LANDING = {
  defaut: {
    label: null, genre: "f",
    eyebrow: "Pour mutuelles, associations, coopératives, ONG et bien d'autres",
    cta: "Créer mon espace",
    heroNom: "organisation",
    lead: "Cotisations, activités et comptabilité : tout ce que votre Bureau suit aujourd'hui à la main, calculé, notifié et archivé automatiquement, avec les règles propres à votre organisation.",
  },
  mutuelle: {
    label: "Mutuelle", genre: "f",
    eyebrow: "Pour les mutuelles de santé et de prévoyance",
    cta: "Inscrire ma mutuelle",
    heroNom: "mutuelle",
    lead: "Cotisations, aides sociales et comptabilité : tout ce que votre Bureau suit aujourd'hui à la main, calculé, notifié et archivé automatiquement, avec les règles propres à vos statuts.",
  },
  association: {
    label: "Association", genre: "f",
    eyebrow: "Pour les associations culturelles, sportives et sociales",
    cta: "Inscrire mon association",
    heroNom: "association",
    lead: "Adhésions, cotisations et activités : tout ce que votre Bureau suit aujourd'hui à la main, calculé, notifié et archivé automatiquement, avec les règles propres à vos statuts.",
  },
  cooperative: {
    label: "Coopérative", genre: "f",
    eyebrow: "Pour les coopératives et entreprises collectives",
    cta: "Inscrire ma coopérative",
    heroNom: "coopérative",
    lead: "Parts sociales, activité économique et partage des bénéfices : tout ce que votre Bureau suit aujourd'hui à la main, calculé et archivé automatiquement, avec les règles propres à vos statuts.",
  },
  ong: {
    label: "ONG", genre: "f",
    eyebrow: "Pour les ONG et fondations",
    cta: "Inscrire mon ONG",
    heroNom: "ONG",
    lead: "Projets, bailleurs et aides sociales : tout ce que votre Bureau suit aujourd'hui à la main, calculé, notifié et archivé automatiquement, avec les règles propres à vos statuts.",
  },
  avec: {
    label: "Groupe d'épargne", genre: "m",
    eyebrow: "Pour les groupes d'épargne et de crédit villageois",
    cta: "Inscrire mon groupe",
    heroNom: "groupe",
    lead: "Tontine, prêts et épargne : tout ce que votre Bureau suit aujourd'hui à la main, calculé, notifié et archivé automatiquement, avec les règles propres à vos statuts.",
  },
  professionnelle: {
    label: "Organisation professionnelle", genre: "f",
    eyebrow: "Pour les ordres, syndicats et groupements professionnels",
    cta: "Inscrire mon organisation",
    heroNom: "organisation professionnelle",
    lead: "Cotisations, services offerts et formations : tout ce que votre Bureau suit aujourd'hui à la main, calculé, notifié et archivé automatiquement, avec les règles propres à vos statuts.",
  },
  federation: {
    label: "Fédération", genre: "f",
    eyebrow: "Pour les fédérations et unions d'organisations",
    cta: "Inscrire ma fédération",
    heroNom: "fédération",
    lead: "Projets, documents et communications : tout ce que votre Bureau suit aujourd'hui à la main, calculé, notifié et archivé automatiquement, avec les règles propres à vos statuts.",
  },
  reseau: {
    label: "Réseau", genre: "m",
    eyebrow: "Pour les réseaux d'organisations",
    cta: "Inscrire mon réseau",
    heroNom: "réseau",
    lead: "Projets, documents et communications : tout ce que votre Bureau suit aujourd'hui à la main, calculé, notifié et archivé automatiquement, avec les règles propres à vos statuts.",
  },
};

const ORDRE_TYPES = ["mutuelle", "association", "cooperative", "ong", "avec", "professionnelle", "federation", "reseau"];

// Trois organisations réelles seulement (MAEPHDA, FDSD, LES QUETEUSES) —
// aucune autre ajoutée à côté : en inventer pour représenter les types
// encore non couverts (coopérative, ONG, AVEC, professionnelle...)
// reviendrait à fabriquer un faux témoignage client.
const ORGANISATIONS = [
  { logo: "/logo-mephda.png", nom: "MAEPHDA — Mutuelle des Agents de l'EPHD de Dabakala", secteur: "Santé" },
  { init: "FD", nom: "FDSD — Famille District Sanitaire de Daloa", secteur: "Santé" },
  { init: "LQ", nom: "Les Quêteuses", secteur: "Association religieuse" },
];

// Chaque fonctionnalité déclare les types d'organisation concernés — la
// grille se filtre en conséquence quand un type est sélectionné. Les
// quatre dernières n'existaient pas dans la version d'origine, pensée
// uniquement pour les mutuelles : Parts sociales, Activité économique,
// Projets et Services/Formations/Partenariats n'y étaient jamais montrés.
const TOUS_TYPES = ["mutuelle", "association", "cooperative", "ong", "avec", "professionnelle", "federation", "reseau", "autre"];

const FONCTIONNALITES = [
  { Icon: Users, titre: "Adhésions et fiches membres", texte: "Demandes en ligne, validation par le Bureau, carte de membre et registre à jour.", couleur: "navy", types: TOUS_TYPES },
  { Icon: CreditCard, titre: "Cotisations et paiements", texte: "Suivi mensuel, paiements fractionnés, reçus automatiques, sanctions sans intervention manuelle.", couleur: "green", types: TOUS_TYPES.filter((t) => t !== "cooperative") },
  { Icon: HandHeart, titre: "Aides sociales", texte: "Demandes, décisions et versements tracés selon le barème de vos statuts.", couleur: "orange", types: ["mutuelle", "ong"] },
  { Icon: Wallet, titre: "Comptabilité", texte: "Recettes et dépenses diverses, justificatifs joints, rapports prêts à présenter.", couleur: "navy", types: TOUS_TYPES },
  { Icon: Megaphone, titre: "Communications", texte: "Annonces et rappels d'échéance, notification individuelle au bon moment.", couleur: "green", types: TOUS_TYPES },
  { Icon: ShieldCheck, titre: "Rôles du Bureau", texte: "Président, trésorier, secrétaire général : chacun accède à ce que sa fonction exige.", couleur: "orange", types: TOUS_TYPES },
  { Icon: ClipboardList, titre: "Assemblées générales", texte: "Convocation, émargement, quorum en direct, procès-verbal archivé.", couleur: "navy", payant: true, types: TOUS_TYPES.filter((t) => t !== "avec") },
  { Icon: RefreshCw, titre: "Tontine", texte: "Ordre de passage fixé, versements suivis tour par tour, notification au bénéficiaire.", couleur: "green", payant: true, types: ["avec"] },
  { Icon: KeyRound, titre: "Prêts et avances", texte: "Demande par le membre ou saisie directe du Bureau, échéances suivies une à une.", couleur: "orange", payant: true, types: ["cooperative", "avec"] },
  { Icon: PiggyBank, titre: "Parts sociales et capital", texte: "Souscriptions, remboursements, capital détenu par chaque membre suivi à tout moment.", couleur: "navy", types: ["cooperative"] },
  { Icon: ShoppingCart, titre: "Activité économique", texte: "Achats, ventes et stock suivis, partage des bénéfices calculé en fin d'exercice.", couleur: "green", types: ["cooperative"] },
  { Icon: FolderKanban, titre: "Projets et bailleurs", texte: "Budgets, dépenses et indicateurs de suivi par projet, bailleur par bailleur.", couleur: "orange", types: ["ong", "association", "federation", "reseau"] },
  { Icon: GraduationCap, titre: "Services, formations et partenariats", texte: "Catalogue de services, calendrier de formations et annuaire de partenaires.", couleur: "navy", types: ["professionnelle"] },
];

const ETAPES = [
  { titre: "On parle de vos statuts", texte: "Cotisations, seuils, types d'aide : vos règles reprises telles qu'écrites." },
  { titre: "Vos membres sont importés", texte: "Le registre actuel est repris et intégré — pas de ressaisie manuelle." },
  { titre: "Le Bureau est formé", texte: "Président, trésorier, secrétaire général apprennent leur propre espace." },
  { titre: "Votre organisation est en ligne", texte: "Les membres reçoivent leurs accès, et le cahier passe le relais." },
];

export default function LandingPage({ onCreationMutuelle, onConnexion }) {
  const orgTrackRef = useRef(null);
  const orgOuterRef = useRef(null);
  const revealRefs = useRef([]);
  revealRefs.current = [];

  // Un paramètre d'URL (?type=cooperative) permet à une campagne ciblée
  // d'arriver directement sur le bon discours ; sans paramètre, le
  // visiteur peut aussi choisir lui-même via le sélecteur ci-dessous.
  const [type, setType] = useState(() => {
    const parametre = new URLSearchParams(window.location.search).get("type");
    return TYPES_LANDING[parametre] ? parametre : null;
  });

  const cfg = TYPES_LANDING[type] || TYPES_LANDING.defaut;
  const fonctionnalitesVisibles = type
    ? FONCTIONNALITES.filter((f) => f.types.includes(type))
    : FONCTIONNALITES;

  function addReveal(el) {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  }

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || !("IntersectionObserver" in window)) {
      revealRefs.current.forEach((el) => el.classList.add("in"));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add("in"), (i % 4) * 90);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
      revealRefs.current.forEach((el) => io.observe(el));
    }

    // Défilement des organisations : ne démarre qu'au moment où la bande
    // devient visible, pour que la première organisation soit bien celle
    // que la personne voit en arrivant sur la section.
    if (orgTrackRef.current && orgOuterRef.current && !reduced && "IntersectionObserver" in window) {
      let started = false;
      const track = orgTrackRef.current;
      const orgIo = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started) {
            started = true;
            track.style.animation = "none";
            void track.offsetWidth;
            track.style.animation = "";
            orgIo.disconnect();
          }
        });
      }, { threshold: 0.3 });
      orgIo.observe(orgOuterRef.current);
    }
  }, []);

  return (
    <div className="lp-shell">
      <style>{CSS}</style>

      <header className="lp-header">
        <div className="lp-nav">
          <div className="lp-wordmark">
            <span className="lp-mark"><Building2 size={16} /></span>
            {NOM_PLATEFORME}
          </div>
          <div className="lp-nav-actions">
            <button className="lp-btn-connexion" onClick={onConnexion}>Se connecter</button>
            <button className="lp-btn lp-btn-primary" onClick={onCreationMutuelle}>
              {cfg.cta} <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div className="lp-type-selecteur">
          <span className="lp-type-label">Vous êtes plutôt :</span>
          {ORDRE_TYPES.map((id) => (
            <button
              key={id}
              className={`lp-type-pill ${type === id ? "is-on" : ""}`}
              onClick={() => setType(type === id ? null : id)}
            >
              {TYPES_LANDING[id].label}
            </button>
          ))}
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-grid">
          <div>
            <span className="lp-eyebrow">{cfg.eyebrow}</span>
            <h1 className="lp-h1">
              Votre {cfg.heroNom}, <span className="lp-accent">{cfg.genre === "m" ? "géré" : "gérée"} simplement</span> — sans perdre le contrôle.
            </h1>
            <p className="lp-lead">
              {cfg.lead}
            </p>
            <div className="lp-ctas">
              <button className="lp-btn lp-btn-primary" onClick={onCreationMutuelle}>
                {cfg.cta} <ArrowRight size={17} />
              </button>
            </div>
            <div className="lp-note"><span className="lp-dot" />Chaque organisation cloisonnée : aucune ne peut voir les données d'une autre.</div>
            <div className="lp-note lp-note-membre">
              Déjà membre d'une organisation cliente ? Utilisez le lien fourni par votre Bureau.
            </div>
          </div>

          <div className="lp-demo">
            <div className="lp-demo-head">
              <span className="lp-demo-t">Cotisations — ce mois</span>
              <span className="lp-demo-s">78% à jour</span>
            </div>
            <div className="lp-demo-rows">
              <div className="lp-drow" style={{ animationDelay: ".05s" }}><span>Membre 1</span><span className="lp-amt">5 000 F</span><span className="lp-st lp-st-ok">À jour</span></div>
              <div className="lp-drow" style={{ animationDelay: ".15s" }}><span>Membre 2</span><span className="lp-amt">3 000 F</span><span className="lp-st lp-st-wait">Partiel</span></div>
              <div className="lp-drow" style={{ animationDelay: ".25s" }}><span>Membre 3</span><span className="lp-amt">5 000 F</span><span className="lp-st lp-st-ok">À jour</span></div>
              <div className="lp-drow" style={{ animationDelay: ".35s" }}><span>Membre 4</span><span className="lp-amt">0 F</span><span className="lp-st lp-st-wait">En attente</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-problem">
        <div className="lp-wrap">
          <div className="lp-reveal lp-problem-head" ref={addReveal}>
            <h2>Le cahier a des limites que votre Bureau connaît déjà</h2>
            <p>Ce que la plateforme remplace, ce n'est pas votre organisation — c'est la charge de tout suivre à la main.</p>
          </div>
          <div className="lp-gripes">
            <div className="lp-reveal lp-gripe" ref={addReveal}><div className="lp-gripe-ic"><AlertTriangle size={18} /></div><h3>Une seule copie</h3><p>Perdu ou déchiré, c'est toute la mémoire financière qui disparaît avec le cahier.</p></div>
            <div className="lp-reveal lp-gripe" ref={addReveal}><div className="lp-gripe-ic"><Sigma size={18} /></div><h3>Calcul manuel des sanctions</h3><p>Qui a du retard ? Personne ne le sait sans reprendre chaque ligne.</p></div>
            <div className="lp-reveal lp-gripe" ref={addReveal}><div className="lp-gripe-ic"><Eye size={18} /></div><h3>Aucune transparence</h3><p>Un membre doit demander au trésorier pour connaître l'état de sa cotisation.</p></div>
            <div className="lp-reveal lp-gripe" ref={addReveal}><div className="lp-gripe-ic"><RefreshCw size={18} /></div><h3>Le savoir s'en va avec le Bureau</h3><p>Un nouveau trésorier hérite d'un cahier sans les règles écrites nulle part.</p></div>
          </div>
        </div>
      </section>

      <section className="lp-features">
        <div className="lp-wrap">
          <h2 className="lp-reveal lp-center" ref={addReveal}>Tout ce que gère déjà votre Bureau — au même endroit</h2>
          <p className="lp-reveal lp-center lp-sub" ref={addReveal}>Un socle commun, et des modules additionnels activables selon vos besoins.</p>
          <div className="lp-grid-feat">
            {fonctionnalitesVisibles.map((f) => (
              <div className="lp-reveal lp-feat" ref={addReveal} key={f.titre}>
                <div className={`lp-feat-ic lp-ic-${f.couleur}`}><f.Icon size={19} /></div>
                <h3>{f.titre}</h3>
                <p>{f.texte}</p>
                {f.payant && <span className="lp-badge-payant">Module payant</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-how">
        <div className="lp-wrap">
          <h2 className="lp-reveal lp-center" ref={addReveal}>De la prise de contact à la mise en service</h2>
          <div className="lp-steps">
            {ETAPES.map((e, i) => (
              <div className="lp-reveal lp-step" ref={addReveal} key={e.titre}>
                <span className="lp-step-num">{i + 1}</span>
                <h3>{e.titre}</h3>
                <p>{e.texte}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-orgs">
        <div className="lp-wrap">
          <div className="lp-reveal lp-orgs-head" ref={addReveal}>
            <h2>Ces organisations nous ont fait confiance</h2>
            <p>Mutuelles, coopératives, associations et bien d'autres — aucun nom de membre n'apparaît jamais sur la plateforme.</p>
          </div>
          <div className="lp-marquee-outer" ref={orgOuterRef}>
            <div className="lp-marquee-track" ref={orgTrackRef}>
              {[...ORGANISATIONS, ...ORGANISATIONS].map((o, i) => (
                <div className="lp-org-chip" key={i}>
                  <span className="lp-org-badge">
                    {o.logo
                      ? <img src={o.logo} alt={`Logo ${o.nom}`} />
                      : o.init}
                  </span>
                  <div>
                    <div className="lp-org-nom">{o.nom}</div>
                    <div className="lp-org-secteur">{o.secteur}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="lp-trust">
        <div className="lp-wrap lp-trust-grid">
          <div className="lp-reveal" ref={addReveal}>
            <span className="lp-eyebrow">Confiance</span>
            <h2>Vos données n'appartiennent qu'à vous</h2>
            <p className="lp-trust-lead">Une plateforme commune ne veut pas dire des données communes. Chaque organisation est isolée des autres au niveau de la base elle-même.</p>
          </div>
          <div className="lp-reveal lp-trust-points" ref={addReveal}>
            <div className="lp-tp"><ShieldCheck size={18} /><div><h4>Cloisonnement strict</h4><p>Aucune organisation cliente ne peut voir les membres ou les finances d'une autre.</p></div></div>
            <div className="lp-tp"><Sliders size={18} /><div><h4>Rôles précis</h4><p>Un trésorier gère les cotisations ; il n'a pas accès aux réglages de l'administrateur technique.</p></div></div>
            <div className="lp-tp"><ScrollText size={18} /><div><h4>Journal de toute action sensible</h4><p>Connexions, paiements, adhésions validées : tout est horodaté.</p></div></div>
            <div className="lp-tp"><Download size={18} /><div><h4>Export à tout moment</h4><p>Le fichier des membres appartient à votre organisation, exportable quand vous le souhaitez.</p></div></div>
          </div>
        </div>
      </section>

      <section className="lp-pricing">
        <div className="lp-wrap lp-center">
          <h2 className="lp-reveal" ref={addReveal}>Un tarif construit autour de votre organisation</h2>
          <p className="lp-reveal lp-sub" ref={addReveal}>Forfait de base + composante variable selon votre activité, modules payants en option.</p>
          <div className="lp-reveal lp-price-card" ref={addReveal}>
            <div className="lp-price-part"><span className="lp-lbl">Base</span><h3>Un forfait fixe</h3><p>Accès à la plateforme et au socle commun.</p></div>
            <div className="lp-price-part"><span className="lp-lbl">Variable</span><h3>Selon votre activité</h3><p>Ajusté au nombre de membres actifs et/ou au volume encaissé.</p></div>
          </div>
          <div className="lp-reveal lp-timeline-tarif" ref={addReveal}>
            <div className="lp-tt-item"><span className="lp-tt-num">1</span><p><strong>Inscription et essai gratuit de 2 mois</strong> — accès complet, aucun paiement demandé.</p></div>
            <div className="lp-tt-item"><span className="lp-tt-num">2</span><p><strong>À la fin de l'essai</strong>, la première facture inclut le forfait + variable, et les éventuels frais de mise en service (configuration, import, formation) — facturés une seule fois, jamais pendant l'essai.</p></div>
            <div className="lp-tt-item"><span className="lp-tt-num">3</span><p><strong>Les mois suivants</strong>, seuls le forfait et la composante variable sont facturés.</p></div>
          </div>
        </div>
      </section>

      <section className="lp-final">
        <div className="lp-wrap lp-center">
          <div className="lp-reveal lp-final-card" ref={addReveal}>
            <h2>Prêt à faire passer votre cahier au numérique ?</h2>
            <p>Deux mois d'essai complet, sans engagement, pour voir si votre organisation s'y retrouve.</p>
            <button className="lp-btn lp-btn-inverse" onClick={onCreationMutuelle}>
              <CheckCircle2 size={17} /> {cfg.cta}
            </button>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-row">
          <div className="lp-wordmark"><span className="lp-mark"><Building2 size={14} /></span>{NOM_PLATEFORME}</div>
        </div>
      </footer>
    </div>
  );
}

const CSS = `
.lp-shell{ background:${C.bg}; color:${C.text}; font-family:'Inter','Poppins',system-ui,sans-serif; }
.lp-wrap{ max-width:1180px; margin:0 auto; padding:0 24px; }
.lp-center{ text-align:center; }
section{ padding:88px 0; }
@media (max-width:720px){ section{ padding:56px 0; } }

.lp-reveal{ opacity:0; transform:translateY(18px); transition:opacity .6s ease, transform .6s ease; }
.lp-reveal.in{ opacity:1; transform:none; }
@media (prefers-reduced-motion: reduce){ .lp-reveal{ opacity:1; transform:none; } }

.lp-header{ position:sticky; top:0; z-index:50; background:rgba(255,255,255,.92); backdrop-filter:blur(8px); border-bottom:1px solid ${C.border}; }
.lp-nav{ max-width:1180px; margin:0 auto; padding:16px 24px; display:flex; align-items:center; justify-content:space-between; }
.lp-wordmark{ font-size:18px; font-weight:700; color:${C.primary}; display:flex; align-items:center; gap:9px; }
.lp-mark{ width:30px; height:30px; border-radius:${R.md}px; background:${C.primary}; color:#fff; display:flex; align-items:center; justify-content:center; }

.lp-nav-actions{ display:flex; align-items:center; gap:16px; }
.lp-btn-connexion{ background:none; border:none; font-family:inherit; font-size:14px; font-weight:600; color:${C.textMuted}; cursor:pointer; }
.lp-btn-connexion:hover{ color:${C.primary}; }

.lp-type-selecteur{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  max-width:1180px; margin:0 auto; padding:14px 24px 0;
}
.lp-type-label{ font-size:12.5px; color:${C.textSubtle}; font-weight:600; margin-right:2px; }
.lp-type-pill{
  background:${C.bg}; border:1px solid ${C.border}; color:${C.textMuted};
  border-radius:999px; padding:6px 13px; font-size:12.5px; font-weight:600;
  cursor:pointer; font-family:inherit; transition:all .15s ease; white-space:nowrap;
}
.lp-type-pill:hover{ border-color:${C.primary}; color:${C.primary}; }
.lp-type-pill.is-on{ background:${C.primary}; border-color:${C.primary}; color:#fff; }
@media (max-width:700px){ .lp-type-selecteur{ overflow-x:auto; flex-wrap:nowrap; padding-bottom:4px; } }

.lp-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:13px 22px; border-radius:${R.md}px; font-size:14.5px; font-weight:600; border:none; cursor:pointer; transition:transform .15s ease, background .15s ease; font-family:inherit; }
.lp-btn:hover{ transform:translateY(-2px); }
.lp-btn-primary{ background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.lp-btn-primary:hover{ background:${C.primaryDark}; box-shadow:${SHADOW.md}; }
.lp-btn-inverse{ background:#fff; color:${C.primary}; }

.lp-hero{ padding-top:72px; }
.lp-hero-grid{ max-width:1180px; margin:0 auto; padding:0 24px; display:grid; grid-template-columns:1.05fr .95fr; gap:56px; align-items:center; }
@media (max-width:900px){ .lp-hero-grid{ grid-template-columns:1fr; gap:40px; } }
.lp-eyebrow{ display:inline-flex; padding:7px 14px; background:${PALETTE.blue100}; color:${C.primary}; font-size:12.5px; font-weight:600; border-radius:999px; margin-bottom:20px; }
.lp-h1{ font-size:clamp(30px,4.2vw,46px); line-height:1.14; margin:0 0 18px; font-weight:700; letter-spacing:-.01em; }
.lp-accent{ color:${C.primary}; }
.lp-lead{ font-size:17px; color:${C.textMuted}; max-width:46ch; margin:0 0 28px; }
.lp-ctas{ margin-bottom:18px; }
.lp-note{ display:flex; align-items:center; gap:8px; font-size:13.5px; color:${C.textSubtle}; margin-top:6px; }
.lp-note-membre{ font-style:italic; }
.lp-dot{ width:7px; height:7px; border-radius:50%; background:${C.success}; flex-shrink:0; }

.lp-demo{ background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xxl}px; padding:24px; box-shadow:${SHADOW.md}; }
.lp-demo-head{ display:flex; justify-content:space-between; margin-bottom:16px; font-size:13px; font-weight:600; }
.lp-demo-s{ color:${C.success}; background:${C.successSoft}; padding:4px 10px; border-radius:999px; font-size:11.5px; }
.lp-demo-rows{ display:flex; flex-direction:column; gap:8px; }
.lp-drow{ display:grid; grid-template-columns:1fr auto auto; gap:12px; align-items:center; padding:11px 14px; border-radius:${R.md}px; background:${C.bg}; opacity:0; animation:lpRowIn .5s ease forwards; }
.lp-amt{ font-weight:600; font-size:13.5px; }
.lp-st{ font-size:11px; font-weight:600; padding:4px 10px; border-radius:999px; }
.lp-st-ok{ background:${C.successSoft}; color:${C.success}; }
.lp-st-wait{ background:${C.warningSoft}; color:${C.warning}; }
@keyframes lpRowIn{ from{ opacity:0; transform:translateY(6px);} to{ opacity:1; transform:none; } }

.lp-problem{ background:${C.surface}; border-top:1px solid ${C.border}; border-bottom:1px solid ${C.border}; }
.lp-problem-head{ text-align:center; max-width:620px; margin:0 auto 48px; }
.lp-problem-head h2{ font-size:clamp(22px,2.8vw,30px); margin:0 0 10px; }
.lp-problem-head p{ color:${C.textMuted}; margin:0; }
.lp-gripes{ display:grid; grid-template-columns:repeat(4,1fr); gap:18px; }
@media (max-width:900px){ .lp-gripes{ grid-template-columns:repeat(2,1fr); } }
@media (max-width:560px){ .lp-gripes{ grid-template-columns:1fr; } }
.lp-gripe{ background:${C.bg}; border:1px solid ${C.border}; border-radius:${R.lg}px; padding:22px; }
.lp-gripe-ic{ width:38px; height:38px; border-radius:${R.md}px; background:${C.warningSoft}; color:${C.warning}; display:flex; align-items:center; justify-content:center; margin-bottom:14px; }
.lp-gripe h3{ font-size:15px; margin:0 0 6px; }
.lp-gripe p{ font-size:13px; color:${C.textMuted}; margin:0; line-height:1.55; }

.lp-sub{ color:${C.textMuted}; max-width:56ch; margin:0 auto 44px; }
.lp-grid-feat{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
@media (max-width:900px){ .lp-grid-feat{ grid-template-columns:repeat(2,1fr); } }
@media (max-width:600px){ .lp-grid-feat{ grid-template-columns:1fr; } }
.lp-feat{ background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px; padding:24px; box-shadow:${SHADOW.xs}; }
.lp-feat-ic{ width:42px; height:42px; border-radius:${R.md}px; display:flex; align-items:center; justify-content:center; margin-bottom:14px; }
.lp-ic-navy{ background:${PALETTE.blue100}; color:${C.primary}; }
.lp-ic-green{ background:${C.successSoft}; color:${C.success}; }
.lp-ic-orange{ background:${C.warningSoft}; color:${C.warning}; }
.lp-feat h3{ font-size:15.5px; margin:0 0 7px; }
.lp-feat p{ font-size:13px; color:${C.textMuted}; margin:0; line-height:1.55; }
.lp-badge-payant{ display:inline-block; margin-top:9px; font-size:10.5px; font-weight:700; text-transform:uppercase; color:${C.warning}; background:${C.warningSoft}; padding:3px 9px; border-radius:999px; }

.lp-steps{ display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
@media (max-width:860px){ .lp-steps{ grid-template-columns:repeat(2,1fr); } }
@media (max-width:520px){ .lp-steps{ grid-template-columns:1fr; } }
.lp-step{ background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px; padding:22px; box-shadow:${SHADOW.xs}; }
.lp-step-num{ width:30px; height:30px; border-radius:${R.md}px; background:${C.primary}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; margin-bottom:14px; }
.lp-step h3{ font-size:15px; margin:0 0 7px; }
.lp-step p{ font-size:13px; color:${C.textMuted}; margin:0; }

.lp-orgs{ background:${C.surface}; border-top:1px solid ${C.border}; border-bottom:1px solid ${C.border}; }
.lp-orgs-head{ text-align:center; max-width:600px; margin:0 auto 40px; }
.lp-orgs-head h2{ font-size:clamp(20px,2.4vw,26px); margin:0 0 8px; }
.lp-orgs-head p{ color:${C.textMuted}; font-size:14px; margin:0; }
.lp-marquee-outer{ overflow:hidden; -webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent); mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent); }
.lp-marquee-track{ display:flex; gap:14px; width:max-content; animation:lpOrgScroll 32s linear infinite; }
.lp-marquee-outer:hover .lp-marquee-track{ animation-play-state:paused; }
@keyframes lpOrgScroll{ from{ transform:translateX(0); } to{ transform:translateX(-50%); } }
@media (prefers-reduced-motion: reduce){ .lp-marquee-track{ animation:none; flex-wrap:wrap; width:auto; } .lp-marquee-outer{ overflow:visible; -webkit-mask-image:none; mask-image:none; } }
.lp-org-chip{ display:flex; align-items:center; gap:11px; background:${C.bg}; border:1px solid ${C.border}; border-radius:${R.md}px; padding:13px 16px; width:270px; flex-shrink:0; }
.lp-org-badge{ width:34px; height:34px; border-radius:${R.md}px; background:${C.primary}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; flex-shrink:0; overflow:hidden; }
.lp-org-badge img{ width:100%; height:100%; object-fit:contain; background:#fff; }
.lp-org-nom{ font-size:13px; font-weight:600; line-height:1.3; }
.lp-org-secteur{ font-size:11px; color:${C.textSubtle}; }

.lp-trust-grid{ display:grid; grid-template-columns:1fr 1fr; gap:52px; align-items:center; }
@media (max-width:860px){ .lp-trust-grid{ grid-template-columns:1fr; gap:32px; } }
.lp-trust-grid h2{ font-size:clamp(20px,2.4vw,28px); margin:14px 0; max-width:18ch; }
.lp-trust-lead{ color:${C.textMuted}; font-size:14.5px; max-width:44ch; margin:0; }
.lp-trust-points{ display:flex; flex-direction:column; gap:16px; }
.lp-tp{ display:flex; gap:13px; align-items:flex-start; color:${C.success}; }
.lp-tp h4{ font-size:14.5px; margin:0 0 4px; color:${C.text}; }
.lp-tp p{ font-size:13px; color:${C.textMuted}; margin:0; }

.lp-pricing{ background:${C.surface}; border-top:1px solid ${C.border}; border-bottom:1px solid ${C.border}; }
.lp-price-card{ display:inline-grid; grid-template-columns:1fr 1fr; max-width:600px; width:100%; background:${C.bg}; border:1px solid ${C.border}; border-radius:${R.xxl}px; overflow:hidden; text-align:left; }
@media (max-width:600px){ .lp-price-card{ grid-template-columns:1fr; } }
.lp-price-part{ padding:28px 26px; }
.lp-price-part + .lp-price-part{ border-left:1px solid ${C.border}; }
@media (max-width:600px){ .lp-price-part + .lp-price-part{ border-left:none; border-top:1px solid ${C.border}; } }

.lp-timeline-tarif{ max-width:640px; margin:32px auto 0; text-align:left; display:flex; flex-direction:column; gap:16px; }
.lp-tt-item{ display:grid; grid-template-columns:28px 1fr; gap:12px; align-items:flex-start; }
.lp-tt-num{ width:26px; height:26px; border-radius:${R.pill}px; background:${PALETTE.blue100}; color:${C.primary}; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0; }
.lp-tt-item p{ margin:0; font-size:13.5px; color:${C.textMuted}; line-height:1.6; }
.lp-tt-item strong{ color:${C.text}; }
.lp-lbl{ display:inline-block; font-size:11px; font-weight:700; text-transform:uppercase; color:${C.primary}; background:${PALETTE.blue100}; padding:4px 10px; border-radius:999px; margin-bottom:10px; }
.lp-price-part h3{ font-size:17px; margin:0 0 6px; }
.lp-price-part p{ font-size:13px; color:${C.textMuted}; margin:0; }

.lp-final-card{ background:${C.primary}; border-radius:${R.xxl}px; padding:56px 36px; color:#fff; box-shadow:${SHADOW.md}; }
.lp-final-card h2{ font-size:clamp(24px,3.2vw,34px); margin:0 0 14px; max-width:20ch; margin-left:auto; margin-right:auto; }
.lp-final-card p{ color:#C6D8F5; max-width:42ch; margin:0 auto 26px; font-size:14.5px; }

.lp-footer{ background:${C.surface}; border-top:1px solid ${C.border}; padding:32px 0; }
.lp-footer-row{ display:flex; justify-content:center; }

*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;