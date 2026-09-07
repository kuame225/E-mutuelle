// Composition du tableau de bord, type par type.
//
// Plutôt que huit tableaux de bord écrits séparément — huit fois le
// même code à corriger à chaque évolution — chaque type déclare ici
// les blocs qu'il affiche. Ajouter un type ou changer sa composition
// revient à modifier une ligne, jamais à réécrire un écran.
//
// L'ordre compte : c'est celui de l'affichage. Le premier bloc de la
// liste occupe la place du grand bandeau en tête.

export const BLOCS = {
  // Recouvrement des cotisations : le pourcentage de membres à jour.
  // Sans objet pour une organisation qui ne collecte pas de cotisation.
  RECOUVREMENT: "recouvrement",

  // Trésorerie : solde de caisse, total encaissé.
  TRESORERIE: "tresorerie",

  // Aides sociales versées.
  AIDES: "aides",

  // Capital social et sociétaires (coopérative).
  CAPITAL_SOCIAL: "capital_social",

  // Encours de prêts et demandes en attente.
  PRETS: "prets",

  // Bénéficiaires suivis et appuis AGR (ONG).
  APPUIS_AGR: "appuis_agr",

  // Épargne AVEC : capital cumulé du cycle en cours.
  EPARGNE_AVEC: "epargne_avec",

  // Projets et budgets.
  PROJETS: "projets",

  // Dons publics reçus.
  DONS: "dons",

  // Effectif : membres actifs, nouvelles adhésions.
  EFFECTIF: "effectif",

  // Graphique d'évolution des encaissements.
  EVOLUTION: "evolution",

  // Répartition des membres par statut de cotisation.
  REPARTITION: "repartition",

  // Liste des membres en retard.
  RETARDATAIRES: "retardataires",
};

const B = BLOCS;

export const COMPOSITION_PAR_TYPE = {
  mutuelle: [
    B.RECOUVREMENT, B.TRESORERIE, B.AIDES,
    B.EVOLUTION, B.REPARTITION, B.RETARDATAIRES,
  ],

  // Une ONG ne collecte pas de cotisation auprès de ses membres : son
  // activité se mesure aux personnes suivies et aux appuis accordés.
  ong: [
    B.APPUIS_AGR, B.TRESORERIE, B.PROJETS, B.DONS, B.EFFECTIF,
  ],

  cooperative: [
    B.CAPITAL_SOCIAL, B.PRETS, B.TRESORERIE, B.EFFECTIF,
  ],

  avec: [
    B.EPARGNE_AVEC, B.PRETS, B.TRESORERIE, B.EFFECTIF,
  ],

  association: [
    B.RECOUVREMENT, B.TRESORERIE, B.DONS, B.PROJETS,
    B.EVOLUTION, B.RETARDATAIRES,
  ],

  professionnelle: [
    B.RECOUVREMENT, B.TRESORERIE, B.EFFECTIF,
    B.EVOLUTION, B.RETARDATAIRES,
  ],

  federation: [
    B.RECOUVREMENT, B.TRESORERIE, B.PROJETS, B.EFFECTIF, B.EVOLUTION,
  ],

  reseau: [
    B.RECOUVREMENT, B.TRESORERIE, B.PROJETS, B.EFFECTIF, B.EVOLUTION,
  ],
};

// Modules dont dépend chaque bloc — un bloc n'est affiché que si le
// module correspondant est actif. Sans entrée ici, le bloc s'affiche
// toujours (recouvrement, trésorerie, effectif).
export const MODULE_REQUIS = {
  [B.AIDES]: "module_aides",
  [B.CAPITAL_SOCIAL]: "module_parts_sociales",
  [B.PRETS]: "module_prets",
  [B.APPUIS_AGR]: "module_agr",
  [B.EPARGNE_AVEC]: "module_avec",
  [B.PROJETS]: "module_projets",
  [B.DONS]: "module_dons",
};

/**
 * Les blocs réellement affichables pour une organisation : sa
 * composition de type, filtrée par les modules qu'elle a activés.
 * Le recouvrement disparaît aussi quand aucune cotisation n'est
 * configurée — un taux calculé sur zéro n'a aucun sens.
 */
export function blocsAAfficher(params) {
  const composition = COMPOSITION_PAR_TYPE[params?.type_organisation]
    || COMPOSITION_PAR_TYPE.mutuelle;

  return composition.filter((bloc) => {
    if (bloc === BLOCS.RECOUVREMENT || bloc === BLOCS.REPARTITION || bloc === BLOCS.RETARDATAIRES) {
      if (Number(params?.montant_cotisation ?? 0) <= 0) return false;
    }
    const module = MODULE_REQUIS[bloc];
    if (!module) return true;
    return Boolean(params?.[module]);
  });
}