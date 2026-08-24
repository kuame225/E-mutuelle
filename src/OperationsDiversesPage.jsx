import React, { useEffect, useState } from "react";
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2, Pencil,
  ArrowUpRight, ArrowDownRight, Search, Wallet, Info, Paperclip, Upload,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { consigner, EVENEMENTS } from "./journal";
import { C, R, S, SHADOW, PALETTE } from "./theme";

/* ---------------- Nomenclature ---------------- */

const CATEGORIES = {
  recette: [
    { id: "don",                      label: "Don",                      aide: "Article 14" },
    { id: "legs",                     label: "Legs",                     aide: "Article 14" },
    { id: "subvention",               label: "Subvention",               aide: "Article 14" },
    { id: "cotisation_exceptionnelle", label: "Cotisation exceptionnelle", aide: "Articles 16 et 29" },
    { id: "autre_recette",            label: "Autre recette",            aide: null },
  ],
  depense: [
    { id: "representation",  label: "Représentation",     aide: "Article 31 — délégation à un événement" },
    { id: "fete_ceremonie",  label: "Fête et cérémonie",  aide: "Article 30" },
    { id: "fonctionnement",  label: "Fonctionnement",     aide: "Fournitures, frais de réunion" },
    { id: "achat_lot",       label: "Achat de lot",       aide: "Lot de tombola acquis par la mutuelle" },
    { id: "autre_depense",   label: "Autre dépense",      aide: null },
  ],
};

const MODES = [
  { id: "cash",         label: "Espèces" },
  { id: "orange_money", label: "Orange Money" },
  { id: "mtn_money",    label: "MTN Money" },
  { id: "moov_money",   label: "Moov Money" },
  { id: "wave",         label: "Wave" },
  { id: "virement",     label: "Virement" },
  { id: "prelevement",  label: "Prélèvement" },
];

const FILTRES = [
  { id: "tout",     label: "Tout" },
  { id: "recette",  label: "Recettes" },
  { id: "depense",  label: "Dépenses" },
];

const VIDE = {
  sens: "recette",
  categorie: "don",
  libelle: "",
  montant: "",
  date_operation: new Date().toISOString().slice(0, 10),
  mode_paiement: "cash",
  tiers: "",
  note: "",
  piece_jointe: null,
};

export default function OperationsDiversesPage() {
  const { params } = useParametrage();
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState("tout");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);      // null | { ...VIDE, id? }
  const [suppression, setSuppression] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function charger() {
    const { data } = await supabase
      .from("operations_diverses")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("date_operation", { ascending: false })
      .order("created_at", { ascending: false });

    setOperations(data || []);
    setLoading(false);
  }

  useEffect(() => { charger(); }, []);

  const visibles = operations.filter((o) => {
    if (filtre !== "tout" && o.sens !== filtre) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return (
      o.libelle.toLowerCase().includes(q) ||
      (o.tiers || "").toLowerCase().includes(q)
    );
  });

  const totalRecettes = operations
    .filter((o) => o.sens === "recette")
    .reduce((s, o) => s + o.montant, 0);
  const totalDepenses = operations
    .filter((o) => o.sens === "depense")
    .reduce((s, o) => s + o.montant, 0);

  function ouvrirCreation() {
    setMessage(null);
    setForm({ ...VIDE });
  }

  function ouvrirModification(o) {
    setMessage(null);
    setForm({
      id: o.id,
      sens: o.sens,
      categorie: o.categorie,
      libelle: o.libelle,
      montant: String(o.montant),
      date_operation: o.date_operation,
      mode_paiement: o.mode_paiement || "cash",
      tiers: o.tiers || "",
      note: o.note || "",
      piece_jointe: o.piece_jointe || null,
    });
  }

  function changerSens(sens) {
    setForm((f) => ({
      ...f,
      sens,
      // La catégorie appartient à un sens : elle se réinitialise
      categorie: CATEGORIES[sens][0].id,
    }));
  }

  async function televerserJustificatif(fichier) {
    if (fichier.size > 8 * 1024 * 1024) {
      setMessage({ type: "err", texte: "Fichier trop lourd (8 Mo maximum)." });
      return;
    }

    setUploadEnCours(true);

    const ext = fichier.name.split(".").pop().toLowerCase();
    const chemin = `${params.organisation_id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("justificatifs-operations")
      .upload(chemin, fichier, { contentType: fichier.type });

    if (upErr) {
      setUploadEnCours(false);
      setMessage({ type: "err", texte: "Échec du téléversement : " + upErr.message });
      return;
    }

    const { data } = supabase.storage.from("justificatifs-operations").getPublicUrl(chemin);

    setUploadEnCours(false);
    setForm((f) => ({ ...f, piece_jointe: data.publicUrl }));
  }

  async function enregistrer() {
    const montantSaisi = parseInt(form.montant, 10);

    if (!form.libelle.trim()) {
      setMessage({ type: "err", texte: "Décrivez l'opération en quelques mots." });
      return;
    }
    if (!montantSaisi || montantSaisi <= 0) {
      setMessage({ type: "err", texte: "Le montant doit être supérieur à zéro." });
      return;
    }
    if (!form.date_operation) {
      setMessage({ type: "err", texte: "Indiquez la date de l'opération." });
      return;
    }

    setEnCours(true);

    const valeurs = {
      sens: form.sens,
      categorie: form.categorie,
      libelle: form.libelle.trim(),
      montant: montantSaisi,
      date_operation: form.date_operation,
      mode_paiement: form.mode_paiement,
      tiers: form.tiers.trim() || null,
      note: form.note.trim() || null,
      piece_jointe: form.piece_jointe || null,
    };

    const { error } = form.id
      ? await supabase.from("operations_diverses").update(valeurs).eq("id", form.id)
      : await supabase.from("operations_diverses").insert({
          ...valeurs,
          organisation_id: params.organisation_id,
          enregistre_par: (await supabase.auth.getUser()).data.user?.id ?? null,
        });

    setEnCours(false);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }

    consigner(EVENEMENTS.OPERATION_DIVERSE_ENREGISTREE, {
      organisation_id: params.organisation_id,
      operation_id: form.id || null,
      sens: valeurs.sens,
      montant: valeurs.montant,
    });

    setForm(null);
    setMessage({
      type: "ok",
      texte: form.id ? "Opération modifiée." : "Opération enregistrée.",
    });
    setTimeout(() => setMessage(null), 3500);
    charger();
  }

  async function supprimer(id) {
    setEnCours(true);
    const cible = operations.find((o) => o.id === id);
    const { error } = await supabase.from("operations_diverses").delete().eq("id", id);
    setEnCours(false);
    setSuppression(null);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }

    consigner(EVENEMENTS.OPERATION_DIVERSE_SUPPRIMEE, {
      organisation_id: params.organisation_id,
      operation_id: id,
      libelle: cible?.libelle,
      montant: cible?.montant,
    });

    setMessage({ type: "ok", texte: "Opération supprimée." });
    setTimeout(() => setMessage(null), 3500);
    charger();
  }

  if (loading) {
    return (
      <div className="od-wrap">
        <style>{CSS}</style>
        <div className="od-skel" /><div className="od-skel" />
      </div>
    );
  }

  return (
    <div className="od-wrap">
      <style>{CSS}</style>

      {message && (
        <div className={`od-msg ${message.type === "ok" ? "is-ok" : "is-err"}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} aria-label="Fermer"><X size={15} /></button>
        </div>
      )}

      {/* ---- Totaux ---- */}
      <section className="od-totaux">
        <article className="od-total od-total-in">
          <span className="od-total-icon"><ArrowUpRight size={18} /></span>
          <div>
            <div className="od-total-lab">Recettes diverses</div>
            <div className="od-total-val">{montant(totalRecettes)} <em>FCFA</em></div>
          </div>
        </article>

        <article className="od-total od-total-out">
          <span className="od-total-icon"><ArrowDownRight size={18} /></span>
          <div>
            <div className="od-total-lab">Dépenses diverses</div>
            <div className="od-total-val">{montant(totalDepenses)} <em>FCFA</em></div>
          </div>
        </article>
      </section>

      <div className="od-note">
        <Info size={14} />
        <span>
          Cet écran recense ce qui n'est ni cotisation, ni aide sociale :
          dons, legs et subventions de l'article 14, cotisations
          exceptionnelles, frais de représentation de l'article 31, fêtes et
          cérémonies de l'article 30. Ces opérations alimentent le livre de
          comptes.
        </span>
      </div>

      {/* ---- Outils ---- */}
      <div className="od-tools">
        <div className="od-search">
          <Search size={16} className="od-search-icon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un libellé ou un tiers…"
            className="od-input"
          />
        </div>

        <div className="od-filtres">
          {FILTRES.map((f) => (
            <button
              key={f.id}
              className={`od-filtre ${filtre === f.id ? "is-on" : ""}`}
              onClick={() => setFiltre(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button className="od-btn" onClick={ouvrirCreation}>
          <Plus size={17} /> Nouvelle opération
        </button>
      </div>

      {/* ---- Liste ---- */}
      {visibles.length === 0 ? (
        <div className="od-vide">
          <Wallet size={36} color={PALETTE.grey300} />
          <div className="od-vide-titre">
            {operations.length === 0 ? "Aucune opération enregistrée" : "Aucun résultat"}
          </div>
          <div className="od-vide-sub">
            {operations.length === 0
              ? "Enregistrez ici les dons reçus, les subventions et les frais engagés par la mutuelle."
              : "Essayez un autre terme ou changez de filtre."}
          </div>
        </div>
      ) : (
        <ul className="od-liste">
          {visibles.map((o) => {
            const cat = (CATEGORIES[o.sens] || []).find((c) => c.id === o.categorie);
            const recette = o.sens === "recette";

            return (
              <li key={o.id} className="od-op">
                <span className={`od-op-icon ${recette ? "is-in" : "is-out"}`}>
                  {recette ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
                </span>

                <div className="od-op-text">
                  <div className="od-op-lib">{o.libelle}</div>
                  <div className="od-op-meta">
                    {cat ? cat.label : o.categorie}
                    {o.tiers ? ` · ${o.tiers}` : ""}
                    {" · "}
                    {new Date(o.date_operation).toLocaleDateString("fr-FR")}
                    {o.mode_paiement ? ` · ${libelleMode(o.mode_paiement)}` : ""}
                  </div>
                  {o.note && <div className="od-op-note">{o.note}</div>}
                  {o.piece_jointe && (
                    <a
                      href={o.piece_jointe}
                      target="_blank"
                      rel="noreferrer"
                      className="od-op-piece"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Paperclip size={12} /> Justificatif
                    </a>
                  )}
                </div>

                <span className={`od-op-montant ${recette ? "is-in" : "is-out"}`}>
                  {recette ? "+" : "−"} {montant(o.montant)} F
                </span>

                <div className="od-op-actions">
                  <button onClick={() => ouvrirModification(o)} aria-label="Modifier">
                    <Pencil size={14} />
                  </button>
                  <button
                    className="is-danger"
                    onClick={() => setSuppression(o)}
                    aria-label="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ---- Formulaire ---- */}
      {form && (
        <div className="od-overlay" onClick={() => !enCours && setForm(null)}>
          <div className="od-modal" onClick={(e) => e.stopPropagation()}>
            <header className="od-modal-head">
              <h3 className="od-modal-titre">
                {form.id ? "Modifier l'opération" : "Nouvelle opération"}
              </h3>
              <button
                className="od-close"
                onClick={() => setForm(null)}
                disabled={enCours}
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </header>

            {/* Sens */}
            <div className="od-champ">
              <span className="od-label">Nature</span>
              <div className="od-sens">
                <button
                  className={`od-sens-btn ${form.sens === "recette" ? "is-on is-in" : ""}`}
                  onClick={() => changerSens("recette")}
                >
                  <ArrowUpRight size={16} /> Recette
                </button>
                <button
                  className={`od-sens-btn ${form.sens === "depense" ? "is-on is-out" : ""}`}
                  onClick={() => changerSens("depense")}
                >
                  <ArrowDownRight size={16} /> Dépense
                </button>
              </div>
            </div>

            {/* Catégorie */}
            <div className="od-champ">
              <label className="od-label" htmlFor="od-cat">Catégorie</label>
              <select
                id="od-cat"
                value={form.categorie}
                onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
                className="od-input"
              >
                {CATEGORIES[form.sens].map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              {(() => {
                const cat = CATEGORIES[form.sens].find((c) => c.id === form.categorie);
                return cat?.aide ? <span className="od-aide">{cat.aide}</span> : null;
              })()}
            </div>

            {/* Libellé */}
            <div className="od-champ">
              <label className="od-label" htmlFor="od-lib">Libellé</label>
              <input
                id="od-lib"
                value={form.libelle}
                onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
                placeholder={form.sens === "recette"
                  ? "Ex : Don du Directeur de l'hôpital"
                  : "Ex : Déplacement à Bouaké pour obsèques"}
                className="od-input"
              />
            </div>

            {/* Montant et date */}
            <div className="od-duo">
              <div className="od-champ">
                <label className="od-label" htmlFor="od-mnt">Montant</label>
                <div className="od-input-devise">
                  <input
                    id="od-mnt" type="number" min={1}
                    value={form.montant}
                    onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
                    className="od-input"
                  />
                  <span>FCFA</span>
                </div>
              </div>

              <div className="od-champ">
                <label className="od-label" htmlFor="od-date">Date</label>
                <input
                  id="od-date" type="date"
                  value={form.date_operation}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setForm((f) => ({ ...f, date_operation: e.target.value }))}
                  className="od-input"
                />
              </div>
            </div>

            {/* Mode et tiers */}
            <div className="od-duo">
              <div className="od-champ">
                <label className="od-label" htmlFor="od-mode">Mode de règlement</label>
                <select
                  id="od-mode"
                  value={form.mode_paiement}
                  onChange={(e) => setForm((f) => ({ ...f, mode_paiement: e.target.value }))}
                  className="od-input"
                >
                  {MODES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="od-champ">
                <label className="od-label" htmlFor="od-tiers">
                  {form.sens === "recette" ? "Donateur" : "Bénéficiaire"}
                  <span className="od-opt"> — facultatif</span>
                </label>
                <input
                  id="od-tiers"
                  value={form.tiers}
                  onChange={(e) => setForm((f) => ({ ...f, tiers: e.target.value }))}
                  placeholder={form.sens === "recette" ? "Nom du donateur" : "Nom du fournisseur"}
                  className="od-input"
                />
              </div>
            </div>

            {/* Note */}
            <div className="od-champ">
              <label className="od-label" htmlFor="od-note">
                Note <span className="od-opt">— facultative</span>
              </label>
              <textarea
                id="od-note" rows={2}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Référence de la pièce justificative, décision d'assemblée…"
                className="od-input od-textarea"
              />
            </div>

            {/* Pièce jointe */}
            <div className="od-champ">
              <label className="od-label">
                Pièce justificative <span className="od-opt">— facultative</span>
              </label>
              {form.piece_jointe ? (
                <a href={form.piece_jointe} target="_blank" rel="noreferrer" className="od-piece-lien">
                  <Paperclip size={14} /> Justificatif joint — voir
                  <button
                    type="button"
                    className="od-piece-retirer"
                    onClick={(e) => { e.preventDefault(); setForm((f) => ({ ...f, piece_jointe: null })); }}
                  >
                    <X size={13} />
                  </button>
                </a>
              ) : (
                <label className="od-piece-btn">
                  {uploadEnCours ? <Loader2 size={15} className="od-spin" /> : <Upload size={15} />}
                  {uploadEnCours ? "Envoi…" : "Joindre un reçu, une facture…"}
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    hidden
                    disabled={uploadEnCours}
                    onChange={(e) => {
                      const fichier = e.target.files?.[0];
                      if (fichier) televerserJustificatif(fichier);
                    }}
                  />
                </label>
              )}
            </div>

            {message?.type === "err" && (
              <div className="od-erreur">
                <AlertCircle size={16} /> {message.texte}
              </div>
            )}

            <div className="od-modal-actions">
              <button
                className="od-mbtn od-mbtn-ghost"
                onClick={() => setForm(null)}
                disabled={enCours}
              >
                Annuler
              </button>
              <button
                className="od-mbtn od-mbtn-primary"
                onClick={enregistrer}
                disabled={enCours}
              >
                {enCours
                  ? <><Loader2 size={16} className="od-spin" /> Enregistrement…</>
                  : form.id ? "Enregistrer les modifications" : "Enregistrer l'opération"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Confirmation de suppression ---- */}
      {suppression && (
        <div className="od-overlay" onClick={() => !enCours && setSuppression(null)}>
          <div className="od-modal od-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="od-modal-titre">Supprimer cette opération ?</h3>
            <p className="od-modal-texte">
              <strong>{suppression.libelle}</strong> — {montant(suppression.montant)} FCFA.
              Elle disparaîtra du livre de comptes.
            </p>
            <div className="od-modal-actions">
              <button
                className="od-mbtn od-mbtn-ghost"
                onClick={() => setSuppression(null)}
                disabled={enCours}
              >
                Annuler
              </button>
              <button
                className="od-mbtn od-mbtn-danger"
                onClick={() => supprimer(suppression.id)}
                disabled={enCours}
              >
                {enCours
                  ? <><Loader2 size={16} className="od-spin" /> Suppression…</>
                  : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Utilitaires ---------------- */

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function libelleMode(id) {
  const m = MODES.find((x) => x.id === id);
  return m ? m.label : id;
}

/* ---------------- Styles ---------------- */

const CSS = `
.od-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .od-wrap{ padding:${S.lg}px; } }

/* ---- Messages ---- */
.od-msg{
  display:flex; align-items:center; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
  animation:odIn .2s ease;
}
.od-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.od-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }
.od-msg span{ flex:1; }
.od-msg button{
  background:none; border:none; cursor:pointer; color:inherit;
  opacity:.7; display:flex; padding:0;
}

/* ---- Totaux ---- */
.od-totaux{
  display:grid; gap:${S.md}px;
  grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));
}
.od-total{
  display:flex; align-items:center; gap:${S.md}px;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.od-total-icon{
  width:42px; height:42px; border-radius:${R.md}px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.od-total-in .od-total-icon{ background:#DCFCE7; color:${C.success}; }
.od-total-in .od-total-val{ color:${C.success}; }
.od-total-out .od-total-icon{ background:#FEE2E2; color:${C.danger}; }
.od-total-out .od-total-val{ color:${C.danger}; }
.od-total-lab{ font-size:12.5px; color:${C.textSubtle}; }
.od-total-val{ font-size:20px; font-weight:700; letter-spacing:-.02em; margin-top:3px; }
.od-total-val em{ font-style:normal; font-size:12px; font-weight:600; opacity:.6; margin-left:4px; }

.od-note{
  display:flex; align-items:flex-start; gap:9px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:12px 15px;
  font-size:13px; color:${C.textMuted}; line-height:1.55;
}

/* ---- Outils ---- */
.od-tools{ display:flex; gap:${S.md}px; flex-wrap:wrap; align-items:center; }
.od-search{ position:relative; flex:1; min-width:200px; max-width:340px; }
.od-search-icon{
  position:absolute; left:14px; top:50%; transform:translateY(-50%);
  color:${C.textSubtle};
}
.od-search .od-input{ padding-left:42px; }
.od-filtres{ display:flex; gap:3px; background:${C.bg}; padding:3px; border-radius:${R.md}px; }
.od-filtre{
  border:none; background:transparent; cursor:pointer;
  padding:9px 15px; border-radius:${R.sm}px;
  font-family:inherit; font-size:13px; font-weight:600; color:${C.textSubtle};
  transition:all .16s ease;
}
.od-filtre.is-on{ background:${C.surface}; color:${C.primary}; box-shadow:${SHADOW.xs}; }
.od-btn{
  display:flex; align-items:center; gap:8px; margin-left:auto;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.od-btn:hover{ background:${C.primaryDark}; }

/* ---- Liste ---- */
.od-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:${S.sm}px; }
.od-op{
  display:flex; align-items:center; gap:${S.md}px;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.lg}px; padding:${S.md}px ${S.lg}px; box-shadow:${SHADOW.xs};
}
.od-op-icon{
  width:38px; height:38px; border-radius:50%; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.od-op-icon.is-in{ background:#DCFCE7; color:${C.success}; }
.od-op-icon.is-out{ background:#FEE2E2; color:${C.danger}; }
.od-op-text{ flex:1; min-width:0; }
.od-op-lib{ font-size:14.5px; font-weight:600; }
.od-op-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }
.od-op-note{ font-size:12.5px; color:${C.textMuted}; margin-top:4px; line-height:1.5; }
.od-op-piece{
  display:inline-flex; align-items:center; gap:5px; margin-top:5px;
  font-size:12px; font-weight:600; color:${C.primary}; text-decoration:none;
}
.od-op-piece:hover{ text-decoration:underline; }
.od-op-montant{
  flex-shrink:0; font-size:14.5px; font-weight:700;
  font-family:'JetBrains Mono',monospace; white-space:nowrap;
}
.od-op-montant.is-in{ color:${C.success}; }
.od-op-montant.is-out{ color:${C.danger}; }
.od-op-actions{ display:flex; gap:4px; flex-shrink:0; }
.od-op-actions button{
  width:32px; height:32px; border-radius:${R.sm}px;
  background:${C.surface}; border:1px solid ${C.border};
  color:${C.textSubtle}; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .16s ease;
}
.od-op-actions button:hover{ border-color:${C.primary}; color:${C.primary}; }
.od-op-actions button.is-danger:hover{ border-color:${C.danger}; color:${C.danger}; }

/* ---- Modale ---- */
.od-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; animation:odFade .18s ease; overflow-y:auto;
}
.od-modal{
  width:100%; max-width:520px; background:${C.surface};
  border-radius:${R.xxl}px; padding:${S.xl}px;
  box-shadow:${SHADOW.lg}; animation:odUp .22s cubic-bezier(.4,0,.2,1);
  margin:auto;
}
.od-modal-court{ max-width:420px; }
.od-modal-head{
  display:flex; align-items:center; justify-content:space-between;
  gap:${S.md}px; margin-bottom:${S.lg}px;
}
.od-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.od-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:0 0 ${S.xl}px; }
.od-close{
  background:none; border:1px solid ${C.border}; border-radius:${R.sm}px;
  color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex;
}
.od-close:hover:not(:disabled){ color:${C.danger}; border-color:${C.danger}; }

/* ---- Champs ---- */
.od-champ{ display:flex; flex-direction:column; gap:7px; margin-bottom:${S.lg}px; }
.od-duo{ display:grid; gap:${S.md}px; grid-template-columns:1fr; }
@media (min-width:520px){ .od-duo{ grid-template-columns:1fr 1fr; } }
.od-label{ font-size:13.5px; font-weight:600; color:${C.textMuted}; }
.od-opt{ font-weight:400; color:${C.textSubtle}; }
.od-input{
  width:100%; box-sizing:border-box; padding:12px 14px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:15px;
  color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.od-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.od-textarea{ resize:vertical; line-height:1.55; }
.od-input-devise{ position:relative; display:flex; align-items:center; }
.od-input-devise .od-input{ padding-right:58px; }
.od-input-devise span{
  position:absolute; right:14px; font-size:13px;
  font-weight:600; color:${C.textSubtle}; pointer-events:none;
}
.od-aide{ font-size:12.5px; color:${C.textSubtle}; }

.od-piece-lien{
  display:flex; align-items:center; gap:8px; width:fit-content;
  background:${PALETTE.blue100 || C.bg}; border:1px solid ${C.primary};
  border-radius:${R.md}px; padding:9px 14px; font-size:13.5px; font-weight:600;
  color:${C.primary}; text-decoration:none;
}
.od-piece-retirer{
  margin-left:6px; background:none; border:none; cursor:pointer;
  color:inherit; opacity:.7; display:flex; padding:0;
}
.od-piece-btn{
  display:flex; align-items:center; gap:8px; width:fit-content;
  background:${C.surface}; border:1.5px dashed ${C.border}; color:${C.textMuted};
  border-radius:${R.md}px; padding:10px 16px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600;
}
.od-piece-btn:hover{ border-color:${C.primary}; color:${C.primary}; }

.od-sens{ display:grid; grid-template-columns:1fr 1fr; gap:${S.sm}px; }
.od-sens-btn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:12px 0; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; color:${C.textMuted};
  transition:all .16s ease;
}
.od-sens-btn:hover{ border-color:${PALETTE.grey300}; }
.od-sens-btn.is-on.is-in{ border-color:${C.success}; background:#DCFCE7; color:${C.success}; }
.od-sens-btn.is-on.is-out{ border-color:${C.danger}; background:#FEE2E2; color:${C.danger}; }

.od-erreur{
  display:flex; align-items:flex-start; gap:9px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:12px 14px; font-size:13.5px;
  line-height:1.5; margin-bottom:${S.lg}px;
}

.od-modal-actions{ display:flex; gap:${S.md}px; }
.od-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.od-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.od-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.od-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.od-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.od-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.od-mbtn-ghost{
  flex:1; background:${C.surface}; color:${C.textMuted};
  border:1.5px solid ${C.border};
}
.od-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.od-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.od-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.od-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:44ch; line-height:1.6; }
.od-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:odShim 1.4s infinite;
}
.od-spin{ animation:odSpin 1s linear infinite; }
@keyframes odSpin{ to{ transform:rotate(360deg); } }
@keyframes odShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
@keyframes odFade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes odUp{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
@keyframes odIn{ from{ opacity:0; transform:translateY(-4px); } to{ opacity:1; transform:none; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;