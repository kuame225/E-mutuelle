import { jsPDF } from "jspdf";
import { supabase } from "./supabaseClient";
import { PARAMS_DEFAUT } from "./useParametrage";

// Même palette et même structure que RecuPaiement.js. Contrairement au
// reçu (un seul paiement déjà connu de l'appelant), cette fonction
// reçoit la liste complète des cotisations du membre — c'est à
// l'écran appelant de les avoir chargées au préalable, pas à ce
// fichier d'aller les chercher lui-même.
export async function genererHistorique({ membre, cotisations, params }) {
  const org = params || (await lireParametrage());

  const sigle = sansAccents(org.nom_mutuelle || PARAMS_DEFAUT.nom_mutuelle);
  const denomination = sansAccents(org.adresse || "");
  const localite = sansAccents(org.localite || "");
  const contact = sansAccents(org.contact || "");

  const doc = new jsPDF();
  const triees = [...cotisations].sort((a, b) => String(a.periode).localeCompare(String(b.periode)));
  const totalDu = triees.reduce((s, c) => s + (c.montant_du || 0), 0);
  const totalPaye = triees.reduce((s, c) => s + (c.montant_paye || 0), 0);

  dessinerEntete(doc, sigle, denomination, membre);

  // ---- En-têtes de colonnes ----
  let y = 130;
  dessinerEnTeteColonnes(doc, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);

  triees.forEach((c) => {
    if (y > 265) {
      doc.addPage();
      y = 25;
      dessinerEnTeteColonnes(doc, y);
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
    }

    doc.setTextColor(26, 26, 23);
    doc.text(formatPeriode(c.periode), 20, y);
    doc.text(formaterMontant(c.montant_du) + " FCFA", 90, y);
    doc.text(formaterMontant(c.montant_paye) + " FCFA", 135, y);

    const { texte, couleur } = libelleStatut(c.statut);
    doc.setTextColor(...couleur);
    doc.setFont("helvetica", "bold");
    doc.text(texte, 180, y);
    doc.setFont("helvetica", "normal");

    y += 8;
  });

  // ---- Total ----
  if (y > 245) { doc.addPage(); y = 25; }
  y += 6;
  doc.setDrawColor(11, 79, 74);
  doc.setLineWidth(0.3);
  doc.line(20, y, 190, y);
  y += 10;

  doc.setFillColor(11, 79, 74);
  doc.roundedRect(15, y, 180, 28, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Total du : " + formaterMontant(totalDu) + " FCFA", 20, y + 12);
  doc.setFont("helvetica", "bold");
  doc.text("Total paye : " + formaterMontant(totalPaye) + " FCFA", 20, y + 21);

  // ---- Coordonnées ----
  if (localite || contact) {
    doc.setTextColor(120, 120, 118);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const coordonnees = [localite, contact].filter(Boolean).join("  -  ");
    doc.text(coordonnees, 20, 282);
  }

  doc.setTextColor(120, 120, 118);
  doc.setFontSize(8);
  doc.text(
    "Genere le " + new Date().toLocaleDateString("fr-FR") +
      " a " + new Date().toLocaleTimeString("fr-FR") + " - document sans valeur fiscale.",
    20, 290
  );

  doc.save("historique-cotisations-" + motCle(sigle) + "-" + motCle(membre.nom) + ".pdf");
}

function dessinerEntete(doc, sigle, denomination, membre) {
  doc.setFillColor(11, 79, 74);
  doc.rect(0, 0, 210, 45, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(sigle, 20, 20);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  if (denomination) doc.text(denomination, 20, 28);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("HISTORIQUE DE COTISATIONS", 20, 40);

  doc.setFillColor(247, 243, 232);
  doc.rect(0, 45, 210, 20, "F");
  doc.setTextColor(11, 79, 74);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(sansAccents(membre.nom), 20, 57);
  doc.setTextColor(26, 26, 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Edite le " + new Date().toLocaleDateString("fr-FR"), 150, 57);

  if (membre.matricule) {
    doc.setTextColor(120, 120, 118);
    doc.setFontSize(9);
    doc.text("Matricule : " + membre.matricule, 20, 68);
  }
}

function dessinerEnTeteColonnes(doc, y) {
  doc.setFillColor(11, 79, 74);
  doc.rect(15, y - 6, 180, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PERIODE", 20, y - 0.5);
  doc.text("MONTANT DU", 90, y - 0.5);
  doc.text("MONTANT PAYE", 135, y - 0.5);
  doc.text("STATUT", 180, y - 0.5);
}

function libelleStatut(statut) {
  if (statut === "paye") return { texte: "Paye", couleur: [46, 139, 124] };
  if (statut === "partiel") return { texte: "Partiel", couleur: [212, 118, 44] };
  return { texte: "Attente", couleur: [180, 60, 60] };
}

/* ---------------- Utilitaires (identiques à RecuPaiement.js) ---------------- */

async function lireParametrage() {
  try {
    const { data } = await supabase.from("parametrage").select("*").maybeSingle();
    return data ? { ...PARAMS_DEFAUT, ...data } : PARAMS_DEFAUT;
  } catch {
    return PARAMS_DEFAUT;
  }
}

function sansAccents(texte) {
  return String(texte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function motCle(texte) {
  return sansAccents(texte)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function formatPeriode(periode) {
  const mois = [
    "Jan", "Fev", "Mar", "Avr", "Mai", "Juin",
    "Jui", "Aou", "Sep", "Oct", "Nov", "Dec",
  ];
  const parts = String(periode).split("-");
  const index = parseInt(parts[1], 10) - 1;
  return mois[index] ? mois[index] + " " + parts[0] : String(periode);
}

function formaterMontant(montant) {
  return (montant || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}