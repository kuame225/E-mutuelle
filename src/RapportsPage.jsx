import React, { useEffect, useState } from "react";
import {
  Download, FileText, Loader2, CalendarRange, CalendarDays,
  TrendingUp, Users, Wallet, AlertCircle, BarChart3, Lock,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

export default function RapportsPage() {
  const { params } = useParametrage();
  const [donnees, setDonnees] = useState({ mois: [], trimestres: [], annees: [] });
  const [libellesAide, setLibellesAide] = useState({});
  const [loading, setLoading] = useState(true);
  const [genere, setGenere] = useState(null);
  const [erreur, setErreur] = useState("");
  const [onglet, setOnglet] = useState("mensuel");
  const [exercicesClotures, setExercicesClotures] = useState([]);
  const [confirmationCloture, setConfirmationCloture] = useState(null); // année
  const [clotureEnCours, setClotureEnCours] = useState(false);

  async function chargerExercicesClotures() {
    const { data } = await supabase
      .from("exercices_clotures")
      .select("annee")
      .eq("organisation_id", params.organisation_id);
    setExercicesClotures((data || []).map((e) => e.annee));
  }

  async function cloturerExercice(annee) {
    setClotureEnCours(true);
    const { error } = await supabase.rpc("cloturer_exercice", {
      p_organisation_id: params.organisation_id,
      p_annee: Number(annee),
    });
    setClotureEnCours(false);
    if (error) { setErreur(error.message); return; }
    setConfirmationCloture(null);
    chargerExercicesClotures();
  }

  useEffect(() => {
    if (params.organisation_id) chargerExercicesClotures();
  }, [params.organisation_id]);

  useEffect(() => {
    async function charger() {
      const [cotRes, baremeRes] = await Promise.all([
        supabase.from("cotisations")
          .select("periode, montant_du, montant_paye, statut")
          .eq("organisation_id", params.organisation_id),
        supabase.from("bareme_prestations")
          .select("type_aide, libelle")
          .eq("organisation_id", params.organisation_id),
      ]);

      const map = {};
      (baremeRes.data || []).forEach((b) => { map[b.type_aide] = b.libelle; });
      setLibellesAide(map);

      const cotisations = cotRes.data || [];
      const parMois = {};

      cotisations.forEach((c) => {
        if (!parMois[c.periode]) {
          parMois[c.periode] = { du: 0, paye: 0, total: 0, regles: 0 };
        }
        const m = parMois[c.periode];
        m.du += c.montant_du;
        m.paye += c.montant_paye;
        m.total += 1;
        if (c.statut === "paye") m.regles += 1;
      });

      const mois = Object.entries(parMois)
        .map(([periode, v]) => ({
          periode, ...v,
          taux: v.total ? Math.round((v.regles / v.total) * 100) : 0,
        }))
        .sort((a, b) => b.periode.localeCompare(a.periode));

      // Agrégation annuelle — même principe que trimestrielle, juste
      // regroupée par année plutôt que par groupe de 3 mois.
      const parAnnee = {};
      mois.forEach((m) => {
        const annee = m.periode.slice(0, 4);
        if (!parAnnee[annee]) parAnnee[annee] = { du: 0, paye: 0, total: 0, regles: 0 };
        parAnnee[annee].du += m.du;
        parAnnee[annee].paye += m.paye;
        parAnnee[annee].total += m.total;
        parAnnee[annee].regles += m.regles;
      });

      const annees = Object.entries(parAnnee)
        .map(([periode, v]) => ({
          periode, ...v,
          taux: v.total ? Math.round((v.regles / v.total) * 100) : 0,
        }))
        .sort((a, b) => b.periode.localeCompare(a.periode));

      // Agrégation trimestrielle
      const parTrim = {};
      mois.forEach((m) => {
        const [annee, mm] = m.periode.split("-");
        const t = `${annee}-T${Math.ceil(parseInt(mm) / 3)}`;
        if (!parTrim[t]) parTrim[t] = { du: 0, paye: 0, total: 0, regles: 0 };
        parTrim[t].du += m.du;
        parTrim[t].paye += m.paye;
        parTrim[t].total += m.total;
        parTrim[t].regles += m.regles;
      });

      const trimestres = Object.entries(parTrim)
        .map(([periode, v]) => ({
          periode, ...v,
          taux: v.total ? Math.round((v.regles / v.total) * 100) : 0,
        }))
        .sort((a, b) => b.periode.localeCompare(a.periode));

      setDonnees({ mois, trimestres, annees });
      setLoading(false);
    }
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  /* ---------- Génération PDF ---------- */

  async function genererMensuel(periode) {
    setGenere(periode);
    setErreur("");

    try {
      const [cotRes, memRes, aideRes] = await Promise.all([
        supabase.from("cotisations")
          .select("*, membres(nom, poste)")
          .eq("periode", periode)
          .eq("organisation_id", params.organisation_id),
        supabase.from("membres")
          .select("id")
          .eq("actif", true)
          .eq("organisation_id", params.organisation_id),
        supabase.from("aides_sociales")
          .select("*, membres(nom)")
          .eq("statut", "payee")
          .eq("organisation_id", params.organisation_id),
      ]);

      const cotisations = cotRes.data || [];
      const aides = (aideRes.data || []).filter(
        (a) => (a.decide_le || a.created_at || "").slice(0, 7) === periode
      );

      const paye = cotisations.reduce((s, c) => s + c.montant_paye, 0);
      const regles = cotisations.filter((c) => c.statut === "paye").length;
      const taux = cotisations.length ? Math.round((regles / cotisations.length) * 100) : 0;
      const totalAides = aides.reduce((s, a) => s + (a.montant_valide || 0), 0);

      const doc = enTete(params, "RAPPORT MENSUEL", formatPeriode(periode).toUpperCase());

      encadreChiffres(doc, [
        ["Membres actifs", String((memRes.data || []).length)],
        ["Cotisations reglees", `${regles}/${cotisations.length}`],
        ["Taux de reglement du mois", taux + " %"],
        ["Montant encaisse", montant(paye) + " F"],
        ["Aides versees", montant(totalAides) + " F"],
        ["Solde de la periode", montant(paye - totalAides) + " F"],
      ]);

      let y = tableauCotisations(doc, cotisations, 100);

      if (aides.length && y < 235) {
        y = tableauAides(doc, aides, y + 10, libellesAide);
      }

      piedDePage(doc, params);
      doc.save(`rapport-mensuel-${motCle(params.nom_mutuelle)}-${periode}.pdf`);
    } catch (e) {
      setErreur("Erreur lors de la génération : " + e.message);
    }
    setGenere(null);
  }

  async function genererTrimestriel(trimestre) {
    setGenere(trimestre);
    setErreur("");

    try {
      const [annee, t] = trimestre.split("-T");
      const debut = `${annee}-${String((parseInt(t) - 1) * 3 + 1).padStart(2, "0")}`;
      const fin = `${annee}-${String((parseInt(t) - 1) * 3 + 3).padStart(2, "0")}`;

      const [cotRes, memRes, tickRes] = await Promise.all([
        supabase.from("cotisations")
          .select("*")
          .gte("periode", debut).lte("periode", fin)
          .eq("organisation_id", params.organisation_id),
        supabase.from("membres")
          .select("id")
          .eq("actif", true)
          .eq("organisation_id", params.organisation_id),
        supabase.from("tombola_tickets")
          .select("*")
          .eq("trimestre", trimestre)
          .eq("organisation_id", params.organisation_id),
      ]);

      const cotisations = cotRes.data || [];
      const tickets = tickRes.data || [];
      const paye = cotisations.reduce((s, c) => s + c.montant_paye, 0);
      const du = cotisations.reduce((s, c) => s + c.montant_du, 0);
      const bonus = tickets.filter((k) => k.type_ticket === "bonus").length;
      const payants = tickets.filter((k) => k.type_ticket === "payant").length;

      const doc = enTete(params, "RAPPORT TRIMESTRIEL", libelleTrimestre(trimestre).toUpperCase());

      encadreChiffres(doc, [
        ["Membres actifs", String((memRes.data || []).length)],
        ["Montant attendu", montant(du) + " F"],
        ["Montant encaisse", montant(paye) + " F"],
        ["Tickets bonus", String(bonus)],
        ["Tickets vendus", String(payants)],
        ["Cagnotte tombola", montant(payants * (params.prix_ticket_tombola || 1000)) + " F"],
      ]);

      // Détail par mois
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(13, 71, 161);
      doc.text("Detail par mois", 20, 100);
      doc.setDrawColor(245, 124, 0);
      doc.setLineWidth(0.7);
      doc.line(20, 102, 68, 102);

      doc.setFillColor(13, 71, 161);
      doc.rect(15, 107, 180, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text("PERIODE", 18, 112.5);
      doc.text("COTISATIONS", 65, 112.5);
      doc.text("ATTENDU", 105, 112.5);
      doc.text("ENCAISSE", 140, 112.5);
      doc.text("TAUX", 178, 112.5);

      let y = 121;
      for (let i = 0; i < 3; i++) {
        const p = `${annee}-${String((parseInt(t) - 1) * 3 + 1 + i).padStart(2, "0")}`;
        const lignes = cotisations.filter((c) => c.periode === p);
        const d = lignes.reduce((s, c) => s + c.montant_du, 0);
        const pa = lignes.reduce((s, c) => s + c.montant_paye, 0);
        const r = lignes.filter((c) => c.statut === "paye").length;
        const tx = lignes.length ? Math.round((r / lignes.length) * 100) : 0;

        if (i % 2 === 0) {
          doc.setFillColor(245, 247, 250);
          doc.rect(15, y - 4.5, 180, 7.5, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setTextColor(26, 26, 23);
        doc.setFontSize(8);
        doc.text(sansAccents(formatPeriode(p)), 18, y);
        doc.text(String(lignes.length), 65, y);
        doc.text(montant(d) + " F", 105, y);
        doc.text(montant(pa) + " F", 140, y);
        doc.setTextColor(...(tx >= 90 ? [46, 125, 50] : tx >= 60 ? [245, 124, 0] : [211, 47, 47]));
        doc.text(tx + " %", 178, y);
        y += 8;
      }

      piedDePage(doc, params);
      doc.save(`rapport-trimestriel-${motCle(params.nom_mutuelle)}-${trimestre}.pdf`);
    } catch (e) {
      setErreur("Erreur lors de la génération : " + e.message);
    }
    setGenere(null);
  }

  // Le socle (membres, finances, assemblées) est commun à toutes les
  // organisations — les modules au-delà (tombola, tontine, prêts,
  // parts sociales, projets) ne sont volontairement pas couverts ici :
  // chacun a son propre schéma à vérifier avant d'agréger des chiffres,
  // plutôt que de deviner et risquer un total silencieusement faux dans
  // un document présenté en assemblée.
  async function genererAnnuel(annee) {
    setGenere(annee);
    setErreur("");

    try {
      const debut = `${annee}-01-01`;
      const fin = `${annee}-12-31`;

      const [membresRes, operationsRes, assembleesRes, aidesRes] = await Promise.all([
        supabase.from("membres")
          .select("id, statut_cotisation, date_adhesion, actif")
          .eq("organisation_id", params.organisation_id),
        supabase.from("operations_diverses")
          .select("sens, montant")
          .eq("organisation_id", params.organisation_id)
          .gte("date_operation", debut).lte("date_operation", fin),
        supabase.from("assemblees")
          .select("id")
          .eq("organisation_id", params.organisation_id)
          .gte("date_prevue", `${debut}T00:00:00`).lte("date_prevue", `${fin}T23:59:59`),
        supabase.from("aides_sociales")
          .select("montant_valide")
          .eq("organisation_id", params.organisation_id)
          .eq("statut", "payee")
          .gte("decide_le", `${debut}T00:00:00`).lte("decide_le", `${fin}T23:59:59`),
      ]);

      const membresActifs = (membresRes.data || []).filter((m) => m.actif !== false);
      const totalMembres = membresActifs.length;
      const membresAJour = membresActifs.filter((m) => m.statut_cotisation === "a_jour").length;
      const membresEnRetard = totalMembres - membresAJour;
      const nouveauxMembres = membresActifs.filter((m) => {
        if (!m.date_adhesion) return false;
        const d = String(m.date_adhesion).slice(0, 10);
        return d >= debut && d <= fin;
      }).length;

      const cotAnnee = donnees.mois.filter((m) => m.periode.startsWith(annee));
      const totalCotisations = cotAnnee.reduce((s, m) => s + m.paye, 0);

      const operations = operationsRes.data || [];
      const totalRecettesDiverses = operations.filter((o) => o.sens === "recette").reduce((s, o) => s + (o.montant || 0), 0);
      const totalDepenses = operations.filter((o) => o.sens === "depense").reduce((s, o) => s + (o.montant || 0), 0);
      const totalAidesVersees = (aidesRes.data || []).reduce((s, a) => s + (a.montant_valide || 0), 0);
      const totalRecettes = totalCotisations + totalRecettesDiverses;
      const solde = totalRecettes - totalDepenses - totalAidesVersees;

      const nombreAssemblees = (assembleesRes.data || []).length;

      const doc = enTete(params, "RAPPORT ANNUEL", annee);

      let y = 60;
      y = sectionAnnuelle(doc, "MEMBRES", y, [
        ["Membres actifs", String(totalMembres)],
        ["A jour de cotisation", String(membresAJour)],
        ["En retard de cotisation", String(membresEnRetard)],
        ["Nouveaux membres dans l'annee", String(nouveauxMembres)],
      ]);

      y += 6;
      y = sectionAnnuelle(doc, "FINANCES", y, [
        ["Cotisations encaissees", montant(totalCotisations) + " F"],
        ["Autres recettes", montant(totalRecettesDiverses) + " F"],
        ["Total des recettes", montant(totalRecettes) + " F"],
        ["Total des depenses", montant(totalDepenses) + " F"],
        ["Aides sociales versees", montant(totalAidesVersees) + " F"],
      ]);

      y += 4;
      doc.setFillColor(13, 71, 161);
      doc.roundedRect(15, y, 180, 22, 4, 4, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Solde de l'exercice", 20, y + 9);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(montant(solde) + " F", 20, y + 18);
      y += 32;

      y = sectionAnnuelle(doc, "VIE ASSOCIATIVE", y, [
        ["Assemblees generales tenues dans l'annee", String(nombreAssemblees)],
      ]);

      piedDePage(doc, params);
      doc.save(`rapport-annuel-${motCle(params.nom_mutuelle)}-${annee}.pdf`);
    } catch (e) {
      setErreur("Erreur lors de la génération : " + e.message);
    }
    setGenere(null);
  }

  const liste = onglet === "mensuel" ? donnees.mois
    : onglet === "trimestriel" ? donnees.trimestres
    : donnees.annees;


  if (loading) {
    return (
      <div className="rp-wrap">
        <style>{CSS}</style>
        <div className="rp-skel" /><div className="rp-skel" />
      </div>
    );
  }

  return (
    <div className="rp-wrap">
      <style>{CSS}</style>

      <header className="rp-head">
        <div>
          <h1 className="rp-titre">Rapports</h1>
          <p className="rp-sub">
            Documents PDF prêts à être présentés au Bureau ou en assemblée.
          </p>
        </div>
      </header>

      {erreur && (
        <div className="rp-erreur"><AlertCircle size={17} /> {erreur}</div>
      )}

      <nav className="rp-onglets">
        <button
          className={`rp-onglet ${onglet === "mensuel" ? "is-on" : ""}`}
          onClick={() => setOnglet("mensuel")}
        >
          <CalendarDays size={16} /> Mensuels
          <span className="rp-badge">{donnees.mois.length}</span>
        </button>
        <button
          className={`rp-onglet ${onglet === "trimestriel" ? "is-on" : ""}`}
          onClick={() => setOnglet("trimestriel")}
        >
          <CalendarRange size={16} /> Trimestriels
          <span className="rp-badge">{donnees.trimestres.length}</span>
        </button>
        <button
          className={`rp-onglet ${onglet === "annuel" ? "is-on" : ""}`}
          onClick={() => setOnglet("annuel")}
        >
          <BarChart3 size={16} /> Annuels
          <span className="rp-badge">{donnees.annees.length}</span>
        </button>
      </nav>

      {liste.length === 0 ? (
        <div className="rp-vide">
          <BarChart3 size={38} color={PALETTE.grey300} />
          <div className="rp-vide-titre">Aucune période disponible</div>
          <div className="rp-vide-sub">
            Générez d'abord les cotisations d'un mois pour pouvoir produire un rapport.
          </div>
        </div>
      ) : (
        <ul className="rp-liste">
          {liste.map((p) => {
            const enCours = genere === p.periode;
            return (
              <li key={p.periode} className="rp-carte">
                <div className="rp-carte-head">
                  <span className="rp-carte-icon">
                    <FileText size={20} />
                  </span>
                  <div className="rp-carte-id">
                    <div className="rp-carte-titre">
                      {onglet === "mensuel" ? formatPeriode(p.periode)
                        : onglet === "trimestriel" ? libelleTrimestre(p.periode)
                        : p.periode}
                    </div>
                    <div className="rp-carte-sous">
                      {p.regles}/{p.total} cotisation{p.total > 1 ? "s" : ""} réglée{p.regles > 1 ? "s" : ""}
                    </div>
                  </div>
                  <button
                    className="rp-btn"
                    disabled={enCours}
                    onClick={() =>
                      onglet === "mensuel" ? genererMensuel(p.periode)
                        : onglet === "trimestriel" ? genererTrimestriel(p.periode)
                        : genererAnnuel(p.periode)
                    }
                  >
                    {enCours
                      ? <><Loader2 size={15} className="rp-spin" /> Génération…</>
                      : <><Download size={15} /> Télécharger</>}
                  </button>
                </div>

                <div className="rp-chiffres">
                  <div className="rp-chiffre">
                    <Wallet size={14} />
                    <span>{montant(p.paye)} <em>/ {montant(p.du)} F</em></span>
                  </div>
                  <div className="rp-chiffre">
                    <Users size={14} />
                    <span>{p.total} membre{p.total > 1 ? "s" : ""}</span>
                  </div>
                  <div className="rp-chiffre">
                    <TrendingUp size={14} />
                    <span
                      style={{
                        color: p.taux >= (params.objectif_recouvrement || 90)
                          ? C.success : p.taux >= 60 ? C.warning : C.danger,
                        fontWeight: 700,
                      }}
                    >
                      {p.taux} %
                    </span>
                  </div>
                </div>

                <div className="rp-jauge">
                  <div
                    style={{
                      width: `${Math.min(p.taux, 100)}%`,
                      background: p.taux >= (params.objectif_recouvrement || 90)
                        ? C.success : p.taux >= 60 ? C.warning : C.danger,
                    }}
                  />
                </div>

                {onglet === "annuel" && (
                  <div className="rp-cloture">
                    {exercicesClotures.includes(Number(p.periode)) ? (
                      <span className="rp-cloture-badge">
                        <Lock size={13} /> Exercice clôturé
                      </span>
                    ) : (
                      <button
                        className="rp-cloture-btn"
                        onClick={() => setConfirmationCloture(p.periode)}
                      >
                        <Lock size={13} /> Clôturer cet exercice
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {confirmationCloture && (
        <div className="rp-overlay" onClick={() => setConfirmationCloture(null)}>
          <div className="rp-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="rp-modal-titre">Clôturer l'exercice {confirmationCloture} ?</h3>
            <p className="rp-modal-texte">
              Une fois clôturé, plus aucun paiement ni aucune opération diverse datée de{" "}
              {confirmationCloture} ne pourra être modifié ou supprimé — par personne, y compris
              un administrateur technique. Cette action est définitive.
            </p>
            {erreur && <div className="rp-erreur"><AlertCircle size={15} /> {erreur}</div>}
            <div className="rp-modal-actions">
              <button
                className="rp-mbtn rp-mbtn-ghost"
                onClick={() => setConfirmationCloture(null)}
                disabled={clotureEnCours}
              >
                Annuler
              </button>
              <button
                className="rp-mbtn rp-mbtn-primary"
                onClick={() => cloturerExercice(confirmationCloture)}
                disabled={clotureEnCours}
              >
                {clotureEnCours ? "Clôture…" : "Clôturer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Constructeurs PDF ---------------- */

function enTete(params, type, periode) {
  const doc = new jsPDF();

  doc.setFillColor(13, 71, 161);
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
  doc.text(`${type} - ${sansAccents(periode)}`, 20, 32);

  doc.setTextColor(26, 26, 23);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Genere le " + new Date().toLocaleDateString("fr-FR"), 20, 46);

  return doc;
}

function encadreChiffres(doc, entrees) {
  doc.setFillColor(245, 247, 250);
  doc.rect(15, 52, 180, 34, "F");

  entrees.forEach(([label, valeur], i) => {
    const x = 22 + (i % 3) * 60;
    const y = i < 3 ? 62 : 77;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 118, 132);
    doc.setFontSize(7.5);
    doc.text(sansAccents(label), x, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(13, 71, 161);
    doc.setFontSize(11);
    doc.text(valeur, x, y + 7);
  });
}

// Disposition verticale plutôt que la grille compacte de
// encadreChiffres — le rapport annuel a trop de lignes pour tenir dans
// une grille à 6 cases fixes.
function sectionAnnuelle(doc, titre, y, lignes) {
  doc.setFillColor(255, 243, 224);
  doc.rect(15, y - 6, 180, 10, "F");
  doc.setTextColor(13, 71, 161);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(sansAccents(titre), 20, y + 1);
  y += 14;

  lignes.forEach(([libelle, valeur]) => {
    doc.setTextColor(26, 26, 23);
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "normal");
    doc.text(sansAccents(libelle), 20, y);
    doc.setFont("helvetica", "bold");
    doc.text(valeur, 190, y, { align: "right" });
    y += 9;
  });

  return y;
}

function tableauCotisations(doc, cotisations, yDepart) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(13, 71, 161);
  doc.text("Detail des cotisations", 20, yDepart);
  doc.setDrawColor(245, 124, 0);
  doc.setLineWidth(0.7);
  doc.line(20, yDepart + 2, 82, yDepart + 2);

  let y = yDepart + 7;
  doc.setFillColor(13, 71, 161);
  doc.rect(15, y, 180, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("MEMBRE", 18, y + 5.5);
  doc.text("POSTE", 78, y + 5.5);
  doc.text("DU", 128, y + 5.5);
  doc.text("PAYE", 152, y + 5.5);
  doc.text("STATUT", 176, y + 5.5);

  y += 14;
  const libelles = {
    paye: "Paye", partiel: "Partiel", en_attente: "En attente",
    en_retard: "Retard", exempte: "Exempte",
  };

  cotisations.forEach((c, i) => {
    if (y > 262) return;
    if (i % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(15, y - 4.5, 180, 7.5, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(26, 26, 23);
    doc.setFontSize(7.5);
    doc.text(sansAccents((c.membres?.nom || "—").slice(0, 30)), 18, y);
    doc.text(sansAccents((c.membres?.poste || "—").slice(0, 24)), 78, y);
    doc.text(montant(c.montant_du), 128, y);
    doc.text(montant(c.montant_paye), 152, y);

    doc.setTextColor(...(c.statut === "paye" ? [46, 125, 50]
      : c.statut === "partiel" ? [245, 124, 0] : [211, 47, 47]));
    doc.text(libelles[c.statut] || c.statut, 176, y);
    y += 7.5;
  });

  return y;
}

function tableauAides(doc, aides, yDepart, libellesAide = {}) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(13, 71, 161);
  doc.text("Aides versees", 20, yDepart);
  doc.setDrawColor(245, 124, 0);
  doc.line(20, yDepart + 2, 58, yDepart + 2);

  let y = yDepart + 7;
  doc.setFillColor(13, 71, 161);
  doc.rect(15, y, 180, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("MEMBRE", 18, y + 5.5);
  doc.text("MOTIF", 88, y + 5.5);
  doc.text("MONTANT", 165, y + 5.5);

  y += 14;
  aides.forEach((a, i) => {
    if (y > 268) return;
    if (i % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(15, y - 4.5, 180, 7.5, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(26, 26, 23);
    doc.setFontSize(7.5);
    doc.text(sansAccents((a.membres?.nom || "—").slice(0, 34)), 18, y);
    // Libellé officiel du barème plutôt que le code technique
    const motif = libellesAide[a.type_aide] || a.type_aide.replace(/_/g, " ");
    doc.text(sansAccents(motif).slice(0, 40), 88, y);
    doc.text(montant(a.montant_valide || 0) + " F", 165, y);
    y += 7.5;
  });

  return y;
}

function piedDePage(doc, params) {
  const sigle = sansAccents(params.nom_mutuelle);
  const localite = sansAccents(params.localite || "");

  doc.setFillColor(13, 71, 161);
  doc.rect(0, 282, 210, 15, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Rapport genere par " + sigle + (localite ? " - " + localite : ""),
    20, 290
  );
}

/* ---------------- Utilitaires ---------------- */

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function sansAccents(t) {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function motCle(texte) {
  return sansAccents(texte)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function formatPeriode(p) {
  const mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const [annee, m] = String(p).split("-");
  const index = parseInt(m, 10) - 1;
  return mois[index] ? `${mois[index]} ${annee}` : p;
}

function libelleTrimestre(t) {
  const [annee, tr] = String(t).split("-T");
  const p = {
    1: "Janvier — Mars", 2: "Avril — Juin",
    3: "Juillet — Septembre", 4: "Octobre — Décembre",
  };
  return `${p[tr] || t} ${annee}`;
}

/* ---------------- Styles ---------------- */

const CSS = `
.rp-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .rp-wrap{ padding:${S.lg}px; } }

.rp-titre{ font-size:22px; font-weight:700; letter-spacing:-.02em; margin:0; }
.rp-sub{ font-size:14px; color:${C.textSubtle}; margin:4px 0 0; }

.rp-erreur{
  display:flex; align-items:center; gap:10px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
}

/* ---- Onglets ---- */
.rp-onglets{
  display:flex; gap:4px; background:${C.bg};
  padding:4px; border-radius:${R.md}px; align-self:flex-start;
}
.rp-onglet{
  display:flex; align-items:center; gap:8px;
  border:none; background:transparent; cursor:pointer;
  padding:11px 18px; border-radius:${R.sm}px;
  font-family:inherit; font-size:14px; font-weight:600; color:${C.textSubtle};
  transition:all .16s ease;
}
.rp-onglet:hover{ color:${C.primary}; }
.rp-onglet.is-on{ background:${C.surface}; color:${C.primary}; box-shadow:${SHADOW.xs}; }
.rp-badge{
  background:${PALETTE.grey200}; color:${C.textMuted};
  border-radius:${R.pill}px; padding:1px 8px; font-size:11.5px; font-weight:700;
}
.rp-onglet.is-on .rp-badge{ background:${PALETTE.blue100}; color:${C.primary}; }

/* ---- Cartes ---- */
.rp-liste{
  list-style:none; margin:0; padding:0; display:grid; gap:${S.md}px;
  grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));
}
.rp-carte{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
  transition:transform .15s ease, box-shadow .18s ease;
}
.rp-carte:hover{ transform:translateY(-2px); box-shadow:${SHADOW.md}; }
.rp-carte-head{ display:flex; align-items:center; gap:${S.md}px; }
.rp-carte-icon{
  width:42px; height:42px; border-radius:${R.md}px; flex-shrink:0;
  background:${PALETTE.blue50}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.rp-carte-id{ flex:1; min-width:0; }
.rp-carte-titre{ font-size:15.5px; font-weight:700; letter-spacing:-.01em; }
.rp-carte-sous{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }
.rp-btn{
  display:flex; align-items:center; gap:7px; flex-shrink:0;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.sm}px; padding:10px 14px; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:600;
  transition:background .18s ease;
}
.rp-btn:hover:not(:disabled){ background:${C.primaryDark}; }
.rp-btn:disabled{ opacity:.65; cursor:not-allowed; }

.rp-chiffres{
  display:flex; gap:${S.lg}px; flex-wrap:wrap;
  margin-top:${S.lg}px; padding-top:${S.md}px;
  border-top:1px solid ${C.border};
}
.rp-chiffre{
  display:flex; align-items:center; gap:7px;
  font-size:13px; color:${C.textMuted};
}
.rp-chiffre em{ font-style:normal; color:${C.textSubtle}; font-size:12px; }

.rp-jauge{
  height:6px; border-radius:${R.pill}px; background:${PALETTE.grey200};
  margin-top:${S.md}px; overflow:hidden;
}
.rp-jauge div{ height:100%; border-radius:${R.pill}px; transition:width .5s ease; }

.rp-cloture{ margin-top:${S.md}px; padding-top:${S.md}px; border-top:1px solid ${C.border}; }
.rp-cloture-badge{
  display:inline-flex; align-items:center; gap:6px;
  background:${PALETTE.grey200}; color:${C.textMuted};
  border-radius:${R.pill}px; padding:6px 13px; font-size:12.5px; font-weight:600;
}
.rp-cloture-btn{
  display:flex; align-items:center; gap:6px;
  background:none; border:1.5px solid ${C.danger}; color:${C.danger};
  border-radius:${R.pill}px; padding:8px 14px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600;
}
.rp-cloture-btn:hover{ background:${C.dangerSoft}; }

.rp-overlay{
  position:fixed; inset:0; z-index:200; background:rgba(10,20,40,.5);
  display:flex; align-items:center; justify-content:center; padding:${S.lg}px;
}
.rp-modal{ background:${C.surface}; border-radius:${R.xxl}px; padding:${S.xl}px; width:100%; max-width:440px; }
.rp-modal-titre{ font-size:18px; font-weight:700; margin:0 0 10px; }
.rp-modal-texte{ font-size:13.5px; color:${C.textMuted}; line-height:1.6; margin:0 0 16px; }
.rp-erreur{
  display:flex; align-items:flex-start; gap:8px; background:${C.dangerSoft}; color:${C.danger};
  border-radius:${R.md}px; padding:11px 13px; font-size:13px; margin-bottom:16px;
}
.rp-modal-actions{ display:flex; gap:10px; }
.rp-mbtn{
  flex:1; display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:12px 0; cursor:pointer; border:none;
  font-family:inherit; font-size:14px; font-weight:600;
}
.rp-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.rp-mbtn-primary{ flex:2; background:${C.danger}; color:#fff; }
.rp-mbtn-ghost{ background:${C.surface}; color:${C.textMuted}; border:1.5px solid ${C.border}; }

/* ---- Divers ---- */
.rp-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.rp-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.rp-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:42ch; line-height:1.6; }
.rp-skel{
  height:150px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:rpShim 1.4s infinite;
}
.rp-spin{ animation:rpSpin 1s linear infinite; }
@keyframes rpSpin{ to{ transform:rotate(360deg); } }
@keyframes rpShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;