import React, { useEffect, useState } from "react";
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2, Pencil,
  Handshake, Eye, EyeOff, Upload, ExternalLink,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { useVocabulaire } from "./useVocabulaire";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const BUCKET_LOGOS = "logos-partenaires";

export default function PartenairesPage() {
  const { params } = useParametrage();
  const { mot } = useVocabulaire();

  const [partenaires, setPartenaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creation, setCreation] = useState(false);
  const [edition, setEdition] = useState(null);
  const [suppression, setSuppression] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function charger() {
    const { data, error } = await supabase
      .from("partenaires")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("created_at", { ascending: false });

    if (error) setMessage({ type: "err", texte: error.message });
    setPartenaires(data || []);
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

  async function basculerVisibilite(p) {
    setEnCours(true);
    const { error } = await supabase
      .from("partenaires")
      .update({ visible_membres: !p.visible_membres })
      .eq("id", p.id);
    setEnCours(false);
    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    charger();
  }

  async function basculerActif(p) {
    setEnCours(true);
    const { error } = await supabase
      .from("partenaires")
      .update({ actif: !p.actif })
      .eq("id", p.id);
    setEnCours(false);
    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    charger();
  }

  async function supprimer(p) {
    setEnCours(true);
    if (p.logo_chemin) {
      await supabase.storage.from(BUCKET_LOGOS).remove([p.logo_chemin]);
    }
    const { error } = await supabase.from("partenaires").delete().eq("id", p.id);
    setEnCours(false);
    setSuppression(null);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    notifier("Partenaire retiré.");
    charger();
  }

  if (loading) {
    return (
      <div className="pa-wrap">
        <style>{CSS}</style>
        <div className="pa-skel" /><div className="pa-skel" />
      </div>
    );
  }

  return (
    <div className="pa-wrap">
      <style>{CSS}</style>

      {message && (
        <div className={`pa-msg ${message.type === "ok" ? "is-ok" : "is-err"}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} aria-label="Fermer"><X size={15} /></button>
        </div>
      )}

      <div className="pa-intro">
        <Handshake size={16} />
        <span>
          Les partenaires marqués « visible {mot("membres").toLowerCase()} » apparaissent
          dans l'espace personnel de chaque {mot("membre_singulier").toLowerCase()}. Un
          partenaire désactivé reste dans l'historique sans apparaître dans l'annuaire.
        </span>
      </div>

      <div className="pa-tools">
        <button className="pa-btn" onClick={() => setCreation(true)}>
          <Plus size={17} /> Ajouter un partenaire
        </button>
      </div>

      {partenaires.length === 0 ? (
        <div className="pa-vide">
          <Handshake size={36} color={PALETTE.grey300} />
          <div className="pa-vide-titre">Aucun partenaire</div>
          <div className="pa-vide-sub">
            Ajoutez les organisations partenaires {mot("organisation_de")}.
          </div>
        </div>
      ) : (
        <ul className="pa-liste">
          {partenaires.map((p) => (
            <li key={p.id} className={`pa-ligne ${!p.actif ? "is-inactif" : ""}`}>
              {p.logo_chemin ? (
                <img
                  className="pa-logo"
                  src={supabase.storage.from(BUCKET_LOGOS).getPublicUrl(p.logo_chemin).data.publicUrl}
                  alt={p.nom}
                />
              ) : (
                <span className="pa-icon"><Handshake size={18} /></span>
              )}

              <div className="pa-ligne-corps">
                <div className="pa-ligne-titre">{p.nom}</div>
                {p.description && <div className="pa-ligne-desc">{p.description}</div>}
                <div className="pa-ligne-meta">
                  {p.site_web && (
                    <a href={p.site_web} target="_blank" rel="noreferrer" className="pa-lien-site">
                      <ExternalLink size={11} /> Site web
                    </a>
                  )}
                  {p.contact && <span>{p.contact}</span>}
                </div>
              </div>

              <button
                className={`pa-visi ${p.visible_membres ? "is-on" : ""}`}
                onClick={() => basculerVisibilite(p)}
                disabled={enCours}
                title={p.visible_membres ? `Visible par les ${mot("membres").toLowerCase()}` : "Interne"}
              >
                {p.visible_membres ? <Eye size={14} /> : <EyeOff size={14} />}
                {p.visible_membres ? mot("membres") : "Interne"}
              </button>

              <div className="pa-ligne-actions">
                <button
                  className={`pa-toggle-actif ${p.actif ? "" : "is-off"}`}
                  onClick={() => basculerActif(p)}
                  disabled={enCours}
                >
                  {p.actif ? "Actif" : "Désactivé"}
                </button>
                <button onClick={() => setEdition(p)} title="Modifier"><Pencil size={14} /></button>
                <button className="is-danger" onClick={() => setSuppression(p)} title="Retirer">
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creation || edition) && (
        <ModalPartenaire
          partenaire={edition}
          organisationId={params.organisation_id}
          onCancel={() => { setCreation(false); setEdition(null); }}
          onDone={(texte) => { setCreation(false); setEdition(null); notifier(texte); charger(); }}
        />
      )}

      {suppression && (
        <div className="pa-overlay" onClick={() => setSuppression(null)}>
          <div className="pa-modal pa-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="pa-modal-titre">Retirer ce partenaire ?</h3>
            <p className="pa-modal-texte">
              <strong>{suppression.nom}</strong> sera définitivement supprimé.
            </p>
            <div className="pa-modal-actions">
              <button className="pa-mbtn pa-mbtn-ghost" onClick={() => setSuppression(null)} disabled={enCours}>
                Annuler
              </button>
              <button className="pa-mbtn pa-mbtn-danger" onClick={() => supprimer(suppression)} disabled={enCours}>
                {enCours ? <><Loader2 size={16} className="pa-spin" /> Suppression…</> : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Formulaire (création / édition) ---------------- */

function ModalPartenaire({ partenaire, organisationId, onCancel, onDone }) {
  const { mot } = useVocabulaire();
  const edition = Boolean(partenaire);
  const [nom, setNom] = useState(partenaire?.nom || "");
  const [description, setDescription] = useState(partenaire?.description || "");
  const [siteWeb, setSiteWeb] = useState(partenaire?.site_web || "");
  const [contact, setContact] = useState(partenaire?.contact || "");
  const [visibleMembres, setVisibleMembres] = useState(partenaire?.visible_membres || false);
  const [logoFichier, setLogoFichier] = useState(null);
  const [logoApercu, setLogoApercu] = useState(
    partenaire?.logo_chemin
      ? supabase.storage.from(BUCKET_LOGOS).getPublicUrl(partenaire.logo_chemin).data.publicUrl
      : null
  );
  const [enCours, setEnCours] = useState(false);
  const [err, setErr] = useState("");

  function choisirLogo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1 * 1024 * 1024) { setErr("Image trop lourde (1 Mo maximum)."); return; }
    setErr("");
    setLogoFichier(f);
    setLogoApercu(URL.createObjectURL(f));
  }

  async function valider() {
    if (!nom.trim()) { setErr("Indiquez le nom du partenaire."); return; }

    setEnCours(true);
    setErr("");

    let logoChemin = partenaire?.logo_chemin || null;

    if (logoFichier) {
      const ext = logoFichier.name.split(".").pop();
      const chemin = `${organisationId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET_LOGOS)
        .upload(chemin, logoFichier, { contentType: logoFichier.type });

      if (upErr) { setEnCours(false); setErr("Échec du téléversement : " + upErr.message); return; }

      if (partenaire?.logo_chemin) {
        await supabase.storage.from(BUCKET_LOGOS).remove([partenaire.logo_chemin]);
      }
      logoChemin = chemin;
    }

    const donnees = {
      nom: nom.trim(),
      description: description.trim() || null,
      site_web: siteWeb.trim() || null,
      contact: contact.trim() || null,
      visible_membres: visibleMembres,
      logo_chemin: logoChemin,
    };

    const { error } = edition
      ? await supabase.from("partenaires").update(donnees).eq("id", partenaire.id)
      : await supabase.from("partenaires").insert({ ...donnees, organisation_id: organisationId });

    setEnCours(false);

    if (error) { setErr(error.message); return; }

    onDone(edition ? "Partenaire modifié." : "Partenaire ajouté.");
  }

  return (
    <div className="pa-overlay" onClick={onCancel}>
      <div className="pa-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pa-modal-head">
          <h3 className="pa-modal-titre">{edition ? "Modifier le partenaire" : "Nouveau partenaire"}</h3>
          <button className="pa-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        <div className="pa-champ">
          <label className="pa-label" htmlFor="pa-nom">Nom du partenaire</label>
          <input
            id="pa-nom" className="pa-fld" value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex : Cabinet Konan & Associés"
          />
        </div>

        <div className="pa-champ">
          <label className="pa-label" htmlFor="pa-desc">
            Description <span className="pa-opt">— facultative</span>
          </label>
          <textarea
            id="pa-desc" rows={2} className="pa-fld"
            value={description} onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="pa-champ">
          <label className="pa-label" htmlFor="pa-site">
            Site web <span className="pa-opt">— facultatif</span>
          </label>
          <input
            id="pa-site" className="pa-fld" value={siteWeb}
            onChange={(e) => setSiteWeb(e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div className="pa-champ">
          <label className="pa-label" htmlFor="pa-contact">
            Contact <span className="pa-opt">— facultatif</span>
          </label>
          <input id="pa-contact" className="pa-fld" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>

        <div className="pa-champ">
          <label className="pa-label" htmlFor="pa-logo">
            Logo <span className="pa-opt">— facultatif</span>
          </label>
          {logoApercu ? (
            <div className="pa-logo-choisi">
              <img src={logoApercu} alt="Aperçu" />
              <label htmlFor="pa-logo" className="pa-logo-changer">Changer</label>
            </div>
          ) : (
            <label className="pa-drop" htmlFor="pa-logo">
              <Upload size={18} /> Choisir une image…
            </label>
          )}
          <input id="pa-logo" type="file" accept="image/*" onChange={choisirLogo} style={{ display: "none" }} />
        </div>

        <button
          className={`pa-bascule ${visibleMembres ? "is-on" : ""}`}
          onClick={() => setVisibleMembres((v) => !v)}
        >
          <span className="pa-case">{visibleMembres && <CheckCircle2 size={13} />}</span>
          <span>
            <strong>Visible par les {mot("membres").toLowerCase()}</strong>
            <em>Sinon, ce partenaire reste interne</em>
          </span>
        </button>

        {err && <div className="pa-err"><AlertCircle size={15} /> {err}</div>}

        <div className="pa-modal-actions">
          <button className="pa-mbtn pa-mbtn-ghost" onClick={onCancel} disabled={enCours}>Annuler</button>
          <button className="pa-mbtn pa-mbtn-primary" onClick={valider} disabled={enCours}>
            {enCours
              ? <><Loader2 size={16} className="pa-spin" /> Envoi…</>
              : edition ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Styles ---------------- */

const CSS = `
.pa-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .pa-wrap{ padding:${S.lg}px; } }

.pa-msg{
  display:flex; align-items:center; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
}
.pa-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.pa-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }
.pa-msg button{ margin-left:auto; background:none; border:none; cursor:pointer; color:inherit; opacity:.7; display:flex; padding:0; }

.pa-intro{
  display:flex; align-items:flex-start; gap:9px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:12px 15px;
  font-size:13px; color:${C.textMuted}; line-height:1.55;
}

.pa-tools{ display:flex; align-items:center; }
.pa-btn{
  margin-left:auto; display:flex; align-items:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.pa-btn:hover{ background:${C.primaryDark}; }

.pa-liste{
  list-style:none; margin:0; padding:0;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; overflow:hidden; box-shadow:${SHADOW.xs};
}
.pa-ligne{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border}; flex-wrap:wrap;
}
.pa-ligne:last-child{ border-bottom:none; }
.pa-ligne.is-inactif{ opacity:.55; }
.pa-icon{
  width:38px; height:38px; border-radius:${R.sm}px; flex-shrink:0;
  background:${PALETTE.blue50}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.pa-logo{ width:38px; height:38px; border-radius:${R.sm}px; object-fit:cover; flex-shrink:0; border:1px solid ${C.border}; }
.pa-ligne-corps{ flex:1; min-width:190px; }
.pa-ligne-titre{ font-size:14.5px; font-weight:600; }
.pa-ligne-desc{ font-size:13px; color:${C.textMuted}; margin-top:3px; line-height:1.5; }
.pa-ligne-meta{ display:flex; align-items:center; gap:10px; font-size:12px; color:${C.textSubtle}; margin-top:4px; }
.pa-lien-site{ display:flex; align-items:center; gap:4px; color:${C.primary}; text-decoration:none; font-weight:600; }

.pa-visi{
  flex-shrink:0; display:flex; align-items:center; gap:6px;
  background:${PALETTE.grey200}; color:${C.textMuted}; border:none;
  border-radius:${R.pill}px; padding:6px 12px; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:600;
  transition:background .16s ease, color .16s ease;
}
.pa-visi.is-on{ background:${PALETTE.blue100}; color:${C.primary}; }

.pa-ligne-actions{ display:flex; align-items:center; gap:5px; flex-shrink:0; }
.pa-toggle-actif{
  background:#DCFCE7; color:${C.success}; border:none;
  border-radius:${R.pill}px; padding:6px 12px; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:600;
}
.pa-toggle-actif.is-off{ background:${PALETTE.grey200}; color:${C.textSubtle}; }
.pa-ligne-actions button:not(.pa-toggle-actif){
  width:30px; height:30px; border-radius:${R.sm}px;
  background:${C.surface}; border:1px solid ${C.border};
  color:${C.textSubtle}; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .16s ease;
}
.pa-ligne-actions button:not(.pa-toggle-actif):hover{ border-color:${C.primary}; color:${C.primary}; }
.pa-ligne-actions button.is-danger:hover{ border-color:${C.danger}; color:${C.danger}; background:#FEE2E2; }

/* ---- Modale ---- */
.pa-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; overflow-y:auto;
}
.pa-modal{ width:100%; max-width:500px; background:${C.surface}; border-radius:${R.xxl}px; padding:${S.xl}px; box-shadow:${SHADOW.lg}; margin:auto; }
.pa-modal-court{ max-width:420px; }
.pa-modal-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; margin-bottom:${S.lg}px; }
.pa-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.pa-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:8px 0 ${S.md}px; }
.pa-close{ background:none; border:1px solid ${C.border}; border-radius:${R.sm}px; color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex; }
.pa-close:hover{ color:${C.danger}; border-color:${C.danger}; }

.pa-champ{ display:flex; flex-direction:column; gap:6px; margin-bottom:${S.md}px; }
.pa-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.pa-opt{ font-weight:400; color:${C.textSubtle}; }
.pa-fld{
  width:100%; box-sizing:border-box; padding:11px 13px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px; color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.pa-fld:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }

.pa-drop{
  display:flex; align-items:center; gap:9px;
  border:1.5px dashed ${C.border}; border-radius:${R.md}px;
  padding:14px 15px; cursor:pointer; font-size:14px; color:${C.textMuted};
}
.pa-drop:hover{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.pa-logo-choisi{ display:flex; align-items:center; gap:12px; }
.pa-logo-choisi img{ width:56px; height:56px; object-fit:cover; border-radius:${R.md}px; border:1px solid ${C.border}; }
.pa-logo-changer{ font-size:13px; font-weight:600; color:${C.primary}; cursor:pointer; }

.pa-bascule{
  display:flex; align-items:flex-start; gap:11px; width:100%;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:12px 14px; cursor:pointer;
  font-family:inherit; text-align:left; transition:all .16s ease;
  margin-bottom:${S.md}px;
}
.pa-bascule:hover{ border-color:${PALETTE.grey300}; }
.pa-bascule.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.pa-case{
  width:19px; height:19px; border-radius:5px; flex-shrink:0; margin-top:1px;
  border:2px solid ${PALETTE.grey300}; color:#fff;
  display:flex; align-items:center; justify-content:center;
}
.pa-bascule.is-on .pa-case{ background:${C.primary}; border-color:${C.primary}; }
.pa-bascule strong{ display:block; font-size:13.5px; font-weight:600; }
.pa-bascule em{ font-style:normal; font-size:12px; color:${C.textSubtle}; }

.pa-err{
  display:flex; align-items:flex-start; gap:8px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:11px 13px; font-size:13px; line-height:1.5; margin-bottom:${S.md}px;
}

.pa-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }
.pa-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.pa-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.pa-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.pa-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.pa-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.pa-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.pa-mbtn-ghost{ flex:1; background:${C.surface}; color:${C.textMuted}; border:1.5px solid ${C.border}; }
.pa-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.pa-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.pa-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.pa-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:44ch; line-height:1.6; }
.pa-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:paShim 1.4s infinite;
}
.pa-spin{ animation:paSpin 1s linear infinite; }
@keyframes paSpin{ to{ transform:rotate(360deg); } }
@keyframes paShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;