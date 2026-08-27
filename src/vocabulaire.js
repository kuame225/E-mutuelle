/* ============================================================
   Vocabulaire par type d'organisation

   Une amicale ne parle pas de « prestations santé », une ONG parle de
   « bénéficiaires » plutôt que de « membres », une coopérative de
   « parts sociales » plutôt que de « cotisations ». Le socle métier
   reste identique — seuls les mots changent.

   Le vocabulaire est figé par type, jamais réglable organisation par
   organisation : deux coopératives emploient les mêmes termes, et une
   organisation ne peut pas se retrouver avec des libellés incohérents
   entre deux écrans.

   Usage dans un écran :
     const { mot } = useVocabulaire();
     <h1>{mot("membres")}</h1>        → « Membres » / « Bénéficiaires »…
     <h1>{mot("membre_un")}</h1>      → « Un membre » / « Un bénéficiaire »…

   Toute clé absente d'un type retombe sur celle de « mutuelle », qui
   sert de référence complète — un type incomplet n'affiche donc jamais
   de libellé vide, seulement le terme générique.
   ============================================================ */

export const TYPES_ORGANISATION = [
  {
    id: "mutuelle",
    label: "Mutuelle",
    description: "Gestion des adhésions, cotisations, prestations santé et remboursements.",
  },
  {
    id: "association",
    label: "Association",
    description: "Gestion des membres, activités, projets et cotisations.",
  },
  {
    id: "cooperative",
    label: "Coopérative",
    description: "Gestion des membres, parts sociales, activités économiques et bénéfices.",
  },
  {
    id: "ong",
    label: "ONG",
    description: "Gestion des projets, bailleurs, bénéficiaires et rapports.",
  },
  {
    id: "avec",
    label: "AVEC / Groupe d'épargne",
    description: "Gestion des cycles d'épargne, prêts, caisse et fonds social.",
  },
  {
    id: "professionnelle",
    label: "Organisation professionnelle",
    description: "Gestion des membres, services, formations et événements.",
  },
  {
    id: "federation",
    label: "Fédération / Union",
    description: "Gestion des structures membres, instances et décisions.",
  },
  {
    id: "reseau",
    label: "Réseau",
    description: "Gestion des membres, partenaires et initiatives communes.",
  },
  {
    id: "autre",
    label: "Autre organisation",
    description: "Personnalisez selon votre modèle de fonctionnement.",
  },
];

/* ---------------- Vocabulaire ---------------- */

// « mutuelle » sert de référence : elle contient toutes les clés, les
// autres types ne redéfinissent que ce qui diffère réellement.
//
// Les clés existent en plusieurs formes grammaticales (organisation,
// organisation_la, organisation_de…) parce que le français ne se
// recompose pas par concaténation : « Vie de » + « le groupe » donnerait
// « Vie de le groupe ». Chaque forme dont un écran a besoin est donc
// déclarée explicitement, plutôt que fabriquée à la volée.
const MUTUELLE = {
  organisation: "mutuelle",
  organisation_la: "la mutuelle",
  organisation_de: "de la mutuelle",   // « Vie de la mutuelle »
  organisation_notre: "notre mutuelle",
  organisation_votre: "votre mutuelle",

  membres: "Membres",
  membre_un: "un membre",
  membre_le: "le membre",
  membre_singulier: "Membre",

  adhesion: "Adhésion",
  adhesions: "Adhésions",
  adherer: "Adhérer à la mutuelle",
  demande_adhesion: "Demande d'adhésion",

  cotisation: "Cotisation",
  cotisations: "Cotisations",
  cotisation_la: "la cotisation",
  cotisation_ma: "Ma cotisation",

  aide: "Aide sociale",
  aides: "Aides sociales",
  demande_aide: "Demande d'aide",
  bareme: "Barème des aides",

  bureau: "Bureau",
  bureau_le: "le Bureau",
  bureau_du: "du Bureau",              // « Rôles du Bureau »

  assemblee: "Assemblée générale",
  assemblees: "Assemblées générales",

  carte: "Carte de membre",
  matricule: "Matricule",

  // Libellés d'interface qui ne se déduisent d'aucune autre clé
  changer_organisation: "Changer de mutuelle",
  espace_membre: "Mon espace membre",
};

// Chaque type ne déclare que ses différences avec la référence ci-dessus.
const DIFFERENCES = {
  mutuelle: {},

  association: {
    organisation: "association",
    organisation_la: "l'association",
    organisation_de: "de l'association",
    organisation_notre: "notre association",
    organisation_votre: "votre association",
    adherer: "Adhérer à l'association",
    aide: "Soutien",
    aides: "Soutiens",
    demande_aide: "Demande de soutien",
    bareme: "Barème des soutiens",
    carte: "Carte de membre",
    changer_organisation: "Changer d'association",
  },

  cooperative: {
    organisation: "coopérative",
    organisation_la: "la coopérative",
    organisation_de: "de la coopérative",
    organisation_notre: "notre coopérative",
    organisation_votre: "votre coopérative",
    membres: "Coopérateurs",
    membre_un: "un coopérateur",
    membre_le: "le coopérateur",
    membre_singulier: "Coopérateur",
    adherer: "Rejoindre la coopérative",
    cotisation: "Part sociale",
    cotisations: "Parts sociales",
    cotisation_la: "la part sociale",
    cotisation_ma: "Ma part sociale",
    aide: "Ristourne",
    aides: "Ristournes",
    demande_aide: "Demande de ristourne",
    bareme: "Barème des ristournes",
    bureau: "Conseil d'administration",
    bureau_le: "le Conseil d'administration",
    bureau_du: "du Conseil d'administration",
    carte: "Carte de coopérateur",
    changer_organisation: "Changer de coopérative",
    espace_membre: "Mon espace coopérateur",
  },

  ong: {
    organisation: "organisation",
    organisation_la: "l'organisation",
    organisation_de: "de l'organisation",
    organisation_notre: "notre organisation",
    organisation_votre: "votre organisation",
    membres: "Bénéficiaires",
    membre_un: "un bénéficiaire",
    membre_le: "le bénéficiaire",
    membre_singulier: "Bénéficiaire",
    adhesion: "Enregistrement",
    adhesions: "Enregistrements",
    adherer: "S'enregistrer",
    demande_adhesion: "Demande d'enregistrement",
    cotisation: "Contribution",
    cotisations: "Contributions",
    cotisation_la: "la contribution",
    cotisation_ma: "Ma contribution",
    aide: "Appui",
    aides: "Appuis",
    demande_aide: "Demande d'appui",
    bareme: "Barème des appuis",
    bureau: "Coordination",
    bureau_le: "la Coordination",
    bureau_du: "de la Coordination",
    carte: "Carte de bénéficiaire",
    matricule: "Référence",
    changer_organisation: "Changer d'organisation",
    espace_membre: "Mon espace bénéficiaire",
  },

  avec: {
    organisation: "groupe",
    organisation_la: "le groupe",
    organisation_de: "du groupe",
    organisation_notre: "notre groupe",
    organisation_votre: "votre groupe",
    membres: "Membres du groupe",
    adherer: "Rejoindre le groupe",
    cotisation: "Épargne",
    cotisations: "Épargnes",
    cotisation_la: "l'épargne",
    cotisation_ma: "Mon épargne",
    aide: "Aide du fonds social",
    aides: "Aides du fonds social",
    demande_aide: "Demande au fonds social",
    bareme: "Barème du fonds social",
    bureau: "Comité de gestion",
    bureau_le: "le Comité de gestion",
    bureau_du: "du Comité de gestion",
    carte: "Carte de membre",
    changer_organisation: "Changer de groupe",
  },

  professionnelle: {
    organisation: "organisation",
    organisation_la: "l'organisation",
    organisation_de: "de l'organisation",
    organisation_notre: "notre organisation",
    organisation_votre: "votre organisation",
    membres: "Adhérents",
    membre_un: "un adhérent",
    membre_le: "l'adhérent",
    membre_singulier: "Adhérent",
    adherer: "Adhérer",
    cotisation: "Cotisation annuelle",
    cotisations: "Cotisations",
    cotisation_ma: "Ma cotisation",
    aide: "Service",
    aides: "Services",
    demande_aide: "Demande de service",
    bareme: "Barème des services",
    bureau: "Bureau",
    carte: "Carte professionnelle",
    changer_organisation: "Changer d'organisation",
    espace_membre: "Mon espace adhérent",
  },

  federation: {
    organisation: "fédération",
    organisation_la: "la fédération",
    organisation_de: "de la fédération",
    organisation_notre: "notre fédération",
    organisation_votre: "votre fédération",
    membres: "Structures membres",
    membre_un: "une structure membre",
    membre_le: "la structure membre",
    membre_singulier: "Structure membre",
    adhesion: "Affiliation",
    adhesions: "Affiliations",
    adherer: "S'affilier à la fédération",
    demande_adhesion: "Demande d'affiliation",
    cotisation: "Contribution",
    cotisations: "Contributions",
    cotisation_la: "la contribution",
    cotisation_ma: "Ma contribution",
    bureau: "Instance dirigeante",
    bureau_le: "l'Instance dirigeante",
    bureau_du: "de l'Instance dirigeante",
    carte: "Attestation d'affiliation",
    changer_organisation: "Changer de fédération",
    espace_membre: "Mon espace",
  },

  reseau: {
    organisation: "réseau",
    organisation_la: "le réseau",
    organisation_de: "du réseau",
    organisation_notre: "notre réseau",
    organisation_votre: "votre réseau",
    membres: "Membres du réseau",
    adhesion: "Affiliation",
    adhesions: "Affiliations",
    adherer: "Rejoindre le réseau",
    demande_adhesion: "Demande d'affiliation",
    cotisation: "Contribution",
    cotisations: "Contributions",
    cotisation_la: "la contribution",
    cotisation_ma: "Ma contribution",
    bureau: "Coordination",
    bureau_le: "la Coordination",
    bureau_du: "de la Coordination",
    carte: "Carte de membre",
    changer_organisation: "Changer de réseau",
  },

  autre: {
    organisation: "organisation",
    organisation_la: "l'organisation",
    organisation_de: "de l'organisation",
    organisation_notre: "notre organisation",
    organisation_votre: "votre organisation",
    adherer: "Rejoindre l'organisation",
    changer_organisation: "Changer d'organisation",
  },
};

// Vocabulaire complet de chaque type : la référence, écrasée par ses
// propres différences.
const VOCABULAIRE = Object.fromEntries(
  Object.entries(DIFFERENCES).map(([type, diff]) => [type, { ...MUTUELLE, ...diff }])
);

/**
 * Mot correspondant à une clé, pour un type d'organisation donné.
 *
 * Un type inconnu (base plus récente que l'application, par exemple) ou
 * une clé absente retombent sur le vocabulaire « mutuelle », jamais sur
 * une chaîne vide.
 */
export function motPourType(type, cle) {
  const dico = VOCABULAIRE[type] || VOCABULAIRE.mutuelle;
  return dico[cle] ?? MUTUELLE[cle] ?? cle;
}

/**
 * Libellé lisible d'un type ("Coopérative", "ONG"…).
 */
export function libelleType(type) {
  return TYPES_ORGANISATION.find((t) => t.id === type)?.label || "Organisation";
}

/**
 * Même mot, première lettre en capitale — pour un début de phrase.
 * « le Bureau » → « Le Bureau », « la Coordination » → « La Coordination ».
 */
export function capitaliser(texte) {
  const t = String(texte || "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}