import React, { useEffect, useState } from "react";
import {
  Banknote, Plus, X, Loader2, Search, ChevronLeft, AlertCircle,
  CheckCircle2, Circle, Clock, XCircle, Settings2, Percent,
  Calendar, Trash2, Pencil, Eye, EyeOff,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { notifierMembre } from "./notifier";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const ONGLETS = [
  { id: "en_attente", label: "Demandes" },
  { id: "approuve",   label: "En cours" },
  { id: "solde",      label: "Soldés" },
  { id: "rejete",     label: "Rejetés" },
];

const STATUTS = {
  en_attente: { label: "En attente", color: C.warning, soft: C.warningSoft, Icon: Clock },
  approuve:   { label: "En cours",   color: C.primary, soft: PALETTE.blue100, Icon: CheckCircle2 },
  solde:      { label: "Soldé",      color: C.success, soft: "#DCFCE7", Icon: CheckCircle2 },
  rejete:     { label: "Rejeté",     color: C.danger,  soft: C.dangerSoft, Icon: XCircle },
};

export default function PretsPage() {
  const { params } = useParametrage();
  const [onglet, setOnglet] = useState("en_attente");
  const [prets, setPrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [creation, setCreation] = useState(false);
  const [catalogue, setCatalogue] = useState(false);

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from("prets")
      .select("*, membres(nom)")
      .eq("organisation_id", params.organisation_id)
      .order("demande_le", { ascending: false });
    setPrets(data || []);
    setLoading(false);
    if (selected) {
      const maj = (data || []).find((p) => p.id === selected.id);
      if (maj) setSelected(maj);
    }
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  if (catalogue) {
    return <CatalogueTypesPret onBack={() => setCatalogue(false)} />;
  }

  if (creation) {
    return <CreationPret onBack={() => setCreation(false)} onCree={() => { setCreation(false); charger(); }} />;
  }

  if (selected) {
    return <FichePret pret={selected} onBack={() => setSelected(null)} onRefresh={charger} />;
  }

  const visibles = prets.filter((p) => p.statut === onglet);

  return (
    <div className="pr-wrap">
      <style>{CSS}</style>

      <header className="pr-head">
        <div>
          <h1 className="pr-titre"><Banknote size={20} /> Prêts et avances</h1>
          <p className="pr-sous">Avance sur cotisation et crédit social remboursable</p>
        </div>
        <div className="pr-head-actions">
          <button className="btn-secondary" onClick={() => setCatalogue(true)}>
            <Settings2 size={15} /> Types de prêt
          </button>
          <button className="btn-primary" onClick={() => setCreation(true)}>
            <Plus size={16} /> Nouveau prêt
          </button>
        </div>
      </header>

      <div className="pr-onglets">
        {ONGLETS.map((o) => {
          const n = prets.filter((p) => p.statut === o.id).length;
          return (
            <button
              key={o.id}
              className={`pr-onglet ${onglet === o.id ? "pr-onglet-actif" : ""}`}
              onClick={() => setOnglet(o.id)}
            >
              {o.label} {n > 0 && <span className="pr-onglet-badge">{n}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="pr-sk" />
      ) : visibles.length === 0 ? (
        <div className="pr-vide">Aucun dossier dans cette catégorie.</div>
      ) : (
        <ul className="pr-liste">
          {visibles.map((p) => {
            const st = STATUTS[p.statut];
            return (
              <li key={p.id} className="pr-item" onClick={() => setSelected(p)}>
                <div>
                  <div className="pr-item-nom">{p.membres?.nom}</div>
                  <div className="pr-item-meta">
                    {p.libelle_type} · {p.montant_principal.toLocaleString("fr-FR")} FCFA
                    {p.taux_interet_pct > 0 && ` · ${p.taux_interet_pct}% d'intérêt`}
                  </div>
                </div>
                <span className="pr-badge" style={{ background: st.soft, color: st.color }}>
                  <st.Icon size={13} /> {st.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Fiche d'un prêt ---------------- */

function FichePret({ pret, onBack, onRefresh }) {
  const [echeances, setEcheances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [dateApprobation, setDateApprobation] = useState("");
  const [motifRejet, setMotifRejet] = useState("");
  const [rejetModal, setRejetModal] = useState(false);
  const [paiementModal, setPaiementModal] = useState(null);
  const [montantSaisi, setMontantSaisi] = useState("");

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from("pret_echeances")
      .select("*")
      .eq("pret_id", pret.id)
      .order("numero_echeance");
    setEcheances(data || []);
    setLoading(false);
  }

  useEffect(() => { charger(); }, [pret.id]);

  async function approuver() {
    if (!dateApprobation) { setErreur("Choisissez la date de la première échéance."); return; }
    setEnCours(true);
    setErreur("");
    const { error } = await supabase.rpc("approuver_pret", {
      p_pret_id: pret.id,
      p_date_premiere_echeance: dateApprobation,
    });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }

    notifierMembre(pret.membre_id, {
      type: "pret",
      titre: "Prêt approuvé",
      message: `Votre demande de prêt (${pret.libelle_type}, ${pret.montant_principal.toLocaleString("fr-FR")} FCFA) a été approuvée. Première échéance le ${new Date(dateApprobation).toLocaleDateString("fr-FR")}.`,
      organisationId: pret.organisation_id,
    });

    onRefresh();
  }

  async function rejeter() {
    setEnCours(true);
    setErreur("");
    const { error } = await supabase.from("prets")
      .update({ statut: "rejete", motif_rejet: motifRejet.trim() || null, decide_le: new Date().toISOString() })
      .eq("id", pret.id)
      .eq("organisation_id", pret.organisation_id);
    setEnCours(false);
    if (error) { setErreur(error.message); return; }

    notifierMembre(pret.membre_id, {
      type: "pret",
      titre: "Demande de prêt refusée",
      message: motifRejet.trim()
        ? `Votre demande de prêt (${pret.libelle_type}) a été refusée. Motif : ${motifRejet.trim()}`
        : `Votre demande de prêt (${pret.libelle_type}) a été refusée.`,
      organisationId: pret.organisation_id,
    });

    setRejetModal(false);
    onRefresh();
  }

  async function enregistrerPaiement() {
    if (!montantSaisi || Number(montantSaisi) <= 0) { setErreur("Montant invalide."); return; }
    setEnCours(true);
    setErreur("");
    const { error } = await supabase.rpc("enregistrer_remboursement_echeance", {
      p_echeance_id: paiementModal.id,
      p_montant: Number(montantSaisi),
      p_mode: "cash",
    });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setPaiementModal(null);
    setMontantSaisi("");
    charger();
    onRefresh();
  }

  const st = STATUTS[pret.statut];
  const totalRembourse = echeances.filter((e) => e.montant_paye).reduce((s, e) => s + Number(e.montant_paye), 0);

  return (
    <div className="pr-wrap">
      <style>{CSS}</style>

      <button className="pr-retour" onClick={onBack}><ChevronLeft size={16} /> Retour</button>

      <header>
        <div className="pr-fiche-head">
          <h1 className="pr-titre">{pret.membres?.nom}</h1>
          <span className="pr-badge" style={{ background: st.soft, color: st.color }}>
            <st.Icon size={13} /> {st.label}
          </span>
        </div>
        <p className="pr-sous">
          {pret.libelle_type} · demandé le {new Date(pret.demande_le).toLocaleDateString("fr-FR")}
          {pret.initiee_par === "admin" && " · saisi directement par l'admin"}
        </p>
      </header>

      <section className="pr-card">
        <div className="pr-conditions">
          <div><span>Montant emprunté</span><strong>{pret.montant_principal.toLocaleString("fr-FR")} FCFA</strong></div>
          <div><span>Taux d'intérêt</span><strong>{pret.taux_interet_pct}%</strong></div>
          <div><span>Total à rembourser</span><strong>{pret.montant_total_a_rembourser.toLocaleString("fr-FR")} FCFA</strong></div>
          <div><span>Remboursement</span><strong>{pret.mode_remboursement === "unique" ? "En une fois" : `${pret.nombre_echeances} échéances`}</strong></div>
        </div>
      </section>

      {pret.statut === "en_attente" && (
        <section className="pr-card">
          <h3 className="pr-card-titre">Traiter la demande</h3>
          <label className="pr-label">Date de la première échéance</label>
          <input className="pr-input" type="date" value={dateApprobation}
            onChange={(e) => setDateApprobation(e.target.value)} />
          {erreur && <div className="pr-erreur"><AlertCircle size={15} /> {erreur}</div>}
          <div className="pr-actions-row">
            <button className="btn-primary" onClick={approuver} disabled={enCours}>
              <CheckCircle2 size={16} /> Approuver
            </button>
            <button className="btn-danger" onClick={() => setRejetModal(true)} disabled={enCours}>
              <XCircle size={16} /> Rejeter
            </button>
          </div>
        </section>
      )}

      {pret.statut === "rejete" && pret.motif_rejet && (
        <section className="pr-card">
          <h3 className="pr-card-titre">Motif du rejet</h3>
          <p className="pr-motif">{pret.motif_rejet}</p>
        </section>
      )}

      {(pret.statut === "approuve" || pret.statut === "solde") && (
        <section className="pr-card">
          <h3 className="pr-card-titre">Échéances</h3>
          <div className="pr-progression">
            {totalRembourse.toLocaleString("fr-FR")} / {pret.montant_total_a_rembourser.toLocaleString("fr-FR")} FCFA remboursés
          </div>
          {loading ? <div className="pr-sk" /> : (
            <ul className="pr-echeances">
              {echeances.map((e) => (
                <li key={e.id} className="pr-echeance-item">
                  <div>
                    <div className="pr-echeance-num">Échéance {e.numero_echeance}</div>
                    <div className="pr-echeance-meta">
                      {e.montant_prevu.toLocaleString("fr-FR")} FCFA · prévue le {new Date(e.date_prevue).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  {e.montant_paye ? (
                    <span className="pr-badge" style={{ background: "#DCFCE7", color: C.success }}>
                      <CheckCircle2 size={13} /> Réglée
                    </span>
                  ) : (
                    <button className="btn-secondary" onClick={() => { setPaiementModal(e); setMontantSaisi(String(e.montant_prevu)); }}>
                      Enregistrer le paiement
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {rejetModal && (
        <div className="pr-overlay" onClick={() => setRejetModal(false)}>
          <div className="pr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pr-modal-head">
              <h3>Motif du rejet</h3>
              <button className="pr-x" onClick={() => setRejetModal(false)}><X size={18} /></button>
            </div>
            <textarea className="pr-textarea" rows={3} value={motifRejet}
              onChange={(e) => setMotifRejet(e.target.value)}
              placeholder="Raison du refus (visible par le membre)" />
            {erreur && <div className="pr-erreur"><AlertCircle size={15} /> {erreur}</div>}
            <button className="btn-danger btn-full" onClick={rejeter} disabled={enCours}>
              {enCours ? <Loader2 size={16} className="spin" /> : <XCircle size={16} />} Confirmer le rejet
            </button>
          </div>
        </div>
      )}

      {paiementModal && (
        <div className="pr-overlay" onClick={() => setPaiementModal(null)}>
          <div className="pr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pr-modal-head">
              <h3>Échéance {paiementModal.numero_echeance}</h3>
              <button className="pr-x" onClick={() => setPaiementModal(null)}><X size={18} /></button>
            </div>
            <label className="pr-label">Montant reçu (FCFA)</label>
            <input className="pr-input" type="number" value={montantSaisi}
              onChange={(e) => setMontantSaisi(e.target.value)} />
            {erreur && <div className="pr-erreur"><AlertCircle size={15} /> {erreur}</div>}
            <button className="btn-primary btn-full" onClick={enregistrerPaiement} disabled={enCours}>
              {enCours ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />} Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Création par l'admin ---------------- */

function CreationPret({ onBack, onCree }) {
  const { params } = useParametrage();
  const [membres, setMembres] = useState([]);
  const [types, setTypes] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [membreChoisi, setMembreChoisi] = useState(null);
  const [typeChoisi, setTypeChoisi] = useState(null);
  const [montant, setMontant] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    supabase.from("membres").select("id, nom")
      .eq("organisation_id", params.organisation_id).eq("actif", true).order("nom")
      .then(({ data }) => setMembres(data || []));
    supabase.from("types_pret").select("*")
      .eq("organisation_id", params.organisation_id).eq("actif", true).order("ordre")
      .then(({ data }) => setTypes(data || []));
  }, [params.organisation_id]);

  const suggestions = membres.filter((m) => m.nom.toLowerCase().includes(recherche.toLowerCase()));

  async function creer() {
    if (!membreChoisi) { setErreur("Choisissez un membre."); return; }
    if (!typeChoisi) { setErreur("Choisissez un type de prêt."); return; }
    if (!montant || Number(montant) <= 0) { setErreur("Montant invalide."); return; }
    if (!dateDebut) { setErreur("La date de la première échéance est obligatoire."); return; }

    setEnvoi(true);
    setErreur("");
    const { error } = await supabase.rpc("creer_pret_admin", {
      p_organisation_id: params.organisation_id,
      p_membre_id: membreChoisi.id,
      p_type_pret_id: typeChoisi.id,
      p_montant_principal: Number(montant),
      p_date_premiere_echeance: dateDebut,
    });
    setEnvoi(false);
    if (error) { setErreur(error.message); return; }

    notifierMembre(membreChoisi.id, {
      type: "pret",
      titre: "Prêt accordé",
      message: `Un prêt (${typeChoisi.libelle}, ${Number(montant).toLocaleString("fr-FR")} FCFA) vous a été accordé. Première échéance le ${new Date(dateDebut).toLocaleDateString("fr-FR")}.`,
      organisationId: params.organisation_id,
    });

    onCree();
  }

  return (
    <div className="pr-wrap">
      <style>{CSS}</style>
      <button className="pr-retour" onClick={onBack}><ChevronLeft size={16} /> Retour</button>
      <h1 className="pr-titre"><Plus size={20} /> Nouveau prêt</h1>

      <section className="pr-card">
        <label className="pr-label">Membre</label>
        {membreChoisi ? (
          <div className="pr-choisi">
            {membreChoisi.nom}
            <button onClick={() => setMembreChoisi(null)}><X size={14} /></button>
          </div>
        ) : (
          <>
            <div className="pr-recherche">
              <Search size={15} />
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un membre…" />
            </div>
            {recherche && (
              <ul className="pr-suggestions">
                {suggestions.slice(0, 6).map((m) => (
                  <li key={m.id} onClick={() => { setMembreChoisi(m); setRecherche(""); }}>{m.nom}</li>
                ))}
              </ul>
            )}
          </>
        )}

        <label className="pr-label">Type de prêt</label>
        {types.length === 0 ? (
          <div className="pr-avertissement">Aucun type de prêt configuré — créez-en un depuis « Types de prêt ».</div>
        ) : (
          <div className="pr-types-choix">
            {types.map((t) => (
              <button
                key={t.id}
                className={`pr-type-btn ${typeChoisi?.id === t.id ? "pr-type-btn-actif" : ""}`}
                onClick={() => setTypeChoisi(t)}
              >
                {t.libelle}
                <span>{t.taux_interet_pct}% · {t.mode_remboursement === "unique" ? "unique" : `${t.nombre_echeances}x`}</span>
              </button>
            ))}
          </div>
        )}

        <label className="pr-label">Montant (FCFA)</label>
        <input className="pr-input" type="number" min={1} value={montant} onChange={(e) => setMontant(e.target.value)} />

        <label className="pr-label">Date de la première échéance</label>
        <input className="pr-input" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
      </section>

      {erreur && <div className="pr-erreur"><AlertCircle size={15} /> {erreur}</div>}

      <button className="btn-primary btn-full" onClick={creer} disabled={envoi}>
        {envoi ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Créer le prêt
      </button>
    </div>
  );
}

/* ---------------- Catalogue des types de prêt ---------------- */

function CatalogueTypesPret({ onBack }) {
  const { params } = useParametrage();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edition, setEdition] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function charger() {
    setLoading(true);
    const { data } = await supabase.from("types_pret")
      .select("*").eq("organisation_id", params.organisation_id).order("ordre");
    setTypes(data || []);
    setLoading(false);
  }

  useEffect(() => { charger(); }, [params.organisation_id]);

  async function enregistrer() {
    const f = edition;
    if (!f.libelle.trim()) { setErreur("Le libellé est obligatoire."); return; }

    setEnvoi(true);
    setErreur("");

    const donnees = {
      libelle: f.libelle.trim(),
      taux_interet_pct: Number(f.taux_interet_pct) || 0,
      mode_remboursement: f.mode_remboursement,
      nombre_echeances: f.mode_remboursement === "echelonne" ? Number(f.nombre_echeances) || 2 : null,
      plafond_montant: f.plafond_montant ? Number(f.plafond_montant) : null,
      actif: f.actif,
    };

    const { error } = f.id
      ? await supabase.from("types_pret").update(donnees)
          .eq("id", f.id).eq("organisation_id", params.organisation_id)
      : await supabase.from("types_pret").insert({ ...donnees, organisation_id: params.organisation_id, ordre: types.length });

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }
    setEdition(null);
    charger();
  }

  async function basculerActif(t) {
    await supabase.from("types_pret").update({ actif: !t.actif })
      .eq("id", t.id).eq("organisation_id", params.organisation_id);
    charger();
  }

  async function supprimer(id) {
    await supabase.from("types_pret").delete()
      .eq("id", id).eq("organisation_id", params.organisation_id);
    charger();
  }

  return (
    <div className="pr-wrap">
      <style>{CSS}</style>
      <button className="pr-retour" onClick={onBack}><ChevronLeft size={16} /> Retour</button>
      <div className="pr-head">
        <h1 className="pr-titre"><Settings2 size={20} /> Types de prêt</h1>
        <button className="btn-primary" onClick={() => setEdition({
          libelle: "", taux_interet_pct: 0, mode_remboursement: "unique",
          nombre_echeances: "", plafond_montant: "", actif: true,
        })}>
          <Plus size={16} /> Nouveau type
        </button>
      </div>

      {loading ? <div className="pr-sk" /> : types.length === 0 ? (
        <div className="pr-vide">Aucun type de prêt configuré pour l'instant.</div>
      ) : (
        <ul className="pr-liste">
          {types.map((t) => (
            <li key={t.id} className="pr-item" style={{ cursor: "default", opacity: t.actif ? 1 : 0.55 }}>
              <div>
                <div className="pr-item-nom">{t.libelle}</div>
                <div className="pr-item-meta">
                  {t.taux_interet_pct}% d'intérêt · {t.mode_remboursement === "unique" ? "remboursement unique" : `${t.nombre_echeances} échéances`}
                  {t.plafond_montant && ` · plafond ${t.plafond_montant.toLocaleString("fr-FR")} FCFA`}
                </div>
              </div>
              <div className="pr-item-actions">
                <button onClick={() => basculerActif(t)} title={t.actif ? "Désactiver" : "Activer"}>
                  {t.actif ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button onClick={() => setEdition(t)}><Pencil size={16} /></button>
                <button onClick={() => supprimer(t.id)} className="pr-retirer"><Trash2 size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {edition && (
        <div className="pr-overlay" onClick={() => setEdition(null)}>
          <div className="pr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pr-modal-head">
              <h3>{edition.id ? "Modifier le type" : "Nouveau type de prêt"}</h3>
              <button className="pr-x" onClick={() => setEdition(null)}><X size={18} /></button>
            </div>

            <label className="pr-label">Libellé</label>
            <input className="pr-input" value={edition.libelle}
              onChange={(e) => setEdition({ ...edition, libelle: e.target.value })}
              placeholder="Avance sur cotisation" />

            <label className="pr-label">Taux d'intérêt (%)</label>
            <input className="pr-input" type="number" min={0} step="0.1" value={edition.taux_interet_pct}
              onChange={(e) => setEdition({ ...edition, taux_interet_pct: e.target.value })} />

            <label className="pr-label">Mode de remboursement</label>
            <div className="pr-choix">
              <button
                className={`pr-choix-btn ${edition.mode_remboursement === "unique" ? "pr-choix-actif" : ""}`}
                onClick={() => setEdition({ ...edition, mode_remboursement: "unique" })}
              >
                En une fois
              </button>
              <button
                className={`pr-choix-btn ${edition.mode_remboursement === "echelonne" ? "pr-choix-actif" : ""}`}
                onClick={() => setEdition({ ...edition, mode_remboursement: "echelonne" })}
              >
                Échelonné
              </button>
            </div>

            {edition.mode_remboursement === "echelonne" && (
              <>
                <label className="pr-label">Nombre d'échéances</label>
                <input className="pr-input" type="number" min={2} value={edition.nombre_echeances}
                  onChange={(e) => setEdition({ ...edition, nombre_echeances: e.target.value })} />
              </>
            )}

            <label className="pr-label">Plafond (optionnel, FCFA)</label>
            <input className="pr-input" type="number" min={1} value={edition.plafond_montant}
              onChange={(e) => setEdition({ ...edition, plafond_montant: e.target.value })} />

            {erreur && <div className="pr-erreur"><AlertCircle size={15} /> {erreur}</div>}

            <button className="btn-primary btn-full" onClick={enregistrer} disabled={envoi}>
              {envoi ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />} Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.pr-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .pr-wrap{ padding:${S.lg}px; } }

.pr-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; flex-wrap:wrap; }
.pr-head-actions{ display:flex; gap:8px; flex-wrap:wrap; }
.pr-titre{ display:flex; align-items:center; gap:8px; font-size:19px; margin:0; }
.pr-sous{ font-size:13px; color:${C.textSubtle}; margin:5px 0 0; }
.pr-fiche-head{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

.btn-primary{
  display:flex; align-items:center; justify-content:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
}
.btn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.btn-primary:disabled{ opacity:.6; cursor:not-allowed; }
.btn-full{ width:100%; }

.btn-secondary{
  display:inline-flex; align-items:center; justify-content:center; gap:7px;
  background:${C.surface}; color:${C.primary}; border:1px solid ${C.border};
  border-radius:${R.md}px; padding:10px 16px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600;
}
.btn-danger{
  display:flex; align-items:center; justify-content:center; gap:8px;
  background:#fff; color:${C.danger}; border:1px solid ${C.danger};
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600;
}

.pr-onglets{ display:flex; gap:6px; flex-wrap:wrap; }
.pr-onglet{
  border:1px solid ${C.border}; background:${C.surface}; color:${C.textMuted};
  border-radius:${R.pill}px; padding:8px 16px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; display:flex; align-items:center; gap:6px;
}
.pr-onglet-actif{ background:${C.primary}; border-color:${C.primary}; color:#fff; }
.pr-onglet-badge{
  background:rgba(255,255,255,.3); border-radius:${R.pill}px; padding:1px 7px; font-size:11px;
}
.pr-onglet:not(.pr-onglet-actif) .pr-onglet-badge{ background:${C.bg}; color:${C.textSubtle}; }

.pr-vide{
  text-align:center; padding:${S.xxxl}px ${S.lg}px; color:${C.textSubtle}; font-size:14px;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
}

.pr-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.pr-item{
  display:flex; align-items:center; justify-content:space-between; gap:${S.md}px;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px;
  padding:${S.md}px ${S.lg}px; cursor:pointer;
}
.pr-item:hover{ border-color:${C.primary}; }
.pr-item-nom{ font-size:15px; font-weight:600; }
.pr-item-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:3px; }
.pr-item-actions{ display:flex; gap:4px; }
.pr-item-actions button{ background:none; border:none; color:${C.textSubtle}; cursor:pointer; padding:6px; }
.pr-retirer{ color:${C.danger} !important; }

.pr-badge{
  display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600;
  padding:5px 11px; border-radius:${R.pill}px; white-space:nowrap; flex-shrink:0;
}

.pr-retour{
  display:inline-flex; align-items:center; gap:5px; align-self:flex-start;
  background:none; border:none; color:${C.textMuted}; font-family:inherit;
  font-size:13.5px; cursor:pointer; padding:4px 0;
}

.pr-card{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:${S.lg}px; box-shadow:${SHADOW.xs}; display:flex; flex-direction:column; gap:${S.md}px;
}
.pr-card-titre{ margin:0; font-size:15px; font-weight:600; }

.pr-conditions{ display:grid; grid-template-columns:1fr 1fr; gap:${S.md}px; }
.pr-conditions div{ display:flex; flex-direction:column; gap:2px; }
.pr-conditions span{ font-size:12px; color:${C.textSubtle}; }
.pr-conditions strong{ font-size:15px; }

.pr-label{ font-size:12.5px; font-weight:600; color:${C.textMuted}; margin-top:6px; }
.pr-input, .pr-textarea{
  width:100%; border:1px solid ${C.border}; border-radius:${R.md}px; padding:10px 12px;
  font-family:inherit; font-size:14px; box-sizing:border-box; resize:vertical;
}
.pr-erreur{
  display:flex; align-items:center; gap:8px; background:${C.dangerSoft}; color:${C.danger};
  border-radius:${R.md}px; padding:10px 14px; font-size:13.5px;
}
.pr-motif{ font-size:14px; color:${C.textMuted}; margin:0; }
.pr-avertissement{ font-size:13px; color:${C.warning}; }

.pr-actions-row{ display:flex; gap:10px; }
.pr-actions-row button{ flex:1; }

.pr-progression{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.pr-echeances{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.pr-echeance-item{
  display:flex; align-items:center; justify-content:space-between; gap:${S.md}px;
  padding:9px 0; border-bottom:1px solid ${C.border};
}
.pr-echeance-item:last-child{ border-bottom:none; }
.pr-echeance-num{ font-size:14px; font-weight:600; }
.pr-echeance-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }

.pr-recherche{
  display:flex; align-items:center; gap:8px; border:1px solid ${C.border}; border-radius:${R.md}px;
  padding:9px 12px; color:${C.textSubtle};
}
.pr-recherche input{ border:none; outline:none; flex:1; font-family:inherit; font-size:14px; }
.pr-suggestions{ list-style:none; margin:0; padding:0; border:1px solid ${C.border}; border-radius:${R.md}px; overflow:hidden; }
.pr-suggestions li{ padding:10px 12px; font-size:14px; cursor:pointer; }
.pr-suggestions li:hover{ background:${PALETTE.blue100}; }
.pr-choisi{
  display:flex; align-items:center; justify-content:space-between;
  background:${PALETTE.blue100}; border-radius:${R.md}px; padding:10px 14px; font-size:14px; font-weight:600;
}
.pr-choisi button{ background:none; border:none; cursor:pointer; color:${C.primary}; display:flex; }

.pr-types-choix{ display:flex; flex-direction:column; gap:6px; }
.pr-type-btn{
  display:flex; justify-content:space-between; align-items:center;
  border:1px solid ${C.border}; background:${C.surface}; border-radius:${R.md}px;
  padding:11px 14px; cursor:pointer; font-family:inherit; font-size:13.5px; font-weight:600; text-align:left;
}
.pr-type-btn span{ font-size:12px; color:${C.textSubtle}; font-weight:500; }
.pr-type-btn-actif{ background:${PALETTE.blue100}; border-color:${C.primary}; }

.pr-choix{ display:flex; gap:8px; }
.pr-choix-btn{
  flex:1; border:1px solid ${C.border}; background:${C.surface}; color:${C.textMuted};
  border-radius:${R.md}px; padding:10px; cursor:pointer; font-family:inherit; font-size:13.5px; font-weight:600;
}
.pr-choix-actif{ background:${PALETTE.blue100}; border-color:${C.primary}; color:${C.primary}; }

.pr-overlay{
  position:fixed; inset:0; background:rgba(15,23,42,.45); z-index:50;
  display:flex; align-items:center; justify-content:center; padding:${S.lg}px;
}
.pr-modal{
  background:#fff; border-radius:${R.xl}px; padding:${S.xl}px; width:100%; max-width:440px;
  max-height:88vh; overflow-y:auto; display:flex; flex-direction:column; gap:${S.sm}px;
}
.pr-modal-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:${S.sm}px; }
.pr-modal-head h3{ margin:0; font-size:17px; }
.pr-x{ background:none; border:none; cursor:pointer; color:${C.textMuted}; }

.spin{ animation:spin 1s linear infinite; }
@keyframes spin{ to{ transform:rotate(360deg); } }
.pr-sk{
  height:90px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:shimmer 1.4s infinite;
}
@keyframes shimmer{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
`;