import React, { useEffect, useState } from "react";
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2, Search,
  ArrowLeft, ChevronRight, Briefcase, Wallet, Calendar, Pencil, TrendingUp,
  FileSpreadsheet, Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const STATUTS = {
  planifie: { label: "Planifié", color: C.textMuted, soft: PALETTE.grey200 },
  en_cours: { label: "En cours", color: C.primary,   soft: PALETTE.blue100 },
  suspendu: { label: "Suspendu", color: C.warning,   soft: "#FEF3C7" },
  termine:  { label: "Terminé",  color: C.success,   soft: "#DCFCE7" },
};

const CATEGORIES_DEPENSE = [
  { id: "personnel",     label: "Personnel" },
  { id: "equipement",    label: "Équipement" },
  { id: "fonctionnement", label: "Fonctionnement" },
  { id: "formation",     label: "Formation" },
  { id: "deplacement",   label: "Déplacement" },
  { id: "autre",         label: "Autre" },
];

export default function ProjetsPage() {
  const { params } = useParametrage();
  const [projets, setProjets] = useState([]);
  const [bailleurs, setBailleurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [creation, setCreation] = useState(false);
  const [query, setQuery] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");

  async function charger() {
    setLoading(true);
    const [{ data: proj }, { data: bail }] = await Promise.all([
      supabase
        .from("projets_ong")
        .select("*, bailleurs_ong(nom, sigle)")
        .eq("organisation_id", params.organisation_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("bailleurs_ong")
        .select("*")
        .eq("organisation_id", params.organisation_id)
        .eq("actif", true)
        .order("nom"),
    ]);
    setProjets(proj || []);
    setBailleurs(bail || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  function majProjet(p) {
    setProjets((liste) => liste.map((x) => (x.id === p.id ? p : x)));
    setSelected(p);
  }

  if (selected) {
    return (
      <FicheProjet
        projet={selected}
        bailleurs={bailleurs}
        onBack={() => setSelected(null)}
        onUpdate={majProjet}
        onDelete={() => { setSelected(null); charger(); }}
        onNouveauBailleur={charger}
      />
    );
  }

  const visibles = projets.filter((p) => {
    const matchQuery = !query || p.nom.toLowerCase().includes(query.toLowerCase());
    const matchStatut = filtreStatut === "tous" || p.statut === filtreStatut;
    return matchQuery && matchStatut;
  });

  return (
    <div className="pj-wrap">
      <style>{CSS}</style>

      <div className="pj-tools">
        <div className="pj-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un projet…"
            className="pj-input"
          />
        </div>
        <select
          className="pj-input pj-filtre"
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
        >
          <option value="tous">Tous les statuts</option>
          {Object.entries(STATUTS).map(([id, s]) => (
            <option key={id} value={id}>{s.label}</option>
          ))}
        </select>
        <button className="pj-btn" onClick={() => setCreation(true)}>
          <Plus size={17} /> Nouveau projet
        </button>
      </div>

      {loading ? (
        <div className="pj-skel" />
      ) : visibles.length === 0 ? (
        <div className="pj-vide">
          <Briefcase size={36} color={PALETTE.grey300} />
          <div className="pj-vide-titre">{projets.length === 0 ? "Aucun projet" : "Aucun résultat"}</div>
          <div className="pj-vide-sub">
            {projets.length === 0
              ? "Créez votre premier projet pour suivre son budget et ses dépenses."
              : "Essayez un autre nom ou changez de filtre."}
          </div>
        </div>
      ) : (
        <ul className="pj-liste">
          {visibles.map((p) => {
            const st = STATUTS[p.statut] || STATUTS.planifie;
            return (
              <li key={p.id} className="pj-ligne" onClick={() => setSelected(p)}>
                <div className="pj-ligne-corps">
                  <div className="pj-ligne-titre">{p.nom}</div>
                  <div className="pj-ligne-meta">
                    {p.bailleurs_ong?.nom || "Sans bailleur"}
                    {p.budget_total ? ` · ${montant(p.budget_total)} FCFA` : ""}
                  </div>
                </div>
                <span className="pj-badge" style={{ color: st.color, background: st.soft }}>
                  {st.label}
                </span>
                <ChevronRight size={18} color={PALETTE.grey300} />
              </li>
            );
          })}
        </ul>
      )}

      {creation && (
        <ModalProjet
          bailleurs={bailleurs}
          organisationId={params.organisation_id}
          onCancel={() => setCreation(false)}
          onCree={(p) => { setCreation(false); charger(); setSelected(p); }}
          onNouveauBailleur={charger}
        />
      )}
    </div>
  );
}

/* ---------------- Fiche projet ---------------- */

function FicheProjet({ projet, bailleurs, onBack, onUpdate, onDelete, onNouveauBailleur }) {
  const [depenses, setDepenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ajoutDepense, setAjoutDepense] = useState(false);
  const [editionProjet, setEditionProjet] = useState(false);
  const [suppressionProjet, setSuppressionProjet] = useState(false);
  const [suppressionDepense, setSuppressionDepense] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  // Suivi & Évaluation
  const [indicateurs, setIndicateurs] = useState([]);
  const [loadingIndicateurs, setLoadingIndicateurs] = useState(true);
  const [ajoutIndicateur, setAjoutIndicateur] = useState(false);
  const [importExcel, setImportExcel] = useState(false);
  const [releveOuvert, setReleveOuvert] = useState(null); // indicateur_id du relevé en saisie
  const [suppressionIndicateur, setSuppressionIndicateur] = useState(null);

  async function chargerIndicateurs() {
    setLoadingIndicateurs(true);
    const { data, error } = await supabase
      .from("suivi_indicateurs")
      .select("*")
      .eq("projet_id", projet.id)
      .order("libelle");

    if (error) setMessage({ type: "err", texte: error.message });
    setIndicateurs(data || []);
    setLoadingIndicateurs(false);
  }

  useEffect(() => { chargerIndicateurs(); }, [projet.id]);

  async function supprimerIndicateur(ind) {
    setEnCours(true);
    const { error } = await supabase.from("indicateurs_projet").delete().eq("id", ind.indicateur_id);
    setEnCours(false);
    setSuppressionIndicateur(null);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    notifier("Indicateur retiré.");
    chargerIndicateurs();
  }

  async function chargerDepenses() {
    setLoading(true);
    const { data, error } = await supabase
      .from("depenses_projet")
      .select("*")
      .eq("projet_id", projet.id)
      .order("date_depense", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) setMessage({ type: "err", texte: error.message });
    setDepenses(data || []);
    setLoading(false);
  }

  useEffect(() => { chargerDepenses(); }, [projet.id]);

  function notifier(texte) {
    setMessage({ type: "ok", texte });
    setTimeout(() => setMessage(null), 3500);
  }

  const totalDepense = depenses.reduce((s, d) => s + Number(d.montant || 0), 0);
  const restant = projet.budget_total != null ? projet.budget_total - totalDepense : null;

  async function supprimerDepense(d) {
    setEnCours(true);
    const { error } = await supabase.from("depenses_projet").delete().eq("id", d.id);
    setEnCours(false);
    setSuppressionDepense(null);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    notifier("Dépense retirée.");
    chargerDepenses();
  }

  async function supprimerProjet() {
    setEnCours(true);
    const { error } = await supabase.from("projets_ong").delete().eq("id", projet.id);
    setEnCours(false);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    onDelete();
  }

  const st = STATUTS[projet.statut] || STATUTS.planifie;

  return (
    <div className="pj-wrap">
      <style>{CSS}</style>

      <button className="pj-retour" onClick={onBack}>
        <ArrowLeft size={16} /> Retour aux projets
      </button>

      {message && (
        <div className={`pj-msg ${message.type === "ok" ? "is-ok" : "is-err"}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} aria-label="Fermer"><X size={15} /></button>
        </div>
      )}

      <header className="pj-entete">
        <div>
          <h1 className="pj-titre">{projet.nom}</h1>
          <div className="pj-sous-titre">
            {projet.bailleurs_ong?.nom || "Sans bailleur"}
            {projet.date_debut && ` · Depuis le ${new Date(projet.date_debut).toLocaleDateString("fr-FR")}`}
          </div>
        </div>
        <span className="pj-badge pj-badge-lg" style={{ color: st.color, background: st.soft }}>
          {st.label}
        </span>
      </header>

      {projet.description && <p className="pj-description">{projet.description}</p>}

      <div className="pj-actions-entete">
        <button className="pj-lien" onClick={() => setEditionProjet(true)}>
          <Pencil size={13} /> Modifier
        </button>
        <button className="pj-lien pj-lien-danger" onClick={() => setSuppressionProjet(true)}>
          <Trash2 size={13} /> Supprimer le projet
        </button>
      </div>

      <div className="pj-resume">
        <div>
          <span>{projet.budget_total != null ? `${montant(projet.budget_total)} FCFA` : "—"}</span>
          <small>Budget</small>
        </div>
        <div>
          <span>{montant(totalDepense)} FCFA</span>
          <small>Dépensé</small>
        </div>
        <div>
          <span style={{ color: restant != null && restant < 0 ? C.danger : C.text }}>
            {restant != null ? `${montant(restant)} FCFA` : "—"}
          </span>
          <small>Restant</small>
        </div>
      </div>

      <div className="pj-tools">
        <h2 className="pj-section-titre">Dépenses</h2>
        <button className="pj-btn" onClick={() => setAjoutDepense(true)}>
          <Plus size={17} /> Ajouter une dépense
        </button>
      </div>

      {loading ? (
        <div className="pj-skel" />
      ) : depenses.length === 0 ? (
        <div className="pj-vide">
          <Wallet size={36} color={PALETTE.grey300} />
          <div className="pj-vide-titre">Aucune dépense enregistrée</div>
          <div className="pj-vide-sub">Enregistrez les dépenses de ce projet au fil de l'eau.</div>
        </div>
      ) : (
        <ul className="pj-liste-depenses">
          {depenses.map((d) => (
            <li key={d.id} className="pj-ligne-depense">
              <div className="pj-depense-corps">
                <div className="pj-depense-titre">{d.description}</div>
                <div className="pj-depense-meta">
                  {CATEGORIES_DEPENSE.find((c) => c.id === d.categorie)?.label || "Autre"}
                  {" · "}{new Date(d.date_depense).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <strong>{montant(d.montant)} FCFA</strong>
              <button
                className="pj-depense-suppr"
                onClick={() => setSuppressionDepense(d)}
                title="Retirer"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ---- Suivi & Évaluation ---- */}
      <div className="pj-tools">
        <h2 className="pj-section-titre">Suivi &amp; Évaluation</h2>
        <button className="pj-lien" onClick={() => setImportExcel(true)}>
          <FileSpreadsheet size={15} /> Importer depuis Excel
        </button>
        <button className="pj-btn" onClick={() => setAjoutIndicateur(true)}>
          <Plus size={17} /> Ajouter un indicateur
        </button>
      </div>

      {loadingIndicateurs ? (
        <div className="pj-skel" />
      ) : indicateurs.length === 0 ? (
        <div className="pj-vide">
          <TrendingUp size={36} color={PALETTE.grey300} />
          <div className="pj-vide-titre">Aucun indicateur suivi</div>
          <div className="pj-vide-sub">
            Ajoutez les indicateurs de ce projet pour suivre sa progression au fil du temps.
          </div>
        </div>
      ) : (
        <ul className="pj-liste-indicateurs">
          {indicateurs.map((ind) => {
            const pct = ind.valeur_cible
              ? Math.round(((ind.derniere_valeur || 0) / ind.valeur_cible) * 100)
              : null;
            return (
              <li key={ind.indicateur_id} className="pj-ligne-indicateur">
                <div className="pj-indicateur-entete">
                  <div>
                    <div className="pj-indicateur-titre">{ind.libelle}</div>
                    <div className="pj-indicateur-meta">
                      {ind.derniere_valeur != null
                        ? `${montant(ind.derniere_valeur)} ${ind.unite || ""}`.trim()
                        : "Aucun relevé"}
                      {ind.valeur_cible != null && ` sur une cible de ${montant(ind.valeur_cible)} ${ind.unite || ""}`.trimEnd()}
                      {ind.derniere_date && ` · relevé le ${new Date(ind.derniere_date).toLocaleDateString("fr-FR")}`}
                    </div>
                  </div>
                  <div className="pj-indicateur-actions">
                    <button className="pj-lien" onClick={() => setReleveOuvert(releveOuvert === ind.indicateur_id ? null : ind.indicateur_id)}>
                      + Relevé
                    </button>
                    <button className="pj-depense-suppr" onClick={() => setSuppressionIndicateur(ind)} title="Retirer l'indicateur">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {pct !== null && (
                  <div className="pj-barre">
                    <div className="pj-barre-remplie" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                  </div>
                )}

                {releveOuvert === ind.indicateur_id && (
                  <ModalReleve
                    indicateurId={ind.indicateur_id}
                    onCancel={() => setReleveOuvert(null)}
                    onDone={(texte) => { setReleveOuvert(null); notifier(texte); chargerIndicateurs(); }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {ajoutIndicateur && (
        <ModalIndicateur
          projetId={projet.id}
          organisationId={projet.organisation_id}
          onCancel={() => setAjoutIndicateur(false)}
          onDone={(texte) => { setAjoutIndicateur(false); notifier(texte); chargerIndicateurs(); }}
        />
      )}

      {importExcel && (
        <ModalImportExcel
          projetId={projet.id}
          organisationId={projet.organisation_id}
          indicateursExistants={indicateurs}
          onCancel={() => setImportExcel(false)}
          onDone={(texte) => { setImportExcel(false); notifier(texte); chargerIndicateurs(); }}
        />
      )}

      {suppressionIndicateur && (
        <div className="pj-overlay" onClick={() => setSuppressionIndicateur(null)}>
          <div className="pj-modal pj-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="pj-modal-titre">Retirer cet indicateur ?</h3>
            <p className="pj-modal-texte">
              <strong>{suppressionIndicateur.libelle}</strong> et tous ses relevés seront
              définitivement supprimés.
            </p>
            <div className="pj-modal-actions">
              <button className="pj-mbtn pj-mbtn-ghost" onClick={() => setSuppressionIndicateur(null)} disabled={enCours}>
                Annuler
              </button>
              <button className="pj-mbtn pj-mbtn-danger" onClick={() => supprimerIndicateur(suppressionIndicateur)} disabled={enCours}>
                {enCours ? <><Loader2 size={16} className="pj-spin" /> Suppression…</> : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {ajoutDepense && (
        <ModalDepense
          projetId={projet.id}
          organisationId={projet.organisation_id}
          onCancel={() => setAjoutDepense(false)}
          onDone={(texte) => { setAjoutDepense(false); notifier(texte); chargerDepenses(); }}
        />
      )}

      {editionProjet && (
        <ModalProjet
          projet={projet}
          bailleurs={bailleurs}
          organisationId={projet.organisation_id}
          onCancel={() => setEditionProjet(false)}
          onCree={(p) => { setEditionProjet(false); onUpdate(p); }}
          onNouveauBailleur={onNouveauBailleur}
        />
      )}

      {suppressionProjet && (
        <div className="pj-overlay" onClick={() => setSuppressionProjet(false)}>
          <div className="pj-modal pj-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="pj-modal-titre">Supprimer ce projet ?</h3>
            <p className="pj-modal-texte">
              <strong>{projet.nom}</strong> et toutes ses dépenses ({depenses.length}) seront
              définitivement supprimés.
            </p>
            <div className="pj-modal-actions">
              <button className="pj-mbtn pj-mbtn-ghost" onClick={() => setSuppressionProjet(false)} disabled={enCours}>
                Annuler
              </button>
              <button className="pj-mbtn pj-mbtn-danger" onClick={supprimerProjet} disabled={enCours}>
                {enCours ? <><Loader2 size={16} className="pj-spin" /> Suppression…</> : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {suppressionDepense && (
        <div className="pj-overlay" onClick={() => setSuppressionDepense(null)}>
          <div className="pj-modal pj-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="pj-modal-titre">Retirer cette dépense ?</h3>
            <div className="pj-modal-actions">
              <button className="pj-mbtn pj-mbtn-ghost" onClick={() => setSuppressionDepense(null)} disabled={enCours}>
                Annuler
              </button>
              <button className="pj-mbtn pj-mbtn-danger" onClick={() => supprimerDepense(suppressionDepense)} disabled={enCours}>
                {enCours ? <><Loader2 size={16} className="pj-spin" /> Suppression…</> : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Formulaire projet (création / édition) ---------------- */

function ModalProjet({ projet, bailleurs, organisationId, onCancel, onCree, onNouveauBailleur }) {
  const edition = Boolean(projet);
  const [nom, setNom] = useState(projet?.nom || "");
  const [description, setDescription] = useState(projet?.description || "");
  const [bailleurId, setBailleurId] = useState(projet?.bailleur_id || "");
  const [nouveauBailleurNom, setNouveauBailleurNom] = useState("");
  const [budgetTotal, setBudgetTotal] = useState(projet?.budget_total != null ? String(projet.budget_total) : "");
  const [dateDebut, setDateDebut] = useState(projet?.date_debut || "");
  const [dateFin, setDateFin] = useState(projet?.date_fin || "");
  const [statut, setStatut] = useState(projet?.statut || "planifie");
  const [enCours, setEnCours] = useState(false);
  const [err, setErr] = useState("");

  const creationBailleur = bailleurId === "__nouveau__";

  async function valider() {
    if (!nom.trim()) { setErr("Indiquez le nom du projet."); return; }
    if (creationBailleur && !nouveauBailleurNom.trim()) { setErr("Indiquez le nom du bailleur."); return; }
    if (dateDebut && dateFin && dateFin < dateDebut) {
      setErr("La date de fin ne peut pas précéder la date de début.");
      return;
    }

    setEnCours(true);
    setErr("");

    let finalBailleurId = bailleurId || null;

    if (creationBailleur) {
      const { data: nouveau, error: errBailleur } = await supabase
        .from("bailleurs_ong")
        .insert({ organisation_id: organisationId, nom: nouveauBailleurNom.trim() })
        .select()
        .single();
      if (errBailleur) { setEnCours(false); setErr(errBailleur.message); return; }
      finalBailleurId = nouveau.id;
      onNouveauBailleur();
    }

    const donnees = {
      nom: nom.trim(),
      description: description.trim() || null,
      bailleur_id: finalBailleurId,
      budget_total: budgetTotal ? parseInt(budgetTotal, 10) : null,
      date_debut: dateDebut || null,
      date_fin: dateFin || null,
      statut,
    };

    const requete = edition
      ? supabase.from("projets_ong").update(donnees).eq("id", projet.id).select("*, bailleurs_ong(nom, sigle)").single()
      : supabase.from("projets_ong").insert({ ...donnees, organisation_id: organisationId }).select("*, bailleurs_ong(nom, sigle)").single();

    const { data, error } = await requete;

    setEnCours(false);

    if (error) { setErr(error.message); return; }

    onCree(data);
  }

  return (
    <div className="pj-overlay" onClick={onCancel}>
      <div className="pj-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pj-modal-head">
          <h3 className="pj-modal-titre">{edition ? "Modifier le projet" : "Nouveau projet"}</h3>
          <button className="pj-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        <div className="pj-champ">
          <label className="pj-label" htmlFor="pj-nom">Nom du projet</label>
          <input id="pj-nom" className="pj-fld" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>

        <div className="pj-champ">
          <label className="pj-label" htmlFor="pj-desc">
            Description <span className="pj-opt">— facultative</span>
          </label>
          <textarea id="pj-desc" rows={2} className="pj-fld" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="pj-champ">
          <label className="pj-label" htmlFor="pj-bailleur">Bailleur</label>
          <select id="pj-bailleur" className="pj-fld" value={bailleurId} onChange={(e) => setBailleurId(e.target.value)}>
            <option value="">Sans bailleur</option>
            {bailleurs.map((b) => (
              <option key={b.id} value={b.id}>{b.nom}</option>
            ))}
            <option value="__nouveau__">+ Nouveau bailleur…</option>
          </select>
        </div>

        {creationBailleur && (
          <div className="pj-champ">
            <label className="pj-label" htmlFor="pj-nouveau-bailleur">Nom du bailleur</label>
            <input
              id="pj-nouveau-bailleur" className="pj-fld"
              value={nouveauBailleurNom} onChange={(e) => setNouveauBailleurNom(e.target.value)}
              placeholder="Ex : Union Européenne"
            />
          </div>
        )}

        <div className="pj-champ">
          <label className="pj-label" htmlFor="pj-budget">
            Budget total <span className="pj-opt">— facultatif</span>
          </label>
          <div className="pj-fld-devise">
            <input id="pj-budget" type="number" min="0" className="pj-fld" value={budgetTotal} onChange={(e) => setBudgetTotal(e.target.value)} />
            <span>FCFA</span>
          </div>
        </div>

        <div className="pj-deux-champs">
          <div className="pj-champ">
            <label className="pj-label" htmlFor="pj-debut">Début</label>
            <input id="pj-debut" type="date" className="pj-fld" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </div>
          <div className="pj-champ">
            <label className="pj-label" htmlFor="pj-fin">Fin prévue</label>
            <input id="pj-fin" type="date" className="pj-fld" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </div>
        </div>

        <div className="pj-champ">
          <label className="pj-label" htmlFor="pj-statut">Statut</label>
          <select id="pj-statut" className="pj-fld" value={statut} onChange={(e) => setStatut(e.target.value)}>
            {Object.entries(STATUTS).map(([id, s]) => (
              <option key={id} value={id}>{s.label}</option>
            ))}
          </select>
        </div>

        {err && <div className="pj-err"><AlertCircle size={15} /> {err}</div>}

        <div className="pj-modal-actions">
          <button className="pj-mbtn pj-mbtn-ghost" onClick={onCancel} disabled={enCours}>Annuler</button>
          <button className="pj-mbtn pj-mbtn-primary" onClick={valider} disabled={enCours}>
            {enCours ? <><Loader2 size={16} className="pj-spin" /> Envoi…</> : edition ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Formulaire dépense ---------------- */

function ModalDepense({ projetId, organisationId, onCancel, onDone }) {
  const [categorie, setCategorie] = useState("autre");
  const [description, setDescription] = useState("");
  const [montantSaisi, setMontantSaisi] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [enCours, setEnCours] = useState(false);
  const [err, setErr] = useState("");

  async function valider() {
    if (!description.trim()) { setErr("Décrivez la dépense."); return; }
    const mt = parseInt(montantSaisi, 10);
    if (!mt || mt <= 0) { setErr("Indiquez un montant."); return; }
    if (!date) { setErr("Indiquez la date."); return; }

    setEnCours(true);
    setErr("");

    const { error } = await supabase.from("depenses_projet").insert({
      organisation_id: organisationId,
      projet_id: projetId,
      categorie,
      description: description.trim(),
      montant: mt,
      date_depense: date,
    });

    setEnCours(false);

    if (error) { setErr(error.message); return; }

    onDone("Dépense enregistrée.");
  }

  return (
    <div className="pj-overlay" onClick={onCancel}>
      <div className="pj-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pj-modal-head">
          <h3 className="pj-modal-titre">Nouvelle dépense</h3>
          <button className="pj-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        <div className="pj-champ">
          <label className="pj-label" htmlFor="dp-categorie">Catégorie</label>
          <div className="pj-choix">
            {CATEGORIES_DEPENSE.map((c) => (
              <button
                key={c.id}
                className={`pj-choix-btn ${categorie === c.id ? "is-on" : ""}`}
                onClick={() => setCategorie(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pj-champ">
          <label className="pj-label" htmlFor="dp-desc">Description</label>
          <input id="dp-desc" className="pj-fld" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex : Achat de kits scolaires" />
        </div>

        <div className="pj-champ">
          <label className="pj-label" htmlFor="dp-montant">Montant</label>
          <div className="pj-fld-devise">
            <input id="dp-montant" type="number" min="0" className="pj-fld" value={montantSaisi} onChange={(e) => setMontantSaisi(e.target.value)} />
            <span>FCFA</span>
          </div>
        </div>

        <div className="pj-champ">
          <label className="pj-label" htmlFor="dp-date">Date</label>
          <input id="dp-date" type="date" className="pj-fld" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {err && <div className="pj-err"><AlertCircle size={15} /> {err}</div>}

        <div className="pj-modal-actions">
          <button className="pj-mbtn pj-mbtn-ghost" onClick={onCancel} disabled={enCours}>Annuler</button>
          <button className="pj-mbtn pj-mbtn-primary" onClick={valider} disabled={enCours}>
            {enCours ? <><Loader2 size={16} className="pj-spin" /> Envoi…</> : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Suivi & Évaluation ---------------- */

function ModalIndicateur({ projetId, organisationId, onCancel, onDone }) {
  const [libelle, setLibelle] = useState("");
  const [unite, setUnite] = useState("");
  const [valeurReference, setValeurReference] = useState("");
  const [valeurCible, setValeurCible] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [err, setErr] = useState("");

  async function valider() {
    if (!libelle.trim()) { setErr("Indiquez le nom de l'indicateur."); return; }

    setEnCours(true);
    setErr("");

    const { error } = await supabase.from("indicateurs_projet").insert({
      organisation_id: organisationId,
      projet_id: projetId,
      libelle: libelle.trim(),
      unite: unite.trim() || null,
      valeur_reference: valeurReference ? parseFloat(valeurReference) : null,
      valeur_cible: valeurCible ? parseFloat(valeurCible) : null,
    });

    setEnCours(false);

    if (error) { setErr(error.message); return; }

    onDone("Indicateur ajouté.");
  }

  return (
    <div className="pj-overlay" onClick={onCancel}>
      <div className="pj-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pj-modal-head">
          <h3 className="pj-modal-titre">Nouvel indicateur</h3>
          <button className="pj-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        <div className="pj-champ">
          <label className="pj-label" htmlFor="ind-libelle">Indicateur</label>
          <input
            id="ind-libelle" className="pj-fld" value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex : Nombre de bénéficiaires formés"
          />
        </div>

        <div className="pj-champ">
          <label className="pj-label" htmlFor="ind-unite">
            Unité <span className="pj-opt">— facultative</span>
          </label>
          <input
            id="ind-unite" className="pj-fld" value={unite}
            onChange={(e) => setUnite(e.target.value)}
            placeholder="personnes, %, puits…"
          />
        </div>

        <div className="pj-deux-champs">
          <div className="pj-champ">
            <label className="pj-label" htmlFor="ind-ref">
              Valeur de référence <span className="pj-opt">— facultative</span>
            </label>
            <input
              id="ind-ref" type="number" className="pj-fld"
              value={valeurReference} onChange={(e) => setValeurReference(e.target.value)}
            />
          </div>
          <div className="pj-champ">
            <label className="pj-label" htmlFor="ind-cible">
              Cible <span className="pj-opt">— facultative</span>
            </label>
            <input
              id="ind-cible" type="number" className="pj-fld"
              value={valeurCible} onChange={(e) => setValeurCible(e.target.value)}
            />
          </div>
        </div>

        {err && <div className="pj-err"><AlertCircle size={15} /> {err}</div>}

        <div className="pj-modal-actions">
          <button className="pj-mbtn pj-mbtn-ghost" onClick={onCancel} disabled={enCours}>Annuler</button>
          <button className="pj-mbtn pj-mbtn-primary" onClick={valider} disabled={enCours}>
            {enCours ? <><Loader2 size={16} className="pj-spin" /> Envoi…</> : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Import en masse depuis un fichier Excel — colonnes attendues :
// Indicateur, Date, Valeur, Note (facultative), Unité et Cible
// (facultatives, utilisées seulement si l'indicateur n'existe pas encore
// et doit être créé à la volée). Un indicateur déjà présent (comparé par
// libellé, sans tenir compte de la casse) reçoit simplement un nouveau
// relevé, il n'est jamais dupliqué.
function ModalImportExcel({ projetId, organisationId, indicateursExistants, onCancel, onDone }) {
  const [fichier, setFichier] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [err, setErr] = useState("");

  function choisirFichier(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFichier(f);
    setResultat(null);
    setErr("");
  }

  async function traiter() {
    if (!fichier) { setErr("Choisissez d'abord un fichier Excel."); return; }

    setEnCours(true);
    setErr("");

    let lignes;
    try {
      const tampon = await fichier.arrayBuffer();
      const classeur = XLSX.read(tampon, { type: "array", cellDates: true });
      const feuille = classeur.Sheets[classeur.SheetNames[0]];
      lignes = XLSX.utils.sheet_to_json(feuille, { defval: null });
    } catch (e) {
      setEnCours(false);
      setErr("Fichier illisible — vérifiez qu'il s'agit bien d'un fichier Excel (.xlsx).");
      return;
    }

    let ajoutes = 0, crees = 0, ignores = 0;
    const indicateursParLibelle = new Map(
      indicateursExistants.map((i) => [i.libelle.trim().toLowerCase(), i.indicateur_id])
    );

    for (const ligne of lignes) {
      const libelleLigne = String(ligne["Indicateur"] || "").trim();
      const valeurLigne = ligne["Valeur"];
      const dateLigne = ligne["Date"];

      if (!libelleLigne || valeurLigne == null || valeurLigne === "" || !dateLigne) {
        ignores++;
        continue;
      }

      const cle = libelleLigne.toLowerCase();
      let indicateurId = indicateursParLibelle.get(cle);

      if (!indicateurId) {
        const { data, error } = await supabase
          .from("indicateurs_projet")
          .insert({
            organisation_id: organisationId,
            projet_id: projetId,
            libelle: libelleLigne,
            unite: ligne["Unité"] ? String(ligne["Unité"]).trim() : null,
            valeur_cible: ligne["Cible"] ? parseFloat(ligne["Cible"]) : null,
          })
          .select()
          .single();

        if (error || !data) { ignores++; continue; }
        indicateurId = data.id;
        indicateursParLibelle.set(cle, indicateurId);
        crees++;
      }

      const dateReleve = dateLigne instanceof Date
        ? dateLigne.toISOString().slice(0, 10)
        : String(dateLigne).slice(0, 10);

      const { error: erreurReleve } = await supabase.from("releves_indicateur").insert({
        indicateur_id: indicateurId,
        valeur: parseFloat(valeurLigne),
        date_releve: dateReleve,
        note: ligne["Note"] ? String(ligne["Note"]).trim() : null,
      });

      if (erreurReleve) { ignores++; continue; }
      ajoutes++;
    }

    setEnCours(false);
    setResultat({ ajoutes, crees, ignores });
  }

  return (
    <div className="pj-overlay" onClick={onCancel}>
      <div className="pj-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pj-modal-head">
          <h3 className="pj-modal-titre">Importer des relevés depuis Excel</h3>
          <button className="pj-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        {!resultat ? (
          <>
            <p className="pj-modal-texte">
              Colonnes attendues : <strong>Indicateur</strong>, <strong>Date</strong>,{" "}
              <strong>Valeur</strong>, et facultativement Note, Unité et Cible (ces deux
              dernières ne servent que si l'indicateur n'existe pas encore).
            </p>

            <label className="pj-drop" htmlFor="pj-fichier-excel">
              <Upload size={18} />
              {fichier ? fichier.name : "Choisir un fichier .xlsx…"}
            </label>
            <input
              id="pj-fichier-excel" type="file" accept=".xlsx,.xls"
              onChange={choisirFichier} style={{ display: "none" }}
            />

            {err && <div className="pj-err"><AlertCircle size={15} /> {err}</div>}

            <div className="pj-modal-actions">
              <button className="pj-mbtn pj-mbtn-ghost" onClick={onCancel} disabled={enCours}>
                Annuler
              </button>
              <button className="pj-mbtn pj-mbtn-primary" onClick={traiter} disabled={enCours || !fichier}>
                {enCours ? <><Loader2 size={16} className="pj-spin" /> Import…</> : "Importer"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="pj-import-resultat">
              <CheckCircle2 size={22} color={C.success} />
              <p>
                <strong>{resultat.ajoutes}</strong> relevé(s) ajouté(s),{" "}
                <strong>{resultat.crees}</strong> nouvel(aux) indicateur(s) créé(s)
                {resultat.ignores > 0 && <>, <strong>{resultat.ignores}</strong> ligne(s) ignorée(s) (colonnes manquantes ou illisibles)</>}.
              </p>
            </div>
            <div className="pj-modal-actions">
              <button className="pj-mbtn pj-mbtn-primary" onClick={() => onDone("Import terminé.")}>
                Fermer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Formulaire compact, affiché en ligne sous l'indicateur plutôt qu'en
// fenêtre à part : on relève une valeur, on ne remplit pas une fiche.
function ModalReleve({ indicateurId, onCancel, onDone }) {
  const [valeur, setValeur] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [err, setErr] = useState("");

  async function valider() {
    const v = parseFloat(valeur);
    if (isNaN(v)) { setErr("Indiquez une valeur."); return; }
    if (!date) { setErr("Indiquez la date."); return; }

    setEnCours(true);
    setErr("");

    const { error } = await supabase.from("releves_indicateur").insert({
      indicateur_id: indicateurId,
      valeur: v,
      date_releve: date,
      note: note.trim() || null,
    });

    setEnCours(false);

    if (error) { setErr(error.message); return; }

    onDone("Relevé enregistré.");
  }

  return (
    <div className="pj-releve-inline">
      <div className="pj-releve-champs">
        <input
          type="number" className="pj-fld" placeholder="Valeur"
          value={valeur} onChange={(e) => setValeur(e.target.value)}
        />
        <input
          type="date" className="pj-fld" max={new Date().toISOString().slice(0, 10)}
          value={date} onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <input
        type="text" className="pj-fld" placeholder="Note — facultative"
        value={note} onChange={(e) => setNote(e.target.value)}
      />
      {err && <div className="pj-err"><AlertCircle size={15} /> {err}</div>}
      <div className="pj-modal-actions">
        <button className="pj-mbtn pj-mbtn-ghost" onClick={onCancel} disabled={enCours}>Annuler</button>
        <button className="pj-mbtn pj-mbtn-primary" onClick={valider} disabled={enCours}>
          {enCours ? <><Loader2 size={16} className="pj-spin" /> Envoi…</> : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Styles ---------------- */

const CSS = `
.pj-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .pj-wrap{ padding:${S.lg}px; } }

.pj-tools{ display:flex; align-items:center; gap:${S.md}px; flex-wrap:wrap; }
.pj-search{
  flex:1; min-width:200px; display:flex; align-items:center; gap:9px;
  background:${C.surface}; border:1.5px solid ${C.border}; border-radius:${R.md}px;
  padding:10px 14px; color:${C.textSubtle};
}
.pj-input{ border:none; outline:none; background:none; font-family:inherit; font-size:14.5px; color:${C.text}; flex:1; }
.pj-filtre{ border:1.5px solid ${C.border}; border-radius:${R.md}px; padding:10px 12px; background:${C.surface}; max-width:170px; }
.pj-btn{
  display:flex; align-items:center; gap:8px; margin-left:auto;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.pj-btn:hover{ background:${C.primaryDark}; }

.pj-liste{
  list-style:none; margin:0; padding:0;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; overflow:hidden; box-shadow:${SHADOW.xs};
}
.pj-ligne{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border};
  cursor:pointer; transition:background .14s ease;
}
.pj-ligne:hover{ background:${C.bg}; }
.pj-ligne:last-child{ border-bottom:none; }
.pj-ligne-corps{ flex:1; min-width:0; }
.pj-ligne-titre{ font-size:14.5px; font-weight:600; }
.pj-ligne-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }

.pj-badge{
  flex-shrink:0; border-radius:${R.pill}px; padding:5px 12px;
  font-size:12px; font-weight:700;
}
.pj-badge-lg{ padding:7px 16px; font-size:13px; }

.pj-retour{
  display:flex; align-items:center; gap:7px; align-self:flex-start;
  background:none; border:none; color:${C.textMuted}; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; padding:0;
}
.pj-retour:hover{ color:${C.primary}; }

.pj-msg{
  display:flex; align-items:center; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
}
.pj-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.pj-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }
.pj-msg button{ margin-left:auto; background:none; border:none; cursor:pointer; color:inherit; opacity:.7; display:flex; padding:0; }

.pj-entete{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; }
.pj-titre{ font-size:22px; font-weight:700; letter-spacing:-.02em; margin:0; }
.pj-sous-titre{ font-size:13.5px; color:${C.textSubtle}; margin-top:4px; }
.pj-description{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:0; }

.pj-actions-entete{ display:flex; gap:${S.lg}px; }
.pj-lien{
  display:flex; align-items:center; gap:6px;
  background:none; border:none; color:${C.primary}; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:600; padding:0;
}
.pj-lien-danger{ color:${C.danger}; }

.pj-resume{ display:flex; gap:${S.md}px; }
.pj-resume > div{
  flex:1; background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px;
  padding:${S.md}px ${S.lg}px; display:flex; flex-direction:column; gap:2px;
}
.pj-resume span{ font-size:18px; font-weight:700; letter-spacing:-.01em; }
.pj-resume small{ font-size:12px; color:${C.textSubtle}; }

.pj-section-titre{ font-size:16px; font-weight:700; letter-spacing:-.01em; margin:0; }

.pj-liste-depenses{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.pj-ligne-depense{
  display:flex; align-items:center; gap:${S.md}px;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.md}px;
  padding:11px 15px;
}
.pj-depense-corps{ flex:1; min-width:0; }
.pj-depense-titre{ font-size:14px; font-weight:600; }
.pj-depense-meta{ font-size:12px; color:${C.textSubtle}; margin-top:2px; }
.pj-ligne-depense strong{ font-size:14px; flex-shrink:0; }
.pj-depense-suppr{
  flex-shrink:0; background:none; border:none; color:${C.textSubtle};
  cursor:pointer; padding:4px; display:flex;
}
.pj-depense-suppr:hover{ color:${C.danger}; }

/* ---- Suivi & Évaluation ---- */
.pj-liste-indicateurs{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.pj-ligne-indicateur{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.md}px;
  padding:12px 15px;
}
.pj-indicateur-entete{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; }
.pj-indicateur-titre{ font-size:14px; font-weight:600; }
.pj-indicateur-meta{ font-size:12px; color:${C.textSubtle}; margin-top:3px; line-height:1.5; }
.pj-indicateur-actions{ display:flex; align-items:center; gap:${S.md}px; flex-shrink:0; }
.pj-barre{
  height:6px; border-radius:${R.pill}px; background:${PALETTE.grey200};
  margin-top:10px; overflow:hidden;
}
.pj-barre-remplie{ height:100%; background:${C.primary}; border-radius:${R.pill}px; transition:width .3s ease; }
.pj-releve-inline{
  background:${C.bg}; border-radius:${R.md}px; padding:${S.md}px;
  margin-top:${S.md}px; display:flex; flex-direction:column; gap:${S.sm}px;
}
.pj-releve-champs{ display:grid; grid-template-columns:1fr 1fr; gap:${S.sm}px; }

/* ---- Modale ---- */
.pj-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; overflow-y:auto;
}
.pj-modal{ width:100%; max-width:520px; background:${C.surface}; border-radius:${R.xxl}px; padding:${S.xl}px; box-shadow:${SHADOW.lg}; margin:auto; }
.pj-modal-court{ max-width:420px; }
.pj-modal-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; margin-bottom:${S.lg}px; }
.pj-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.pj-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:8px 0 ${S.md}px; }
.pj-close{ background:none; border:1px solid ${C.border}; border-radius:${R.sm}px; color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex; }
.pj-close:hover{ color:${C.danger}; border-color:${C.danger}; }

.pj-champ{ display:flex; flex-direction:column; gap:6px; margin-bottom:${S.md}px; }
.pj-deux-champs{ display:grid; grid-template-columns:1fr 1fr; gap:${S.md}px; }
.pj-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.pj-opt{ font-weight:400; color:${C.textSubtle}; }
.pj-fld{
  width:100%; box-sizing:border-box; padding:11px 13px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px; color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.pj-fld:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.pj-fld-devise{ display:flex; align-items:center; gap:8px; }
.pj-fld-devise span{ font-size:13px; color:${C.textSubtle}; flex-shrink:0; }

.pj-choix{ display:flex; flex-wrap:wrap; gap:${S.sm}px; }
.pj-choix-btn{
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.pill}px; padding:7px 13px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600; color:${C.textMuted};
  transition:all .16s ease;
}
.pj-choix-btn.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; color:${C.primary}; }

.pj-drop{
  display:flex; align-items:center; gap:9px;
  border:1.5px dashed ${C.border}; border-radius:${R.md}px;
  padding:14px 15px; cursor:pointer; font-size:14px; color:${C.textMuted};
  margin-bottom:${S.md}px;
}
.pj-drop:hover{ border-color:${C.primary}; background:${PALETTE.blue50}; }

.pj-import-resultat{
  display:flex; align-items:flex-start; gap:10px;
  background:#DCFCE7; border:1px solid ${C.success}33;
  border-radius:${R.md}px; padding:14px 16px; margin-bottom:${S.md}px;
}
.pj-import-resultat p{ margin:0; font-size:13.5px; line-height:1.6; color:${C.text}; }

.pj-err{
  display:flex; align-items:flex-start; gap:8px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:11px 13px; font-size:13px; line-height:1.5; margin-bottom:${S.md}px;
}

.pj-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }
.pj-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.pj-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.pj-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.pj-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.pj-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.pj-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.pj-mbtn-ghost{ flex:1; background:${C.surface}; color:${C.textMuted}; border:1.5px solid ${C.border}; }
.pj-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.pj-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.pj-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.pj-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:44ch; line-height:1.6; }
.pj-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:pjShim 1.4s infinite;
}
.pj-spin{ animation:pjSpin 1s linear infinite; }
@keyframes pjSpin{ to{ transform:rotate(360deg); } }
@keyframes pjShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;