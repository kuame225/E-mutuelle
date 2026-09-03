import React, { useEffect, useRef, useState } from "react";
import {
  Building2, ArrowRight, AlertTriangle, Sigma, Eye, RefreshCw, Users,
  CreditCard, HandHeart, ClipboardList, Wallet, Megaphone, ShieldCheck,
  KeyRound, Sliders, ScrollText, Download, CheckCircle2,
  PiggyBank, ShoppingCart, FolderKanban, GraduationCap, Lock, Gift,
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
    lead: "Parts variables, fonds social et crédit interne : tout ce que votre Bureau suit aujourd'hui à la main, sécurisé par plusieurs clés et vérifié à chaque réunion.",
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

// La carte de démonstration dans le hero change selon le type
// sélectionné, comme le reste de la page — plutôt qu'une liste de
// cotisations figée quel que soit le type choisi, une donnée
// réellement représentative de ce que cette organisation suit.

const ORDRE_TYPES = ["mutuelle", "association", "cooperative", "ong", "avec", "professionnelle", "federation", "reseau"];

// Trois organisations réelles seulement (MAEPHDA, FDSD, LES QUETEUSES) —
// aucune autre ajoutée à côté : en inventer pour représenter les types
// encore non couverts (coopérative, ONG, AVEC, professionnelle...)
// reviendrait à fabriquer un faux témoignage client.
const ORGANISATIONS = [
  { logo: "/logo-babamoo.png", nom: "MAEPHDA — Mutuelle des Agents de l'EPHD de Dabakala", secteur: "Santé" },
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
  { Icon: RefreshCw, titre: "Tontine", texte: "Ordre de passage fixé, versements suivis tour par tour, notification au bénéficiaire.", couleur: "green", payant: true, types: [] },
  { Icon: Lock, titre: "Épargne AVEC sécurisée", texte: "Parts variables par réunion, fonds social, crédit interne à éligibilité automatique — sécurisé par plusieurs clés, vérifié à chaque clôture de caisse.", couleur: "navy", payant: true, types: ["avec"] },
  { Icon: KeyRound, titre: "Prêts et avances", texte: "Demande par le membre ou saisie directe du Bureau, échéances suivies une à une.", couleur: "orange", payant: true, types: ["cooperative"] },
  { Icon: PiggyBank, titre: "Parts sociales et capital", texte: "Souscriptions, remboursements, capital détenu par chaque membre suivi à tout moment.", couleur: "navy", types: ["cooperative"] },
  { Icon: ShoppingCart, titre: "Activité économique", texte: "Achats, ventes et stock suivis, partage des bénéfices calculé en fin d'exercice.", couleur: "green", types: ["cooperative"] },
  { Icon: FolderKanban, titre: "Projets et bailleurs", texte: "Budgets, dépenses et indicateurs de suivi par projet, bailleur par bailleur.", couleur: "orange", types: ["ong", "association", "federation", "reseau"] },
  { Icon: GraduationCap, titre: "Services, formations et partenariats", texte: "Catalogue de services, calendrier de formations et annuaire de partenaires.", couleur: "navy", types: ["professionnelle"] },
  { Icon: Gift, titre: "Dons publics", texte: "Une page de collecte partageable, sans création de compte — le paiement va directement vers votre organisation.", couleur: "orange", types: ["association", "ong", "federation", "reseau"] },
];

const ETAPES = [
  { titre: "On parle de vos statuts", texte: "Cotisations, seuils, types d'aide : vos règles reprises telles qu'écrites." },
  { titre: "Vos membres sont importés", texte: "Le registre actuel est repris et intégré — pas de ressaisie manuelle." },
  { titre: "Le Bureau est formé", texte: "Président, trésorier, secrétaire général apprennent leur propre espace." },
  { titre: "Votre organisation est en ligne", texte: "Les membres reçoivent leurs accès, et le cahier passe le relais." },
];

function IllustrationTableauBord() {
  return (
    <div className="illus-scene" aria-hidden="true">
      <div className="illus-laptop">
        <div className="illus-laptop-ecran">
          <div className="illus-barre-titre">
            <span className="illus-logo-badge"><img src="/logo-babamoo.png" alt="" /></span>
            <span className="illus-marque-texte">Babamoo</span>
          </div>

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
          <div className="illus-phone-salut">
            <span className="illus-logo-badge illus-logo-badge-petit"><img src="/logo-babamoo.png" alt="" /></span>
            Bonjour Koffi 👋
          </div>
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
            <span className="lp-mark">
              <img src="/logo-babamoo.png" alt="Babamoo" />
            </span>
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

          <IllustrationTableauBord />
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
          <div className="lp-wordmark">
            <span className="lp-mark">
              <img src="/logo-babamoo.png" alt="Babamoo" />
            </span>
            {NOM_PLATEFORME}
          </div>
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
.lp-mark{ width:30px; height:30px; border-radius:${R.md}px; background:${C.surface}; border:1px solid ${C.border}; display:flex; align-items:center; justify-content:center; padding:4px; }
.lp-mark img{ width:100%; height:100%; object-fit:contain; }

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

/* ---- Illustration animée (décorative, aucune vraie donnée) ---- */
/* Écrans blancs, comme de vraies captures — coque sombre pour se
   détacher du panneau bleu derrière. Les deux appareils sont ancrés au
   même bas (bottom:0) plutôt que l'un depuis le haut et l'autre depuis
   le bas : sans ça, garantir leur alignement exige un calcul de pixels
   fragile, jamais vérifiable sans pouvoir observer le rendu réel. */
.illus-scene{ position:relative; height:300px; transform:scale(.88); transform-origin:top left; }
@media (max-width:900px){
  .illus-scene{ transform:scale(1); }
}
@media (max-width:650px){
  .illus-scene{ transform:scale(.62); height:186px; }
}

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
.illus-barre-titre{ display:flex; align-items:center; gap:6px; margin-bottom:14px; }
.illus-logo-badge{
  width:16px; height:16px; border-radius:5px; flex-shrink:0;
  background:${C.surface}; border:1px solid ${C.border};
  display:flex; align-items:center; justify-content:center; padding:2px;
}
.illus-logo-badge img{ width:100%; height:100%; object-fit:contain; }
.illus-logo-badge-petit{ width:13px; height:13px; border-radius:4px; }
.illus-marque-texte{ font-size:10.5px; font-weight:700; color:${C.textMuted}; }

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
.illus-phone-salut{ display:flex; align-items:center; gap:5px; font-size:10.5px; font-weight:700; color:${C.text}; }
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