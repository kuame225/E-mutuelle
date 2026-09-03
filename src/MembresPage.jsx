import React, { useEffect, useRef, useState, } from "react";
import {
  Search, ChevronRight, ArrowLeft, Phone, Mail, Briefcase,
  CalendarDays, Camera, Loader2, Trash2, CheckCircle2,
  Clock, AlertTriangle, Users, KeyRound, Copy, Check, ShieldCheck, UserPlus,
  Smartphone, Receipt, CalendarCheck, LogOut, Undo2, Info, Coins, Pencil,
  Heart, Baby, UserRound, User, FileSpreadsheet,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage, construireMatricule, dateEligibilite, moduleActif } from "./useParametrage";
import ImportMembresModal from "./ImportMembresModal";
import { useVocabulaire } from "./useVocabulaire";
import { de } from "./vocabulaire";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const STATUT = {
  nouveau:  { label: "Nouveau",   color: C.primaryLight, soft: PALETTE.blue100, Icon: UserPlus },
  a_jour:   { label: "À jour",    color: C.success, soft: "#DCFCE7", Icon: CheckCircle2 },
  partiel:  { label: "Partiel",   color: C.warning, soft: "#FEF3C7", Icon: Clock },
  retard:   { label: "En retard", color: C.danger,  soft: "#FEE2E2", Icon: AlertTriangle },
  suspendu: { label: "Suspendu",  color: C.danger,  soft: "#FEE2E2", Icon: AlertTriangle },
};

// Même catalogue que MembreBeneficiaires.jsx (espace membre) — l'admin
// ne fait que consulter ici, jamais ajouter ni modifier : ce sont les
// bénéficiaires déclarés par le membre lui-même, sous sa responsabilité.
const LIENS_BENEFICIAIRE = [
  { id: "conjoint", label: "Conjoint(e)", Icon: Heart,      color: C.danger },
  { id: "enfant",   label: "Enfant",      Icon: Baby,       color: C.primaryLight },
  { id: "pere",     label: "Père",        Icon: UserRound,  color: C.primary },
  { id: "mere",     label: "Mère",        Icon: UserRound,  color: C.primary },
  { id: "frere",    label: "Frère",       Icon: User,       color: C.success },
  { id: "soeur",    label: "Sœur",        Icon: User,       color: C.success },
  { id: "autre",    label: "Autre",       Icon: User,       color: C.textMuted },
];

const FILTRES = [
  { id: "tous",    label: "Tous" },
  { id: "nouveau", label: "Nouveaux" },
  { id: "a_jour",  label: "À jour" },
  { id: "partiel", label: "Partiel" },
  { id: "retard",  label: "En retard" },
  { id: "sortis",  label: "Sortis" },
];

// Vocabulaire aligné sur celui de la table paiements, afin que la comptabilité
// n'affiche pas deux libellés distincts pour un même mode de règlement.
// « prelevement » s'y ajoute : l'article 17 prévoit le prélèvement sur les
// intéressements pour le droit d'adhésion comme pour les cotisations.
const MODES_PAIEMENT = [
  { id: "cash",         label: "Espèces" },
  { id: "prelevement",  label: "Prélèvement sur intéressements" },
  { id: "orange_money", label: "Orange Money" },
  { id: "mtn_money",    label: "MTN Money" },
  { id: "moov_money",   label: "Moov Money" },
  { id: "wave",         label: "Wave" },
];

// Article 32 : la qualité de membre se perd par démission, mutation,
// départ à la retraite ou décès.
const MOTIFS_SORTIE = [
  {
    id: "demission",
    label: "Démission",
    article: "Articles 32 et 33",
    aide: "La démission doit avoir été présentée par écrit au Bureau Exécutif.",
    prestation: null,
  },
  {
    id: "mutation",
    label: "Mutation",
    article: "Articles 23 et 32",
    aide: "Ouvre droit à la moitié des cotisations versées, mais uniquement si le membre n'a jamais été assisté.",
    prestation: "mutation",
  },
  {
    id: "retraite",
    label: "Départ à la retraite",
    article: "Articles 24 et 32",
    aide: "Ouvre droit à une prestation remise au cours d'une réunion.",
    prestation: "retraite",
  },
  {
    id: "deces",
    label: "Décès",
    article: "Articles 25 et 32",
    aide: "Ouvre droit à une prestation versée au conjoint déclaré, ainsi qu'à un don remis à la famille.",
    prestation: "deces_adherent",
  },
];

export default function MembresPage() {
  const { params } = useParametrage();
  const { mot } = useVocabulaire();
  const [membres, setMembres] = useState([]);
  const [query, setQuery] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [import_, setImport] = useState(false);

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from("membres")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("nom");
    setMembres(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  // Garder la fiche ouverte synchronisée après modification
  function majMembre(m) {
    setMembres((liste) => liste.map((x) => (x.id === m.id ? m : x)));
    setSelected(m);
  }

  const filtres = membres
    .filter((m) => m.nom.toLowerCase().includes(query.toLowerCase().trim()))
    .filter((m) => {
      // Les membres sortis ne figurent que dans leur propre onglet
      if (filtre === "sortis") return Boolean(m.sortie_le);
      if (m.sortie_le) return false;
      return filtre === "tous" || m.statut_cotisation === filtre;
    });

  const compte = (id) => {
    if (id === "sortis") return membres.filter((m) => m.sortie_le).length;
    const actifs = membres.filter((m) => !m.sortie_le);
    return id === "tous"
      ? actifs.length
      : actifs.filter((m) => m.statut_cotisation === id).length;
  };

  const sansDroit = membres.filter(
    (m) => !m.droit_adhesion_paye_le && !m.sortie_le
  ).length;

  if (loading) {
    return (
      <div className="mb-wrap">
        <style>{CSS}</style>
        <div className="mb-skel" /><div className="mb-skel" /><div className="mb-skel" />
      </div>
    );
  }

  if (selected) {
    return (
      <FicheMembre
        membre={selected}
        onBack={() => setSelected(null)}
        onUpdate={majMembre}
      />
    );
  }

  return (
    <div className="mb-wrap">
      <style>{CSS}</style>

      {/* ---- Rappel de régularisation ---- */}
      {sansDroit > 0 && (
        <div className="mb-rappel">
          <Receipt size={17} />
          <span>
            <strong>
              {sansDroit} {sansDroit > 1 ? mot("membres").toLowerCase() : mot("membre_singulier").toLowerCase()}
            </strong> sans droit
            d'adhésion enregistré. Le délai de carence court à compter de ce
            versement : tant qu'il n'est pas saisi, l'éligibilité aux {mot("aides").toLowerCase()}
            reste estimée.
          </span>
        </div>
      )}

      {/* ---- Recherche et filtres ---- */}
      <div className="mb-tools">
        <div className="mb-search-ligne">
          <div className="mb-search">
            <Search size={17} className="mb-search-icon" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Rechercher ${mot("membre_un")}…`}
              className="mb-input"
            />
          </div>
          <button className="mb-btn-import" onClick={() => setImport(true)}>
            <FileSpreadsheet size={15} /> Importer
          </button>
        </div>

        <div className="mb-filters">
          {FILTRES.map((f) => (
            <button
              key={f.id}
              className={`mb-filter ${filtre === f.id ? "is-on" : ""} ${f.id === "sortis" ? "is-sortis" : ""}`}
              onClick={() => setFiltre(f.id)}
            >
              {f.label} <span className="mb-count">{compte(f.id)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ---- Liste ---- */}
      {filtres.length === 0 ? (
        <div className="mb-empty">
          <Users size={36} color={PALETTE.grey300} />
          <div className="mb-empty-title">
            {membres.length === 0 ? `Aucun ${mot("membre_singulier").toLowerCase()} enregistré` : "Aucun résultat"}
          </div>
          <div className="mb-empty-sub">
            {membres.length === 0
              ? "Les fiches se créent automatiquement à la validation d'une adhésion."
              : filtre === "sortis"
                ? "Aucune sortie enregistrée à ce jour."
                : "Essayez un autre nom ou changez de filtre."}
          </div>
        </div>
      ) : (
        <ul className="mb-list">
          {filtres.map((m) => {
            const st = STATUT[m.statut_cotisation] || STATUT.a_jour;
            const sorti = Boolean(m.sortie_le);
            const motif = MOTIFS_SORTIE.find((x) => x.id === m.sortie_motif);

            return (
              <li key={m.id}>
                <button
                  className={`mb-row ${sorti ? "is-sorti" : ""}`}
                  onClick={() => setSelected(m)}
                >
                  <Avatar membre={m} taille={44} />
                  <div className="mb-row-text">
                    <div className="mb-row-nom">{m.nom}</div>
                    <div className="mb-row-sub">
                      {sorti
                        ? `${motif ? motif.label : "Sortie"} · ${new Date(m.sortie_le).toLocaleDateString("fr-FR")}`
                        : `${m.poste || "—"}${m.service ? ` · ${m.service}` : ""}`}
                    </div>
                  </div>

                  {!sorti && !m.droit_adhesion_paye_le && (
                    <span className="mb-pastille" title="Droit d'adhésion non enregistré" />
                  )}

                  {sorti ? (
                    <span className="mb-chip mb-chip-sorti">
                      <LogOut size={12} /> Sorti
                    </span>
                  ) : (
                    <span className="mb-chip" style={{ background: st.soft, color: st.color }}>
                      <st.Icon size={12} /> {st.label}
                    </span>
                  )}

                  <ChevronRight size={18} className="mb-arrow" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {import_ && (
        <ImportMembresModal
          organisationId={params.organisation_id}
          onClose={() => setImport(false)}
          onTermine={() => { setImport(false); charger(); }}
        />
      )}
    </div>
  );
}

/* ---------------- Fiche membre ---------------- */

function FicheMembre({ membre, onBack, onUpdate }) {
  const { params, recharger } = useParametrage();
  const { mot, motMaj } = useVocabulaire();
  const fileRef = useRef(null);
  const [upload, setUpload] = useState(false);
  const [erreur, setErreur] = useState("");

  // Codes d'activation (membre pas encore activé)
  const [codes, setCodes] = useState([]);
  const [nouveauCode, setNouveauCode] = useState(null);
  const [generation, setGeneration] = useState(false);
  const [copie, setCopie] = useState(false);
  const [mailEnvoye, setMailEnvoye] = useState(null); // null | "envoye" | "echec"
  // Codes de récupération (membre déjà activé, changement de téléphone)
  const [codesRecup, setCodesRecup] = useState([]);
  const [nouveauRecup, setNouveauRecup] = useState(null);
  const [generationRecup, setGenerationRecup] = useState(false);
  const [copieRecup, setCopieRecup] = useState(false);
  const [mailEnvoyeRecup, setMailEnvoyeRecup] = useState(null); // null | "envoye" | "echec"

  // Droit d'adhésion
  const [saisieDroit, setSaisieDroit] = useState(null);
  const [enregistreDroit, setEnregistreDroit] = useState(false);

  // Parts sociales (coopérative) — historique des mouvements du membre
  const partsActif = moduleActif(params, "module_parts_sociales");
  const [partsMouvements, setPartsMouvements] = useState([]);
  const [partsChargement, setPartsChargement] = useState(partsActif);
  const [saisieParts, setSaisieParts] = useState(null);
  const [enregistreParts, setEnregistreParts] = useState(false);
  const [editValeurPart, setEditValeurPart] = useState(false);
  const [nouvelleValeurPart, setNouvelleValeurPart] = useState("");
  const [enregistreValeurPart, setEnregistreValeurPart] = useState(false);

  // Bénéficiaires déclarés par le membre — lecture seule ici, l'admin
  // ne les gère jamais lui-même.
  const [beneficiaires, setBeneficiaires] = useState([]);
  const [beneficiairesChargement, setBeneficiairesChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    setBeneficiairesChargement(true);
    supabase
      .from("beneficiaires")
      .select("*")
      .eq("membre_id", membre.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (actif) { setBeneficiaires(data || []); setBeneficiairesChargement(false); }
      });
    return () => { actif = false; };
  }, [membre.id]);

  useEffect(() => {
    if (!partsActif) return;
    let actif = true;
    setPartsChargement(true);
    supabase
      .from("parts_sociales_mouvements")
      .select("*")
      .eq("membre_id", membre.id)
      .order("date_mouvement", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (actif) { setPartsMouvements(data || []); setPartsChargement(false); }
      });
    return () => { actif = false; };
  }, [membre.id, partsActif]);

  // Sortie de la mutuelle
  const [bareme, setBareme] = useState({});
  const [totalCotise, setTotalCotise] = useState(0);
  const [dejaAssiste, setDejaAssiste] = useState(false);
  const [saisieSortie, setSaisieSortie] = useState(null);
  const [enregistreSortie, setEnregistreSortie] = useState(false);
  const [resultatSortie, setResultatSortie] = useState(null);

  const st = STATUT[membre.statut_cotisation] || STATUT.a_jour;
  const actif = Boolean(membre.user_id);
  const sorti = Boolean(membre.sortie_le);
  const motifSortie = MOTIFS_SORTIE.find((x) => x.id === membre.sortie_motif);
  const matricule = construireMatricule(params, membre);

  const droitPaye = Boolean(membre.droit_adhesion_paye_le);
  const montantReference = params.droit_adhesion ?? 2000;
  const carenceMois = params.carence_mois ?? 3;
  const eligibilite = dateEligibilite(params, membre);

  // Codes d'activation encore valides
  useEffect(() => {
    supabase
      .from("codes_activation")
      .select("*")
      .eq("membre_id", membre.id)
      .is("utilise_le", null)
      .gt("expire_le", new Date().toISOString())
      .order("created_at", { ascending: false })
      .then(({ data }) => setCodes(data || []));
  }, [membre.id, nouveauCode]);

  // Codes de récupération encore valides
  useEffect(() => {
    supabase
      .from("codes_recuperation")
      .select("*")
      .eq("membre_id", membre.id)
      .is("utilise_le", null)
      .gt("expire_le", new Date().toISOString())
      .order("created_at", { ascending: false })
      .then(({ data }) => setCodesRecup(data || []));
  }, [membre.id, nouveauRecup]);

  // Éléments nécessaires à l'aperçu des prestations de sortie
  useEffect(() => {
    Promise.all([
      supabase.from("bareme_prestations")
        .select("type_aide, libelle, montant_membre, montant_don")
        .eq("organisation_id", params.organisation_id),
      supabase.from("cotisations").select("montant_paye").eq("membre_id", membre.id),
      supabase.from("aides_sociales").select("id")
        .eq("membre_id", membre.id).in("statut", ["validee", "payee"]),
    ]).then(([b, c, a]) => {
      const map = {};
      (b.data || []).forEach((x) => { map[x.type_aide] = x; });
      setBareme(map);
      setTotalCotise((c.data || []).reduce((s, x) => s + (x.montant_paye || 0), 0));
      setDejaAssiste((a.data || []).length > 0);
    });
  }, [membre.id, membre.sortie_le]);

  async function genererCode() {
    setGeneration(true);
    setErreur("");
    setCopie(false);
    setMailEnvoye(null);

    const { data, error } = await supabase.rpc("generer_code_activation", {
      p_membre_id: membre.id,
    });

    setGeneration(false);
    if (error) { setErreur(error.message); return; }
    setNouveauCode(data);

    // E-mail automatique en complément de la transmission manuelle —
    // seulement si le membre a une vraie adresse enregistrée. Un membre
    // sans adresse (identifiant technique généré automatiquement) continue
    // de recevoir son code manuellement, il n'y a personne à qui écrire.
    if (membre.email) {
      const { error: erreurMail } = await supabase.functions.invoke("notifier-code-activation", {
        body: {
          email: membre.email,
          nomMembre: membre.nom,
          code: data,
          nomOrg: params.nom_mutuelle,
        },
      });
      setMailEnvoye(erreurMail ? "echec" : "envoye");
      if (erreurMail) console.error("[genererCode] notifier-code-activation a échoué :", erreurMail);
    }
  }

  async function genererCodeRecup() {
    setGenerationRecup(true);
    setErreur("");
    setCopieRecup(false);
    setMailEnvoyeRecup(null);

    const { data, error } = await supabase.rpc("generer_code_recuperation", {
      p_membre_id: membre.id,
    });

    setGenerationRecup(false);
    if (error) { setErreur(error.message); return; }
    setNouveauRecup(data);

    if (membre.email) {
      const { error: erreurMail } = await supabase.functions.invoke("notifier-code-activation", {
        body: {
          email: membre.email,
          nomMembre: membre.nom,
          code: data,
          nomOrg: params.nom_mutuelle,
          type: "recuperation",
        },
      });
      setMailEnvoyeRecup(erreurMail ? "echec" : "envoye");
      if (erreurMail) console.error("[genererCodeRecup] notifier-code-activation a échoué :", erreurMail);
    }
  }

  async function copier(code, quel) {
    try {
      await navigator.clipboard.writeText(code);
      if (quel === "recup") {
        setCopieRecup(true);
        setTimeout(() => setCopieRecup(false), 2200);
      } else {
        setCopie(true);
        setTimeout(() => setCopie(false), 2200);
      }
    } catch {
      setErreur("Copie impossible — notez le code manuellement.");
    }
  }

  /* ---- Droit d'adhésion ---- */

  function ouvrirSaisieDroit() {
    setErreur("");
    setSaisieDroit({
      montant: String(montantReference),
      date: new Date().toISOString().slice(0, 10),
      mode: "cash",
    });
  }

  async function enregistrerDroit() {
    const montantSaisi = parseInt(saisieDroit.montant, 10);

    if (!montantSaisi || montantSaisi <= 0) {
      setErreur("Indiquez le montant versé.");
      return;
    }
    if (!saisieDroit.date) {
      setErreur("Indiquez la date du versement.");
      return;
    }

    setEnregistreDroit(true);
    setErreur("");

    const { error } = await supabase.rpc("enregistrer_droit_adhesion", {
      p_membre_id: membre.id,
      p_montant: montantSaisi,
      p_mode: saisieDroit.mode,
      p_date: saisieDroit.date,
    });

    setEnregistreDroit(false);

    if (error) { setErreur(error.message); return; }

    setSaisieDroit(null);
    onUpdate({
      ...membre,
      droit_adhesion_montant: montantSaisi,
      droit_adhesion_paye_le: saisieDroit.date,
      droit_adhesion_mode: saisieDroit.mode,
    });
  }

  async function annulerDroit() {
    setEnregistreDroit(true);
    setErreur("");

    const { error } = await supabase.rpc("annuler_droit_adhesion", {
      p_membre_id: membre.id,
    });

    setEnregistreDroit(false);

    if (error) { setErreur(error.message); return; }

    onUpdate({
      ...membre,
      droit_adhesion_montant: null,
      droit_adhesion_paye_le: null,
      droit_adhesion_mode: null,
    });
  }

  /* ---- Parts sociales (coopérative) ---- */

  function ouvrirSaisieParts(type) {
    setErreur("");
    const defaut = params.valeur_part_sociale;
    setSaisieParts({
      type,
      nombreParts: "1",
      montant: defaut ? String(defaut) : "",
      date: new Date().toISOString().slice(0, 10),
      note: "",
    });
  }

  const totalParts = partsMouvements.reduce((s, m) =>
    s + (m.type_mouvement === "souscription" ? m.nombre_parts : -m.nombre_parts), 0);
  const totalCapital = partsMouvements.reduce((s, m) =>
    s + (m.type_mouvement === "souscription" ? m.montant : -m.montant), 0);

  async function enregistrerParts() {
    const nb = parseInt(saisieParts.nombreParts, 10);
    const mt = parseInt(saisieParts.montant, 10);

    if (!nb || nb <= 0) { setErreur("Indiquez le nombre de parts."); return; }
    if (!mt || mt <= 0) { setErreur("Indiquez le montant."); return; }
    if (!saisieParts.date) { setErreur("Indiquez la date."); return; }
    if (saisieParts.type === "remboursement" && nb > totalParts) {
      setErreur(`Ce ${mot("membre_singulier").toLowerCase()} ne détient que ${totalParts} part(s).`);
      return;
    }

    setEnregistreParts(true);
    setErreur("");

    const { data, error } = await supabase
      .from("parts_sociales_mouvements")
      .insert({
        organisation_id: params.organisation_id,
        membre_id: membre.id,
        type_mouvement: saisieParts.type,
        nombre_parts: nb,
        valeur_part_unitaire: Math.round(mt / nb),
        montant: mt,
        date_mouvement: saisieParts.date,
        note: saisieParts.note.trim() || null,
      })
      .select()
      .single();

    setEnregistreParts(false);

    if (error) { setErreur(error.message); return; }

    setPartsMouvements((liste) => [data, ...liste]);
    setSaisieParts(null);
  }

  async function supprimerMouvementParts(mvt) {
    const { error } = await supabase
      .from("parts_sociales_mouvements")
      .delete()
      .eq("id", mvt.id);

    if (error) { setErreur(error.message); return; }
    setPartsMouvements((liste) => liste.filter((m) => m.id !== mvt.id));
  }

  async function enregistrerValeurPart() {
    const v = parseInt(nouvelleValeurPart, 10);
    if (!v || v <= 0) { setErreur("Indiquez une valeur."); return; }

    setEnregistreValeurPart(true);
    setErreur("");

    const { error } = await supabase
      .from("parametrage")
      .update({ valeur_part_sociale: v })
      .eq("organisation_id", params.organisation_id);

    setEnregistreValeurPart(false);

    if (error) { setErreur(error.message); return; }

    setEditValeurPart(false);
    recharger();
  }

  /* ---- Sortie de la mutuelle ---- */

  function ouvrirSaisieSortie() {
    setErreur("");
    setResultatSortie(null);
    setSaisieSortie({
      motif: "demission",
      date: new Date().toISOString().slice(0, 10),
      note: "",
      cotisations: "maintenir",
      prestation: false,
    });
  }

  const motifChoisi = saisieSortie
    ? MOTIFS_SORTIE.find((m) => m.id === saisieSortie.motif)
    : null;

  // Aperçu du montant de la prestation qui serait ouverte
  const apercuPrestation = (() => {
    if (!motifChoisi?.prestation) return null;

    if (motifChoisi.prestation === "mutation") {
      if (dejaAssiste) {
        return {
          possible: false,
          texte: `Ce ${mot("membre_singulier").toLowerCase()} a déjà été assisté : l'article 23 ne lui ouvre aucun droit.`,
        };
      }
      return {
        possible: true,
        montant: Math.floor(totalCotise / 2),
        don: 0,
      };
    }

    const ligne = bareme[motifChoisi.prestation];
    if (!ligne) return null;

    return {
      possible: true,
      montant: ligne.montant_membre || 0,
      don: ligne.montant_don || 0,
    };
  })();

  async function enregistrerSortie() {
    if (!saisieSortie.date) {
      setErreur("Indiquez la date de sortie.");
      return;
    }

    setEnregistreSortie(true);
    setErreur("");

    const { data, error } = await supabase.rpc("enregistrer_sortie_membre", {
      p_membre_id: membre.id,
      p_motif: saisieSortie.motif,
      p_date: saisieSortie.date,
      p_note: saisieSortie.note.trim() || null,
      p_cotisations: saisieSortie.cotisations,
      p_prestation: saisieSortie.prestation,
    });

    setEnregistreSortie(false);

    if (error) { setErreur(error.message); return; }

    setSaisieSortie(null);
    setResultatSortie(data || null);
    onUpdate({
      ...membre,
      sortie_motif: saisieSortie.motif,
      sortie_le: saisieSortie.date,
      sortie_note: saisieSortie.note.trim() || null,
      actif: false,
    });
  }

  async function annulerSortie() {
    setEnregistreSortie(true);
    setErreur("");

    const { error } = await supabase.rpc("annuler_sortie_membre", {
      p_membre_id: membre.id,
    });

    setEnregistreSortie(false);

    if (error) { setErreur(error.message); return; }

    setResultatSortie(null);
    onUpdate({
      ...membre,
      sortie_motif: null,
      sortie_le: null,
      sortie_note: null,
      actif: true,
    });
  }

  /* ---- Photo ---- */

  async function televerser(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErreur("Le fichier doit être une image.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setErreur("Image trop lourde (3 Mo maximum).");
      return;
    }

    setUpload(true);
    setErreur("");

    const ext = file.name.split(".").pop().toLowerCase();
    const chemin = `${membre.id}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("photos-membres")
      .upload(chemin, file, { upsert: true, contentType: file.type });

    if (upErr) {
      setUpload(false);
      setErreur("Échec du téléversement : " + upErr.message);
      return;
    }

    const { data } = supabase.storage.from("photos-membres").getPublicUrl(chemin);
    const url = `${data.publicUrl}?v=${Date.now()}`;

    const { error: dbErr } = await supabase
      .from("membres").update({ photo_url: url }).eq("id", membre.id);

    setUpload(false);
    if (dbErr) { setErreur(dbErr.message); return; }
    onUpdate({ ...membre, photo_url: url });
  }

  async function retirerPhoto() {
    setUpload(true);
    setErreur("");
    const { error } = await supabase.from("membres").update({ photo_url: null }).eq("id", membre.id);
    setUpload(false);
    if (error) {
      setErreur("Le retrait de la photo n'a pas abouti. Vérifiez votre connexion et réessayez.");
      return;
    }
    onUpdate({ ...membre, photo_url: null });
  }

  const codeAffiche = nouveauCode || codes[0]?.code || null;
  const expiration = nouveauCode
    ? new Date(Date.now() + 7 * 86400000)
    : codes[0]?.expire_le ? new Date(codes[0].expire_le) : null;

  const recupAffiche = nouveauRecup || codesRecup[0]?.code || null;
  const expirationRecup = nouveauRecup
    ? new Date(Date.now() + 24 * 3600000)
    : codesRecup[0]?.expire_le ? new Date(codesRecup[0].expire_le) : null;

  return (
    <div className="mb-wrap">
      <style>{CSS}</style>

      <button className="mb-back" onClick={onBack}>
        <ArrowLeft size={16} /> Retour à la liste
      </button>

      <div className="mb-fiche">
        {/* ---- Bandeau de sortie ---- */}
        {sorti && (
          <div className="mb-bandeau-sortie">
            <LogOut size={18} />
            <div>
              <strong>
                {motifSortie ? motifSortie.label : "Sortie"} enregistrée le{" "}
                {new Date(membre.sortie_le).toLocaleDateString("fr-FR")}
              </strong>
              <p>
                Ce {mot("membre_singulier").toLowerCase()} ne fait plus partie {mot("organisation_de")} (article 32). Son accès
                à l'application reste ouvert tant qu'une prestation lui est due.
              </p>
            </div>
          </div>
        )}

        {/* ---- Bandeau ---- */}
        <div className="mb-fiche-head">
          <div className="mb-photo-zone">
            <Avatar membre={membre} taille={96} bordure />
            <button
              className="mb-photo-btn"
              onClick={() => fileRef.current?.click()}
              disabled={upload}
              title="Changer la photo"
            >
              {upload ? <Loader2 size={15} className="mb-spin" /> : <Camera size={15} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*"
              onChange={televerser} style={{ display: "none" }} />
          </div>

          <div className="mb-fiche-id">
            <h2 className="mb-fiche-nom">{membre.nom}</h2>
            <div className="mb-fiche-poste">{membre.poste || "—"}</div>
            <div className="mb-fiche-puces">
              {sorti ? (
                <span className="mb-chip mb-chip-sorti">
                  <LogOut size={13} /> {motifSortie ? motifSortie.label : "Sorti"}
                </span>
              ) : (
                <span className="mb-chip" style={{ background: st.soft, color: st.color }}>
                  <st.Icon size={13} /> {st.label}
                </span>
              )}

              <span
                className="mb-chip"
                style={{
                  background: actif ? "#DCFCE7" : PALETTE.grey200,
                  color: actif ? C.success : C.textMuted,
                }}
              >
                {actif ? <ShieldCheck size={13} /> : <KeyRound size={13} />}
                {actif ? "Compte activé" : "Compte non activé"}
              </span>

              {!sorti && (
                <span
                  className="mb-chip"
                  style={{
                    background: droitPaye ? "#DCFCE7" : "#FEF3C7",
                    color: droitPaye ? C.success : "#B45309",
                  }}
                >
                  <Receipt size={13} />
                  {droitPaye ? "Droit d'adhésion réglé" : "Droit d'adhésion en attente"}
                </span>
              )}
            </div>
          </div>
        </div>

        {membre.photo_url && (
          <button className="mb-remove" onClick={retirerPhoto} disabled={upload}>
            <Trash2 size={13} /> Retirer la photo
          </button>
        )}

        {erreur && <div className="mb-error">{erreur}</div>}

        {/* ---- Résultat de l'enregistrement d'une sortie ---- */}
        {resultatSortie && (
          <div className="mb-resultat">
            <CheckCircle2 size={17} />
            <div>
              <strong>Sortie enregistrée.</strong>
              <ul>
                <li>
                  {resultatSortie.cotisations_impayees > 0
                    ? `${resultatSortie.cotisations_impayees} ${resultatSortie.cotisations_impayees > 1 ? mot("cotisations").toLowerCase() : mot("cotisation").toLowerCase()} impayée${resultatSortie.cotisations_impayees > 1 ? "s" : ""} au moment de la sortie`
                    : `Aucune ${mot("cotisation").toLowerCase()} impayée`}
                  {resultatSortie.cotisations_annulees > 0 &&
                    ` — ${resultatSortie.cotisations_annulees} annulée(s) sur décision ${mot("bureau_du")}`}
                </li>
                <li>
                  {resultatSortie.prestation_creee
                    ? `Demande de prestation créée pour ${montant(resultatSortie.montant_prestation)} FCFA — à instruire dans ${mot("aides")}`
                    : "Aucune prestation ouverte"}
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* ---- Informations ---- */}
        <dl className="mb-infos">
          <Info2 Icon={Briefcase}    label="Service"        value={membre.service || "—"} />
          <Info2 Icon={Phone}        label="Téléphone"      value={membre.telephone || "—"} />
          <Info2 Icon={Mail}         label="Adresse e-mail" value={membre.email || "Non renseignée"} />
          <Info2 Icon={CalendarDays} label={`${mot("membre_singulier")} depuis`}
            value={membre.date_adhesion
              ? new Date(membre.date_adhesion).toLocaleDateString("fr-FR")
              : "—"} />
        </dl>

        <div className="mb-matricule">
          <span>{mot("matricule")}</span>
          <strong>{matricule}</strong>
        </div>

        {/* ---- Bénéficiaires déclarés — lecture seule ---- */}
        <section className="mb-acces">
          <header className="mb-acces-head">
            <span className="mb-acces-icon"><Users size={18} /></span>
            <div>
              <h3 className="mb-acces-titre">Bénéficiaires déclarés</h3>
              <p className="mb-acces-sub">
                Proches renseignés par {mot("membre_singulier").toLowerCase()} lui-même, pouvant
                être concernés par une demande {de(mot("aides").toLowerCase())}.
              </p>
            </div>
          </header>

          {beneficiairesChargement ? (
            <div style={{ padding: "12px 0", color: C.textSubtle, fontSize: 13 }}>Chargement…</div>
          ) : beneficiaires.length === 0 ? (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: C.textSubtle }}>
              Aucun bénéficiaire déclaré pour le moment.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {beneficiaires.map((b) => {
                const lien = LIENS_BENEFICIAIRE.find((l) => l.id === b.lien_parente) || LIENS_BENEFICIAIRE[6];
                return (
                  <li
                    key={b.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: C.bg, borderRadius: R.md, padding: "10px 14px",
                    }}
                  >
                    <span style={{
                      width: 34, height: 34, borderRadius: R.sm, flexShrink: 0,
                      background: lien.color + "14", color: lien.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <lien.Icon size={16} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{b.nom}</div>
                      <div style={{ fontSize: 12, color: C.textSubtle, marginTop: 1 }}>
                        {lien.label}
                        {b.telephone && ` · ${b.telephone}`}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ---- Droit d'adhésion (article 15) ---- */}
        {!sorti && (
          <section className="mb-acces">
            <header className="mb-acces-head">
              <span className="mb-acces-icon"><Receipt size={18} /></span>
              <div>
                <h3 className="mb-acces-titre">Droit {de(mot("adhesion").toLowerCase())}</h3>
                <p className="mb-acces-sub">
                  {montant(montantReference)} francs, payable en une seule fois.
                  {params.depart_carence !== "date_adhesion" && (
                    <> Ce versement fait courir le délai de {carenceMois} mois
                    avant toute prestation.</>
                  )}
                </p>
              </div>
            </header>

            {droitPaye ? (
              <>
                <dl className="mb-droit-infos">
                  <div>
                    <dt>Montant versé</dt>
                    <dd>{montant(membre.droit_adhesion_montant)} FCFA</dd>
                  </div>
                  <div>
                    <dt>Date du versement</dt>
                    <dd>{new Date(membre.droit_adhesion_paye_le).toLocaleDateString("fr-FR")}</dd>
                  </div>
                  <div>
                    <dt>Mode</dt>
                    <dd>{libelleMode(membre.droit_adhesion_mode)}</dd>
                  </div>
                </dl>

                {eligibilite.date && (
                  <div className="mb-eligibilite">
                    <CalendarCheck size={15} />
                    <span>
                      Éligible aux prestations depuis le{" "}
                      <strong>{eligibilite.date.toLocaleDateString("fr-FR")}</strong>
                      {eligibilite.date > new Date() && " — pas encore atteint"}.
                    </span>
                  </div>
                )}

                {membre.droit_adhesion_montant !== montantReference && (
                  <div className="mb-warn mb-warn-serre">
                    <AlertTriangle size={15} />
                    <span>
                      Le montant enregistré s'écarte des {montant(montantReference)}{" "}
                      francs fixés dans les paramètres.
                    </span>
                  </div>
                )}

                <button
                  className="mb-lien-danger"
                  onClick={annulerDroit}
                  disabled={enregistreDroit}
                >
                  {enregistreDroit
                    ? <><Loader2 size={13} className="mb-spin" /> Annulation…</>
                    : <><Trash2 size={13} /> Annuler cet enregistrement</>}
                </button>
              </>
            ) : saisieDroit ? (
              <div className="mb-form">
                <div className="mb-champ">
                  <label className="mb-label" htmlFor="droit-montant">Montant versé</label>
                  <div className="mb-input-devise">
                    <input
                      id="droit-montant"
                      type="number"
                      value={saisieDroit.montant}
                      onChange={(e) =>
                        setSaisieDroit((d) => ({ ...d, montant: e.target.value }))}
                      className="mb-input"
                    />
                    <span>FCFA</span>
                  </div>
                </div>

                <div className="mb-champ">
                  <label className="mb-label" htmlFor="droit-date">Date du versement</label>
                  <input
                    id="droit-date"
                    type="date"
                    value={saisieDroit.date}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) =>
                      setSaisieDroit((d) => ({ ...d, date: e.target.value }))}
                    className="mb-input"
                  />
                </div>

                <div className="mb-champ">
                  <label className="mb-label" htmlFor="droit-mode">Mode de paiement</label>
                  <select
                    id="droit-mode"
                    value={saisieDroit.mode}
                    onChange={(e) =>
                      setSaisieDroit((d) => ({ ...d, mode: e.target.value }))}
                    className="mb-input"
                  >
                    {MODES_PAIEMENT.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-form-actions">
                  <button
                    className="mb-code-new"
                    onClick={() => { setSaisieDroit(null); setErreur(""); }}
                    disabled={enregistreDroit}
                  >
                    Annuler
                  </button>
                  <button
                    className="mb-btn-code"
                    onClick={enregistrerDroit}
                    disabled={enregistreDroit}
                  >
                    {enregistreDroit
                      ? <><Loader2 size={16} className="mb-spin" /> Enregistrement…</>
                      : <><Check size={16} /> Enregistrer le versement</>}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-warn mb-warn-serre">
                  <AlertTriangle size={15} />
                  <span>
                    Aucun versement enregistré. L'éligibilité de ce {mot("membre_singulier").toLowerCase()}{" "}
                    aux {mot("aides").toLowerCase()} est calculée à titre provisoire depuis
                    sa date {de(mot("adhesion").toLowerCase())}.
                  </span>
                </div>
                <button className="mb-btn-code" onClick={ouvrirSaisieDroit}>
                  <Receipt size={16} /> Enregistrer le droit {de(mot("adhesion").toLowerCase())}
                </button>
              </>
            )}
          </section>
        )}

        {/* ---- Parts sociales (coopérative) ---- */}
        {!sorti && partsActif && (
          <section className="mb-acces">
            <header className="mb-acces-head">
              <span className="mb-acces-icon"><Coins size={18} /></span>
              <div>
                <h3 className="mb-acces-titre">Parts sociales</h3>
                <p className="mb-acces-sub">
                  Capital détenu par ce {mot("membre_singulier").toLowerCase()}, souscrit ou
                  remboursé au fil du temps.
                </p>
              </div>
            </header>

            <div className="mb-parts-valeur">
              {editValeurPart ? (
                <div className="mb-parts-valeur-edit">
                  <input
                    type="number"
                    value={nouvelleValeurPart}
                    onChange={(e) => setNouvelleValeurPart(e.target.value)}
                    placeholder="Valeur d'une part"
                    className="mb-input"
                    autoFocus
                  />
                  <span>FCFA</span>
                  <button
                    className="mb-code-new"
                    onClick={() => { setEditValeurPart(false); setErreur(""); }}
                    disabled={enregistreValeurPart}
                  >
                    Annuler
                  </button>
                  <button
                    className="mb-btn-code mb-btn-code-sm"
                    onClick={enregistrerValeurPart}
                    disabled={enregistreValeurPart}
                  >
                    {enregistreValeurPart ? <Loader2 size={14} className="mb-spin" /> : "Valider"}
                  </button>
                </div>
              ) : (
                <>
                  <span>
                    Valeur d'une part :{" "}
                    {params.valeur_part_sociale
                      ? <strong>{montant(params.valeur_part_sociale)} FCFA</strong>
                      : <em>non définie</em>}
                  </span>
                  <button
                    className="mb-parts-valeur-btn"
                    onClick={() => {
                      setNouvelleValeurPart(params.valeur_part_sociale ? String(params.valeur_part_sociale) : "");
                      setEditValeurPart(true);
                      setErreur("");
                    }}
                  >
                    <Pencil size={12} /> {params.valeur_part_sociale ? "Modifier" : "Définir"}
                  </button>
                </>
              )}
            </div>

            {partsChargement ? (
              <div className="mb-parts-skel" />
            ) : (
              <>
                <dl className="mb-droit-infos">
                  <div>
                    <dt>Parts détenues</dt>
                    <dd>{totalParts}</dd>
                  </div>
                  <div>
                    <dt>Capital investi</dt>
                    <dd>{montant(totalCapital)} FCFA</dd>
                  </div>
                </dl>

                {partsMouvements.length > 0 && (
                  <ul className="mb-parts-liste">
                    {partsMouvements.map((m) => (
                      <li key={m.id} className="mb-parts-ligne">
                        <span className={`mb-parts-badge ${m.type_mouvement === "remboursement" ? "is-remb" : ""}`}>
                          {m.type_mouvement === "souscription" ? "+" : "−"}{m.nombre_parts}
                        </span>
                        <div className="mb-parts-corps">
                          <span>{montant(m.montant)} FCFA</span>
                          <span className="mb-parts-date">
                            {new Date(m.date_mouvement).toLocaleDateString("fr-FR")}
                            {m.note ? ` · ${m.note}` : ""}
                          </span>
                        </div>
                        <button
                          className="mb-parts-suppr"
                          onClick={() => supprimerMouvementParts(m)}
                          title="Supprimer ce mouvement"
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {saisieParts ? (
                  <div className="mb-form">
                    <div className="mb-champ">
                      <label className="mb-label" htmlFor="parts-nombre">Nombre de parts</label>
                      <input
                        id="parts-nombre"
                        type="number"
                        min="1"
                        value={saisieParts.nombreParts}
                        onChange={(e) =>
                          setSaisieParts((d) => ({ ...d, nombreParts: e.target.value }))}
                        className="mb-input"
                      />
                    </div>

                    <div className="mb-champ">
                      <label className="mb-label" htmlFor="parts-montant">Montant</label>
                      <div className="mb-input-devise">
                        <input
                          id="parts-montant"
                          type="number"
                          value={saisieParts.montant}
                          onChange={(e) =>
                            setSaisieParts((d) => ({ ...d, montant: e.target.value }))}
                          className="mb-input"
                        />
                        <span>FCFA</span>
                      </div>
                    </div>

                    <div className="mb-champ">
                      <label className="mb-label" htmlFor="parts-date">Date</label>
                      <input
                        id="parts-date"
                        type="date"
                        value={saisieParts.date}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) =>
                          setSaisieParts((d) => ({ ...d, date: e.target.value }))}
                        className="mb-input"
                      />
                    </div>

                    <div className="mb-champ">
                      <label className="mb-label" htmlFor="parts-note">
                        Note <span className="mb-opt">— facultative</span>
                      </label>
                      <input
                        id="parts-note"
                        type="text"
                        value={saisieParts.note}
                        onChange={(e) =>
                          setSaisieParts((d) => ({ ...d, note: e.target.value }))}
                        className="mb-input"
                      />
                    </div>

                    <div className="mb-form-actions">
                      <button
                        className="mb-code-new"
                        onClick={() => { setSaisieParts(null); setErreur(""); }}
                        disabled={enregistreParts}
                      >
                        Annuler
                      </button>
                      <button
                        className="mb-btn-code"
                        onClick={enregistrerParts}
                        disabled={enregistreParts}
                      >
                        {enregistreParts
                          ? <><Loader2 size={16} className="mb-spin" /> Enregistrement…</>
                          : <><Check size={16} /> Enregistrer</>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-parts-actions">
                    <button className="mb-btn-code" onClick={() => ouvrirSaisieParts("souscription")}>
                      <Coins size={16} /> Nouvelle souscription
                    </button>
                    {totalParts > 0 && (
                      <button className="mb-lien-danger" onClick={() => ouvrirSaisieParts("remboursement")}>
                        <Undo2 size={13} /> Enregistrer un remboursement
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ---- Accès à la plateforme ---- */}
        {!actif ? (
          <section className="mb-acces">
            <header className="mb-acces-head">
              <span className="mb-acces-icon"><KeyRound size={18} /></span>
              <div>
                <h3 className="mb-acces-titre">Accès à la plateforme</h3>
                <p className="mb-acces-sub">
                  Remettez un code d'activation au membre pour qu'il ouvre son espace.
                </p>
              </div>
            </header>

            {codeAffiche ? (
              <div className="mb-code-zone">
                <div className="mb-code-label">Code d'activation</div>
                <div className="mb-code-valeur">{codeAffiche}</div>
                <div className="mb-code-actions">
                  <button className="mb-code-copy" onClick={() => copier(codeAffiche, "activation")}>
                    {copie ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier</>}
                  </button>
                  <button className="mb-code-new" onClick={genererCode} disabled={generation}>
                    {generation
                      ? <><Loader2 size={14} className="mb-spin" /> Génération…</>
                      : "Générer un nouveau code"}
                  </button>
                </div>
                {expiration && (
                  <div className="mb-code-exp">
                    Valable jusqu'au {expiration.toLocaleDateString("fr-FR")} · usage unique
                  </div>
                )}
                {membre.email && mailEnvoye === "envoye" && (
                  <div className="mb-code-exp" style={{ color: C.success }}>
                    <Mail size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                    Envoyé par e-mail à {membre.email}
                  </div>
                )}
                {membre.email && mailEnvoye === "echec" && (
                  <div className="mb-code-exp" style={{ color: C.danger }}>
                    L'envoi automatique par e-mail a échoué — transmettez ce code manuellement.
                  </div>
                )}
              </div>
            ) : (
              <button className="mb-btn-code" onClick={genererCode} disabled={generation}>
                {generation
                  ? <><Loader2 size={16} className="mb-spin" /> Génération…</>
                  : <><KeyRound size={16} /> Générer un code d'activation</>}
              </button>
            )}
          </section>
        ) : (
          <section className="mb-acces">
            <header className="mb-acces-head">
              <span className="mb-acces-icon"><Smartphone size={18} /></span>
              <div>
                <h3 className="mb-acces-titre">Changement de téléphone</h3>
                <p className="mb-acces-sub">
                  Si ce membre a perdu l'accès à son espace (nouveau téléphone,
                  application réinstallée), remettez-lui un code de récupération.
                </p>
              </div>
            </header>

            {recupAffiche ? (
              <div className="mb-code-zone mb-code-zone-recup">
                <div className="mb-code-label">Code de récupération</div>
                <div className="mb-code-valeur mb-code-valeur-recup">{recupAffiche}</div>
                <div className="mb-code-actions">
                  <button
                    className="mb-code-copy mb-code-copy-recup"
                    onClick={() => copier(recupAffiche, "recup")}
                  >
                    {copieRecup ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier</>}
                  </button>
                  <button
                    className="mb-code-new"
                    onClick={genererCodeRecup}
                    disabled={generationRecup}
                  >
                    {generationRecup
                      ? <><Loader2 size={14} className="mb-spin" /> Génération…</>
                      : "Générer un nouveau code"}
                  </button>
                </div>
                {expirationRecup && (
                  <div className="mb-code-exp">
                    Valable jusqu'au {expirationRecup.toLocaleDateString("fr-FR")} à{" "}
                    {expirationRecup.toLocaleTimeString("fr-FR", {
                      hour: "2-digit", minute: "2-digit",
                    })} · usage unique
                  </div>
                )}
                {membre.email && mailEnvoyeRecup === "envoye" && (
                  <div className="mb-code-exp" style={{ color: C.success }}>
                    <Mail size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                    Envoyé par e-mail à {membre.email}
                  </div>
                )}
                {membre.email && mailEnvoyeRecup === "echec" && (
                  <div className="mb-code-exp" style={{ color: C.danger }}>
                    L'envoi automatique par e-mail a échoué — transmettez ce code manuellement.
                  </div>
                )}
              </div>
            ) : (
              <button
                className="mb-btn-code mb-btn-code-recup"
                onClick={genererCodeRecup}
                disabled={generationRecup}
              >
                {generationRecup
                  ? <><Loader2 size={16} className="mb-spin" /> Génération…</>
                  : <><Smartphone size={16} /> Générer un code de récupération</>}
              </button>
            )}

            <div className="mb-warn mb-warn-serre">
              <AlertTriangle size={15} />
              <span>
                L'usage de ce code déconnecte automatiquement l'ancien appareil.
                Ne le remettez qu'au membre lui-même, après vous être assuré de son identité.
              </span>
            </div>
          </section>
        )}

        {!membre.email && !actif && !sorti && (
          <div className="mb-warn">
            <AlertTriangle size={15} />
            <span>
              Aucune adresse e-mail renseignée. Le code d'activation est le seul
              moyen d'ouvrir l'accès de ce membre.
            </span>
          </div>
        )}

        {/* ---- Sortie de la mutuelle (articles 23, 24, 32, 33) ---- */}
        <section className="mb-acces mb-acces-sortie">
          <header className="mb-acces-head">
            <span className="mb-acces-icon mb-acces-icon-sortie"><LogOut size={18} /></span>
            <div>
              <h3 className="mb-acces-titre">Sortie {mot("organisation_de")}</h3>
              <p className="mb-acces-sub">
                Article 32 : la qualité {de(mot("membre_singulier").toLowerCase())} se perd par démission, mutation,
                départ à la retraite ou décès.
              </p>
            </div>
          </header>

          {sorti ? (
            <>
              <dl className="mb-droit-infos">
                <div>
                  <dt>Motif</dt>
                  <dd>{motifSortie ? motifSortie.label : membre.sortie_motif}</dd>
                </div>
                <div>
                  <dt>Date de sortie</dt>
                  <dd>{new Date(membre.sortie_le).toLocaleDateString("fr-FR")}</dd>
                </div>
                <div>
                  <dt>Référence</dt>
                  <dd>{motifSortie ? motifSortie.article : "—"}</dd>
                </div>
              </dl>

              {membre.sortie_note && (
                <div className="mb-note-sortie">
                  <strong>Note {mot("bureau_du")} : </strong>{membre.sortie_note}
                </div>
              )}

              <button
                className="mb-lien-danger"
                onClick={annulerSortie}
                disabled={enregistreSortie}
              >
                {enregistreSortie
                  ? <><Loader2 size={13} className="mb-spin" /> Annulation…</>
                  : <><Undo2 size={13} /> Annuler cette sortie</>}
              </button>
            </>
          ) : saisieSortie ? (
            <div className="mb-form">
              <div className="mb-champ">
                <span className="mb-label">Motif de la sortie</span>
                <div className="mb-motifs">
                  {MOTIFS_SORTIE.map((m) => (
                    <button
                      key={m.id}
                      className={`mb-motif ${saisieSortie.motif === m.id ? "is-on" : ""}`}
                      onClick={() =>
                        setSaisieSortie((s) => ({ ...s, motif: m.id, prestation: false }))}
                    >
                      <span className="mb-radio">
                        {saisieSortie.motif === m.id && <span className="mb-radio-dot" />}
                      </span>
                      <span className="mb-motif-text">
                        <strong>{m.label}</strong>
                        <em>{m.article}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {motifChoisi && (
                <div className="mb-note">
                  <Info size={13} /> {motifChoisi.aide}
                </div>
              )}

              <div className="mb-champ">
                <label className="mb-label" htmlFor="sortie-date">Date de sortie</label>
                <input
                  id="sortie-date"
                  type="date"
                  value={saisieSortie.date}
                  onChange={(e) =>
                    setSaisieSortie((s) => ({ ...s, date: e.target.value }))}
                  className="mb-input"
                />
              </div>

              <div className="mb-champ">
                <label className="mb-label" htmlFor="sortie-note">
                  Note <span className="mb-optionnel">— facultative</span>
                </label>
                <textarea
                  id="sortie-note"
                  rows={2}
                  value={saisieSortie.note}
                  onChange={(e) =>
                    setSaisieSortie((s) => ({ ...s, note: e.target.value }))}
                  placeholder="Référence de la lettre de démission, nouvelle affectation…"
                  className="mb-input mb-textarea"
                />
              </div>

              <div className="mb-champ">
                <span className="mb-label">Cotisations impayées</span>
                <div className="mb-choix">
                  <button
                    className={`mb-choix-btn ${saisieSortie.cotisations === "maintenir" ? "is-on" : ""}`}
                    onClick={() =>
                      setSaisieSortie((s) => ({ ...s, cotisations: "maintenir" }))}
                  >
                    Les maintenir dues
                  </button>
                  <button
                    className={`mb-choix-btn ${saisieSortie.cotisations === "annuler" ? "is-on" : ""}`}
                    onClick={() =>
                      setSaisieSortie((s) => ({ ...s, cotisations: "annuler" }))}
                  >
                    Les annuler
                  </button>
                </div>
                {saisieSortie.cotisations === "annuler" && (
                  <div className="mb-note">
                    <Info size={13} /> Les cotisations non réglées passeront en
                    « exemptées ». Elles cesseront de peser sur l'éligibilité de ce
                    membre à une éventuelle prestation de sortie.
                  </div>
                )}
              </div>

              {apercuPrestation && (
                <div className="mb-champ">
                  <span className="mb-label">Prestation de sortie</span>

                  {apercuPrestation.possible ? (
                    <>
                      <button
                        className={`mb-choix-btn mb-choix-large ${saisieSortie.prestation ? "is-on" : ""}`}
                        onClick={() =>
                          setSaisieSortie((s) => ({ ...s, prestation: !s.prestation }))}
                      >
                        <span className="mb-case">
                          {saisieSortie.prestation && <Check size={13} />}
                        </span>
                        Ouvrir une demande de {montant(apercuPrestation.montant)} FCFA
                        {apercuPrestation.don > 0 &&
                          ` + ${montant(apercuPrestation.don)} FCFA de don`}
                      </button>
                      <div className="mb-note">
                        <Info size={13} /> La demande sera créée dans « {mot("aides")} »
                        avec le statut « en attente », pour instruction normale par {mot("bureau_le")}.
                      </div>
                    </>
                  ) : (
                    <div className="mb-note">
                      <Info size={13} /> {apercuPrestation.texte}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-form-actions">
                <button
                  className="mb-code-new"
                  onClick={() => { setSaisieSortie(null); setErreur(""); }}
                  disabled={enregistreSortie}
                >
                  Annuler
                </button>
                <button
                  className="mb-btn-sortie"
                  onClick={enregistrerSortie}
                  disabled={enregistreSortie}
                >
                  {enregistreSortie
                    ? <><Loader2 size={16} className="mb-spin" /> Enregistrement…</>
                    : <><LogOut size={16} /> Confirmer la sortie</>}
                </button>
              </div>
            </div>
          ) : (
            <button className="mb-lien-sortie" onClick={ouvrirSaisieSortie}>
              <LogOut size={14} /> Enregistrer une sortie
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------------- Sous-composants ---------------- */

function Avatar({ membre, taille, bordure }) {
  const initiales = membre.nom.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase();

  if (membre.photo_url) {
    return (
      <img
        src={membre.photo_url}
        alt={membre.nom}
        className="mb-avatar-img"
        style={{
          width: taille, height: taille,
          border: bordure ? `3px solid ${C.surface}` : "none",
          boxShadow: bordure ? SHADOW.md : "none",
        }}
      />
    );
  }

  return (
    <div
      className="mb-avatar"
      style={{
        width: taille, height: taille,
        fontSize: taille * 0.36,
        border: bordure ? `3px solid ${C.surface}` : "none",
        boxShadow: bordure ? SHADOW.md : "none",
      }}
    >
      {initiales}
    </div>
  );
}

function Info2({ Icon, label, value }) {
  return (
    <div className="mb-info">
      <span className="mb-info-icon"><Icon size={16} /></span>
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}

/* ---------------- Utilitaires ---------------- */

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function libelleMode(id) {
  const m = MODES_PAIEMENT.find((x) => x.id === id);
  return m ? m.label : (id || "—");
}

/* ---------------- Styles ---------------- */

const CSS = `
.mb-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .mb-wrap{ padding:${S.lg}px; } }

/* ---- Rappel ---- */
.mb-rappel{
  display:flex; align-items:flex-start; gap:10px;
  background:#FEF3C7; color:#92400E; border:1px solid ${C.warning}44;
  border-radius:${R.md}px; padding:12px 15px; font-size:13.5px; line-height:1.55;
}

/* ---- Outils ---- */
.mb-tools{ display:flex; flex-direction:column; gap:${S.md}px; }
.mb-search-ligne{ display:flex; gap:10px; align-items:center; }
.mb-search{ position:relative; max-width:400px; flex:1; }
.mb-btn-import{
  display:flex; align-items:center; gap:7px; flex-shrink:0;
  background:${C.surface}; border:1.5px solid ${C.border}; color:${C.textMuted};
  border-radius:${R.md}px; padding:12px 16px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600;
}
.mb-btn-import:hover{ border-color:${C.primary}; color:${C.primary}; }
.mb-search-icon{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:${C.textSubtle}; }
.mb-input{
  width:100%; box-sizing:border-box; padding:13px 16px 13px 42px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:15px;
  color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.mb-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.mb-input::placeholder{ color:${PALETTE.grey300}; }

.mb-filters{ display:flex; gap:${S.sm}px; flex-wrap:wrap; }
.mb-filter{
  display:flex; align-items:center; gap:7px;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.pill}px; padding:8px 14px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; color:${C.textMuted};
  transition:all .16s ease;
}
.mb-filter:hover{ border-color:${PALETTE.grey300}; }
.mb-filter.is-on{ background:${C.primary}; border-color:${C.primary}; color:#fff; }
.mb-filter.is-sortis.is-on{ background:${C.textMuted}; border-color:${C.textMuted}; }
.mb-count{
  background:${PALETTE.grey200}; color:${C.textMuted};
  border-radius:${R.pill}px; padding:1px 7px; font-size:11.5px; font-weight:700;
}
.mb-filter.is-on .mb-count{ background:rgba(255,255,255,.25); color:#fff; }

/* ---- Liste ---- */
.mb-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:${S.sm}px; }
.mb-row{
  display:flex; align-items:center; gap:${S.md}px; width:100%;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.lg}px; padding:${S.md}px ${S.lg}px;
  cursor:pointer; font-family:inherit; text-align:left;
  box-shadow:${SHADOW.xs};
  transition:transform .14s ease, box-shadow .18s ease, border-color .18s ease;
}
.mb-row:hover{ transform:translateY(-1px); box-shadow:${SHADOW.md}; border-color:${PALETTE.grey300}; }
.mb-row.is-sorti{ background:${C.bg}; }
.mb-row.is-sorti .mb-row-nom{ color:${C.textMuted}; }
.mb-row-text{ flex:1; min-width:0; }
.mb-row-nom{ font-size:15px; font-weight:600; }
.mb-row-sub{
  font-size:12.5px; color:${C.textSubtle}; margin-top:2px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.mb-arrow{ color:${C.textSubtle}; flex-shrink:0; }
.mb-pastille{
  width:8px; height:8px; border-radius:50%; flex-shrink:0;
  background:${C.warning};
}

/* ---- Avatars ---- */
.mb-avatar{
  border-radius:50%; flex-shrink:0;
  background:linear-gradient(135deg, ${PALETTE.blue800}, ${PALETTE.blue600});
  color:#fff; display:flex; align-items:center; justify-content:center;
  font-weight:700; letter-spacing:-.02em;
}
.mb-avatar-img{ border-radius:50%; flex-shrink:0; object-fit:cover; background:${PALETTE.grey200}; }

/* ---- Puces ---- */
.mb-chip{
  display:inline-flex; align-items:center; gap:5px; flex-shrink:0;
  padding:5px 11px; border-radius:${R.pill}px;
  font-size:12px; font-weight:600; white-space:nowrap;
}
.mb-chip-sorti{ background:${PALETTE.grey200}; color:${C.textMuted}; }

/* ---- Fiche ---- */
.mb-back{
  display:flex; align-items:center; gap:7px; align-self:flex-start;
  background:none; border:none; padding:0; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; color:${C.primary};
}
.mb-back:hover{ text-decoration:underline; }

.mb-fiche{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xl}px;
  box-shadow:${SHADOW.xs}; max-width:620px;
}
.mb-bandeau-sortie{
  display:flex; align-items:flex-start; gap:${S.md}px;
  background:${PALETTE.grey200}; color:${C.textMuted};
  border-radius:${R.md}px; padding:${S.md}px ${S.lg}px; margin-bottom:${S.lg}px;
}
.mb-bandeau-sortie strong{ font-size:14px; color:${C.text}; }
.mb-bandeau-sortie p{ font-size:13px; margin:4px 0 0; line-height:1.55; }

.mb-fiche-head{ display:flex; align-items:center; gap:${S.xl}px; flex-wrap:wrap; }
.mb-photo-zone{ position:relative; flex-shrink:0; }
.mb-photo-btn{
  position:absolute; right:-2px; bottom:-2px;
  width:32px; height:32px; border-radius:50%;
  background:${C.primary}; color:#fff; border:2.5px solid ${C.surface};
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  transition:background .16s ease;
}
.mb-photo-btn:hover:not(:disabled){ background:${C.primaryDark}; }
.mb-photo-btn:disabled{ opacity:.7; cursor:not-allowed; }
.mb-fiche-id{ min-width:0; }
.mb-fiche-nom{ font-size:22px; font-weight:700; letter-spacing:-.02em; margin:0; }
.mb-fiche-poste{ font-size:14px; color:${C.textSubtle}; margin-top:3px; }
.mb-fiche-puces{ display:flex; gap:${S.sm}px; flex-wrap:wrap; margin-top:${S.sm}px; }

.mb-remove{
  display:flex; align-items:center; gap:6px; align-self:flex-start;
  background:none; border:none; padding:0; margin-top:${S.md}px;
  cursor:pointer; font-family:inherit; font-size:13px;
  font-weight:600; color:${C.danger};
}
.mb-remove:hover{ text-decoration:underline; }

.mb-error{
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:11px 14px; font-size:13.5px; margin-top:${S.md}px;
}
.mb-resultat{
  display:flex; align-items:flex-start; gap:10px;
  background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33;
  border-radius:${R.md}px; padding:13px 15px; margin-top:${S.md}px;
  font-size:13.5px; line-height:1.55;
}
.mb-resultat ul{ margin:5px 0 0; padding-left:18px; }
.mb-resultat li{ margin-top:2px; }

/* ---- Informations ---- */
.mb-infos{
  display:grid; gap:${S.lg}px; margin:${S.xl}px 0 0; padding:0;
  grid-template-columns:1fr;
}
@media (min-width:520px){ .mb-infos{ grid-template-columns:1fr 1fr; } }
.mb-info{ display:flex; align-items:flex-start; gap:${S.md}px; }
.mb-info-icon{
  width:36px; height:36px; border-radius:${R.sm}px; flex-shrink:0;
  background:${PALETTE.blue50}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.mb-info dt{ font-size:12px; color:${C.textSubtle}; }
.mb-info dd{ font-size:14.5px; font-weight:600; margin:2px 0 0; word-break:break-word; }

.mb-matricule{
  display:flex; align-items:center; justify-content:space-between;
  background:${C.bg}; border-radius:${R.md}px;
  padding:${S.md}px ${S.lg}px; margin-top:${S.xl}px; font-size:13.5px;
}
.mb-matricule span{ color:${C.textSubtle}; }
.mb-matricule strong{ font-family:'JetBrains Mono',monospace; letter-spacing:.04em; }

.mb-warn{
  display:flex; align-items:flex-start; gap:9px; margin-top:${S.lg}px;
  background:#FEF3C7; color:#B45309; border-radius:${R.md}px;
  padding:12px 14px; font-size:13.5px; line-height:1.5;
}
.mb-warn-serre{ font-size:12.5px; margin-top:${S.md}px; }

/* ---- Sections ---- */
.mb-acces{
  background:${C.bg}; border-radius:${R.lg}px;
  padding:${S.lg}px; margin-top:${S.xl}px;
}
.mb-acces-sortie{ border:1px solid ${C.border}; background:${C.surface}; }
.mb-acces-head{ display:flex; align-items:flex-start; gap:${S.md}px; margin-bottom:${S.lg}px; }
.mb-acces-icon{
  width:38px; height:38px; border-radius:${R.md}px; flex-shrink:0;
  background:${C.surface}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
  box-shadow:${SHADOW.xs};
}
.mb-acces-icon-sortie{ background:${PALETTE.grey200}; color:${C.textMuted}; box-shadow:none; }
.mb-acces-titre{ font-size:15px; font-weight:600; margin:0; }
.mb-acces-sub{ font-size:13px; color:${C.textSubtle}; margin:3px 0 0; line-height:1.5; }

/* ---- Droit d'adhésion et sortie ---- */
.mb-droit-infos{
  display:grid; gap:${S.md}px; margin:0 0 ${S.md}px; padding:0;
  grid-template-columns:1fr;
}
@media (min-width:480px){ .mb-droit-infos{ grid-template-columns:repeat(3, 1fr); } }
.mb-droit-infos dt{ font-size:11.5px; color:${C.textSubtle}; }
.mb-droit-infos dd{ font-size:14.5px; font-weight:600; margin:3px 0 0; }

.mb-eligibilite{
  display:flex; align-items:flex-start; gap:8px;
  background:#DCFCE7; color:${C.success};
  border-radius:${R.md}px; padding:11px 13px;
  font-size:13px; line-height:1.5;
}

/* ---- Parts sociales ---- */
.mb-parts-valeur{
  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;
  background:${C.bg}; border-radius:${R.md}px; padding:10px 13px;
  font-size:13px; color:${C.textMuted}; margin-bottom:${S.md}px;
}
.mb-parts-valeur strong{ color:${C.text}; }
.mb-parts-valeur em{ font-style:normal; color:${C.textSubtle}; }
.mb-parts-valeur-btn{
  display:flex; align-items:center; gap:5px;
  background:none; border:none; color:${C.primary}; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600; padding:0;
}
.mb-parts-valeur-edit{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; width:100%; }
.mb-parts-valeur-edit input{ max-width:140px; }
.mb-btn-code-sm{ padding:8px 14px; font-size:13px; }

.mb-parts-skel{
  height:60px; border-radius:${R.md}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:mbShim 1.4s infinite;
}

.mb-parts-liste{ list-style:none; margin:0 0 ${S.md}px; padding:0; display:flex; flex-direction:column; gap:6px; }
.mb-parts-ligne{
  display:flex; align-items:center; gap:10px;
  background:${C.bg}; border-radius:${R.sm}px; padding:9px 11px;
}
.mb-parts-badge{
  flex-shrink:0; min-width:34px; text-align:center;
  background:${PALETTE.blue100}; color:${C.primary};
  border-radius:${R.pill}px; padding:3px 8px;
  font-size:12.5px; font-weight:700;
}
.mb-parts-badge.is-remb{ background:#FEE2E2; color:${C.danger}; }
.mb-parts-corps{ flex:1; min-width:0; display:flex; flex-direction:column; }
.mb-parts-corps > span:first-child{ font-size:13.5px; font-weight:600; }
.mb-parts-date{ font-size:11.5px; color:${C.textSubtle}; }
.mb-parts-suppr{
  flex-shrink:0; background:none; border:none; color:${C.textSubtle};
  cursor:pointer; padding:4px; display:flex;
}
.mb-parts-suppr:hover{ color:${C.danger}; }
.mb-parts-actions{ display:flex; align-items:center; gap:${S.md}px; flex-wrap:wrap; }

.mb-note-sortie{
  background:${C.bg}; border-radius:${R.md}px;
  padding:11px 13px; font-size:13px; line-height:1.55; color:${C.textMuted};
}

/* ---- Formulaires ---- */
.mb-form{ display:flex; flex-direction:column; gap:${S.md}px; }
.mb-champ{ display:flex; flex-direction:column; gap:6px; }
.mb-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.mb-optionnel{ font-weight:400; color:${C.textSubtle}; }
.mb-form .mb-input{ padding:12px 14px; }
.mb-textarea{ resize:vertical; line-height:1.55; }
.mb-input-devise{ position:relative; display:flex; align-items:center; }
.mb-input-devise .mb-input{ padding-right:58px; }
.mb-input-devise span{
  position:absolute; right:14px; font-size:13px;
  font-weight:600; color:${C.textSubtle}; pointer-events:none;
}
.mb-form-actions{ display:flex; gap:${S.sm}px; margin-top:${S.xs}px; }
.mb-form-actions .mb-btn-code,
.mb-form-actions .mb-btn-sortie{ flex:2; }
.mb-form-actions .mb-code-new{ flex:1; }

.mb-note{
  display:flex; align-items:flex-start; gap:6px;
  font-size:12.5px; color:${C.textSubtle}; line-height:1.5;
}

/* ---- Motifs de sortie ---- */
.mb-motifs{ display:grid; gap:${S.xs}px; grid-template-columns:1fr; }
@media (min-width:480px){ .mb-motifs{ grid-template-columns:1fr 1fr; } }
.mb-motif{
  display:flex; align-items:flex-start; gap:10px;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:11px 13px; cursor:pointer;
  font-family:inherit; text-align:left; transition:all .16s ease;
}
.mb-motif:hover{ border-color:${PALETTE.grey300}; }
.mb-motif.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.mb-radio{
  width:17px; height:17px; border-radius:50%; flex-shrink:0; margin-top:1px;
  border:2px solid ${PALETTE.grey300};
  display:flex; align-items:center; justify-content:center;
}
.mb-motif.is-on .mb-radio{ border-color:${C.primary}; }
.mb-radio-dot{ width:8px; height:8px; border-radius:50%; background:${C.primary}; }
.mb-motif-text{ display:flex; flex-direction:column; gap:1px; min-width:0; }
.mb-motif-text strong{ font-size:13.5px; font-weight:600; }
.mb-motif-text em{ font-style:normal; font-size:11.5px; color:${C.textSubtle}; }

.mb-choix{ display:flex; gap:${S.xs}px; }
.mb-choix-btn{
  flex:1; background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:11px 13px; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:600; color:${C.textMuted};
  transition:all .16s ease;
}
.mb-choix-btn:hover{ border-color:${PALETTE.grey300}; }
.mb-choix-btn.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; color:${C.primary}; }
.mb-choix-large{
  display:flex; align-items:center; gap:9px; text-align:left; width:100%;
}
.mb-case{
  width:17px; height:17px; border-radius:4px; flex-shrink:0;
  border:2px solid ${PALETTE.grey300}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.mb-choix-large.is-on .mb-case{ border-color:${C.primary}; }

/* ---- Boutons ---- */
.mb-lien-danger{
  display:flex; align-items:center; gap:6px; margin-top:${S.md}px;
  background:none; border:none; padding:0; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600; color:${C.danger};
}
.mb-lien-danger:hover:not(:disabled){ text-decoration:underline; }
.mb-lien-danger:disabled{ opacity:.6; cursor:not-allowed; }

.mb-lien-sortie{
  display:flex; align-items:center; gap:7px;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:11px 16px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; color:${C.textMuted};
  transition:all .16s ease;
}
.mb-lien-sortie:hover{ border-color:${C.textMuted}; color:${C.text}; }

.mb-btn-code{
  display:flex; align-items:center; justify-content:center; gap:9px;
  width:100%; background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:14px 0; cursor:pointer;
  font-family:inherit; font-size:14.5px; font-weight:600;
  box-shadow:${SHADOW.sm}; transition:background .18s ease;
}
.mb-btn-code:hover:not(:disabled){ background:${C.primaryDark}; }
.mb-btn-code:disabled{ opacity:.65; cursor:not-allowed; }
.mb-btn-code-recup{ background:${C.warning}; }
.mb-btn-code-recup:hover:not(:disabled){ background:#D97706; }

.mb-btn-sortie{
  display:flex; align-items:center; justify-content:center; gap:9px;
  background:${C.textMuted}; color:#fff; border:none;
  border-radius:${R.md}px; padding:14px 0; cursor:pointer;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease;
}
.mb-btn-sortie:hover:not(:disabled){ background:${C.text}; }
.mb-btn-sortie:disabled{ opacity:.65; cursor:not-allowed; }

.mb-code-zone{
  background:${C.surface}; border:1.5px dashed ${C.primary}55;
  border-radius:${R.lg}px; padding:${S.lg}px; text-align:center;
}
.mb-code-zone-recup{ border-color:${C.warning}66; }
.mb-code-label{
  font-size:11.5px; font-weight:600; color:${C.textSubtle};
  text-transform:uppercase; letter-spacing:.08em;
}
.mb-code-valeur{
  font-family:'JetBrains Mono',monospace;
  font-size:34px; font-weight:700; color:${C.primary};
  letter-spacing:.16em; margin:${S.md}px 0;
}
.mb-code-valeur-recup{ color:${C.warning}; }
.mb-code-actions{ display:flex; gap:${S.sm}px; justify-content:center; flex-wrap:wrap; }
.mb-code-copy{
  display:flex; align-items:center; gap:7px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.sm}px; padding:10px 16px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600;
}
.mb-code-copy:hover{ background:${C.primaryDark}; }
.mb-code-copy-recup{ background:${C.warning}; }
.mb-code-copy-recup:hover{ background:#D97706; }
.mb-code-new{
  background:${C.surface}; color:${C.textMuted};
  border:1.5px solid ${C.border}; border-radius:${R.sm}px;
  padding:10px 16px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600;
}
.mb-code-new:hover:not(:disabled){ border-color:${C.primary}; color:${C.primary}; }
.mb-code-new:disabled{ opacity:.65; cursor:not-allowed; }
.mb-code-exp{ font-size:12px; color:${C.textSubtle}; margin-top:${S.md}px; }

/* ---- Divers ---- */
.mb-empty{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.mb-empty-title{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.mb-empty-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:38ch; line-height:1.55; }
.mb-skel{
  height:72px; border-radius:${R.lg}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:mbShim 1.4s infinite;
}
.mb-spin{ animation:mbSpin 1s linear infinite; }
@keyframes mbSpin{ to{ transform:rotate(360deg); } }
@keyframes mbShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;