import React, { useState, useEffect } from "react";
import {
  Building2, ArrowLeft, ArrowRight, Loader2, AlertCircle,
  CheckCircle2, Mail, Lock, MapPin, Briefcase, ShieldCheck, Sliders,
  HeartHandshake, Users2, Handshake, Globe, PiggyBank, Network, Share2,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { TYPES_ORGANISATION, motPourType } from "./vocabulaire";
import { rafraichirIdentite } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

// Un exemple de dénomination par type, pour que le placeholder du champ
// ne suggère plus systématiquement une mutuelle — repéré comme un oubli
// isolé, le reste de l'écran adaptait déjà correctement son vocabulaire.
const EXEMPLES_DENOMINATION = {
  mutuelle: "Mutuelle Générale des Fonctionnaires",
  association: "Association des Femmes Entrepreneures",
  cooperative: "Coopérative des Planteurs de Cacao",
  ong: "Fondation pour l'Éducation des Filles",
  avec: "Association Villageoise d'Épargne et de Crédit de Divo",
  professionnelle: "Ordre des Experts-Comptables",
  federation: "Fédération des Mutuelles de Santé",
  reseau: "Réseau des Coopératives Agricoles",
  autre: "Nom de votre organisation",
};

// Les 14 modules réellement optionnels (colonnes module_* de
// parametrage) — le socle (membres, cotisations, communications...)
// n'est jamais un module à cocher, il est toujours présent.
const LABELS_MODULES = {
  module_qr_carte: "Carte de membre (QR code)",
  module_assemblees: "Assemblées générales",
  module_documents: "Documents",
  module_aides: "Aides sociales",
  module_prets: "Prêts et avances",
  module_tontine: "Tontine",
  module_tombola: "Tombola",
  module_sanctions: "Sanctions",
  module_parts_sociales: "Parts sociales",
  module_activites_economiques: "Activité économique",
  module_projets: "Projets et bailleurs",
  module_services: "Services offerts",
  module_formations: "Formations",
  module_partenariats: "Partenariats",
};

// Une icône par type, pour que le choix ne soit plus qu'un nom et une
// phrase — repéré comme l'un des écrans les plus plats du parcours.
const ICONES_TYPE = {
  mutuelle: HeartHandshake,
  association: Users2,
  cooperative: Handshake,
  ong: Globe,
  avec: PiggyBank,
  professionnelle: Briefcase,
  federation: Network,
  reseau: Share2,
  autre: Building2,
};

// Le socle n'a pas de colonne module_* — toujours présent, jamais une
// bascule. Montré ici seulement pour que l'étape Modules donne une vue
// complète (« Essentiels » + « Recommandés » + « Optionnels »), comme
// dans la maquette, plutôt qu'une liste des seuls modules facultatifs.
function socleParType(type) {
  const base = ["Adhésions et fiches membres", "Comptabilité", "Communications", "Rôles du Bureau"];
  if (type !== "cooperative") base.splice(1, 0, "Cotisations et paiements");
  return base;
}

const ETAPES_PARCOURS = [
  { id: "type", label: "Type" },
  { id: "formulaire", label: "Informations" },
  { id: "modules", label: "Modules" },
  { id: "recapitulatif", label: "Confirmation" },
];

function BarreEtapes({ etapeActuelle }) {
  const indexActuel = ETAPES_PARCOURS.findIndex((e) => e.id === etapeActuelle);

  return (
    <div className="io-etapes">
      {ETAPES_PARCOURS.map((e, i) => (
        <React.Fragment key={e.id}>
          <div className={`io-etape ${i < indexActuel ? "is-fait" : ""} ${i === indexActuel ? "is-actuel" : ""}`}>
            <span className="io-etape-rond">
              {i < indexActuel ? <CheckCircle2 size={13} /> : i + 1}
            </span>
            <span className="io-etape-label">{e.label}</span>
          </div>
          {i < ETAPES_PARCOURS.length - 1 && <span className="io-etape-trait" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// Panneau permanent, mis à jour en direct — visible dès qu'il y a
// quelque chose à récapituler (à partir du formulaire), pas à l'étape
// Type où rien n'est encore rempli.
function PanneauRecap({ type, sigle, nom, secteur, localite, modules }) {
  const nbModules = Object.values(modules).filter(Boolean).length;
  const typeLabel = TYPES_ORGANISATION.find((t) => t.id === type)?.label;

  return (
    <aside className="io-panneau">
      <div className="io-panneau-titre">Récapitulatif</div>
      <div className="io-panneau-ligne">
        <Building2 size={14} /><strong>{typeLabel || "—"}</strong>
      </div>
      {sigle && <div className="io-panneau-ligne"><span className="io-panneau-lbl">Sigle</span><strong>{sigle}</strong></div>}
      {nom && <div className="io-panneau-ligne"><span className="io-panneau-lbl">Nom</span><strong>{nom}</strong></div>}
      {secteur && <div className="io-panneau-ligne"><span className="io-panneau-lbl">Secteur</span><strong>{secteur}</strong></div>}
      {localite && <div className="io-panneau-ligne"><span className="io-panneau-lbl">Localité</span><strong>{localite}</strong></div>}
      <div className="io-panneau-sep" />
      <div className="io-panneau-ligne">
        <span className="io-panneau-lbl">Modules sélectionnés</span><strong>{nbModules}</strong>
      </div>
    </aside>
  );
}

// Panneau de marque permanent — même traitement que LoginScreen.jsx
// (dégradé sombre, argumentaire, icônes), pour que ce parcours ne soit
// plus le seul écran resté au style plus sobre du reste de l'application.
// Une seule <style>{CSS}</style>, hissée ici plutôt que répétée à
// chacun des six écrans du parcours.
function PageInscription({ children }) {
  return (
    <div className="io-shell-duo">
      <style>{CSS}</style>

      <aside className="io-marque">
        <div className="io-marque-glow io-marque-glow-1" />
        <div className="io-marque-glow io-marque-glow-2" />

        <div className="io-marque-contenu">
          <div className="io-marque-mark">
            <div className="io-marque-logo"><Building2 size={20} /></div>
            <span className="io-marque-nom">Baamo</span>
          </div>

          <h1 className="io-marque-titre">
            Votre organisation,<br />prête en quelques minutes.
          </h1>
          <p className="io-marque-sous">
            Cotisations, membres et activités : tout ce que vous gérez
            aujourd'hui à la main, réuni au même endroit.
          </p>

          <ul className="io-marque-atouts">
            <li>
              <span className="io-marque-icone"><ShieldCheck size={16} /></span>
              Chaque organisation isolée et sécurisée
            </li>
            <li>
              <span className="io-marque-icone"><Sliders size={16} /></span>
              Un espace déjà adapté à votre type d'organisation
            </li>
            <li>
              <span className="io-marque-icone"><CheckCircle2 size={16} /></span>
              2 mois d'essai complet, sans engagement
            </li>
          </ul>
        </div>
      </aside>

      <main className="io-contenu">
        {children}
      </main>
    </div>
  );
}

/**
 * Inscription d'une nouvelle organisation.
 *
 * Deux temps : le compte de la personne se crée d'abord (signUp), puis une
 * fonction serveur crée l'organisation, son paramétrage et le rattachement
 * en une seule transaction — voir creer_organisation en base.
 *
 * Si la création du compte réussit mais que celle de l'organisation
 * échoue (sigle déjà pris, par exemple), la personne garde sa session :
 * on lui redemande seulement un sigle, sans repasser par le mot de passe.
 */
export default function InscriptionOrganisationScreen({ onBack }) {
  // Le choix du type vient en premier : il détermine le vocabulaire et les
  // modules de toute l'organisation, et donne au formulaire suivant des
  // libellés déjà adaptés (« Sigle de l'association », etc.).
  const [etape, setEtape] = useState("type"); // type | formulaire | modules | recapitulatif | sigle_seul | succes

  const [type, setType] = useState(null);
  const [nom, setNom] = useState("");
  const [sigle, setSigle] = useState("");
  const [secteur, setSecteur] = useState("");
  const [localite, setLocalite] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [modules, setModules] = useState({});

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  // Dès le type choisi, on récupère les vrais défauts depuis la même
  // fonction que la création utilisera — jamais une copie de cette
  // logique réécrite ici, qui finirait par diverger du serveur.
  useEffect(() => {
    if (!type) return;
    supabase.rpc("modules_par_defaut", { p_type: type }).then(({ data }) => {
      if (data) setModules(data);
    });
  }, [type]);

  // Le champ Contact accepte un numéro OU une adresse e-mail : on ne peut
  // pas filtrer les caractères non numériques sans casser la saisie d'un
  // e-mail. Tant que la saisie ne contient que des chiffres (un numéro en
  // cours de frappe), on la limite à 10 — la longueur d'un numéro ivoirien.
  // Dès qu'une lettre ou un @ apparaît, la limite ne s'applique plus.
  function onChangerContact(v) {
    const estUniquementChiffres = /^\d*$/.test(v);
    setContact(estUniquementChiffres ? v.slice(0, 10) : v);
  }

  function validerFormulaire() {
    if (!nom.trim()) return "Indiquez la dénomination complète de l'organisation.";
    if (!sigle.trim()) return "Indiquez un sigle.";
    if (sigle.trim().length > 20) return "Le sigle doit rester court : 20 caractères au maximum.";
    if (!email.trim()) return "Indiquez une adresse e-mail.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return "Adresse e-mail invalide.";
    if (motDePasse.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
    if (motDePasse !== confirmation) return "Les deux mots de passe ne correspondent pas.";
    return null;
  }

  async function creerOrganisation() {
    const { data, error } = await supabase.rpc("creer_organisation", {
      p_nom: nom,
      p_sigle: sigle,
      p_secteur: secteur || null,
      p_localite: localite || null,
      p_contact: contact || null,
      p_type: type || "mutuelle",
      p_modules: modules,
    });

    if (error) {
      // Le compte existe déjà, mais pas encore d'organisation : on ne
      // redemande que le sigle, la session reste acquise.
      setErreur(error.message);
      setEtape("sigle_seul");
      return;
    }

    // Notification au représentant — indépendante du système d'e-mails
    // d'authentification (voir notifier-inscription). Ne bloque jamais la
    // suite : un échec d'envoi ne doit pas empêcher l'inscription elle-même,
    // qui a déjà réussi à ce stade.
    supabase.functions.invoke("notifier-inscription", {
      body: { nom: nom.trim(), sigle: sigle.trim(), email: email.trim().toLowerCase() },
    }).catch((e) => console.error("[InscriptionOrganisationScreen] notifier-inscription a échoué :", e));

    // Notification push à l'exploitant, si un appareil est abonné — voir
    // push_abonnements_exploitant. Même logique de non-blocage : un échec
    // ici ne doit jamais remettre en cause une inscription déjà réussie.
    supabase.functions.invoke("envoyer-push-exploitant", {
      body: { organisation_id: data.organisation_id },
    }).catch((e) => console.error("[InscriptionOrganisationScreen] envoyer-push-exploitant a échoué :", e));

    // Drapeau explicite plutôt qu'un pari sur la vitesse de résolution de
    // l'organisation : Shell() (App.jsx) le lit pour ne jamais proposer la
    // configuration du PIN à un compte qui vient tout juste de s'inscrire,
    // quelle que soit la rapidité de useParametrage à ce moment précis.
    // Retiré par Shell() lui-même dès que l'état de l'organisation est connu.
    sessionStorage.setItem("post_inscription_org", "1");

    // Point corrigé : useParametrage() avait déjà résolu "aucune organisation"
    // juste après signUp() (avant que creer_organisation() n'ait fini), et
    // gardait ce résultat en cache indéfiniment — rien ne le rafraîchissait
    // ensuite, d'où le blocage prolongé sur "Chargement…" observé plus tôt.
    //
    // Point à ne pas répéter : rafraîchir AVANT setEtape("succes") réglait
    // ce blocage, mais faisait basculer Shell() (App.jsx) vers son propre
    // écran si vite que celui-ci n'avait jamais l'occasion de s'afficher à
    // l'écran — la personne ne voyait alors jamais "Félicitations". L'ordre
    // compte : l'écran de succès s'affiche d'abord, le rafraîchissement est
    // différé de façon à lui laisser le temps d'être réellement peint.
    setEtape("succes");
    setTimeout(() => { rafraichirIdentite(); }, 1200);
    // Délai allongé (5s) pour laisser le temps de lire le rappel des
    // conditions tarifaires affiché sur cet écran, et pour rester après
    // la bascule de Shell() vers "Espace non actif" une fois l'identité
    // rafraîchie ci-dessus — au cas où la personne reviendrait sur cet
    // onglet avant que ce changement de page n'ait eu lieu.
    setTimeout(() => window.location.reload(), 5000);
  }

  function passerAuxModules(e) {
    e.preventDefault();
    const probleme = validerFormulaire();
    if (probleme) { setErreur(probleme); return; }
    setErreur("");
    setEtape("modules");
  }

  async function soumettre(e) {
    e?.preventDefault();

    setEnvoi(true);
    setErreur("");

    // Posé ICI, avant tout appel à Supabase — pas après creerOrganisation()
    // comme précédemment. signUp() ouvre la session presque instantanément,
    // et Shell() peut y réagir avant même que le code n'atteigne la ligne
    // suivante : pour que le drapeau serve à quelque chose, il doit exister
    // avant la moindre chance qu'une session apparaisse.
    sessionStorage.setItem("post_inscription_org", "1");

    const courriel = email.trim().toLowerCase();

    const { error: erreurCompte } = await supabase.auth.signUp({
      email: courriel,
      password: motDePasse,
    });

    if (erreurCompte) {
      const dejaInscrit = /already registered|already exists/i.test(erreurCompte.message);

      if (!dejaInscrit) {
        setEnvoi(false);
        setErreur(traduireErreurCompte(erreurCompte.message));
        return;
      }

      // Tous les comptes de la plateforme partagent la même base : cette
      // adresse appartient sans doute déjà à quelqu'un qui administre ou
      // est membre d'une autre organisation. Plutôt que de bloquer, on tente
      // de se connecter avec le mot de passe saisi — la même personne
      // peut ainsi rattacher une seconde organisation à son compte.
      const { error: erreurConnexion } = await supabase.auth.signInWithPassword({
        email: courriel,
        password: motDePasse,
      });

      if (erreurConnexion) {
        setEnvoi(false);
        setErreur(
          "Un compte existe déjà avec cette adresse, et ce mot de passe ne " +
          "correspond pas à ce compte. Connectez-vous d'abord avec votre " +
          "mot de passe habituel, puis revenez créer l'espace de votre " +
          "nouvelle organisation."
        );
        return;
      }
    }

    await creerOrganisation();
    setEnvoi(false);
  }

  async function reessayerAvecAutreSigle(e) {
    e.preventDefault();
    if (!sigle.trim()) { setErreur("Indiquez un sigle."); return; }
    if (sigle.trim().length > 20) { setErreur("Le sigle doit rester court : 20 caractères au maximum."); return; }

    // Toujours reposé ici aussi, par précaution : la session existe déjà
    // à ce stade (compte créé lors du premier essai), donc le risque est
    // moindre, mais rien ne coûte à s'assurer que le drapeau est bien là.
    sessionStorage.setItem("post_inscription_org", "1");

    setEnvoi(true);
    setErreur("");
    await creerOrganisation();
    setEnvoi(false);
  }

  /* ---------------- Choix du type ---------------- */
  if (etape === "type") {
    return (
      <PageInscription>
        <div className="io-page">
          <BarreEtapes etapeActuelle="type" />
          <div className="io-carte io-carte-large">
            {onBack && (
              <button className="io-retour" onClick={onBack}>
                <ArrowLeft size={15} /> Retour
              </button>
            )}

            <div className="io-icone"><Building2 size={26} /></div>
            <h1 className="io-titre">Quel type d'organisation ?</h1>
            <p className="io-sous">
              Ce choix adapte le vocabulaire et les fonctions proposées.
              Il reste modifiable plus tard depuis les paramètres.
            </p>

            <div className="io-types">
              {TYPES_ORGANISATION.map((t) => {
                const IconeType = ICONES_TYPE[t.id] || Building2;
                return (
                  <button
                    key={t.id}
                    className={`io-type ${type === t.id ? "is-on" : ""}`}
                    onClick={() => setType(t.id)}
                  >
                    {type === t.id && (
                      <span className="io-type-coche"><CheckCircle2 size={15} /></span>
                    )}
                    <span className="io-type-icone"><IconeType size={19} /></span>
                    <span className="io-type-nom">{t.label}</span>
                    <span className="io-type-desc">{t.description}</span>
                  </button>
                );
              })}
            </div>

            <button
              className="io-btn"
              onClick={() => setEtape("formulaire")}
              disabled={!type}
            >
              Continuer <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </PageInscription>
    );
  }

  if (etape === "succes") {
    return (
      <PageInscription>
        <div className="io-carte io-carte-centree">
          <div className="io-icone io-icone-ok"><CheckCircle2 size={30} /></div>
          <h1 className="io-titre">Demande envoyée</h1>
          <p className="io-sous">
            Votre demande d'inscription pour {nom} a bien été enregistrée.
            Notre équipe la valide sous peu et vous préviendra dès que
            votre espace sera actif.
          </p>
          <div className="io-rappel-tarif io-rappel-succes">
            <ShieldCheck size={16} />
            <p>
              Dès l'activation : 2 mois d'essai gratuit et complet. La
              facturation (forfait + variable, et frais de mise en service
              éventuels) ne commence qu'à l'issue de cet essai.
            </p>
          </div>
          <div className="io-barre"><span /></div>
        </div>
      </PageInscription>
    );
  }

  if (etape === "sigle_seul") {
    return (
      <PageInscription>
        <div className="io-carte">
          <div className="io-icone"><Building2 size={26} /></div>
          <h1 className="io-titre">Un autre sigle</h1>
          <p className="io-sous">
            Votre compte est créé. Il ne manque qu'un sigle disponible pour
            ouvrir l'espace de votre organisation.
          </p>

          <form onSubmit={reessayerAvecAutreSigle} className="io-form">
            <Champ label="Sigle" value={sigle} onChange={setSigle}
              placeholder="Ex : MUGEFCI" maxLength={20} />

            {erreur && (
              <div className="io-erreur"><AlertCircle size={16} /> {erreur}</div>
            )}

            <button type="submit" className="io-btn" disabled={envoi}>
              {envoi
                ? <><Loader2 size={17} className="io-spin" /> Création…</>
                : <>Créer l'espace <ArrowRight size={17} /></>}
            </button>
          </form>
        </div>
      </PageInscription>
    );
  }

  /* ---------------- Modules recommandés ---------------- */
  if (etape === "modules") {
    const recommandes = Object.entries(LABELS_MODULES).filter(([cle]) => modules[cle]);
    const optionnels = Object.entries(LABELS_MODULES).filter(([cle]) => !modules[cle]);

    return (
      <PageInscription>
        <div className="io-page">
          <BarreEtapes etapeActuelle="modules" />
          <div className="io-layout-duo">
            <div className="io-carte io-carte-large">
              <button className="io-retour" onClick={() => setEtape("formulaire")}>
                <ArrowLeft size={15} /> Retour
              </button>

              <div className="io-icone"><Sliders size={26} /></div>
              <h1 className="io-titre">Quels modules activer ?</h1>
              <p className="io-sous">
                Une sélection déjà adaptée à {motPourType(type, "organisation_votre")}.
                Ajustez si besoin — rien n'est figé, tout reste modifiable depuis
                les paramètres une fois l'espace créé.
              </p>

              <div className="io-modules-groupe">
                <div className="io-modules-titre">
                  <span className="io-point io-point-essentiel" /> Essentiels — toujours inclus
                </div>
                <div className="io-modules-liste">
                  {socleParType(type).map((libelle) => (
                    <div key={libelle} className="io-module io-module-fixe">
                      <span>{libelle}</span>
                      <CheckCircle2 size={16} />
                    </div>
                  ))}
                </div>
              </div>

              {recommandes.length > 0 && (
                <div className="io-modules-groupe">
                  <div className="io-modules-titre">
                    <span className="io-point io-point-recommande" /> Recommandés pour {motPourType(type, "organisation_votre")}
                  </div>
                  <div className="io-modules-liste">
                    {recommandes.map(([cle, libelle]) => (
                      <label key={cle} className={`io-module ${modules[cle] ? "is-on" : ""}`}>
                        <span>{libelle}</span>
                        <span className="io-bascule-wrap">
                          <input
                            type="checkbox"
                            checked={Boolean(modules[cle])}
                            onChange={() => setModules((m) => ({ ...m, [cle]: !m[cle] }))}
                          />
                          <span className="io-bascule" />
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="io-modules-groupe">
                <div className="io-modules-titre">
                  <span className="io-point io-point-optionnel" /> Autres modules disponibles
                </div>
                <div className="io-modules-liste">
                  {optionnels.map(([cle, libelle]) => (
                    <label key={cle} className={`io-module ${modules[cle] ? "is-on" : ""}`}>
                      <span>{libelle}</span>
                      <span className="io-bascule-wrap">
                        <input
                          type="checkbox"
                          checked={Boolean(modules[cle])}
                          onChange={() => setModules((m) => ({ ...m, [cle]: !m[cle] }))}
                        />
                        <span className="io-bascule" />
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button className="io-btn" onClick={() => setEtape("recapitulatif")}>
                Continuer <ArrowRight size={17} />
              </button>
            </div>

            <PanneauRecap type={type} sigle={sigle} nom={nom} secteur={secteur} localite={localite} modules={modules} />
          </div>
        </div>
      </PageInscription>
    );
  }

  /* ---------------- Récapitulatif ---------------- */
  if (etape === "recapitulatif") {
    const modulesActifs = Object.entries(LABELS_MODULES).filter(([cle]) => modules[cle]);

    return (
      <PageInscription>
        <div className="io-page">
          <BarreEtapes etapeActuelle="recapitulatif" />
          <div className="io-layout-duo">
            <div className="io-carte io-carte-large">
              <button className="io-retour" onClick={() => setEtape("modules")}>
                <ArrowLeft size={15} /> Retour
              </button>

              <div className="io-icone"><ShieldCheck size={26} /></div>
              <h1 className="io-titre">Vérifiez avant de créer votre espace</h1>

              <div className="io-recap">
                <div className="io-recap-ligne">
                  <span>Type</span>
                  <strong>{TYPES_ORGANISATION.find((t) => t.id === type)?.label}</strong>
                </div>
                <div className="io-recap-ligne"><span>Sigle</span><strong>{sigle}</strong></div>
                <div className="io-recap-ligne"><span>Dénomination</span><strong>{nom}</strong></div>
                {secteur && <div className="io-recap-ligne"><span>Secteur</span><strong>{secteur}</strong></div>}
                {localite && <div className="io-recap-ligne"><span>Localité</span><strong>{localite}</strong></div>}
                {contact && <div className="io-recap-ligne"><span>Contact</span><strong>{contact}</strong></div>}
                <div className="io-recap-ligne"><span>Votre e-mail</span><strong>{email}</strong></div>
              </div>

              <div className="io-section-titre io-section-suite">Modules activés</div>
              {modulesActifs.length === 0 ? (
                <p className="io-sous" style={{ margin: 0 }}>
                  Aucun module optionnel — seul le socle commun.
                </p>
              ) : (
                <ul className="io-recap-modules">
                  {modulesActifs.map(([cle, libelle]) => <li key={cle}>{libelle}</li>)}
                </ul>
              )}

              <div className="io-rappel-tarif">
                <ShieldCheck size={16} />
                <p>
                  <strong>2 mois d'essai gratuit</strong>, accès complet, sans paiement.
                  À l'issue de l'essai : forfait + composante variable selon votre
                  activité, et d'éventuels frais de mise en service (facturés une
                  seule fois). Votre demande doit d'abord être validée par notre
                  équipe avant toute activation.
                </p>
              </div>

              {erreur && (
                <div className="io-erreur"><AlertCircle size={16} /> {erreur}</div>
              )}

              <button className="io-btn" onClick={soumettre} disabled={envoi}>
                {envoi
                  ? <><Loader2 size={17} className="io-spin" /> Création…</>
                  : <>Confirmer et créer mon espace <ArrowRight size={17} /></>}
              </button>

              <p className="io-legal">
                Vous devenez administrateur de cette organisation. Vous pourrez ensuite
                régler ses cotisations, son barème d'aides et les fonctions
                activées depuis les paramètres.
              </p>
            </div>

            <PanneauRecap type={type} sigle={sigle} nom={nom} secteur={secteur} localite={localite} modules={modules} />
          </div>
        </div>
      </PageInscription>
    );
  }

  return (
    <PageInscription>
      <div className="io-page">
        <BarreEtapes etapeActuelle="formulaire" />
        <div className="io-layout-duo">
          <div className="io-carte">
            <button className="io-retour" onClick={() => setEtape("type")}>
              <ArrowLeft size={15} /> Changer de type
            </button>

            <div className="io-icone"><Building2 size={26} /></div>
            <h1 className="io-titre">
              Ouvrir l'espace de {motPourType(type, "organisation_votre")}
            </h1>
            <p className="io-sous">
              Créez l'espace de votre organisation et votre propre accès administrateur.
            </p>

            <form onSubmit={passerAuxModules} className="io-form">
              <div className="io-section-titre">
                {motPourType(type, "organisation").toUpperCase()}
              </div>

              <Champ label="Sigle" value={sigle} onChange={setSigle}
                placeholder="Ex : MUGEFCI" maxLength={20}
                aide={`Nom court, affiché aux membres. Sert aussi d'adresse propre à ${motPourType(type, "organisation_votre")}.`} />

              <Champ label="Dénomination complète" value={nom} onChange={setNom}
                placeholder={`Ex : ${EXEMPLES_DENOMINATION[type] || EXEMPLES_DENOMINATION.autre}...`} />

              <div className="io-duo">
                <Champ label="Secteur d'activité de l'organisation" value={secteur} onChange={setSecteur}
                  placeholder="Ex : Santé, Agriculture, Éducation…" Icon={Briefcase}
                  aide="Le domaine où intervient l'organisation — pas votre métier à vous. Facultatif." />
                <Champ label="Localité" value={localite} onChange={setLocalite}
                  placeholder="Ex : Abidjan" Icon={MapPin} />
              </div>

              <Champ label="Contact" value={contact} onChange={onChangerContact}
                placeholder="Téléphone ou e-mail du Bureau"
                aide="Facultatif — affiché aux membres en cas de besoin. Un numéro de téléphone est limité à 10 chiffres." />

              <div className="io-section-titre io-section-suite">Votre accès</div>

              <Champ label="Votre adresse e-mail" value={email} onChange={setEmail}
                type="email" Icon={Mail} placeholder="vous@exemple.com" />

              <div className="io-duo">
                <Champ label="Mot de passe" value={motDePasse} onChange={setMotDePasse}
                  type="password" Icon={Lock} placeholder="••••••••" />
                <Champ label="Confirmer" value={confirmation} onChange={setConfirmation}
                  type="password" Icon={Lock} placeholder="••••••••" />
              </div>

              {erreur && (
                <div className="io-erreur"><AlertCircle size={16} /> {erreur}</div>
              )}

              <button type="submit" className="io-btn">
                Continuer <ArrowRight size={17} />
              </button>
            </form>
          </div>

          <PanneauRecap type={type} sigle={sigle} nom={nom} secteur={secteur} localite={localite} modules={modules} />
        </div>
      </div>
    </PageInscription>
  );
}

/* ---------------- Sous-composants ---------------- */

function Champ({ label, value, onChange, placeholder, type = "text", Icon, maxLength, aide }) {
  return (
    <div className="io-champ">
      <label className="io-label">{label}</label>
      <div className="io-input-wrap">
        {Icon && <Icon size={16} className="io-input-icon" />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`io-input ${Icon ? "io-input-avec-icone" : ""}`}
        />
      </div>
      {aide && <span className="io-aide">{aide}</span>}
    </div>
  );
}

/* ---------------- Utilitaires ---------------- */

function traduireErreurCompte(message = "") {
  if (message.includes("already registered") || message.includes("already exists"))
    return "Un compte existe déjà avec cette adresse e-mail. Connectez-vous plutôt.";
  if (message.includes("Password"))
    return "Le mot de passe est trop simple. Choisissez-en un de 8 caractères au moins.";
  return message;
}

/* ---------------- Styles ---------------- */

const CSS = `
.io-shell-duo{
  min-height:100vh; display:grid; grid-template-columns:1fr;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (min-width:960px){ .io-shell-duo{ grid-template-columns:0.8fr 1.2fr; } }

/* ---- Panneau de marque ---- */
.io-marque{
  display:flex; flex-direction:column; justify-content:center;
  position:relative; overflow:hidden;
  background:linear-gradient(150deg, ${PALETTE.blue900} 0%, ${PALETTE.blue800} 55%, ${PALETTE.blue600} 130%);
  color:#fff; padding:${S.xl}px ${S.lg}px;
}
@media (min-width:960px){ .io-marque{ align-items:center; padding:${S.xxxl}px; } }
.io-marque-glow{ position:absolute; border-radius:50%; filter:blur(4px); }
.io-marque-glow-1{ width:280px; height:280px; right:-90px; top:-90px; background:rgba(255,255,255,.06); }
.io-marque-glow-2{ width:200px; height:200px; left:-70px; bottom:-60px; background:rgba(255,255,255,.05); }
@media (min-width:960px){
  .io-marque-glow-1{ width:420px; height:420px; right:-140px; top:-120px; }
  .io-marque-glow-2{ width:300px; height:300px; left:-100px; bottom:-90px; }
}
.io-marque-contenu{ position:relative; z-index:1; max-width:400px; margin:0 auto; width:100%; }
.io-marque-mark{ display:flex; align-items:center; gap:10px; margin-bottom:${S.lg}px; }
@media (min-width:960px){ .io-marque-mark{ margin-bottom:${S.xxxl}px; } }
.io-marque-logo{
  width:36px; height:36px; border-radius:${R.md}px; flex-shrink:0;
  background:rgba(255,255,255,.14); display:flex; align-items:center; justify-content:center;
}
.io-marque-nom{ font-size:16px; font-weight:700; letter-spacing:.02em; }
.io-marque-titre{ font-size:22px; font-weight:700; line-height:1.25; letter-spacing:-.02em; margin:0 0 ${S.sm}px; }
@media (min-width:960px){ .io-marque-titre{ font-size:34px; margin-bottom:${S.lg}px; } }
.io-marque-sous{ font-size:13.5px; line-height:1.55; opacity:.85; margin:0 0 ${S.lg}px; max-width:36ch; }
@media (min-width:960px){ .io-marque-sous{ font-size:15.5px; margin-bottom:${S.xxxl}px; } }
.io-marque-atouts{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:${S.sm}px; }
@media (min-width:960px){ .io-marque-atouts{ gap:${S.md}px; } }
.io-marque-atouts li{ display:flex; align-items:center; gap:${S.sm}px; font-size:12.5px; opacity:.92; }
@media (min-width:960px){ .io-marque-atouts li{ font-size:14px; } }
.io-marque-icone{
  width:28px; height:28px; border-radius:${R.sm}px; flex-shrink:0;
  background:rgba(255,255,255,.12); display:flex; align-items:center; justify-content:center;
}

.io-contenu{
  min-height:100%; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(160deg, ${PALETTE.blue50} 0%, ${C.bg} 55%);
  padding:${S.xl}px;
}

.io-carte{
  width:100%; max-width:460px; background:${C.surface};
  border:1px solid ${C.border}; border-radius:${R.xxl}px;
  padding:${S.xxl}px ${S.xl}px; box-shadow:${SHADOW.md};
  animation:ioIn .3s ease; position:relative; overflow:hidden;
}
.io-carte::before{
  content:""; position:absolute; top:0; left:0; right:0; height:4px;
  background:linear-gradient(90deg, ${C.primary}, ${PALETTE.blue600});
}
.io-carte-centree{ text-align:center; }
.io-carte-large{ max-width:620px; }

.io-page{ width:100%; max-width:920px; display:flex; flex-direction:column; align-items:center; gap:${S.lg}px; }
.io-layout-duo{ width:100%; display:grid; grid-template-columns:1fr 300px; gap:${S.lg}px; align-items:start; }
@media (max-width:820px){ .io-layout-duo{ grid-template-columns:1fr; } }
.io-layout-duo .io-carte{ max-width:none; width:100%; }

/* ---- Barre d'étapes ---- */
.io-etapes{ display:flex; align-items:center; width:100%; }
.io-etape{ display:flex; align-items:center; gap:8px; flex-shrink:0; }
.io-etape-rond{
  width:26px; height:26px; border-radius:50%; flex-shrink:0;
  background:${PALETTE.grey200}; color:${C.textSubtle};
  display:flex; align-items:center; justify-content:center;
  font-size:12px; font-weight:700; transition:all .18s ease;
}
.io-etape-label{ font-size:12.5px; font-weight:600; color:${C.textSubtle}; white-space:nowrap; }
.io-etape.is-actuel .io-etape-rond{ background:${C.primary}; color:#fff; }
.io-etape.is-actuel .io-etape-label{ color:${C.text}; }
.io-etape.is-fait .io-etape-rond{ background:${C.success}; color:#fff; }
.io-etape.is-fait .io-etape-label{ color:${C.textMuted}; }
.io-etape-trait{ flex:1; height:2px; background:${PALETTE.grey200}; margin:0 8px; min-width:16px; }
@media (max-width:560px){ .io-etape-label{ display:none; } }

/* ---- Panneau récapitulatif permanent ---- */
.io-panneau{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:${S.lg}px; box-shadow:${SHADOW.xs}; position:sticky; top:${S.xl}px;
}
.io-panneau-titre{
  font-size:12px; font-weight:700; text-transform:uppercase;
  letter-spacing:.06em; color:${C.textSubtle}; margin-bottom:${S.md}px;
}
.io-panneau-ligne{
  display:flex; align-items:center; justify-content:space-between; gap:8px;
  padding:7px 0; font-size:13px; border-bottom:1px solid ${C.border};
}
.io-panneau-ligne:first-of-type{ justify-content:flex-start; color:${C.primary}; font-weight:700; }
.io-panneau-ligne:last-child{ border-bottom:none; }
.io-panneau-lbl{ color:${C.textSubtle}; }
.io-panneau-ligne strong{ color:${C.text}; text-align:right; }
.io-panneau-sep{ height:1px; background:${C.border}; margin:${S.sm}px 0; }
@media (max-width:820px){ .io-panneau{ position:static; } }

/* ---- Cartes de modules (étape Modules) ---- */
.io-modules-groupe{ margin-bottom:${S.lg}px; }
.io-modules-titre{
  display:flex; align-items:center; gap:7px; font-size:12.5px; font-weight:700;
  color:${C.textMuted}; margin-bottom:${S.sm}px; text-transform:uppercase; letter-spacing:.04em;
}
.io-point{ width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.io-point-essentiel{ background:${C.success}; }
.io-point-recommande{ background:${C.primary}; }
.io-point-optionnel{ background:${PALETTE.grey300}; }
.io-modules-liste{ display:flex; flex-direction:column; gap:6px; }
.io-module{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:10px 14px; background:${C.bg}; border:1px solid ${C.border};
  border-left:3px solid ${PALETTE.grey300};
  border-radius:${R.md}px; font-size:13.5px; font-weight:600; color:${C.text};
  cursor:pointer; transition:border-color .15s ease, background .15s ease;
}
.io-module.is-on{ border-left-color:${C.primary}; background:${PALETTE.blue50}; }
.io-module-fixe{ cursor:default; color:${C.textMuted}; border-left-color:${C.success}; }
.io-module-fixe svg{ color:${C.success}; flex-shrink:0; }

.io-bascule-wrap{ position:relative; width:38px; height:22px; flex-shrink:0; }
.io-bascule-wrap input{ position:absolute; inset:0; opacity:0; cursor:pointer; margin:0; z-index:1; }
.io-bascule{
  position:absolute; inset:0; background:${PALETTE.grey300}; border-radius:999px;
  transition:background .18s ease; pointer-events:none;
}
.io-bascule::after{
  content:""; position:absolute; top:2px; left:2px; width:18px; height:18px;
  background:#fff; border-radius:50%; transition:transform .18s ease;
  box-shadow:0 1px 3px rgba(0,0,0,.25);
}
.io-bascule-wrap input:checked + .io-bascule{ background:${C.primary}; }
.io-bascule-wrap input:checked + .io-bascule::after{ transform:translateX(16px); }

/* ---- Choix du type d'organisation ---- */
.io-types{
  display:grid; grid-template-columns:1fr 1fr; gap:${S.md}px;
  margin-bottom:${S.xl}px;
}
@media (max-width:520px){ .io-types{ grid-template-columns:1fr; } }
.io-type{
  display:flex; flex-direction:column; gap:4px; text-align:left; position:relative;
  padding:${S.md}px ${S.lg}px; cursor:pointer;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.lg}px; font-family:inherit;
  transition:border-color .15s ease, background .15s ease, box-shadow .15s ease, transform .15s ease;
}
.io-type:hover{ border-color:${PALETTE.grey300}; background:${C.bg}; transform:translateY(-1px); box-shadow:${SHADOW.sm}; }
.io-type.is-on{
  border-color:${C.primary}; background:${PALETTE.blue50};
  box-shadow:${SHADOW.focus};
}
.io-type-icone{
  width:36px; height:36px; border-radius:${R.md}px; margin-bottom:6px;
  background:${PALETTE.blue100}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.io-type.is-on .io-type-icone{ background:${C.primary}; color:#fff; }
.io-type-coche{
  position:absolute; top:12px; right:12px; color:${C.primary}; display:flex;
}
.io-type-nom{ font-size:14.5px; font-weight:600; color:${C.text}; }
.io-type-desc{ font-size:12px; color:${C.textSubtle}; line-height:1.45; }

.io-retour{
  display:flex; align-items:center; gap:6px;
  background:none; border:none; padding:0; margin-bottom:${S.lg}px;
  cursor:pointer; font-family:inherit; font-size:14px;
  font-weight:600; color:${C.primary};
}
.io-retour:hover{ text-decoration:underline; }

.io-icone{
  width:56px; height:56px; border-radius:16px; margin:0 auto ${S.lg}px;
  background:${PALETTE.blue100}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 6px 16px -6px ${C.primary}55;
}
.io-icone-ok{ background:#DCFCE7; color:${C.success}; box-shadow:0 6px 16px -6px ${C.success}55; }

.io-titre{ font-size:21px; font-weight:700; letter-spacing:-.02em; margin:0; }
.io-sous{
  font-size:14px; color:${C.textSubtle}; line-height:1.6;
  margin:${S.sm}px 0 ${S.xl}px; max-width:36ch;
}
.io-carte:not(.io-carte-centree) .io-titre{ text-align:left; }
.io-carte:not(.io-carte-centree) .io-sous{ text-align:left; margin-left:0; }

.io-form{ display:flex; flex-direction:column; gap:${S.md}px; text-align:left; }
.io-section-titre{
  font-size:11.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
  color:${C.textSubtle}; margin:0 0 -4px;
}
.io-section-suite{ margin-top:${S.sm}px; padding-top:${S.md}px; border-top:1px solid ${C.border}; }

.io-duo{ display:grid; gap:${S.md}px; grid-template-columns:1fr 1fr; }
@media (max-width:420px){ .io-duo{ grid-template-columns:1fr; } }

.io-champ{ display:flex; flex-direction:column; gap:6px; }
.io-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.io-input-wrap{ position:relative; display:flex; align-items:center; }
.io-input-icon{
  position:absolute; left:9px; width:24px; height:24px; border-radius:50%;
  background:${PALETTE.blue50}; color:${C.primary};
  display:flex; align-items:center; justify-content:center; pointer-events:none;
}
.io-input{
  width:100%; box-sizing:border-box; padding:12px 14px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; color:${C.text};
  font-family:inherit; font-size:14.5px; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.io-input-avec-icone{ padding-left:46px; }
.io-input::placeholder{ color:${PALETTE.grey300}; }
.io-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.io-aide{ font-size:12px; color:${C.textSubtle}; line-height:1.5; }

.io-erreur{
  display:flex; align-items:flex-start; gap:9px; text-align:left;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:12px 14px; font-size:13.5px; line-height:1.5;
  animation:ioIn .2s ease;
}

.io-btn{
  display:flex; align-items:center; justify-content:center; gap:9px;
  width:100%; background:linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%);
  color:#fff; border:none;
  border-radius:${R.md}px; padding:15px 0; cursor:pointer;
  font-family:inherit; font-size:15px; font-weight:600;
  box-shadow:0 4px 14px -4px ${C.primary}88; margin-top:4px;
  transition:transform .15s ease, box-shadow .15s ease, opacity .15s ease;
}
.io-btn:hover:not(:disabled){ transform:translateY(-1px); box-shadow:0 6px 18px -4px ${C.primary}aa; }
.io-btn:disabled{ opacity:.6; cursor:not-allowed; }

.io-legal{
  font-size:12px; color:${C.textSubtle}; line-height:1.55;
  text-align:center; margin:${S.sm}px 0 0;
}

.io-rappel-tarif{
  display:flex; align-items:flex-start; gap:10px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:13px 15px; color:${C.primary};
}
.io-rappel-tarif p{ margin:0; font-size:12.5px; line-height:1.55; color:${C.textMuted}; }
.io-rappel-tarif strong{ color:${C.text}; }

.io-modules{
  display:grid; grid-template-columns:1fr 1fr; gap:${S.sm}px;
  margin-bottom:${S.lg}px;
}
@media (max-width:520px){ .io-modules{ grid-template-columns:1fr; } }
.io-module{
  display:flex; align-items:center; gap:10px; text-align:left;
  padding:11px 14px; cursor:pointer;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; font-size:13.5px; font-weight:600; color:${C.textMuted};
  transition:border-color .15s ease, background .15s ease, color .15s ease;
}
.io-module:hover{ border-color:${PALETTE.grey300}; }
.io-module.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; color:${C.text}; }
.io-module input{ accent-color:${C.primary}; width:16px; height:16px; flex-shrink:0; }

.io-recap{
  background:${C.bg}; border:1px solid ${C.border}; border-radius:${R.lg}px;
  padding:${S.md}px ${S.lg}px; margin-bottom:${S.md}px;
}
.io-recap-ligne{
  display:flex; justify-content:space-between; gap:${S.md}px;
  padding:6px 0; font-size:13.5px; border-bottom:1px solid ${C.border};
}
.io-recap-ligne:last-child{ border-bottom:none; }
.io-recap-ligne span{ color:${C.textSubtle}; }
.io-recap-ligne strong{ color:${C.text}; text-align:right; }
.io-recap-modules{
  margin:0 0 ${S.md}px; padding-left:20px; font-size:13.5px;
  color:${C.textMuted}; line-height:1.9;
}

.io-barre{
  height:4px; border-radius:4px; background:${PALETTE.grey200};
  overflow:hidden; margin-top:${S.lg}px;
}
.io-barre span{
  display:block; height:100%; border-radius:4px;
  background:${C.success}; animation:ioProgres 5s linear forwards;
}

.io-spin{ animation:ioSpin 1s linear infinite; }
@keyframes ioSpin{ to{ transform:rotate(360deg); } }
@keyframes ioIn{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:none; } }
@keyframes ioProgres{ from{ width:0; } to{ width:100%; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;