import { jsPDF } from "jspdf";
import { supabase } from "./supabaseClient";
import { PARAMS_DEFAUT } from "./useParametrage";

// La fonction est asynchrone : elle lit l'identité de l'organisation avant de
// composer le reçu. Les appels existants (sans await) restent valables, le
// fichier étant simplement enregistré une fraction de seconde plus tard.
export async function genererRecu({ membre, cotisation, paiement, params }) {
  const org = params || (await lireParametrage());

  const sigle = sansAccents(org.nom_mutuelle || PARAMS_DEFAUT.nom_mutuelle);
  const denomination = sansAccents(org.adresse || "");
  const localite = sansAccents(org.localite || "");
  const contact = sansAccents(org.contact || "");

  const doc = new jsPDF();

  // ---- En-tête ----
  doc.setFillColor(11, 79, 74);
  doc.rect(0, 0, 210, 45, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(sigle, 20, 20);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  if (denomination) doc.text(denomination, 20, 28);

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("RECU DE PAIEMENT", 20, 40);

  // ---- Bandeau info ----
  doc.setFillColor(247, 243, 232);
  doc.rect(0, 45, 210, 20, "F");
  doc.setTextColor(11, 79, 74);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("N° " + paiement.id.slice(0, 8).toUpperCase(), 20, 56);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(26, 26, 23);
  doc.text(
    "Date : " + new Date(paiement.created_at).toLocaleDateString("fr-FR"),
    110, 56
  );

  // ---- Bloc membre ----
  doc.setDrawColor(11, 79, 74);
  doc.setLineWidth(0.3);
  doc.rect(15, 72, 85, 55);
  doc.setTextColor(11, 79, 74);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("MEMBRE", 20, 81);
  doc.setDrawColor(212, 118, 44);
  doc.setLineWidth(0.8);
  doc.line(20, 83, 60, 83);
  doc.setTextColor(26, 26, 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(sansAccents(membre.nom), 20, 92);
  doc.setFontSize(9);
  doc.text(sansAccents(membre.poste || ""), 20, 100);
  doc.text(sansAccents(membre.service || ""), 20, 107);
  doc.text("Tel : " + (membre.telephone || ""), 20, 114);
  doc.text(
    "Membre depuis : " + (membre.date_adhesion
      ? new Date(membre.date_adhesion).toLocaleDateString("fr-FR")
      : "—"),
    20, 121
  );

  // ---- Bloc paiement ----
  doc.setDrawColor(11, 79, 74);
  doc.setLineWidth(0.3);
  doc.rect(110, 72, 85, 55);
  doc.setTextColor(11, 79, 74);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("DETAILS DU PAIEMENT", 115, 81);
  doc.setDrawColor(212, 118, 44);
  doc.setLineWidth(0.8);
  doc.line(115, 83, 175, 83);
  doc.setTextColor(26, 26, 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Periode : " + formatPeriode(cotisation.periode), 115, 92);
  doc.text("Mode : " + formatMode(paiement.mode_paiement), 115, 100);
  doc.text("Ref : " + (paiement.reference_transaction || "—"), 115, 107);

  // ---- Montant ----
  doc.setFillColor(11, 79, 74);
  doc.roundedRect(15, 140, 180, 35, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Montant paye", 20, 153);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(formaterMontant(paiement.montant) + " FCFA", 20, 168);

  // ---- Solde ----
  doc.setFillColor(247, 243, 232);
  doc.rect(15, 185, 180, 30, "F");
  doc.setDrawColor(11, 79, 74);
  doc.setLineWidth(0.3);
  doc.rect(15, 185, 180, 30);
  doc.setTextColor(26, 26, 23);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const reste = cotisation.montant_du - cotisation.montant_paye;
  doc.text("Cotisation due : " + formaterMontant(cotisation.montant_du) + " FCFA", 20, 197);
  doc.text("Total paye : " + formaterMontant(cotisation.montant_paye) + " FCFA", 20, 205);
  doc.setFont("helvetica", "bold");
  if (reste <= 0) {
    doc.setTextColor(46, 139, 124);
    doc.text("Cotisation entierement reglee", 110, 201);
  } else {
    doc.setTextColor(212, 118, 44);
    doc.text("Reste : " + formaterMontant(reste) + " FCFA", 110, 201);
  }

  // ---- Coordonnées de la mutuelle ----
  if (localite || contact) {
    doc.setTextColor(120, 120, 118);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const coordonnees = [localite, contact].filter(Boolean).join("  -  ");
    doc.text(coordonnees, 20, 226);
  }

  // ---- Pied ----
  doc.setFillColor(11, 79, 74);
  doc.rect(0, 270, 210, 27, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Recu genere automatiquement par " + sigle + " - document sans valeur fiscale.",
    20, 280
  );
  doc.text(
    "Genere le " + new Date().toLocaleDateString("fr-FR") +
      " a " + new Date().toLocaleTimeString("fr-FR"),
    20, 287
  );

  doc.save(
    "recu-" + motCle(sigle) + "-" + motCle(membre.nom) + "-" + cotisation.periode + ".pdf"
  );
}

/* ---------------- Utilitaires ---------------- */

async function lireParametrage() {
  try {
    const { data } = await supabase.from("parametrage").select("*").maybeSingle();
    return data ? { ...PARAMS_DEFAUT, ...data } : PARAMS_DEFAUT;
  } catch {
    return PARAMS_DEFAUT;
  }
}

// jsPDF en police standard ne rend pas les accents : on les retire à l'export
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
    "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
  ];
  const parts = String(periode).split("-");
  const index = parseInt(parts[1], 10) - 1;
  return mois[index] ? mois[index] + " " + parts[0] : String(periode);
}

function formaterMontant(montant) {
  return (montant || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatMode(mode) {
  const map = {
    cash: "Especes",
    especes: "Especes",
    orange_money: "Orange Money",
    mtn_money: "MTN Mobile Money",
    moov_money: "Moov Money",
    wave: "Wave",
    virement: "Virement",
    prelevement: "Prelevement sur interessements",
  };
  return map[mode] || mode;
}