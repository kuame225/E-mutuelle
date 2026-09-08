import { jsPDF } from "jspdf";
import { supabase } from "./supabaseClient";

// Le PDF de jsPDF ne gère pas les accents avec les polices standard :
// ils s'affichent comme des caractères parasites. On les retire donc,
// comme le fait déjà RapportsPage pour les rapports de cotisation.
function sansAccents(texte) {
  return String(texte ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function montant(v) {
  return Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function enTeteOng(params, periodeLabel) {
  const doc = new jsPDF();

  doc.setFillColor(13, 27, 76);
  doc.rect(0, 0, 210, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text(sansAccents(params.nom_mutuelle), 20, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(sansAccents(params.adresse || ""), 20, 21);
  doc.setFontSize(12.5);
  doc.setFont("helvetica", "bold");
  doc.text(`RAPPORT D'ACTIVITE - ${sansAccents(periodeLabel)}`, 20, 32);

  doc.setTextColor(26, 26, 23);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Genere le " + new Date().toLocaleDateString("fr-FR"), 20, 46);

  return doc;
}

function section(doc, titre, y, lignes) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(13, 27, 76);
  doc.text(sansAccents(titre), 20, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  lignes.forEach(([label, valeur]) => {
    doc.setFont("helvetica", "normal");
    doc.text(sansAccents(label), 24, y);
    doc.setFont("helvetica", "bold");
    doc.text(sansAccents(valeur), 150, y);
    y += 6;
  });

  return y + 4;
}

/**
 * Rapport d'activité pour une ONG : ce qu'elle a accompli sur la
 * période, pas ce qu'elle a collecté. Sert autant à rendre compte aux
 * bailleurs qu'à piloter en interne — d'où le détail par bénéficiaire
 * en fin de document.
 *
 * @param {object} params - le paramétrage de l'organisation
 * @param {string} debut - date ISO (AAAA-MM-JJ) incluse
 * @param {string} fin - date ISO incluse
 * @param {string} periodeLabel - intitulé affiché en tête
 */
export async function genererRapportOng(params, debut, fin, periodeLabel) {
  const debutIso = `${debut}T00:00:00`;
  const finIso = `${fin}T23:59:59`;

  const [benefRes, appuisRes, versRes, projetsRes, donsRes, opsRes, membresRes, indicRes] =
    await Promise.all([
      supabase.from("beneficiaires_ong").select("id, nom, sexe, created_at")
        .eq("organisation_id", params.organisation_id),
      supabase.from("appuis_agr")
        .select("*, beneficiaires_ong(nom)")
        .eq("organisation_id", params.organisation_id),
      supabase.from("appuis_agr_versements").select("appui_id, montant, statut, date_versement")
        .eq("organisation_id", params.organisation_id),
      supabase.from("projets_ong").select("id, nom, statut, budget_total")
        .eq("organisation_id", params.organisation_id),
      supabase.from("dons").select("montant, statut, created_at")
        .eq("organisation_id", params.organisation_id),
      supabase.from("operations_diverses").select("sens, montant, date_operation")
        .eq("organisation_id", params.organisation_id)
        .gte("date_operation", debut).lte("date_operation", fin),
      supabase.from("membres").select("id, actif")
        .eq("organisation_id", params.organisation_id),
      supabase.from("suivi_indicateurs")
        .select("projet_id, libelle, unite, valeur_reference, valeur_cible, derniere_valeur, derniere_date")
        .eq("organisation_id", params.organisation_id),
    ]);

  const dansPeriode = (iso) => iso && iso >= debutIso && iso <= finIso;

  const tousBeneficiaires = benefRes.data || [];
  const nouveauxBeneficiaires = tousBeneficiaires.filter((b) => dansPeriode(b.created_at));

  const tousAppuis = appuisRes.data || [];
  const appuisPeriode = tousAppuis.filter((a) => dansPeriode(a.transmis_le));
  const accordesPeriode = appuisPeriode.filter((a) =>
    a.statut === "accorde" || a.statut === "decaisse" || a.statut === "solde");
  const rejetesPeriode = appuisPeriode.filter((a) => a.statut === "rejete");

  const versements = (versRes.data || []).filter(
    (v) => v.statut === "depose" && v.date_versement >= debut && v.date_versement <= fin
  );
  const totalRembourseP = versements.reduce((s, v) => s + Number(v.montant), 0);

  const totalAccorde = accordesPeriode.reduce((s, a) => s + Number(a.montant_accorde || 0), 0);
  const totalDemande = appuisPeriode.reduce((s, a) => s + Number(a.montant_demande || 0), 0);

  // Encours : tous appuis décaissés non soldés, quelle que soit leur
  // date — un bailleur veut la situation à date, pas seulement ce qui
  // s'est passé pendant la période.
  const encours = tousAppuis
    .filter((a) => a.statut === "decaisse")
    .reduce((s, a) => {
      const depose = (versRes.data || [])
        .filter((v) => v.appui_id === a.id && v.statut === "depose")
        .reduce((t, v) => t + Number(v.montant), 0);
      return s + Math.max(Number(a.montant_a_rembourser || 0) - depose, 0);
    }, 0);

  const dons = (donsRes.data || []).filter(
    (d) => d.statut === "confirme" && dansPeriode(d.created_at)
  );
  const totalDons = dons.reduce((s, d) => s + Number(d.montant || 0), 0);

  const operations = opsRes.data || [];
  const recettes = operations.filter((o) => o.sens === "recette")
    .reduce((s, o) => s + Number(o.montant || 0), 0);
  const depenses = operations.filter((o) => o.sens === "depense")
    .reduce((s, o) => s + Number(o.montant || 0), 0);

  const projets = projetsRes.data || [];
  const membresActifs = (membresRes.data || []).filter((m) => m.actif).length;

  const femmes = nouveauxBeneficiaires.filter((b) => b.sexe === "F").length;
  const hommes = nouveauxBeneficiaires.filter((b) => b.sexe === "M").length;

  /* ---- Construction du document ---- */

  const doc = enTeteOng(params, periodeLabel);
  let y = 58;

  y = section(doc, "BENEFICIAIRES", y, [
    ["Beneficiaires suivis au total", String(tousBeneficiaires.length)],
    ["Nouveaux sur la periode", String(nouveauxBeneficiaires.length)],
    ["dont femmes", String(femmes)],
    ["dont hommes", String(hommes)],
  ]);

  y = section(doc, "APPUIS AUX ACTIVITES GENERATRICES DE REVENUS", y, [
    ["Demandes transmises", String(appuisPeriode.length)],
    ["Appuis accordes", String(accordesPeriode.length)],
    ["Demandes rejetees", String(rejetesPeriode.length)],
    ["Montant total demande", montant(totalDemande) + " F"],
    ["Montant total accorde", montant(totalAccorde) + " F"],
    ["Rembourse sur la periode", montant(totalRembourseP) + " F"],
    ["Encours restant du (a date)", montant(encours) + " F"],
  ]);

  if (y > 230) { doc.addPage(); y = 20; }

  y = section(doc, "RESSOURCES ET DEPENSES", y, [
    ["Dons recus", montant(totalDons) + " F"],
    ["Autres recettes", montant(recettes) + " F"],
    ["Depenses de fonctionnement", montant(depenses) + " F"],
    ["Solde de la periode", montant(recettes + totalDons - depenses) + " F"],
  ]);

  if (projets.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    y = section(doc, "PROJETS", y, [
      ["Projets en cours", String(projets.filter((p) => p.statut === "en_cours").length)],
      ["Budget total prevu", montant(projets.reduce((s, p) => s + Number(p.budget_total || 0), 0)) + " F"],
    ]);
  }

  y = section(doc, "ORGANISATION", y, [
    ["Membres actifs", String(membresActifs)],
  ]);

  /* ---- Détail par bénéficiaire appuyé ---- */

  if (accordesPeriode.length > 0) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(13, 27, 76);
    doc.text("DETAIL DES APPUIS ACCORDES", 20, 20);

    let yd = 30;
    doc.setFontSize(8);
    doc.setTextColor(107, 118, 132);
    doc.text("BENEFICIAIRE", 20, yd);
    doc.text("ACTIVITE", 75, yd);
    doc.text("ACCORDE", 135, yd);
    doc.text("REMBOURSE", 168, yd);
    yd += 5;
    doc.setDrawColor(220, 224, 230);
    doc.line(20, yd - 2, 195, yd - 2);

    doc.setTextColor(60, 60, 60);
    accordesPeriode.forEach((a) => {
      if (yd > 275) {
        doc.addPage();
        yd = 20;
      }
      const depose = (versRes.data || [])
        .filter((v) => v.appui_id === a.id && v.statut === "depose")
        .reduce((t, v) => t + Number(v.montant), 0);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(sansAccents(a.beneficiaires_ong?.nom || "-").slice(0, 30), 20, yd);
      doc.text(sansAccents(a.type_agr || a.activite_a_entreprendre || "-").slice(0, 32), 75, yd);
      doc.text(montant(a.montant_accorde) + " F", 135, yd);
      doc.text(montant(depose) + " F", 168, yd);
      yd += 6;
    });
  }

  /* ---- Indicateurs de suivi-évaluation, par projet ---- */

  const indicateurs = indicRes.data || [];
  if (indicateurs.length > 0) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(13, 27, 76);
    doc.text("SUIVI DES INDICATEURS", 20, 20);

    let yi = 30;

    projets.forEach((projet) => {
      const siens = indicateurs.filter((i) => i.projet_id === projet.id);
      if (siens.length === 0) return;

      if (yi > 250) { doc.addPage(); yi = 20; }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(13, 27, 76);
      doc.text(sansAccents(projet.nom).slice(0, 60), 20, yi);
      yi += 6;

      doc.setFontSize(7.5);
      doc.setTextColor(107, 118, 132);
      doc.text("INDICATEUR", 24, yi);
      doc.text("REFERENCE", 108, yi);
      doc.text("ATTEINT", 134, yi);
      doc.text("CIBLE", 158, yi);
      doc.text("TAUX", 180, yi);
      yi += 4;
      doc.setDrawColor(220, 224, 230);
      doc.line(24, yi - 2, 195, yi - 2);
      yi += 2;

      siens.forEach((ind) => {
        if (yi > 275) { doc.addPage(); yi = 20; }

        // Le taux se mesure depuis la valeur de référence, pas depuis
        // zéro : un indicateur partant de 40 pour atteindre 100 a
        // progressé de moitié à 70, pas de 70 %.
        const ref = Number(ind.valeur_reference || 0);
        const cible = Number(ind.valeur_cible || 0);
        const atteint = Number(ind.derniere_valeur || 0);
        const ecart = cible - ref;
        const taux = ecart !== 0
          ? Math.round(((atteint - ref) / ecart) * 100)
          : (atteint >= cible ? 100 : 0);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(60, 60, 60);
        doc.text(sansAccents(ind.libelle).slice(0, 44), 24, yi);
        doc.text(montant(ref), 108, yi);
        doc.text(montant(atteint), 134, yi);
        doc.text(montant(cible), 158, yi);

        // La couleur signale d'un coup d'œil où le projet décroche.
        if (taux >= 80) doc.setTextColor(46, 125, 50);
        else if (taux >= 50) doc.setTextColor(245, 124, 0);
        else doc.setTextColor(211, 47, 47);
        doc.setFont("helvetica", "bold");
        doc.text(`${Math.max(taux, 0)} %`, 180, yi);

        yi += 6;
      });

      yi += 4;
    });
  }

  const nomFichier = `rapport-activite-${sansAccents(params.nom_mutuelle)
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${periodeLabel.replace(/[^\w]+/g, "-")}.pdf`;
  doc.save(nomFichier);
}