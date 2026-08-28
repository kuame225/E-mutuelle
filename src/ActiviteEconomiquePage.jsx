import React, { useEffect, useState } from "react";
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2,
  ShoppingCart, TrendingUp, Package,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Achats et ventes partagent la même forme (article, quantité, prix, date,
// note) — seule la "partie prenante" diffère (fournisseur / client), ainsi
// que le nom de colonne date et la vérification de stock. Un seul
// composant paramétré plutôt que deux presque identiques.
const TYPES_MOUVEMENT = {
  achat: {
    table: "achats_cooperative",
    dateColonne: "date_achat",
    champPartie: "fournisseur",
    labelPartie: "Fournisseur",
    titreAjout: "Nouvel achat",
    titreVide: "Aucun achat enregistré",
    subVide: "Enregistrez vos achats pour suivre votre stock automatiquement.",
    verbe: "achat",
    Icon: ShoppingCart,
  },
  vente: {
    table: "ventes_cooperative",
    dateColonne: "date_vente",
    champPartie: "client",
    labelPartie: "Client",
    titreAjout: "Nouvelle vente",
    titreVide: "Aucune vente enregistrée",
    subVide: "Enregistrez vos ventes pour suivre vos recettes et votre stock.",
    verbe: "vente",
    Icon: TrendingUp,
  },
};

const ONGLETS = [
  { id: "achats", label: "Achats", Icon: ShoppingCart },
  { id: "ventes", label: "Ventes", Icon: TrendingUp },
  { id: "stock",  label: "Stock",  Icon: Package },
];

export default function ActiviteEconomiquePage() {
  const { params } = useParametrage();
  const [onglet, setOnglet] = useState("achats");
  const [articles, setArticles] = useState([]);
  const [stock, setStock] = useState([]);
  const [chargement, setChargement] = useState(true);

  async function chargerCatalogue() {
    const [{ data: art }, { data: stk }] = await Promise.all([
      supabase
        .from("articles_cooperative")
        .select("*")
        .eq("organisation_id", params.organisation_id)
        .eq("actif", true)
        .order("nom"),
      supabase
        .from("stock_cooperative")
        .select("*")
        .eq("organisation_id", params.organisation_id)
        .order("nom"),
    ]);
    setArticles(art || []);
    setStock(stk || []);
    setChargement(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    chargerCatalogue();
  }, [params.organisation_id]);

  return (
    <div className="ae-wrap">
      <style>{CSS}</style>

      <nav className="ae-tabs">
        {ONGLETS.map((t) => (
          <button
            key={t.id}
            className={`ae-tab ${onglet === t.id ? "is-on" : ""}`}
            onClick={() => setOnglet(t.id)}
          >
            <t.Icon size={16} /> {t.label}
          </button>
        ))}
      </nav>

      {onglet === "achats" && (
        <OngletMouvement
          typeConfig={TYPES_MOUVEMENT.achat}
          articles={articles}
          stock={stock}
          organisationId={params.organisation_id}
          onCatalogueChange={chargerCatalogue}
        />
      )}
      {onglet === "ventes" && (
        <OngletMouvement
          typeConfig={TYPES_MOUVEMENT.vente}
          articles={articles}
          stock={stock}
          organisationId={params.organisation_id}
          onCatalogueChange={chargerCatalogue}
        />
      )}
      {onglet === "stock" && <OngletStock stock={stock} loading={chargement} />}
    </div>
  );
}

/* ---------------- Onglet Achats / Ventes ---------------- */

function OngletMouvement({ typeConfig, articles, stock, organisationId, onCatalogueChange }) {
  const [lignes, setLignes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ajout, setAjout] = useState(false);
  const [suppression, setSuppression] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function charger() {
    setLoading(true);
    const { data, error } = await supabase
      .from(typeConfig.table)
      .select("*, articles_cooperative(nom, unite)")
      .eq("organisation_id", organisationId)
      .order(typeConfig.dateColonne, { ascending: false })
      .order("created_at", { ascending: false });

    if (error) setMessage({ type: "err", texte: error.message });
    setLignes(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (organisationId) charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, typeConfig.table]);

  function notifier(texte) {
    setMessage({ type: "ok", texte });
    setTimeout(() => setMessage(null), 3500);
  }

  async function supprimer(ligne) {
    setEnCours(true);
    const { error } = await supabase.from(typeConfig.table).delete().eq("id", ligne.id);
    setEnCours(false);
    setSuppression(null);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    notifier(typeConfig.verbe === "achat" ? "Achat retiré." : "Vente retirée.");
    charger();
    onCatalogueChange();
  }

  const total = lignes.reduce((s, l) => s + Number(l.montant || 0), 0);

  return (
    <div>
      {message && (
        <div className={`ae-msg ${message.type === "ok" ? "is-ok" : "is-err"}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} aria-label="Fermer"><X size={15} /></button>
        </div>
      )}

      <div className="ae-resume">
        <div><span>{lignes.length}</span><small>{typeConfig.verbe === "achat" ? "achats" : "ventes"}</small></div>
        <div><span>{montant(total)} FCFA</span><small>Total</small></div>
      </div>

      <div className="ae-tools">
        <button className="ae-btn" onClick={() => setAjout(true)}>
          <Plus size={17} /> {typeConfig.titreAjout}
        </button>
      </div>

      {loading ? (
        <div className="ae-skel" />
      ) : lignes.length === 0 ? (
        <div className="ae-vide">
          <typeConfig.Icon size={36} color={PALETTE.grey300} />
          <div className="ae-vide-titre">{typeConfig.titreVide}</div>
          <div className="ae-vide-sub">{typeConfig.subVide}</div>
        </div>
      ) : (
        <ul className="ae-liste">
          {lignes.map((l) => (
            <li key={l.id} className="ae-ligne">
              <div className="ae-ligne-corps">
                <div className="ae-ligne-titre">{l.articles_cooperative?.nom || "—"}</div>
                <div className="ae-ligne-meta">
                  {l.quantite} {l.articles_cooperative?.unite} · {montant(l.prix_unitaire)} FCFA/{l.articles_cooperative?.unite}
                  {l[typeConfig.champPartie] ? ` · ${l[typeConfig.champPartie]}` : ""}
                </div>
                {l.note && <div className="ae-ligne-note">{l.note}</div>}
              </div>
              <div className="ae-ligne-droite">
                <strong>{montant(l.montant)} FCFA</strong>
                <span className="ae-ligne-date">
                  {new Date(l[typeConfig.dateColonne]).toLocaleDateString("fr-FR")}
                </span>
              </div>
              <button className="ae-ligne-suppr" onClick={() => setSuppression(l)} title="Retirer">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {ajout && (
        <ModalMouvement
          typeConfig={typeConfig}
          articles={articles}
          stock={stock}
          organisationId={organisationId}
          onCancel={() => setAjout(false)}
          onDone={(texte) => { setAjout(false); notifier(texte); charger(); onCatalogueChange(); }}
        />
      )}

      {suppression && (
        <div className="ae-overlay" onClick={() => setSuppression(null)}>
          <div className="ae-modal ae-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="ae-modal-titre">Retirer cet enregistrement ?</h3>
            <p className="ae-modal-texte">
              Cette ligne sera définitivement supprimée — le stock sera
              recalculé en conséquence.
            </p>
            <div className="ae-modal-actions">
              <button className="ae-mbtn ae-mbtn-ghost" onClick={() => setSuppression(null)} disabled={enCours}>
                Annuler
              </button>
              <button className="ae-mbtn ae-mbtn-danger" onClick={() => supprimer(suppression)} disabled={enCours}>
                {enCours ? <><Loader2 size={16} className="ae-spin" /> Suppression…</> : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Formulaire d'ajout ---------------- */

function ModalMouvement({ typeConfig, articles, stock, organisationId, onCancel, onDone }) {
  const [articleId, setArticleId] = useState(articles[0]?.id || "__nouveau__");
  const [nouvelArticleNom, setNouvelArticleNom] = useState("");
  const [nouvelArticleUnite, setNouvelArticleUnite] = useState("unité");
  const [partie, setPartie] = useState("");
  const [quantite, setQuantite] = useState("1");
  const [prixUnitaire, setPrixUnitaire] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [err, setErr] = useState("");

  const creationArticle = articleId === "__nouveau__";

  // Une vente pré-remplit le prix depuis le prix de référence de l'article,
  // s'il en a un — l'admin garde la main pour l'ajuster.
  useEffect(() => {
    if (typeConfig.verbe !== "vente" || creationArticle) return;
    const art = articles.find((a) => a.id === articleId);
    if (art?.prix_vente_reference) setPrixUnitaire(String(art.prix_vente_reference));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  const stockDisponible = !creationArticle
    ? stock.find((s) => s.article_id === articleId)?.quantite_disponible ?? 0
    : 0;

  const montantCalcule = (parseFloat(quantite) || 0) * (parseFloat(prixUnitaire) || 0);

  async function valider() {
    if (creationArticle && !nouvelArticleNom.trim()) { setErr("Indiquez le nom de l'article."); return; }
    if (!creationArticle && !articleId) { setErr("Choisissez un article."); return; }

    const qte = parseFloat(quantite);
    if (!qte || qte <= 0) { setErr("Indiquez une quantité."); return; }

    const pu = parseFloat(prixUnitaire);
    if (isNaN(pu) || pu < 0) { setErr("Indiquez un prix unitaire."); return; }

    if (!date) { setErr("Indiquez la date."); return; }

    if (typeConfig.verbe === "vente" && !creationArticle && qte > stockDisponible) {
      setErr(`Stock insuffisant : ${stockDisponible} disponible(s).`);
      return;
    }

    setEnCours(true);
    setErr("");

    let finalArticleId = articleId;

    if (creationArticle) {
      const { data: nouvel, error: errArticle } = await supabase
        .from("articles_cooperative")
        .insert({
          organisation_id: organisationId,
          nom: nouvelArticleNom.trim(),
          unite: nouvelArticleUnite.trim() || "unité",
        })
        .select()
        .single();

      if (errArticle) { setEnCours(false); setErr(errArticle.message); return; }
      finalArticleId = nouvel.id;
    }

    const ligne = {
      organisation_id: organisationId,
      article_id: finalArticleId,
      [typeConfig.dateColonne]: date,
      quantite: qte,
      prix_unitaire: pu,
      montant: Math.round(montantCalcule),
      note: note.trim() || null,
      [typeConfig.champPartie]: partie.trim() || null,
    };

    const { error } = await supabase.from(typeConfig.table).insert(ligne);

    setEnCours(false);

    if (error) { setErr(error.message); return; }

    onDone(typeConfig.verbe === "achat" ? "Achat enregistré." : "Vente enregistrée.");
  }

  return (
    <div className="ae-overlay" onClick={onCancel}>
      <div className="ae-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ae-modal-head">
          <h3 className="ae-modal-titre">{typeConfig.titreAjout}</h3>
          <button className="ae-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        <div className="ae-champ">
          <label className="ae-label" htmlFor="ae-article">Article</label>
          <select
            id="ae-article"
            className="ae-input"
            value={articleId}
            onChange={(e) => setArticleId(e.target.value)}
          >
            {articles.map((a) => (
              <option key={a.id} value={a.id}>{a.nom} ({a.unite})</option>
            ))}
            <option value="__nouveau__">+ Nouvel article…</option>
          </select>
          {!creationArticle && typeConfig.verbe === "vente" && (
            <span className="ae-hint">{stockDisponible} disponible(s) en stock</span>
          )}
        </div>

        {creationArticle && (
          <>
            <div className="ae-champ">
              <label className="ae-label" htmlFor="ae-nom">Nom de l'article</label>
              <input
                id="ae-nom" className="ae-input" value={nouvelArticleNom}
                onChange={(e) => setNouvelArticleNom(e.target.value)}
                placeholder="Ex : Cacao (sac de 50 kg)"
              />
            </div>
            <div className="ae-champ">
              <label className="ae-label" htmlFor="ae-unite">Unité</label>
              <input
                id="ae-unite" className="ae-input" value={nouvelArticleUnite}
                onChange={(e) => setNouvelArticleUnite(e.target.value)}
                placeholder="sac, kg, litre, unité…"
              />
            </div>
          </>
        )}

        <div className="ae-deux-champs">
          <div className="ae-champ">
            <label className="ae-label" htmlFor="ae-quantite">Quantité</label>
            <input
              id="ae-quantite" type="number" min="0" step="any" className="ae-input"
              value={quantite} onChange={(e) => setQuantite(e.target.value)}
            />
          </div>
          <div className="ae-champ">
            <label className="ae-label" htmlFor="ae-prix">Prix unitaire</label>
            <input
              id="ae-prix" type="number" min="0" className="ae-input"
              value={prixUnitaire} onChange={(e) => setPrixUnitaire(e.target.value)}
            />
          </div>
        </div>

        <div className="ae-montant-calcule">
          Montant : <strong>{montant(Math.round(montantCalcule) || 0)} FCFA</strong>
        </div>

        <div className="ae-champ">
          <label className="ae-label" htmlFor="ae-partie">
            {typeConfig.labelPartie} <span className="ae-opt">— facultatif</span>
          </label>
          <input id="ae-partie" className="ae-input" value={partie} onChange={(e) => setPartie(e.target.value)} />
        </div>

        <div className="ae-champ">
          <label className="ae-label" htmlFor="ae-date">Date</label>
          <input
            id="ae-date" type="date" className="ae-input"
            max={new Date().toISOString().slice(0, 10)}
            value={date} onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="ae-champ">
          <label className="ae-label" htmlFor="ae-note">
            Note <span className="ae-opt">— facultative</span>
          </label>
          <input id="ae-note" className="ae-input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {err && <div className="ae-err"><AlertCircle size={15} /> {err}</div>}

        <div className="ae-modal-actions">
          <button className="ae-mbtn ae-mbtn-ghost" onClick={onCancel} disabled={enCours}>Annuler</button>
          <button className="ae-mbtn ae-mbtn-primary" onClick={valider} disabled={enCours}>
            {enCours ? <><Loader2 size={16} className="ae-spin" /> Envoi…</> : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Onglet Stock ---------------- */

function OngletStock({ stock, loading }) {
  if (loading) return <div className="ae-skel" />;

  if (stock.length === 0) {
    return (
      <div className="ae-vide">
        <Package size={36} color={PALETTE.grey300} />
        <div className="ae-vide-titre">Aucun article suivi</div>
        <div className="ae-vide-sub">
          Le stock se construit automatiquement à partir de vos achats et ventes.
        </div>
      </div>
    );
  }

  return (
    <ul className="ae-stock-liste">
      {stock.map((s) => (
        <li key={s.article_id} className={`ae-stock-ligne ${s.quantite_disponible <= 0 ? "is-vide" : ""}`}>
          <span className="ae-stock-nom">{s.nom}</span>
          <span className="ae-stock-qte">{s.quantite_disponible} {s.unite}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Styles ---------------- */

const CSS = `
.ae-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .ae-wrap{ padding:${S.lg}px; } }

.ae-tabs{ display:flex; gap:6px; background:${PALETTE.grey100}; border-radius:${R.pill}px; padding:4px; width:fit-content; }
.ae-tab{
  display:flex; align-items:center; gap:7px;
  background:none; border:none; border-radius:${R.pill}px; padding:9px 16px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; color:${C.textMuted};
  transition:background .16s ease, color .16s ease;
}
.ae-tab.is-on{ background:${C.surface}; color:${C.primary}; box-shadow:${SHADOW.xs}; }

.ae-msg{
  display:flex; align-items:center; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
}
.ae-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.ae-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }
.ae-msg button{ margin-left:auto; background:none; border:none; cursor:pointer; color:inherit; opacity:.7; display:flex; padding:0; }

.ae-resume{ display:flex; gap:${S.md}px; }
.ae-resume > div{
  flex:1; background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px;
  padding:${S.md}px ${S.lg}px; display:flex; flex-direction:column; gap:2px;
}
.ae-resume span{ font-size:19px; font-weight:700; letter-spacing:-.01em; }
.ae-resume small{ font-size:12px; color:${C.textSubtle}; }

.ae-tools{ display:flex; align-items:center; }
.ae-btn{
  margin-left:auto; display:flex; align-items:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.ae-btn:hover{ background:${C.primaryDark}; }

.ae-liste{
  list-style:none; margin:0; padding:0;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; overflow:hidden; box-shadow:${SHADOW.xs};
}
.ae-ligne{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border}; flex-wrap:wrap;
}
.ae-ligne:last-child{ border-bottom:none; }
.ae-ligne-corps{ flex:1; min-width:180px; }
.ae-ligne-titre{ font-size:14.5px; font-weight:600; }
.ae-ligne-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }
.ae-ligne-note{ font-size:13px; color:${C.textMuted}; margin-top:4px; }
.ae-ligne-droite{ display:flex; flex-direction:column; align-items:flex-end; gap:2px; flex-shrink:0; }
.ae-ligne-droite strong{ font-size:14.5px; }
.ae-ligne-date{ font-size:11.5px; color:${C.textSubtle}; }
.ae-ligne-suppr{
  flex-shrink:0; width:30px; height:30px; border-radius:${R.sm}px;
  background:none; border:1px solid ${C.border}; color:${C.textSubtle}; cursor:pointer;
  display:flex; align-items:center; justify-content:center; transition:all .16s ease;
}
.ae-ligne-suppr:hover{ border-color:${C.danger}; color:${C.danger}; background:#FEE2E2; }

.ae-stock-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.ae-stock-ligne{
  display:flex; align-items:center; justify-content:space-between;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px;
  padding:13px ${S.lg}px;
}
.ae-stock-ligne.is-vide{ border-color:${C.danger}33; background:#FEF2F2; }
.ae-stock-nom{ font-size:14.5px; font-weight:600; }
.ae-stock-qte{ font-size:14px; font-weight:700; color:${C.primary}; }
.ae-stock-ligne.is-vide .ae-stock-qte{ color:${C.danger}; }

/* ---- Modale ---- */
.ae-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; overflow-y:auto;
}
.ae-modal{ width:100%; max-width:480px; background:${C.surface}; border-radius:${R.xxl}px; padding:${S.xl}px; box-shadow:${SHADOW.lg}; margin:auto; }
.ae-modal-court{ max-width:420px; }
.ae-modal-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; margin-bottom:${S.lg}px; }
.ae-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.ae-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:8px 0 ${S.md}px; }
.ae-close{ background:none; border:1px solid ${C.border}; border-radius:${R.sm}px; color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex; }
.ae-close:hover{ color:${C.danger}; border-color:${C.danger}; }

.ae-champ{ display:flex; flex-direction:column; gap:6px; margin-bottom:${S.md}px; }
.ae-deux-champs{ display:grid; grid-template-columns:1fr 1fr; gap:${S.md}px; }
.ae-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.ae-opt{ font-weight:400; color:${C.textSubtle}; }
.ae-hint{ font-size:12px; color:${C.textSubtle}; }
.ae-input{
  width:100%; box-sizing:border-box; padding:11px 13px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px; color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.ae-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }

.ae-montant-calcule{
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:11px 14px; font-size:13.5px; color:${C.textMuted};
  margin-bottom:${S.md}px;
}
.ae-montant-calcule strong{ color:${C.primary}; font-size:15px; }

.ae-err{
  display:flex; align-items:flex-start; gap:8px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:11px 13px; font-size:13px; line-height:1.5; margin-bottom:${S.md}px;
}

.ae-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }
.ae-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.ae-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.ae-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.ae-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.ae-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.ae-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.ae-mbtn-ghost{ flex:1; background:${C.surface}; color:${C.textMuted}; border:1.5px solid ${C.border}; }
.ae-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.ae-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.ae-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.ae-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:44ch; line-height:1.6; }
.ae-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:aeShim 1.4s infinite;
}
.ae-spin{ animation:aeSpin 1s linear infinite; }
@keyframes aeSpin{ to{ transform:rotate(360deg); } }
@keyframes aeShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;