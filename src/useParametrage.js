import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/* ============================================================
   Socle et modules

   Le socle est présent dans toute organisation : membres, cotisations,
   aides, comptabilité, communication, agenda, carte de membre, rapports
   et journal d'activité.

   Les modules ci-dessous s'activent au cas par cas. Une mutuelle
   d'enseignants n'a que faire d'une tombola ; une association de
   commerçants voudra peut-être une tontine.

   Règle à ne pas transgresser : un module ne dépend jamais d'un autre
   module. Il peut s'appuyer sur le socle, jamais sur une option.
   ============================================================ */
export const MODULES = [
  {
    id: "module_tombola",
    label: "Tombola",
    aide: "Tickets, tirages trimestriels et ticket bonus.",
  },
  {
    id: "module_sanctions",
    label: "Sanctions graduées",
    aide: "Barème de suspension d'accès selon l'ancienneté du retard.",
  },
  {
    id: "module_qr_carte",
    label: "QR code sur la carte",
    aide: "Vérification de la carte de membre par lecture d'un QR code.",
  },
  {
    id: "module_assemblees",
    label: "Assemblées générales",
    aide: "Convocation, émargement, quorum et procès-verbal.",
  },
  {
    id: "module_tontine",
    label: "Tontine",
    aide: "Épargne rotative entre membres.",
  },
  {
    id: "module_prets",
    label: "Prêts et avances",
    aide: "Avance sur cotisation et crédit social remboursable.",
  },
  {
    id: "module_aides",
    label: "Aides sociales",
    aide: "Demandes d'aide, barème des prestations et versements.",
  },
];

// Valeurs de repli, utilisées tant qu'aucun paramétrage n'a été enregistré.
// Elles sont volontairement neutres : l'identité réelle de l'organisation vient
// de la table parametrage, jamais du code.
export const PARAMS_DEFAUT = {
  // Identité
  nom_mutuelle: "",
  adresse: "",
  localite: "",
  contact: "",
  logo_url: null,
  prefixe_matricule: "MUT",
  organisation_id: null,
  // Détermine le vocabulaire affiché (voir vocabulaire.js). Renseigné par
  // la fonction publique organisation_publique_par_slug pour un visiteur
  // non connecté, et par la table parametrage jointe à organisations
  // pour une personne connectée.
  type_organisation: "mutuelle",

  // Cotisations et adhésion
  montant_cotisation: 1000,
  max_fractions: 2,
  droit_adhesion: 2000,

  // Conditions d'accès aux prestations (articles 18 et 34)
  carence_mois: 3,
  mois_a_jour_requis: 3,
  depart_carence: "droit_adhesion",

  // Tombola
  prix_ticket_tombola: 1000,
  plafond_tickets_tombola: null,

  // Sanctions
  seuil_sanction_tombola: 1,
  seuil_sanction_aides: 2,
  seuil_suspension: 3,

  // Pilotage
  objectif_recouvrement: 90,

  // Modules — désactivés par défaut, à l'exception du QR code de la carte
  module_tombola: false,
  module_sanctions: false,
  module_qr_carte: true,
  module_assemblees: false,
  module_tontine: false,
  module_prets: false,
  // Le défaut « true » vaut pour une base pas encore migrée : les aides
  // faisaient partie du socle avant de devenir un module, mieux vaut les
  // laisser visibles que les faire disparaître sans prévenir.
  module_aides: true,
};

// Emblème neutre, affiché pendant le chargement et lorsqu'aucun logo n'a été
// téléversé. Intégré au code plutôt que servi depuis /public : aucune identité
// étrangère ne peut ainsi apparaître, même une fraction de seconde.
export const LOGO_DEFAUT =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="#E8EDF5"/>
      <path d="M32 14 L48 21 v12 c0 10-7 16-16 19-9-3-16-9-16-19V21z"
            fill="none" stroke="#8A98AE" stroke-width="3.2"
            stroke-linejoin="round"/>
      <path d="M25 33 l5 5 9-11" fill="none" stroke="#8A98AE"
            stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`.replace(/\s+/g, " ")
  );

/* ============================================================
   Organisation active

   Une même personne peut désormais administrer plusieurs mutuelles — un
   compte créé pour la MAEPHDA peut aussi ouvrir l'espace d'une seconde
   organisation. Dans ce cas, la table parametrage renvoie plusieurs
   lignes à cette personne, et il faut savoir laquelle regarder.

   Le choix se fait une fois, se retient sur cet appareil (localStorage,
   pas sessionStorage : il doit survivre à la fermeture du navigateur),
   et reste modifiable à tout moment depuis la barre latérale.
   ============================================================ */

const CLE_ORG_ACTIVE = "org_active_id";

function lireOrganisationActive() {
  try {
    return localStorage.getItem(CLE_ORG_ACTIVE);
  } catch {
    return null;
  }
}

function ecrireOrganisationActive(id) {
  try {
    localStorage.setItem(CLE_ORG_ACTIVE, id);
  } catch {
    // Stockage indisponible : le choix ne survivra pas au rechargement,
    // sans conséquence grave, juste moins pratique.
  }
}

/**
 * Les organisations que la personne connectée administre.
 *
 * Sert à construire le sélecteur affiché aux comptes qui en administrent
 * plusieurs — pour tous les autres, ce tableau ne contiendra qu'une ligne
 * et le sélecteur ne s'affichera pas.
 */
export async function mesOrganisationsAdministrees() {
  const { data, error } = await supabase
    .from("roles_admin")
    .select("organisation_id, organisations(nom, sigle)");

  if (error || !data) return [];

  return data
    .filter((r) => r.organisations)
    .map((r) => ({
      organisation_id: r.organisation_id,
      nom: r.organisations.nom,
      sigle: r.organisations.sigle,
    }));
}

/**
 * Change l'organisation active et rafraîchit tous les écrans ouverts.
 */
export function changerOrganisationActive(organisationId) {
  ecrireOrganisationActive(organisationId);
  return rafraichirIdentite();
}

/* ============================================================
   Cache partagé

   Une dizaine d'écrans réclament la même identité. Sans mise en
   commun, chacun interrogerait la base pour son propre compte, ce qui
   retarderait l'affichage du logo et du sigle de plusieurs secondes.

   Trois niveaux se complètent :
     1. la mémoire du module — instantané entre deux écrans ;
     2. sessionStorage — instantané au rechargement de la page ;
     3. la base — source de vérité, consultée une seule fois puis
        rafraîchie discrètement en arrière-plan.
   ============================================================ */

const CLE_CACHE = "org_identite";

let cacheMemoire = lireCacheSession();
let requeteEnCours = null;
const abonnes = new Set();

function lireCacheSession() {
  try {
    const brut = sessionStorage.getItem(CLE_CACHE);
    return brut ? { ...PARAMS_DEFAUT, ...JSON.parse(brut) } : null;
  } catch {
    return null;
  }
}

function ecrireCacheSession(valeurs) {
  try {
    sessionStorage.setItem(CLE_CACHE, JSON.stringify(valeurs));
  } catch {
    // Stockage indisponible (navigation privée sur certains navigateurs) :
    // le cache mémoire suffit pour la session en cours.
  }
}

function diffuser(valeurs) {
  cacheMemoire = valeurs;
  ecrireCacheSession(valeurs);
  abonnes.forEach((notifier) => notifier(valeurs));
}

// L'adresse identifie la mutuelle pour un visiteur non connecté, sous la
// forme ?org=maephda. Sans ce paramètre, la fonction serveur se rabat sur
// l'organisation unique tant qu'il n'en existe qu'une — voir le SQL.
function slugDepuisAdresse() {
  try {
    return new URLSearchParams(window.location.search).get("org");
  } catch {
    return null;
  }
}

async function interroger() {
  // Les deux sources sont interrogées ensemble : la lecture complète échoue
  // silencieusement pour un visiteur non connecté, la fonction publique
  // répond dans tous les cas. En parallèle plutôt qu'en cascade, pour
  // n'attendre qu'un seul aller-retour réseau.
  //
  // Pas de maybeSingle() ici : une personne qui administre plusieurs
  // organisations verrait plusieurs lignes, et maybeSingle() échoue dans
  // ce cas plutôt que d'en choisir une — c'est tout le sens de ce qui suit.
  const [complet, publique] = await Promise.all([
    // Le type d'organisation vit sur organisations, pas sur parametrage :
    // la jointure le ramène ici pour que le vocabulaire soit correct aussi
    // pour une personne connectée (la fonction publique ci-dessous ne sert
    // qu'aux visiteurs non connectés).
    supabase.from("parametrage").select("*, organisations(type_organisation)"),
    supabase.rpc("organisation_publique_par_slug", { p_slug: slugDepuisAdresse() }),
  ]);

  const lignes = complet.data || [];
  let source = null;

  if (lignes.length === 1) {
    // Le cas courant, très largement majoritaire : une seule organisation.
    source = lignes[0];
  } else if (lignes.length > 1) {
    // Plusieurs organisations accessibles. Un lien contenant ?org=<slug>
    // (partagé pour pointer vers une mutuelle précise) doit l'emporter sur
    // le dernier choix mémorisé sur cet appareil — sinon un lien de test
    // ou un lien partagé n'a aucun effet pour un compte déjà connecté.
    // À défaut de slug reconnu, on retombe sur le choix mémorisé, ou sur
    // la première organisation.
    let choisie = lireOrganisationActive();

    const slug = slugDepuisAdresse();
    if (slug) {
      const { data: orgParSlug } = await supabase
        .from("organisations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (orgParSlug && lignes.some((l) => l.organisation_id === orgParSlug.id)) {
        choisie = orgParSlug.id;
      }
    }

    source = lignes.find((l) => l.organisation_id === choisie) || lignes[0];
    ecrireOrganisationActive(source.organisation_id);
  }

  if (!source) {
    // Personne non connectée, ou aucune organisation accessible : repli sur
    // l'identité publique de la mutuelle visée par l'adresse.
    const donneesPubliques = Array.isArray(publique.data) ? publique.data[0] : publique.data;
    source = donneesPubliques;
  }

  if (!source) return PARAMS_DEFAUT;

  // La lecture authentifiée ramène le type sous forme imbriquée
  // (organisations: { type_organisation }), la fonction publique le
  // renvoie déjà à plat — on aplatit la première forme pour que les deux
  // voies produisent exactement la même structure.
  const aplati = { ...source };
  if (aplati.organisations?.type_organisation) {
    aplati.type_organisation = aplati.organisations.type_organisation;
  }
  delete aplati.organisations;

  return { ...PARAMS_DEFAUT, ...nettoyer(aplati) };
}

function charger({ forcer = false } = {}) {
  if (requeteEnCours && !forcer) return requeteEnCours;

  requeteEnCours = interroger()
    .then((valeurs) => {
      diffuser(valeurs);
      return valeurs;
    })
    .catch(() => cacheMemoire || PARAMS_DEFAUT)
    .finally(() => { requeteEnCours = null; });

  return requeteEnCours;
}

/**
 * Identité, réglages et modules de l'organisation actuellement affichée.
 *
 * Le premier écran monté déclenche la lecture ; les suivants se servent du
 * cache partagé. Toute modification enregistrée par le Bureau, ou tout
 * changement d'organisation active, est répercuté immédiatement sur les
 * écrans ouverts.
 */
export function useParametrage() {
  const [params, setParams] = useState(cacheMemoire || PARAMS_DEFAUT);
  const [loading, setLoading] = useState(!cacheMemoire);

  useEffect(() => {
    let actif = true;

    const notifier = (valeurs) => {
      if (actif) {
        setParams(valeurs);
        setLoading(false);
      }
    };

    abonnes.add(notifier);

    // Cache déjà rempli : on rafraîchit en arrière-plan sans faire attendre
    charger().finally(() => { if (actif) setLoading(false); });

    return () => {
      actif = false;
      abonnes.delete(notifier);
    };
  }, []);

  return { params, loading, recharger: () => charger({ forcer: true }) };
}

/**
 * À appeler après modification du paramétrage, ou après un changement
 * d'organisation active : relit la base et prévient tous les écrans ouverts.
 */
export function rafraichirIdentite() {
  return charger({ forcer: true });
}

/**
 * Un module est-il actif ?
 *
 * L'absence de la colonne — base non encore migrée — vaut désactivation,
 * sauf pour le QR code de la carte, présent de longue date.
 */
export function moduleActif(params, id) {
  const valeur = params?.[id];
  if (valeur === undefined || valeur === null) {
    return PARAMS_DEFAUT[id] === true;
  }
  return valeur === true;
}

// Les colonnes vides en base ne doivent pas écraser les valeurs de repli.
// Les booléens à false sont conservés : c'est une valeur, pas une absence.
function nettoyer(data) {
  const propre = {};
  Object.entries(data).forEach(([cle, valeur]) => {
    if (valeur === null || valeur === "") return;
    propre[cle] = valeur;
  });
  return propre;
}

// Matricule d'un membre, construit à partir du préfixe de l'organisation
export function construireMatricule(params, membre) {
  const prefixe = params?.prefixe_matricule || PARAMS_DEFAUT.prefixe_matricule;
  const annee = membre?.date_adhesion
    ? new Date(membre.date_adhesion).getFullYear()
    : new Date().getFullYear();
  const suffixe = String(membre?.id || "0000").slice(0, 4).toUpperCase();
  return `${prefixe}-${annee}-${suffixe}`;
}

/**
 * Date à partir de laquelle un membre peut prétendre à une prestation.
 *
 * Le point de départ dépend du réglage de la mutuelle : le versement du droit
 * d'adhésion, ou la date d'adhésion. Retourne aussi « estime » lorsque le
 * versement n'est pas enregistré et que l'on se rabat sur la date d'adhésion.
 */
export function dateEligibilite(params, membre) {
  const mois = params?.carence_mois ?? PARAMS_DEFAUT.carence_mois;
  const regle = params?.depart_carence ?? PARAMS_DEFAUT.depart_carence;

  const depart = regle === "date_adhesion"
    ? membre?.date_adhesion
    : (membre?.droit_adhesion_paye_le || membre?.date_adhesion);

  if (!depart) return { date: null, estime: true };

  const d = new Date(depart);
  d.setMonth(d.getMonth() + mois);

  return {
    date: d,
    estime: regle !== "date_adhesion" && !membre?.droit_adhesion_paye_le,
  };
}

// En-tête utilisé par les documents imprimés (reçus, rapports, livre de comptes)
export function enteteOrganisation(params) {
  return {
    sigle: params?.nom_mutuelle || PARAMS_DEFAUT.nom_mutuelle,
    denomination: params?.adresse || "",
    localite: params?.localite || "",
    contact: params?.contact || "",
  };
}