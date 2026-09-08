import React, { useEffect, useState } from "react";
import {
  Users, Plus, Search, Loader2, AlertCircle, CheckCircle2, XCircle,
  HandCoins, ArrowLeft, Clock, Banknote, MapPin, Download, Pencil,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { usePermissions } from "./usePermissions";
import ReprendreAppuiModal from "./ReprendreAppuiModal";
import { C, R, S, SHADOW, PALETTE } from "./theme";

function montant(v) {
  return Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const STATUTS = {
  transmis: { label: "Transmis", couleur: C.warning, fond: "#FEF3C7", Icone: Clock },
  accorde: { label: "Accordé", couleur: C.primary, fond: PALETTE.blue100, Icone: CheckCircle2 },
  decaisse: { label: "Décaissé", couleur: C.success, fond: "#DCFCE7", Icone: Banknote },
  solde: { label: "Soldé", couleur: C.textMuted, fond: PALETTE.grey200, Icone: CheckCircle2 },
  rejete: { label: "Rejeté", couleur: C.danger, fond: "#FEE2E2", Icone: XCircle },
};

// Nombre de jours avant l'échéance à partir duquel on prévient. Assez
// tôt pour que l'ASC ait le temps de passer voir le bénéficiaire,
// assez tard pour ne pas alerter dans le vide.
const JOURS_ALERTE_PREVENTIVE = 30;

/**
 * L'état de remboursement d'un appui décaissé : à jour, échéance
 * proche, ou en retard. Un appui déjà soldé n'est jamais en retard,
 * même si sa date de fin est passée — il a été remboursé.
 */
function etatEcheance(appui, totalDepose) {
  if (appui.statut !== "decaisse") return null;
  if (!appui.date_fin_remboursement) return null;
  if (appui.montant_a_rembourser != null && totalDepose >= appui.montant_a_rembourser) return null;

  const fin = new Date(appui.date_fin_remboursement);
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const jours = Math.ceil((fin - aujourdhui) / 86400000);

  if (jours < 0) {
    return {
      niveau: "retard",
      label: `En retard de ${Math.abs(jours)} jour${Math.abs(jours) > 1 ? "s" : ""}`,
      couleur: C.danger, fond: "#FEE2E2",
    };
  }
  if (jours <= JOURS_ALERTE_PREVENTIVE) {
    return {
      niveau: "proche",
      label: jours === 0 ? "Échéance aujourd'hui" : `Échéance dans ${jours} jour${jours > 1 ? "s" : ""}`,
      couleur: C.warning, fond: "#FEF3C7",
    };
  }
  return null;
}

const BENEFICIAIRE_VIDE = {
  nom: "", sexe: "", annee_naissance: "", activite_professionnelle: "",
  lieu_residence: "", contact: "", centre_pec: "", code_pec: "",
  statut_matrimonial: "", scolarise: "",
  latitude: null, longitude: null, precision_gps: null,
};

export default function BeneficiairesAgrPage() {
  const { params } = useParametrage();
  // L'ASC saisit et transmet ; le responsable AGR décide et décaisse.
  // Les boutons de chacun sont masqués à l'autre — la base refuse déjà
  // l'action, mais un bouton qui échoue systématiquement déroute.
  const { peut } = usePermissions();
  const estAsc = peut("beneficiaires_ong");
  const estResponsableAgr = peut("appuis_agr");
  const [onglet, setOnglet] = useState("beneficiaires");
  const [beneficiaires, setBeneficiaires] = useState([]);
  const [appuis, setAppuis] = useState([]);
  const [versements, setVersements] = useState([]);
  const [remboursementPour, setRemboursementPour] = useState(null);
  const [ficheOuverte, setFicheOuverte] = useState(null);
  const [repriseOuverte, setRepriseOuverte] = useState(false);
  const [periode, setPeriode] = useState({ debut: "", fin: "" });
  const [exportOuvert, setExportOuvert] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [nouveauBenef, setNouveauBenef] = useState(false);
  const [demandePour, setDemandePour] = useState(null);
  const [appuiATraiter, setAppuiATraiter] = useState(null);
  const [erreur, setErreur] = useState("");

  async function charger() {
    setLoading(true);
    const [{ data: b }, { data: a }, { data: v }] = await Promise.all([
      supabase.from("beneficiaires_ong").select("*")
        .eq("organisation_id", params.organisation_id)
        .order("created_at", { ascending: false }),
      supabase.from("appuis_agr").select("*, beneficiaires_ong(nom, contact, sexe, lieu_residence)")
        .eq("organisation_id", params.organisation_id)
        .order("transmis_le", { ascending: false }),
      supabase.from("appuis_agr_versements").select("*")
        .eq("organisation_id", params.organisation_id)
        .order("date_versement", { ascending: false }),
    ]);
    setBeneficiaires(b || []);
    setAppuis(a || []);
    setVersements(v || []);
    setLoading(false);
  }

  useEffect(() => {
    if (params.organisation_id) charger();
  }, [params.organisation_id]);

  const benefFiltres = beneficiaires.filter((b) =>
    b.nom.toLowerCase().includes(recherche.toLowerCase().trim())
  );

  // Reproduit exactement la mise en page de leur fichier de suivi :
  // quatre sections d'en-tête, six versements en colonnes fixes, puis
  // total, solde et observation. Le format leur permet de transmettre
  // le document tel quel, sans le retravailler à la main.
  function exporterFormatSuivi() {
    const debut = periode.debut ? new Date(periode.debut) : null;
    const fin = periode.fin ? new Date(periode.fin + "T23:59:59") : null;

    const dansPeriode = (dateIso) => {
      if (!dateIso) return false;
      const d = new Date(dateIso);
      if (debut && d < debut) return false;
      if (fin && d > fin) return false;
      return true;
    };

    const echapper = (v) => {
      if (v == null) return "";
      const s = String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const ligne = (cellules) => cellules.map(echapper).join(";");
    const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");

    const retenus = appuis.filter((a) => dansPeriode(a.transmis_le));
    const MAX_VERSEMENTS = 6;

    const lignes = [];

    // Première ligne d'en-tête : les quatre grandes sections, chacune
    // positionnée au-dessus de sa première colonne.
    const sections = new Array(32).fill("");
    sections[0] = "INFORMATIONS GENERALES";
    sections[5] = "INFORMATION SUR L'AGR";
    sections[8] = "INFORMATION SUR LE PRÊT";
    sections[14] = "REMBOURSEMENT";
    lignes.push(ligne(sections));

    const entetes = [
      "N°", "NOM ET PRENOMS", "Sexe", "Contact", "LIEU DE RESIDENCE",
      "ACTIVITE A ENTREPRENDRE", "TYPE D'AGR", "COUT DU PROJET",
      "MONTANT DE PRÊT DEMANDE", "MONTANT DE PRÊT ACCORDE",
      "DATE DE DECAISSEMENT", "TAUX", "MONTANT A REMBOURSER",
      "DATE DE FIN DE REMBOURSEMENT",
    ];
    for (let i = 1; i <= MAX_VERSEMENTS; i++) {
      entetes.push(`${i}${i === 1 ? "er" : "ème"} VERSEMENT - DATE`);
      entetes.push(`${i}${i === 1 ? "er" : "ème"} VERSEMENT - MONTANT`);
    }
    entetes.push("TOTAL REMBOURSE", "SOLDE", "OBSERVATION");
    lignes.push(ligne(entetes));

    retenus.forEach((a, index) => {
      const b = a.beneficiaires_ong || {};
      const sesVersements = versements
        .filter((v) => v.appui_id === a.id && v.statut === "depose")
        .sort((x, y) => new Date(x.date_versement) - new Date(y.date_versement));

      const totalRembourse = sesVersements.reduce((t, v) => t + Number(v.montant), 0);
      const solde = a.montant_a_rembourser != null
        ? Math.max(a.montant_a_rembourser - totalRembourse, 0) : "";

      const cellules = [
        index + 1, b.nom, b.sexe || "", b.contact || "", b.lieu_residence || "",
        a.activite_a_entreprendre, a.type_agr, a.cout_projet,
        a.montant_demande, a.montant_accorde,
        dateFr(a.date_decaissement), a.taux_interet_pct, a.montant_a_rembourser,
        dateFr(a.date_fin_remboursement),
      ];

      for (let i = 0; i < MAX_VERSEMENTS; i++) {
        const v = sesVersements[i];
        cellules.push(v ? dateFr(v.date_versement) : "");
        cellules.push(v ? v.montant : "");
      }

      // Au-delà de six versements, le format d'origine ne prévoit rien :
      // plutôt que de perdre l'information en silence, elle est signalée
      // en observation.
      const surplus = sesVersements.length - MAX_VERSEMENTS;
      cellules.push(totalRembourse, solde,
        surplus > 0 ? `${surplus} versement(s) supplémentaire(s) non détaillé(s) ici` : "");

      lignes.push(ligne(cellules));
    });

    const contenu = "\uFEFF" + lignes.join("\n");
    const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8;" }));
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `suivi-des-prets-${periode.debut || "debut"}-${periode.fin || "aujourdhui"}.csv`;
    lien.click();
    URL.revokeObjectURL(url);
  }

  const enAttente = appuis.filter((a) => a.statut === "transmis").length;

  // Synthèse des échéances, tous appuis confondus — pour qu'un
  // responsable suivant vingt dossiers voie l'essentiel sans parcourir
  // toute la liste.
  const alertes = appuis
    .map((a) => {
      const depose = versements
        .filter((v) => v.appui_id === a.id && v.statut === "depose")
        .reduce((t, v) => t + Number(v.montant), 0);
      return etatEcheance(a, depose);
    })
    .filter(Boolean);
  const nbRetards = alertes.filter((x) => x.niveau === "retard").length;
  const nbProches = alertes.filter((x) => x.niveau === "proche").length;

  async function confirmerDepot(versementId) {
    setErreur("");
    const { error } = await supabase.rpc("confirmer_depot_remboursement_agr", {
      p_versement_id: versementId,
    });
    if (error) { setErreur(error.message); return; }
    charger();
  }

  // Un point-virgule comme séparateur, jamais la virgule : Excel en
  // configuration française ne découpe pas les colonnes autrement. Le
  // BOM en tête permet aux accents de s'afficher correctement.
  function exporterCsv() {
    const debut = periode.debut ? new Date(periode.debut) : null;
    const fin = periode.fin ? new Date(periode.fin + "T23:59:59") : null;

    const dansPeriode = (dateIso) => {
      if (!dateIso) return false;
      const d = new Date(dateIso);
      if (debut && d < debut) return false;
      if (fin && d > fin) return false;
      return true;
    };

    const benefRetenus = beneficiaires.filter((b) => dansPeriode(b.created_at));
    const appuisRetenus = appuis.filter((a) => dansPeriode(a.transmis_le));

    const echapper = (v) => {
      if (v == null) return "";
      const s = String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const ligne = (cellules) => cellules.map(echapper).join(";");

    const lignes = [];

    lignes.push(ligne(["BÉNÉFICIAIRES ENREGISTRÉS"]));
    lignes.push(ligne([
      "Nom", "Sexe", "Année de naissance", "Activité professionnelle",
      "Lieu de résidence", "Contact", "Centre PEC", "Code PEC",
      "Latitude", "Longitude", "Précision GPS (m)", "Enregistré le",
    ]));
    benefRetenus.forEach((b) => lignes.push(ligne([
      b.nom, b.sexe, b.annee_naissance, b.activite_professionnelle,
      b.lieu_residence, b.contact, b.centre_pec, b.code_pec,
      b.latitude, b.longitude, b.precision_gps,
      new Date(b.created_at).toLocaleDateString("fr-FR"),
    ])));

    lignes.push("");
    lignes.push(ligne(["APPUIS AGR"]));
    lignes.push(ligne([
      "Bénéficiaire", "Type d'AGR", "Activité", "Coût du projet",
      "Montant demandé", "Montant accordé", "Taux (%)", "À rembourser",
      "Déjà remboursé", "Reste dû", "Date décaissement",
      "Fin remboursement", "Statut", "Motif du rejet", "Transmis le",
    ]));
    appuisRetenus.forEach((a) => {
      const depose = versements
        .filter((v) => v.appui_id === a.id && v.statut === "depose")
        .reduce((t, v) => t + Number(v.montant), 0);
      const reste = a.montant_a_rembourser != null
        ? Math.max(a.montant_a_rembourser - depose, 0) : null;
      lignes.push(ligne([
        a.beneficiaires_ong?.nom, a.type_agr, a.activite_a_entreprendre,
        a.cout_projet, a.montant_demande, a.montant_accorde,
        a.taux_interet_pct, a.montant_a_rembourser, depose, reste,
        a.date_decaissement, a.date_fin_remboursement,
        STATUTS[a.statut]?.label || a.statut, a.motif_rejet,
        new Date(a.transmis_le).toLocaleDateString("fr-FR"),
      ]));
    });

    const contenu = "\uFEFF" + lignes.join("\n");
    const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8;" }));
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `beneficiaires-appuis-${periode.debut || "debut"}-${periode.fin || "aujourdhui"}.csv`;
    lien.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="bg-wrap"><style>{CSS}</style><div className="bg-sk" /></div>;

  if (ficheOuverte) {
    const benef = beneficiaires.find((b) => b.id === ficheOuverte) || null;
    if (benef) {
      return (
        <FicheBeneficiaire
          beneficiaire={benef}
          appuis={appuis.filter((a) => a.beneficiaire_id === benef.id)}
          versements={versements}
          estAsc={estAsc}
          onBack={() => setFicheOuverte(null)}
          onModifie={charger}
          onDemande={() => setDemandePour(benef)}
        />
      );
    }
  }

  return (
    <div className="bg-wrap">
      <style>{CSS}</style>

      <header className="bg-head">
        <div className="bg-head-ligne">
          <div>
            <h1 className="bg-titre"><Users size={20} /> Bénéficiaires et appuis</h1>
            <p className="bg-sous">
              Les personnes suivies par l'organisation et les appuis AGR qui leur sont accordés —
              distincts des membres de l'organisation elle-même.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {estResponsableAgr && (
              <button className="bg-btn-petit" onClick={() => setRepriseOuverte(true)}>
                <Plus size={14} /> Reprendre un appui
              </button>
            )}
            <button className="bg-btn-petit" onClick={() => setExportOuvert((v) => !v)}>
              <Download size={14} /> Exporter
            </button>
          </div>
        </div>

        {exportOuvert && (
          <div className="bg-export">
            <div className="bg-export-champs">
              <div>
                <label className="bg-label">Du</label>
                <input
                  className="bg-input" type="date" value={periode.debut}
                  onChange={(e) => setPeriode((p) => ({ ...p, debut: e.target.value }))}
                />
              </div>
              <div>
                <label className="bg-label">Au</label>
                <input
                  className="bg-input" type="date" value={periode.fin}
                  onChange={(e) => setPeriode((p) => ({ ...p, fin: e.target.value }))}
                />
              </div>
              <button className="btn-primary" onClick={exporterCsv}>
                <Download size={15} /> Listing complet
              </button>
              <button className="bg-btn-petit" onClick={exporterFormatSuivi}>
                <Download size={14} /> Format suivi des prêts
              </button>
            </div>
            <p className="bg-note">
              Laissez une date vide pour ne pas borner de ce côté. Le <strong>listing complet</strong> reprend
              les bénéficiaires et les appuis dans deux sections ; le <strong>format suivi des prêts</strong> reproduit
              la mise en page de votre fichier habituel, prêt à transmettre.
            </p>
          </div>
        )}
      </header>

      <nav className="bg-onglets">
        <button
          className={`bg-onglet ${onglet === "beneficiaires" ? "is-on" : ""}`}
          onClick={() => setOnglet("beneficiaires")}
        >
          Bénéficiaires <span className="bg-badge">{beneficiaires.length}</span>
        </button>
        <button
          className={`bg-onglet ${onglet === "appuis" ? "is-on" : ""}`}
          onClick={() => setOnglet("appuis")}
        >
          Demandes d'appui
          {enAttente > 0 && <span className="bg-badge bg-badge-alerte">{enAttente}</span>}
        </button>
      </nav>

      {erreur && <div className="bg-erreur"><AlertCircle size={15} /> {erreur}</div>}

      {(nbRetards > 0 || nbProches > 0) && (
        <div className={`bg-synthese ${nbRetards > 0 ? "is-retard" : ""}`}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>
            {nbRetards > 0 && (
              <strong>
                {nbRetards} appui{nbRetards > 1 ? "s" : ""} en retard de remboursement
              </strong>
            )}
            {nbRetards > 0 && nbProches > 0 && " · "}
            {nbProches > 0 && (
              <>{nbProches} échéance{nbProches > 1 ? "s" : ""} dans les {JOURS_ALERTE_PREVENTIVE} jours</>
            )}
          </span>
        </div>
      )}

      {onglet === "beneficiaires" ? (
        <>
          <div className="bg-tools">
            <div className="bg-recherche">
              <Search size={16} className="bg-recherche-icone" />
              <input
                value={recherche} onChange={(e) => setRecherche(e.target.value)}
                placeholder="Chercher un bénéficiaire…" className="bg-input-recherche"
              />
            </div>
            {estAsc && (
              <button className="btn-primary" onClick={() => setNouveauBenef(true)}>
                <Plus size={16} /> Nouveau bénéficiaire
              </button>
            )}
          </div>

          {benefFiltres.length === 0 ? (
            <div className="bg-vide">
              <Users size={36} color={C.textSubtle} />
              <div className="bg-vide-titre">
                {beneficiaires.length === 0 ? "Aucun bénéficiaire enregistré" : "Aucun résultat"}
              </div>
            </div>
          ) : (
            <ul className="bg-liste">
              {benefFiltres.map((b) => {
                const sesAppuis = appuis.filter((a) => a.beneficiaire_id === b.id);
                return (
                  <li key={b.id} className="bg-carte">
                    <div className="bg-carte-haut">
                      <button
                        className="bg-carte-lien"
                        onClick={() => setFicheOuverte(b.id)}
                      >
                        <div className="bg-carte-nom">{b.nom}</div>
                        <div className="bg-carte-meta">
                          {[b.activite_professionnelle, b.lieu_residence, b.contact]
                            .filter(Boolean).join(" · ") || "—"}
                        </div>
                        {b.code_pec && <div className="bg-carte-pec">Code PEC : {b.code_pec}</div>}
                      </button>
                      {estAsc && (
                        <button className="bg-btn-petit" onClick={() => setDemandePour(b)}>
                          <HandCoins size={14} /> Demande d'appui
                        </button>
                      )}
                    </div>
                    {sesAppuis.length > 0 && (
                      <ul className="bg-appuis-mini">
                        {sesAppuis.map((a) => {
                          const s = STATUTS[a.statut] || STATUTS.transmis;
                          return (
                            <li key={a.id}>
                              <span>{a.type_agr || a.activite_a_entreprendre || "Appui"}</span>
                              <strong>{montant(a.montant_accorde || a.montant_demande)} F</strong>
                              <span className="bg-chip" style={{ background: s.fond, color: s.couleur }}>
                                {s.label}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          {appuis.length === 0 ? (
            <div className="bg-vide">
              <HandCoins size={36} color={C.textSubtle} />
              <div className="bg-vide-titre">Aucune demande d'appui</div>
              <div className="bg-vide-sous">
                Les demandes apparaissent ici une fois transmises depuis la fiche d'un bénéficiaire.
              </div>
            </div>
          ) : (
            <ul className="bg-liste">
              {appuis.map((a) => {
                const s = STATUTS[a.statut] || STATUTS.transmis;
                const sesVersements = versements.filter((v) => v.appui_id === a.id);
                const totalDepose = sesVersements
                  .filter((v) => v.statut === "depose")
                  .reduce((t, v) => t + Number(v.montant), 0);
                const enAttenteDepot = sesVersements.filter((v) => v.statut === "collecte");
                const reste = a.montant_a_rembourser != null
                  ? Math.max(a.montant_a_rembourser - totalDepose, 0) : null;
                const alerte = etatEcheance(a, totalDepose);

                return (
                  <li key={a.id} className="bg-carte">
                    <div className="bg-carte-haut">
                      <div>
                        <div className="bg-carte-nom">{a.beneficiaires_ong?.nom || "—"}</div>
                        <div className="bg-carte-meta">
                          {a.type_agr || a.activite_a_entreprendre || "Activité non précisée"}
                        </div>
                        <div className="bg-carte-montants">
                          Demandé : <strong>{montant(a.montant_demande)} F</strong>
                          {a.montant_accorde != null && (
                            <> · Accordé : <strong>{montant(a.montant_accorde)} F</strong></>
                          )}
                          {a.montant_a_rembourser != null && (
                            <> · À rembourser : <strong>{montant(a.montant_a_rembourser)} F</strong></>
                          )}
                        </div>
                        {a.motif_rejet && (
                          <div className="bg-carte-rejet">Motif : {a.motif_rejet}</div>
                        )}
                      </div>
                      <div className="bg-carte-actions">
                        <span className="bg-chip" style={{ background: s.fond, color: s.couleur }}>
                          <s.Icone size={13} /> {s.label}
                        </span>
                        {alerte && (
                          <span className="bg-chip" style={{ background: alerte.fond, color: alerte.couleur }}>
                            <AlertCircle size={13} /> {alerte.label}
                          </span>
                        )}
                        {estResponsableAgr && a.statut === "transmis" && (
                          <button className="bg-btn-petit" onClick={() => setAppuiATraiter(a)}>
                            Traiter
                          </button>
                        )}
                        {estAsc && (a.statut === "decaisse" || a.statut === "solde") && (
                          <button className="bg-btn-petit" onClick={() => setRemboursementPour(a)}>
                            <Banknote size={14} /> Remboursement
                          </button>
                        )}
                      </div>
                    </div>

                    {(a.statut === "decaisse" || a.statut === "solde") && a.montant_a_rembourser != null && (
                      <div className="bg-remb">
                        <div className="bg-remb-ligne">
                          <span>Remboursé : <strong>{montant(totalDepose)} F</strong></span>
                          {reste > 0 && <span>Reste : <strong>{montant(reste)} F</strong></span>}
                        </div>
                        <div className="bg-jauge">
                          <div style={{
                            width: `${Math.min((totalDepose / a.montant_a_rembourser) * 100, 100)}%`,
                            background: reste === 0 ? C.success : C.primary,
                          }} />
                        </div>

                        {enAttenteDepot.length > 0 && (
                          <div className="bg-remb-attente">
                            <Clock size={13} />
                            {enAttenteDepot.length} versement{enAttenteDepot.length > 1 ? "s" : ""} collecté
                            {enAttenteDepot.length > 1 ? "s" : ""} par l'ASC, en attente de dépôt
                            {" "}({montant(enAttenteDepot.reduce((t, v) => t + Number(v.montant), 0))} F)
                          </div>
                        )}

                        {sesVersements.length > 0 && (
                          <ul className="bg-versements">
                            {sesVersements.map((v) => (
                              <li key={v.id}>
                                <span>{new Date(v.date_versement).toLocaleDateString("fr-FR")}</span>
                                <strong>{montant(v.montant)} F</strong>
                                {v.statut === "depose" ? (
                                  <span className="bg-chip" style={{ background: "#DCFCE7", color: C.success }}>
                                    Déposé
                                  </span>
                                ) : estResponsableAgr ? (
                                  <button
                                    className="bg-btn-mini"
                                    onClick={() => confirmerDepot(v.id)}
                                  >
                                    Confirmer le dépôt
                                  </button>
                                ) : (
                                  <span className="bg-chip" style={{ background: "#FEF3C7", color: "#92400E" }}>
                                    En attente de dépôt
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {nouveauBenef && (
        <ModalBeneficiaire
          organisationId={params.organisation_id}
          onCancel={() => setNouveauBenef(false)}
          onCree={() => { setNouveauBenef(false); charger(); }}
        />
      )}

      {demandePour && (
        <ModalDemande
          beneficiaire={demandePour}
          organisationId={params.organisation_id}
          onCancel={() => setDemandePour(null)}
          onCree={() => { setDemandePour(null); setOnglet("appuis"); charger(); }}
        />
      )}

      {appuiATraiter && (
        <ModalTraitement
          appui={appuiATraiter}
          onCancel={() => setAppuiATraiter(null)}
          onTraite={() => { setAppuiATraiter(null); charger(); }}
        />
      )}

      {remboursementPour && (
        <ModalRemboursement
          appui={remboursementPour}
          onCancel={() => setRemboursementPour(null)}
          onEnregistre={() => { setRemboursementPour(null); charger(); }}
        />
      )}

      {repriseOuverte && (
        <ReprendreAppuiModal
          organisationId={params.organisation_id}
          beneficiaires={beneficiaires}
          onClose={() => setRepriseOuverte(false)}
          onTermine={() => { setRepriseOuverte(false); setOnglet("appuis"); charger(); }}
        />
      )}
    </div>
  );
}

/* ---------------- Nouveau bénéficiaire ---------------- */

function ModalBeneficiaire({ organisationId, onCancel, onCree }) {
  const [form, setForm] = useState(BENEFICIAIRE_VIDE);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [gpsEnCours, setGpsEnCours] = useState(false);
  const [gpsErreur, setGpsErreur] = useState("");

  const maj = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));

  // Capture explicite, jamais automatique : la position relevée est
  // celle de l'appareil au moment du clic — donc celle du demandeur
  // uniquement si l'ASC saisit sur place. Le bouton rend ce choix
  // conscient plutôt que de relever une position trompeuse à distance.
  function capterPosition() {
    if (!navigator.geolocation) {
      setGpsErreur("Cet appareil ne permet pas la géolocalisation.");
      return;
    }

    setGpsEnCours(true);
    setGpsErreur("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precision_gps: Math.round(pos.coords.accuracy),
        }));
        setGpsEnCours(false);
      },
      (err) => {
        setGpsEnCours(false);
        setGpsErreur(
          err.code === 1
            ? "Autorisation refusée — activez la localisation pour ce site."
            : "Position introuvable. Réessayez à l'extérieur ou près d'une fenêtre."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function enregistrer() {
    if (!form.nom.trim()) { setErreur("Le nom est obligatoire."); return; }

    setEnvoi(true);
    setErreur("");

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("beneficiaires_ong").insert({
      organisation_id: organisationId,
      nom: form.nom.trim(),
      sexe: form.sexe || null,
      annee_naissance: form.annee_naissance ? Number(form.annee_naissance) : null,
      activite_professionnelle: form.activite_professionnelle.trim() || null,
      lieu_residence: form.lieu_residence.trim() || null,
      contact: form.contact.trim() || null,
      centre_pec: form.centre_pec.trim() || null,
      code_pec: form.code_pec.trim() || null,
      statut_matrimonial: form.statut_matrimonial.trim() || null,
      scolarise: form.scolarise.trim() || null,
      latitude: form.latitude,
      longitude: form.longitude,
      precision_gps: form.precision_gps,
      saisi_par: userData.user?.id,
    });

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }
    onCree();
  }

  return (
    <div className="bg-overlay" onClick={onCancel}>
      <div className="bg-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="bg-modal-titre">Nouveau bénéficiaire</h3>

        <label className="bg-label">Nom et prénoms *</label>
        <input className="bg-input" value={form.nom} onChange={(e) => maj("nom", e.target.value)} />

        <div className="bg-grille2">
          <div>
            <label className="bg-label">Sexe</label>
            <select className="bg-input" value={form.sexe} onChange={(e) => maj("sexe", e.target.value)}>
              <option value="">—</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div>
            <label className="bg-label">Année de naissance</label>
            <input className="bg-input" type="number" value={form.annee_naissance}
              onChange={(e) => maj("annee_naissance", e.target.value)} />
          </div>
        </div>

        <label className="bg-label">Activité professionnelle</label>
        <input className="bg-input" value={form.activite_professionnelle}
          onChange={(e) => maj("activite_professionnelle", e.target.value)} />

        <div className="bg-grille2">
          <div>
            <label className="bg-label">Lieu de résidence</label>
            <input className="bg-input" value={form.lieu_residence}
              onChange={(e) => maj("lieu_residence", e.target.value)} />
          </div>
          <div>
            <label className="bg-label">Contact</label>
            <input className="bg-input" value={form.contact}
              onChange={(e) => maj("contact", e.target.value)} />
          </div>
        </div>

        <div className="bg-grille2">
          <div>
            <label className="bg-label">Centre de prise en charge</label>
            <input className="bg-input" value={form.centre_pec}
              onChange={(e) => maj("centre_pec", e.target.value)} />
          </div>
          <div>
            <label className="bg-label">Code PEC</label>
            <input className="bg-input" value={form.code_pec}
              onChange={(e) => maj("code_pec", e.target.value)} />
          </div>
        </div>

        <div className="bg-gps">
          <div className="bg-gps-haut">
            <div>
              <div className="bg-gps-titre">Localisation</div>
              <div className="bg-gps-sous">
                {form.latitude != null
                  ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)} · précision ${form.precision_gps} m`
                  : "À relever sur place, chez le bénéficiaire."}
              </div>
            </div>
            <button
              type="button" className="bg-btn-petit"
              onClick={capterPosition} disabled={gpsEnCours}
            >
              {gpsEnCours
                ? <><Loader2 size={14} className="bg-spin" /> Relevé…</>
                : <><MapPin size={14} /> {form.latitude != null ? "Relever à nouveau" : "Relever ici"}</>}
            </button>
          </div>
          {gpsErreur && <div className="bg-gps-erreur">{gpsErreur}</div>}
        </div>

        {erreur && <div className="bg-erreur"><AlertCircle size={15} /> {erreur}</div>}

        <div className="bg-modal-actions">
          <button className="bg-btn-ghost" onClick={onCancel} disabled={envoi}>Annuler</button>
          <button className="btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? <><Loader2 size={15} className="bg-spin" /> Enregistrement…</> : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Transmettre une demande (ASC) ---------------- */

function ModalDemande({ beneficiaire, organisationId, onCancel, onCree }) {
  const [form, setForm] = useState({
    activite_a_entreprendre: "", type_agr: "", cout_projet: "", montant_demande: "",
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const maj = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));

  async function transmettre() {
    if (!form.montant_demande || Number(form.montant_demande) <= 0) {
      setErreur("Le montant demandé est obligatoire.");
      return;
    }

    setEnvoi(true);
    setErreur("");

    // Passe par la fonction serveur, qui refuse une seconde demande
    // tant que la précédente n'est pas soldée ou rejetée.
    const { error } = await supabase.rpc("transmettre_demande_agr", {
      p_organisation_id: organisationId,
      p_beneficiaire_id: beneficiaire.id,
      p_activite_a_entreprendre: form.activite_a_entreprendre.trim() || null,
      p_type_agr: form.type_agr.trim() || null,
      p_cout_projet: form.cout_projet ? Number(form.cout_projet) : null,
      p_montant_demande: Number(form.montant_demande),
    });

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }
    onCree();
  }

  return (
    <div className="bg-overlay" onClick={onCancel}>
      <div className="bg-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="bg-modal-titre">Demande d'appui</h3>
        <p className="bg-modal-sous">
          Pour <strong>{beneficiaire.nom}</strong> — la demande sera transmise au responsable AGR,
          qui décidera du montant accordé et du décaissement.
        </p>

        <label className="bg-label">Activité à entreprendre</label>
        <input className="bg-input" value={form.activite_a_entreprendre}
          onChange={(e) => maj("activite_a_entreprendre", e.target.value)} />

        <label className="bg-label">Type d'AGR</label>
        <input className="bg-input" value={form.type_agr}
          onChange={(e) => maj("type_agr", e.target.value)}
          placeholder="Commerce, élevage, transformation…" />

        <div className="bg-grille2">
          <div>
            <label className="bg-label">Coût du projet (FCFA)</label>
            <input className="bg-input" type="number" value={form.cout_projet}
              onChange={(e) => maj("cout_projet", e.target.value)} />
          </div>
          <div>
            <label className="bg-label">Montant demandé (FCFA) *</label>
            <input className="bg-input" type="number" value={form.montant_demande}
              onChange={(e) => maj("montant_demande", e.target.value)} />
          </div>
        </div>

        {erreur && <div className="bg-erreur"><AlertCircle size={15} /> {erreur}</div>}

        <div className="bg-modal-actions">
          <button className="bg-btn-ghost" onClick={onCancel} disabled={envoi}>Annuler</button>
          <button className="btn-primary" onClick={transmettre} disabled={envoi}>
            {envoi ? <><Loader2 size={15} className="bg-spin" /> Transmission…</> : "Transmettre"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Traiter une demande (responsable AGR) ---------------- */

function ModalTraitement({ appui, onCancel, onTraite }) {
  const [decision, setDecision] = useState("accorde");
  const [form, setForm] = useState({
    montant_accorde: appui.montant_demande || "",
    taux_interet_pct: "0",
    date_decaissement: "",
    date_fin_remboursement: "",
    motif_rejet: "",
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const maj = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));

  async function valider() {
    setEnvoi(true);
    setErreur("");

    const { error } = await supabase.rpc("decider_appui_agr", {
      p_appui_id: appui.id,
      p_decision: decision,
      p_montant_accorde: decision === "accorde" ? Number(form.montant_accorde) : null,
      p_taux_interet_pct: Number(form.taux_interet_pct) || 0,
      p_date_decaissement: form.date_decaissement || null,
      p_date_fin_remboursement: form.date_fin_remboursement || null,
      p_motif_rejet: decision === "rejete" ? form.motif_rejet.trim() || null : null,
    });

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }
    onTraite();
  }

  return (
    <div className="bg-overlay" onClick={onCancel}>
      <div className="bg-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="bg-modal-titre">Traiter la demande</h3>
        <p className="bg-modal-sous">
          <strong>{appui.beneficiaires_ong?.nom}</strong> — {montant(appui.montant_demande)} FCFA demandés
          {appui.type_agr && <> pour : {appui.type_agr}</>}
        </p>

        <div className="bg-choix">
          <button
            className={`bg-choix-btn ${decision === "accorde" ? "is-on" : ""}`}
            onClick={() => setDecision("accorde")}
          >
            <CheckCircle2 size={15} /> Accorder
          </button>
          <button
            className={`bg-choix-btn ${decision === "rejete" ? "is-rejet" : ""}`}
            onClick={() => setDecision("rejete")}
          >
            <XCircle size={15} /> Rejeter
          </button>
        </div>

        {decision === "accorde" ? (
          <>
            <div className="bg-grille2">
              <div>
                <label className="bg-label">Montant accordé (FCFA) *</label>
                <input className="bg-input" type="number" value={form.montant_accorde}
                  onChange={(e) => maj("montant_accorde", e.target.value)} />
              </div>
              <div>
                <label className="bg-label">Taux d'intérêt (%)</label>
                <input className="bg-input" type="number" step="0.1" value={form.taux_interet_pct}
                  onChange={(e) => maj("taux_interet_pct", e.target.value)} />
              </div>
            </div>

            <div className="bg-grille2">
              <div>
                <label className="bg-label">Date de décaissement</label>
                <input className="bg-input" type="date" value={form.date_decaissement}
                  onChange={(e) => maj("date_decaissement", e.target.value)} />
              </div>
              <div>
                <label className="bg-label">Fin de remboursement</label>
                <input className="bg-input" type="date" value={form.date_fin_remboursement}
                  onChange={(e) => maj("date_fin_remboursement", e.target.value)} />
              </div>
            </div>
            <p className="bg-note">
              Laissez la date de décaissement vide pour accorder maintenant et décaisser plus tard.
            </p>
          </>
        ) : (
          <>
            <label className="bg-label">Motif du rejet</label>
            <textarea className="bg-input" rows={3} value={form.motif_rejet}
              onChange={(e) => maj("motif_rejet", e.target.value)} />
          </>
        )}

        {erreur && <div className="bg-erreur"><AlertCircle size={15} /> {erreur}</div>}

        <div className="bg-modal-actions">
          <button className="bg-btn-ghost" onClick={onCancel} disabled={envoi}>Annuler</button>
          <button className="btn-primary" onClick={valider} disabled={envoi}>
            {envoi ? <><Loader2 size={15} className="bg-spin" /> Traitement…</> : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Collecter un remboursement (ASC) ---------------- */

function ModalRemboursement({ appui, onCancel, onEnregistre }) {
  const [form, setForm] = useState({
    montant: "",
    date_versement: new Date().toISOString().slice(0, 10),
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function enregistrer() {
    if (!form.montant || Number(form.montant) <= 0) {
      setErreur("Le montant est obligatoire.");
      return;
    }

    setEnvoi(true);
    setErreur("");

    const { error } = await supabase.rpc("collecter_remboursement_agr", {
      p_appui_id: appui.id,
      p_montant: Number(form.montant),
      p_date_versement: form.date_versement,
    });

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }
    onEnregistre();
  }

  return (
    <div className="bg-overlay" onClick={onCancel}>
      <div className="bg-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="bg-modal-titre">Remboursement collecté</h3>
        <p className="bg-modal-sous">
          De <strong>{appui.beneficiaires_ong?.nom}</strong>. Ce versement sera marqué comme
          collecté par vous, en attente de votre dépôt auprès du responsable AGR — qui le
          confirmera de son côté.
        </p>

        <label className="bg-label">Montant reçu (FCFA) *</label>
        <input
          className="bg-input" type="number" value={form.montant}
          onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
        />

        <label className="bg-label">Date du versement</label>
        <input
          className="bg-input" type="date" value={form.date_versement}
          onChange={(e) => setForm((f) => ({ ...f, date_versement: e.target.value }))}
        />

        {erreur && <div className="bg-erreur"><AlertCircle size={15} /> {erreur}</div>}

        <div className="bg-modal-actions">
          <button className="bg-btn-ghost" onClick={onCancel} disabled={envoi}>Annuler</button>
          <button className="btn-primary" onClick={enregistrer} disabled={envoi}>
            {envoi ? <><Loader2 size={15} className="bg-spin" /> Enregistrement…</> : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Fiche détaillée d'un bénéficiaire ---------------- */

function FicheBeneficiaire({ beneficiaire, appuis, versements, estAsc, onBack, onModifie, onDemande }) {
  const [edition, setEdition] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const b = beneficiaire;

  async function enregistrerModif() {
    if (!edition.nom.trim()) { setErreur("Le nom est obligatoire."); return; }

    setEnvoi(true);
    setErreur("");

    const { data, error } = await supabase.from("beneficiaires_ong")
      .update({
        nom: edition.nom.trim(),
        sexe: edition.sexe || null,
        annee_naissance: edition.annee_naissance ? Number(edition.annee_naissance) : null,
        activite_professionnelle: edition.activite_professionnelle?.trim() || null,
        lieu_residence: edition.lieu_residence?.trim() || null,
        contact: edition.contact?.trim() || null,
        centre_pec: edition.centre_pec?.trim() || null,
        code_pec: edition.code_pec?.trim() || null,
      })
      .eq("id", b.id)
      .select();

    setEnvoi(false);
    // Une politique RLS qui refuse n'émet pas d'erreur : elle affecte
    // zéro ligne. C'est donc la longueur du résultat qui révèle un refus.
    if (error || !data || data.length === 0) {
      setErreur("La modification n'a pas abouti — seul l'ASC peut modifier une fiche.");
      return;
    }
    setEdition(null);
    onModifie();
  }

  const champ = (cle, valeur) => setEdition((e) => ({ ...e, [cle]: valeur }));

  return (
    <div className="bg-wrap">
      <style>{CSS}</style>

      <button className="bg-retour" onClick={onBack}>
        <ArrowLeft size={15} /> Retour à la liste
      </button>

      <header className="bg-fiche-head">
        <div>
          <h1 className="bg-fiche-nom">{b.nom}</h1>
          <p className="bg-fiche-sous">
            {[b.activite_professionnelle, b.lieu_residence].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <div className="bg-fiche-actions">
          {estAsc && !edition && (
            <button className="bg-btn-petit" onClick={() => setEdition({ ...b })}>
              <Pencil size={14} /> Modifier
            </button>
          )}
          {estAsc && (
            <button className="bg-btn-petit" onClick={onDemande}>
              <HandCoins size={14} /> Demande d'appui
            </button>
          )}
        </div>
      </header>

      {erreur && <div className="bg-erreur"><AlertCircle size={15} /> {erreur}</div>}

      {edition ? (
        <section className="bg-carte">
          <h3 className="bg-section-titre">Modifier la fiche</h3>

          <label className="bg-label">Nom et prénoms *</label>
          <input className="bg-input" value={edition.nom}
            onChange={(e) => champ("nom", e.target.value)} />

          <div className="bg-grille2">
            <div>
              <label className="bg-label">Sexe</label>
              <select className="bg-input" value={edition.sexe || ""}
                onChange={(e) => champ("sexe", e.target.value)}>
                <option value="">—</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
            <div>
              <label className="bg-label">Année de naissance</label>
              <input className="bg-input" type="number" value={edition.annee_naissance || ""}
                onChange={(e) => champ("annee_naissance", e.target.value)} />
            </div>
          </div>

          <label className="bg-label">Activité professionnelle</label>
          <input className="bg-input" value={edition.activite_professionnelle || ""}
            onChange={(e) => champ("activite_professionnelle", e.target.value)} />

          <div className="bg-grille2">
            <div>
              <label className="bg-label">Lieu de résidence</label>
              <input className="bg-input" value={edition.lieu_residence || ""}
                onChange={(e) => champ("lieu_residence", e.target.value)} />
            </div>
            <div>
              <label className="bg-label">Contact</label>
              <input className="bg-input" value={edition.contact || ""}
                onChange={(e) => champ("contact", e.target.value)} />
            </div>
          </div>

          <div className="bg-grille2">
            <div>
              <label className="bg-label">Centre de prise en charge</label>
              <input className="bg-input" value={edition.centre_pec || ""}
                onChange={(e) => champ("centre_pec", e.target.value)} />
            </div>
            <div>
              <label className="bg-label">Code PEC</label>
              <input className="bg-input" value={edition.code_pec || ""}
                onChange={(e) => champ("code_pec", e.target.value)} />
            </div>
          </div>

          <div className="bg-modal-actions">
            <button className="bg-btn-ghost" onClick={() => { setEdition(null); setErreur(""); }} disabled={envoi}>
              Annuler
            </button>
            <button className="btn-primary" onClick={enregistrerModif} disabled={envoi}>
              {envoi ? <><Loader2 size={15} className="bg-spin" /> Enregistrement…</> : "Enregistrer"}
            </button>
          </div>
        </section>
      ) : (
        <section className="bg-carte">
          <h3 className="bg-section-titre">Informations</h3>
          <dl className="bg-infos">
            <div><dt>Sexe</dt><dd>{b.sexe === "M" ? "Masculin" : b.sexe === "F" ? "Féminin" : "—"}</dd></div>
            <div><dt>Année de naissance</dt><dd>{b.annee_naissance || "—"}</dd></div>
            <div><dt>Activité</dt><dd>{b.activite_professionnelle || "—"}</dd></div>
            <div><dt>Résidence</dt><dd>{b.lieu_residence || "—"}</dd></div>
            <div><dt>Contact</dt><dd>{b.contact || "—"}</dd></div>
            <div><dt>Centre PEC</dt><dd>{b.centre_pec || "—"}</dd></div>
            <div><dt>Code PEC</dt><dd>{b.code_pec || "—"}</dd></div>
            <div>
              <dt>Enregistré le</dt>
              <dd>{new Date(b.created_at).toLocaleDateString("fr-FR")}</dd>
            </div>
          </dl>

          {b.latitude != null && (
            <div className="bg-localisation">
              <div>
                <div className="bg-loc-titre"><MapPin size={14} /> Localisation relevée</div>
                <div className="bg-loc-coord">
                  {b.latitude.toFixed(5)}, {b.longitude.toFixed(5)}
                  {b.precision_gps && ` · précision ${b.precision_gps} m`}
                </div>
              </div>
              <a
                className="bg-btn-petit"
                href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`}
                target="_blank" rel="noopener noreferrer"
              >
                Voir sur la carte
              </a>
            </div>
          )}
        </section>
      )}

      <section className="bg-carte">
        <h3 className="bg-section-titre">
          Historique des appuis
          {appuis.length > 0 && <span className="bg-badge">{appuis.length}</span>}
        </h3>

        {appuis.length === 0 ? (
          <p className="bg-note">Aucun appui demandé pour ce bénéficiaire.</p>
        ) : (
          <ul className="bg-histo">
            {appuis.map((a) => {
              const s = STATUTS[a.statut] || STATUTS.transmis;
              const depose = versements
                .filter((v) => v.appui_id === a.id && v.statut === "depose")
                .reduce((t, v) => t + Number(v.montant), 0);
              const alerte = etatEcheance(a, depose);

              return (
                <li key={a.id} className="bg-histo-item">
                  <div className="bg-histo-haut">
                    <span className="bg-histo-titre">
                      {a.type_agr || a.activite_a_entreprendre || "Appui"}
                    </span>
                    <span className="bg-chip" style={{ background: s.fond, color: s.couleur }}>
                      <s.Icone size={12} /> {s.label}
                    </span>
                  </div>
                  <div className="bg-histo-detail">
                    Demandé {montant(a.montant_demande)} F
                    {a.montant_accorde != null && ` · accordé ${montant(a.montant_accorde)} F`}
                    {a.montant_a_rembourser != null && ` · remboursé ${montant(depose)} / ${montant(a.montant_a_rembourser)} F`}
                  </div>
                  <div className="bg-histo-date">
                    Transmis le {new Date(a.transmis_le).toLocaleDateString("fr-FR")}
                    {a.date_decaissement && ` · décaissé le ${new Date(a.date_decaissement).toLocaleDateString("fr-FR")}`}
                  </div>
                  {alerte && (
                    <span className="bg-chip" style={{ background: alerte.fond, color: alerte.couleur, marginTop: 6 }}>
                      <AlertCircle size={12} /> {alerte.label}
                    </span>
                  )}
                  {a.motif_rejet && <div className="bg-carte-rejet">Motif : {a.motif_rejet}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const CSS = `
.bg-wrap{ padding:${S.xl}px; max-width:960px; }
.bg-sk{ height:220px; border-radius:${R.xl}px; background:${PALETTE.grey100}; }
.bg-head{ margin-bottom:${S.lg}px; }
.bg-head-ligne{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
.bg-export{
  margin-top:14px; background:${C.bg}; border:1px solid ${C.border};
  border-radius:${R.md}px; padding:14px 16px;
}
.bg-export-champs{ display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; }
.bg-export-champs > div{ flex:1; min-width:130px; }
.bg-export-champs button{ flex-shrink:0; }

.bg-synthese{
  display:flex; align-items:center; gap:10px;
  background:#FEF3C7; color:#92400E; border-radius:${R.md}px;
  padding:12px 15px; font-size:13px; line-height:1.45; margin-bottom:${S.lg}px;
}
.bg-synthese.is-retard{ background:#FEE2E2; color:${C.danger}; }

.bg-retour{
  display:flex; align-items:center; gap:6px; background:none; border:none;
  color:${C.primary}; cursor:pointer; font-family:inherit;
  font-size:13.5px; font-weight:600; padding:0; margin-bottom:${S.lg}px;
}
.bg-fiche-head{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:14px; flex-wrap:wrap; margin-bottom:${S.lg}px;
}
.bg-fiche-nom{ font-size:22px; font-weight:700; margin:0; }
.bg-fiche-sous{ font-size:13.5px; color:${C.textSubtle}; margin:5px 0 0; }
.bg-fiche-actions{ display:flex; gap:8px; flex-shrink:0; }
.bg-section-titre{
  display:flex; align-items:center; gap:9px;
  font-size:15px; font-weight:700; margin:0 0 14px;
}
.bg-carte + .bg-carte{ margin-top:${S.md}px; }

.bg-infos{
  display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));
  gap:14px; margin:0;
}
@media (max-width:520px){ .bg-infos{ grid-template-columns:1fr 1fr; } }
.bg-infos dt{ font-size:11.5px; color:${C.textSubtle}; font-weight:600; }
.bg-infos dd{ font-size:14px; margin:3px 0 0; }

.bg-localisation{
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  margin-top:16px; padding-top:16px; border-top:1px solid ${C.border}; flex-wrap:wrap;
}
.bg-loc-titre{ display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; }
.bg-loc-coord{ font-size:12px; color:${C.textSubtle}; margin-top:3px; }

.bg-carte-lien{
  flex:1; min-width:0; text-align:left; background:none; border:none;
  padding:0; cursor:pointer; font-family:inherit; color:inherit;
}
.bg-carte-lien:hover .bg-carte-nom{ color:${C.primary}; }

.bg-histo{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
.bg-histo-item{
  background:${C.bg}; border-radius:${R.md}px; padding:13px 15px;
}
.bg-histo-haut{
  display:flex; align-items:center; justify-content:space-between;
  gap:10px; margin-bottom:6px; flex-wrap:wrap;
}
.bg-histo-titre{ font-size:14px; font-weight:600; }
.bg-histo-detail{ font-size:12.5px; color:${C.textMuted}; }
.bg-histo-date{ font-size:11.5px; color:${C.textSubtle}; margin-top:3px; }
.bg-titre{ display:flex; align-items:center; gap:9px; font-size:20px; font-weight:700; margin:0; }
.bg-sous{ font-size:13.5px; color:${C.textSubtle}; margin:6px 0 0; max-width:62ch; line-height:1.5; }

.bg-onglets{
  display:flex; gap:4px; background:${C.bg}; padding:4px; border-radius:${R.md}px;
  align-self:flex-start; margin-bottom:${S.lg}px; max-width:100%; overflow-x:auto;
  scrollbar-width:none;
}
.bg-onglets::-webkit-scrollbar{ display:none; }
.bg-onglet{
  display:flex; align-items:center; gap:8px; flex-shrink:0;
  border:none; background:transparent; cursor:pointer; padding:10px 16px;
  border-radius:${R.sm}px; font-family:inherit; font-size:13.5px; font-weight:600;
  color:${C.textSubtle};
}
.bg-onglet.is-on{ background:${C.surface}; color:${C.primary}; box-shadow:${SHADOW.xs}; }
.bg-badge{
  background:${PALETTE.grey200}; color:${C.textMuted}; border-radius:${R.pill}px;
  padding:2px 8px; font-size:11.5px; font-weight:700;
}
.bg-badge-alerte{ background:${C.warning}; color:#fff; }

.bg-tools{ display:flex; gap:10px; align-items:center; margin-bottom:${S.lg}px; flex-wrap:wrap; }
.bg-recherche{ position:relative; flex:1; min-width:200px; }
.bg-recherche-icone{ position:absolute; left:12px; top:50%; transform:translateY(-50%); color:${C.textSubtle}; }
.bg-input-recherche{
  width:100%; box-sizing:border-box; padding:11px 14px 11px 36px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  font-family:inherit; font-size:14px; outline:none;
}

.bg-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
.bg-carte{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px;
  padding:15px 17px; box-shadow:${SHADOW.xs};
}
.bg-carte-haut{ display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
.bg-carte-nom{ font-size:15px; font-weight:700; }
.bg-carte-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:3px; }
.bg-carte-pec{ font-size:11.5px; color:${C.textSubtle}; margin-top:2px; }
.bg-carte-montants{ font-size:12.5px; color:${C.textMuted}; margin-top:6px; }
.bg-carte-rejet{ font-size:12px; color:${C.danger}; margin-top:5px; }
.bg-carte-actions{ display:flex; align-items:center; gap:8px; flex-shrink:0; }

.bg-appuis-mini{
  list-style:none; margin:12px 0 0; padding:12px 0 0; border-top:1px solid ${C.border};
  display:flex; flex-direction:column; gap:7px;
}
.bg-appuis-mini li{ display:flex; align-items:center; gap:10px; font-size:12.5px; }
.bg-appuis-mini li span:first-child{ flex:1; color:${C.textMuted}; }

.bg-remb{ margin-top:13px; padding-top:13px; border-top:1px solid ${C.border}; }
.bg-remb-ligne{
  display:flex; justify-content:space-between; gap:12px;
  font-size:12.5px; color:${C.textMuted}; margin-bottom:7px;
}
.bg-jauge{
  height:6px; border-radius:${R.pill}px; background:${PALETTE.grey200}; overflow:hidden;
}
.bg-jauge div{ height:100%; border-radius:${R.pill}px; transition:width .4s ease; }
.bg-remb-attente{
  display:flex; align-items:center; gap:7px; margin-top:10px;
  background:#FEF3C7; color:#92400E; border-radius:${R.md}px;
  padding:8px 12px; font-size:12px; line-height:1.4;
}
.bg-versements{
  list-style:none; margin:10px 0 0; padding:0;
  display:flex; flex-direction:column; gap:6px;
}
.bg-versements li{
  display:flex; align-items:center; gap:10px; font-size:12.5px;
  padding:6px 0; border-bottom:1px solid ${C.border};
}
.bg-versements li:last-child{ border-bottom:none; }
.bg-versements li span:first-child{ flex:1; color:${C.textSubtle}; }
.bg-btn-mini{
  background:${C.primary}; color:#fff; border:none; border-radius:${R.sm}px;
  padding:5px 11px; cursor:pointer; font-family:inherit;
  font-size:11.5px; font-weight:600; white-space:nowrap;
}

.bg-chip{
  display:inline-flex; align-items:center; gap:5px; border-radius:${R.pill}px;
  padding:4px 11px; font-size:11.5px; font-weight:600; white-space:nowrap;
}
.bg-btn-petit{
  display:flex; align-items:center; gap:6px; flex-shrink:0;
  background:${C.surface}; border:1.5px solid ${C.border}; color:${C.textMuted};
  border-radius:${R.md}px; padding:8px 13px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600;
}
.bg-btn-petit:hover{ border-color:${C.primary}; color:${C.primary}; }

.bg-vide{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:44px; text-align:center; display:flex; flex-direction:column;
  align-items:center; gap:8px;
}
.bg-vide-titre{ font-size:15px; font-weight:600; }
.bg-vide-sous{ font-size:13px; color:${C.textSubtle}; max-width:44ch; line-height:1.5; }

.bg-overlay{
  position:fixed; inset:0; z-index:300; background:rgba(10,20,40,.5);
  display:flex; align-items:center; justify-content:center; padding:${S.lg}px;
}
.bg-modal{
  background:${C.surface}; border-radius:${R.xxl}px; padding:${S.xl}px;
  width:100%; max-width:520px; max-height:88vh; overflow-y:auto;
  display:flex; flex-direction:column; gap:9px;
}
.bg-modal-titre{ font-size:18px; font-weight:700; margin:0; }
.bg-modal-sous{ font-size:13px; color:${C.textMuted}; margin:0 0 6px; line-height:1.5; }
.bg-label{ font-size:12.5px; font-weight:600; color:${C.textMuted}; margin-top:4px; }
.bg-input{
  width:100%; box-sizing:border-box; padding:11px 13px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  font-family:inherit; font-size:14px; outline:none; resize:vertical;
}
.bg-grille2{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
@media (max-width:520px){ .bg-grille2{ grid-template-columns:1fr; } }

.bg-gps{
  background:${C.bg}; border:1px solid ${C.border}; border-radius:${R.md}px;
  padding:12px 14px; margin-top:6px;
}
.bg-gps-haut{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
.bg-gps-titre{ font-size:13px; font-weight:600; }
.bg-gps-sous{ font-size:11.5px; color:${C.textSubtle}; margin-top:3px; line-height:1.4; }
.bg-gps-erreur{ font-size:11.5px; color:${C.danger}; margin-top:8px; line-height:1.4; }
.bg-note{ font-size:11.5px; color:${C.textSubtle}; margin:2px 0 0; line-height:1.45; }

.bg-choix{ display:flex; gap:8px; margin:6px 0; }
.bg-choix-btn{
  flex:1; display:flex; align-items:center; justify-content:center; gap:7px;
  background:${C.bg}; border:1.5px solid ${C.border}; color:${C.textMuted};
  border-radius:${R.md}px; padding:11px 0; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600;
}
.bg-choix-btn.is-on{ background:${PALETTE.blue100}; border-color:${C.primary}; color:${C.primary}; }
.bg-choix-btn.is-rejet{ background:#FEE2E2; border-color:${C.danger}; color:${C.danger}; }

.bg-erreur{
  display:flex; align-items:flex-start; gap:8px; background:#FEE2E2; color:${C.danger};
  border-radius:${R.md}px; padding:11px 13px; font-size:13px; line-height:1.45;
}
.bg-modal-actions{ display:flex; gap:10px; margin-top:8px; }
.bg-modal-actions button{ flex:1; }
.bg-btn-ghost{
  background:${C.surface}; border:1.5px solid ${C.border}; color:${C.textMuted};
  border-radius:${R.md}px; padding:12px 0; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600;
}
.bg-spin{ animation:bgSpin 1s linear infinite; }
@keyframes bgSpin{ to{ transform:rotate(360deg); } }
`;