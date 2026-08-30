import { jsPDF } from "jspdf";
import { supabase } from "./supabaseClient";
import { PARAMS_DEFAUT } from "./useParametrage";

// Même palette et même structure que RecuPaiement.js — un document
// officiel doit avoir la même identité visuelle que les autres pièces
// délivrées par l'organisation, pas un style différent à chaque fois.
export async function genererAttestation({ membre, params }) {
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
  doc.text("ATTESTATION D'ADHESION", 20, 40);

  // ---- Bandeau info ----
  doc.setFillColor(247, 243, 232);
  doc.rect(0, 45, 210, 20, "F");
  doc.setTextColor(11, 79, 74);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("N° " + membre.id.slice(0, 8).toUpperCase(), 20, 56);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(26, 26, 23);
  doc.text("Delivree le : " + new Date().toLocaleDateString("fr-FR"), 110, 56);

  // ---- Corps ----
  doc.setTextColor(26, 26, 23);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  const statutTexte = membre.statut_cotisation === "a_jour"
    ? "a jour de ses cotisations"
    : "non a jour de ses cotisations a la date de la presente attestation";

  const paragraphe = [
    `Nous soussignes, le Bureau de ${sigle}${denomination ? " (" + denomination + ")" : ""},`,
    `attestons par la presente que :`,
  ];
  paragraphe.forEach((ligne, i) => doc.text(ligne, 20, 80 + i * 8));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(sansAccents(membre.nom), 20, 105);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const suite = [
    `est membre${membre.matricule ? " (matricule " + membre.matricule + ")" : ""} de notre organisation`,
    `depuis le ${membre.date_adhesion ? new Date(membre.date_adhesion).toLocaleDateString("fr-FR") : "—"}.`,
    ``,
    `A la date de delivrance de la presente attestation, ${sansAccents(membre.nom).split(" ")[0]}`,
    `est ${statutTexte}.`,
    ``,
    `Cette attestation est delivree a l'interesse(e) pour servir et valoir ce que de droit.`,
  ];
  suite.forEach((ligne, i) => doc.text(ligne, 20, 118 + i * 8));

  // ---- Coordonnées de l'organisation ----
  if (localite || contact) {
    doc.setTextColor(120, 120, 118);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const coordonnees = [localite, contact].filter(Boolean).join("  -  ");
    doc.text(coordonnees, 20, 230);
  }

  // ---- Pied ----
  doc.setFillColor(11, 79, 74);
  doc.rect(0, 270, 210, 27, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Attestation generee automatiquement par " + sigle + " - document sans valeur fiscale.",
    20, 280
  );
  doc.text(
    "Genere le " + new Date().toLocaleDateString("fr-FR") +
      " a " + new Date().toLocaleTimeString("fr-FR"),
    20, 287
  );

  doc.save("attestation-" + motCle(sigle) + "-" + motCle(membre.nom) + ".pdf");
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