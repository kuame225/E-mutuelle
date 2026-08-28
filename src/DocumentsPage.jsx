import React, { useEffect, useState } from "react";
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2,
  FileText, Download, Eye, EyeOff, Upload, File, FileSpreadsheet, FileImage,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { useVocabulaire } from "./useVocabulaire";
import { consigner, EVENEMENTS } from "./journal";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const BUCKET = "documents-organisation";
const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo

const CATEGORIES = [
  { id: "statuts",    label: "Statuts & règlement" },
  { id: "rapport",    label: "Rapports" },
  { id: "formulaire", label: "Formulaires & modèles" },
  { id: "autre",      label: "Autres documents" },
];

export default function DocumentsPage() {
  const { params } = useParametrage();
  const { mot } = useVocabulaire();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creation, setCreation] = useState(false);
  const [suppression, setSuppression] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  // id -> true pendant la génération de l'URL signée d'ouverture
  const [ouverture, setOuverture] = useState({});

  async function charger() {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("created_at", { ascending: false });

    if (error) setMessage({ type: "err", texte: error.message });
    setDocuments(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  function notifier(texte) {
    setMessage({ type: "ok", texte });
    setTimeout(() => setMessage(null), 3500);
  }

  // Le bucket est privé : pas de lien permanent, une URL signée est générée
  // à chaque ouverture et expire après une minute.
  async function ouvrir(doc) {
    setOuverture((o) => ({ ...o, [doc.id]: true }));
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.fichier_chemin, 60);
    setOuverture((o) => ({ ...o, [doc.id]: false }));

    if (error || !data?.signedUrl) {
      setMessage({ type: "err", texte: "Impossible d'ouvrir ce document pour le moment." });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function basculerVisibilite(doc) {
    setEnCours(true);
    const { error } = await supabase
      .from("documents")
      .update({ visible_membres: !doc.visible_membres })
      .eq("id", doc.id)
      .eq("organisation_id", params.organisation_id);
    setEnCours(false);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    consigner(EVENEMENTS.DOCUMENT_VISIBILITE_MODIFIEE, {
      organisation_id: params.organisation_id,
      titre: doc.titre,
      visible_membres: !doc.visible_membres,
    });
    charger();
  }

  async function supprimer(doc) {
    setEnCours(true);

    // Le fichier est retiré du stockage avant la ligne en base : un
    // enregistrement orphelin gêne (il pointerait vers rien), un fichier
    // orphelin dans le bucket ne gêne personne — l'ordre le plus sûr en
    // cas d'échec partiel est donc celui-ci.
    await supabase.storage.from(BUCKET).remove([doc.fichier_chemin]);

    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id)
      .eq("organisation_id", params.organisation_id);

    setEnCours(false);
    setSuppression(null);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    notifier("Document retiré.");
    consigner(EVENEMENTS.DOCUMENT_SUPPRIME, {
      organisation_id: params.organisation_id,
      titre: doc.titre,
    });
    charger();
  }

  const parCategorie = CATEGORIES
    .map((cat) => ({ ...cat, lignes: documents.filter((d) => d.categorie === cat.id) }))
    .filter((cat) => cat.lignes.length > 0);

  if (loading) {
    return (
      <div className="dc-wrap">
        <style>{CSS}</style>
        <div className="dc-skel" /><div className="dc-skel" />
      </div>
    );
  }

  return (
    <div className="dc-wrap">
      <style>{CSS}</style>

      {message && (
        <div className={`dc-msg ${message.type === "ok" ? "is-ok" : "is-err"}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} aria-label="Fermer"><X size={15} /></button>
        </div>
      )}

      <div className="dc-intro">
        <FileText size={16} />
        <span>
          Les documents marqués « visible {mot("membres").toLowerCase()} » apparaissent
          dans l'espace personnel de chaque {mot("membre_singulier").toLowerCase()}. Les
          autres ne sont consultables que par {mot("bureau_le")}.
        </span>
      </div>

      <div className="dc-tools">
        <button className="dc-btn" onClick={() => { setCreation(true); setMessage(null); }}>
          <Plus size={17} /> Ajouter un document
        </button>
      </div>

      {parCategorie.length === 0 ? (
        <div className="dc-vide">
          <FileText size={36} color={PALETTE.grey300} />
          <div className="dc-vide-titre">Aucun document</div>
          <div className="dc-vide-sub">
            Statuts, rapports, formulaires : ajoutez les documents utiles {mot("organisation_de")}.
          </div>
        </div>
      ) : (
        parCategorie.map((cat) => (
          <section key={cat.id} className="dc-groupe">
            <h2 className="dc-groupe-titre">{cat.label}</h2>
            <ul className="dc-liste">
              {cat.lignes.map((d) => (
                <li key={d.id} className="dc-ligne">
                  <span className="dc-icon"><IconeFichier nom={d.fichier_nom} /></span>

                  <div className="dc-ligne-corps">
                    <div className="dc-ligne-titre">{d.titre}</div>
                    <div className="dc-ligne-meta">
                      {d.fichier_nom}
                      {d.fichier_taille ? ` · ${tailleLisible(d.fichier_taille)}` : ""}
                      {" · "}{new Date(d.created_at).toLocaleDateString("fr-FR")}
                    </div>
                    {d.description && <div className="dc-ligne-desc">{d.description}</div>}
                  </div>

                  <button
                    className={`dc-visi ${d.visible_membres ? "is-on" : ""}`}
                    onClick={() => basculerVisibilite(d)}
                    disabled={enCours}
                    title={d.visible_membres
                      ? `Visible par ${mot("bureau_le")} et par les ${mot("membres").toLowerCase()}`
                      : `Consultable uniquement par ${mot("bureau_le")}`}
                  >
                    {d.visible_membres ? <Eye size={14} /> : <EyeOff size={14} />}
                    {d.visible_membres ? mot("membres") : "Interne"}
                  </button>

                  <div className="dc-ligne-actions">
                    <button onClick={() => ouvrir(d)} disabled={ouverture[d.id]} title="Ouvrir">
                      {ouverture[d.id]
                        ? <Loader2 size={15} className="dc-spin" />
                        : <Download size={15} />}
                    </button>
                    <button className="is-danger" onClick={() => setSuppression(d)} title="Retirer">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {creation && (
        <ModalDocument
          organisationId={params.organisation_id}
          onCancel={() => setCreation(false)}
          onDone={(texte) => { setCreation(false); notifier(texte); charger(); }}
        />
      )}

      {suppression && (
        <div className="dc-overlay" onClick={() => setSuppression(null)}>
          <div className="dc-modal dc-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="dc-modal-titre">Retirer ce document ?</h3>
            <p className="dc-modal-texte">
              <strong>{suppression.titre}</strong> sera définitivement supprimé,
              y compris pour les {mot("membres").toLowerCase()} qui y avaient accès.
            </p>
            <div className="dc-modal-actions">
              <button className="dc-mbtn dc-mbtn-ghost" onClick={() => setSuppression(null)} disabled={enCours}>
                Annuler
              </button>
              <button className="dc-mbtn dc-mbtn-danger" onClick={() => supprimer(suppression)} disabled={enCours}>
                {enCours
                  ? <><Loader2 size={16} className="dc-spin" /> Suppression…</>
                  : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Formulaire d'ajout ---------------- */

function ModalDocument({ organisationId, onCancel, onDone }) {
  const { mot } = useVocabulaire();
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [categorie, setCategorie] = useState("autre");
  const [visibleMembres, setVisibleMembres] = useState(false);
  const [fichier, setFichier] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [err, setErr] = useState("");

  function choisirFichier(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > TAILLE_MAX) {
      setErr("Fichier trop lourd (10 Mo maximum).");
      return;
    }
    setErr("");
    setFichier(f);
    if (!titre) setTitre(f.name.replace(/\.[^.]+$/, ""));
  }

  async function valider() {
    if (!titre.trim()) { setErr("Indiquez un titre."); return; }
    if (!fichier) { setErr("Choisissez un fichier."); return; }

    setEnCours(true);
    setErr("");

    const ext = fichier.name.split(".").pop();
    const chemin = `${organisationId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(chemin, fichier, { contentType: fichier.type });

    if (upErr) {
      setEnCours(false);
      setErr("Échec du téléversement : " + upErr.message);
      return;
    }

    const { error } = await supabase.from("documents").insert({
      organisation_id: organisationId,
      titre: titre.trim(),
      description: description.trim() || null,
      categorie,
      fichier_chemin: chemin,
      fichier_nom: fichier.name,
      fichier_taille: fichier.size,
      visible_membres: visibleMembres,
    });

    setEnCours(false);

    if (error) {
      // Le fichier est déjà envoyé : on ne le laisse pas orphelin si
      // l'enregistrement de la ligne échoue derrière.
      await supabase.storage.from(BUCKET).remove([chemin]);
      setErr(error.message);
      return;
    }

    consigner(EVENEMENTS.DOCUMENT_AJOUTE, {
      organisation_id: organisationId,
      titre: titre.trim(),
    });

    onDone("Document ajouté.");
  }

  return (
    <div className="dc-overlay" onClick={onCancel}>
      <div className="dc-modal" onClick={(e) => e.stopPropagation()}>
        <header className="dc-modal-head">
          <div>
            <h3 className="dc-modal-titre">Nouveau document</h3>
            <p className="dc-modal-sub">PDF, Word, Excel ou image — 10 Mo maximum.</p>
          </div>
          <button className="dc-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        <div className="dc-champ">
          <label className="dc-label" htmlFor="dc-fichier">Fichier</label>
          <label className={`dc-drop ${fichier ? "is-rempli" : ""}`} htmlFor="dc-fichier">
            <Upload size={18} />
            {fichier ? fichier.name : "Choisir un fichier…"}
          </label>
          <input id="dc-fichier" type="file" onChange={choisirFichier} style={{ display: "none" }} />
        </div>

        <div className="dc-champ">
          <label className="dc-label" htmlFor="dc-titre">Titre</label>
          <input
            id="dc-titre"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Ex : Règlement intérieur 2026"
            className="dc-input"
          />
        </div>

        <div className="dc-champ">
          <span className="dc-label">Catégorie</span>
          <div className="dc-choix">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`dc-choix-btn ${categorie === c.id ? "is-on" : ""}`}
                onClick={() => setCategorie(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dc-champ">
          <label className="dc-label" htmlFor="dc-desc">
            Description <span className="dc-opt">— facultative</span>
          </label>
          <textarea
            id="dc-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="dc-input dc-textarea"
          />
        </div>

        <button
          className={`dc-bascule ${visibleMembres ? "is-on" : ""}`}
          onClick={() => setVisibleMembres((v) => !v)}
        >
          <span className="dc-case">{visibleMembres && <CheckCircle2 size={13} />}</span>
          <span>
            <strong>Visible par les {mot("membres").toLowerCase()}</strong>
            <em>Sinon, ce document n'est consultable que par {mot("bureau_le")}</em>
          </span>
        </button>

        {err && <div className="dc-err"><AlertCircle size={15} /> {err}</div>}

        <div className="dc-modal-actions">
          <button className="dc-mbtn dc-mbtn-ghost" onClick={onCancel} disabled={enCours}>
            Annuler
          </button>
          <button className="dc-mbtn dc-mbtn-primary" onClick={valider} disabled={enCours}>
            {enCours
              ? <><Loader2 size={16} className="dc-spin" /> Envoi…</>
              : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Utilitaires ---------------- */

function IconeFichier({ nom }) {
  const ext = (nom.split(".").pop() || "").toLowerCase();
  if (["xlsx", "xls", "csv"].includes(ext)) return <FileSpreadsheet size={18} />;
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return <FileImage size={18} />;
  return <File size={18} />;
}

function tailleLisible(octets) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

/* ---------------- Styles ---------------- */

const CSS = `
.dc-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .dc-wrap{ padding:${S.lg}px; } }

.dc-msg{
  display:flex; align-items:center; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
}
.dc-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.dc-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }
.dc-msg button{
  margin-left:auto; background:none; border:none; cursor:pointer;
  color:inherit; opacity:.7; display:flex; padding:0;
}

.dc-intro{
  display:flex; align-items:flex-start; gap:9px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:12px 15px;
  font-size:13px; color:${C.textMuted}; line-height:1.55;
}

.dc-tools{ display:flex; align-items:center; }
.dc-btn{
  margin-left:auto; display:flex; align-items:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.dc-btn:hover{ background:${C.primaryDark}; }

/* ---- Groupes ---- */
.dc-groupe-titre{
  font-size:16px; font-weight:700; letter-spacing:-.01em; margin:0 0 ${S.md}px;
}
.dc-liste{
  list-style:none; margin:0; padding:0;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; overflow:hidden; box-shadow:${SHADOW.xs};
}
.dc-ligne{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border};
  flex-wrap:wrap;
}
.dc-ligne:last-child{ border-bottom:none; }
.dc-icon{
  width:38px; height:38px; border-radius:${R.sm}px; flex-shrink:0;
  background:${PALETTE.blue50}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.dc-ligne-corps{ flex:1; min-width:190px; }
.dc-ligne-titre{ font-size:14.5px; font-weight:600; }
.dc-ligne-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }
.dc-ligne-desc{ font-size:13px; color:${C.textMuted}; margin-top:4px; line-height:1.5; }

.dc-visi{
  flex-shrink:0; display:flex; align-items:center; gap:6px;
  background:${PALETTE.grey200}; color:${C.textMuted}; border:none;
  border-radius:${R.pill}px; padding:6px 12px; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:600;
  transition:background .16s ease, color .16s ease;
}
.dc-visi.is-on{ background:${PALETTE.blue100}; color:${C.primary}; }

.dc-ligne-actions{ display:flex; gap:5px; flex-shrink:0; }
.dc-ligne-actions button{
  width:32px; height:32px; border-radius:${R.sm}px;
  background:${C.surface}; border:1px solid ${C.border};
  color:${C.textSubtle}; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .16s ease;
}
.dc-ligne-actions button:hover:not(:disabled){ border-color:${C.primary}; color:${C.primary}; }
.dc-ligne-actions button.is-danger:hover{ border-color:${C.danger}; color:${C.danger}; background:#FEE2E2; }
.dc-ligne-actions button:disabled{ opacity:.5; cursor:not-allowed; }

/* ---- Modale ---- */
.dc-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; overflow-y:auto;
}
.dc-modal{
  width:100%; max-width:520px; background:${C.surface};
  border-radius:${R.xxl}px; padding:${S.xl}px;
  box-shadow:${SHADOW.lg}; margin:auto;
}
.dc-modal-court{ max-width:420px; }
.dc-modal-head{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:${S.md}px; margin-bottom:${S.lg}px;
}
.dc-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.dc-modal-sub{ font-size:13px; color:${C.textSubtle}; margin:4px 0 0; line-height:1.5; }
.dc-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:8px 0 ${S.md}px; }
.dc-close{
  background:none; border:1px solid ${C.border}; border-radius:${R.sm}px;
  color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex;
}
.dc-close:hover{ color:${C.danger}; border-color:${C.danger}; }

.dc-champ{ display:flex; flex-direction:column; gap:6px; margin-bottom:${S.md}px; }
.dc-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.dc-opt{ font-weight:400; color:${C.textSubtle}; }

.dc-drop{
  display:flex; align-items:center; gap:9px;
  border:1.5px dashed ${C.border}; border-radius:${R.md}px;
  padding:14px 15px; cursor:pointer; font-size:14px; color:${C.textMuted};
  transition:border-color .15s ease, background .15s ease;
}
.dc-drop:hover{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.dc-drop.is-rempli{ border-style:solid; border-color:${C.primary}; color:${C.text}; }

.dc-input{
  width:100%; box-sizing:border-box; padding:12px 14px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px;
  color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.dc-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.dc-textarea{ resize:vertical; }

.dc-choix{ display:flex; flex-wrap:wrap; gap:${S.sm}px; }
.dc-choix-btn{
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.pill}px; padding:8px 14px; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:600; color:${C.textMuted};
  transition:all .16s ease;
}
.dc-choix-btn:hover{ border-color:${PALETTE.grey300}; }
.dc-choix-btn.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; color:${C.primary}; }

.dc-bascule{
  display:flex; align-items:flex-start; gap:11px; width:100%;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:12px 14px; cursor:pointer;
  font-family:inherit; text-align:left; transition:all .16s ease;
  margin-bottom:${S.md}px;
}
.dc-bascule:hover{ border-color:${PALETTE.grey300}; }
.dc-bascule.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.dc-case{
  width:19px; height:19px; border-radius:5px; flex-shrink:0; margin-top:1px;
  border:2px solid ${PALETTE.grey300}; color:#fff;
  display:flex; align-items:center; justify-content:center;
}
.dc-bascule.is-on .dc-case{ background:${C.primary}; border-color:${C.primary}; }
.dc-bascule strong{ display:block; font-size:13.5px; font-weight:600; }
.dc-bascule em{ font-style:normal; font-size:12px; color:${C.textSubtle}; }

.dc-err{
  display:flex; align-items:flex-start; gap:8px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:11px 13px; font-size:13px;
  line-height:1.5; margin-bottom:${S.md}px;
}

.dc-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }
.dc-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.dc-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.dc-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.dc-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.dc-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.dc-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.dc-mbtn-ghost{
  flex:1; background:${C.surface}; color:${C.textMuted};
  border:1.5px solid ${C.border};
}
.dc-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.dc-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.dc-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.dc-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:44ch; line-height:1.6; }
.dc-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:dcShim 1.4s infinite;
}
.dc-spin{ animation:dcSpin 1s linear infinite; }
@keyframes dcSpin{ to{ transform:rotate(360deg); } }
@keyframes dcShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;