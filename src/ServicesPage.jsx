import React, { useEffect, useState } from "react";
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2,
  Briefcase, Eye, EyeOff, Pencil,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { useVocabulaire } from "./useVocabulaire";
import { C, R, S, SHADOW, PALETTE } from "./theme";

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function ServicesPage() {
  const { params } = useParametrage();
  const { mot } = useVocabulaire();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creation, setCreation] = useState(false);
  const [edition, setEdition] = useState(null);
  const [suppression, setSuppression] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function charger() {
    const { data, error } = await supabase
      .from("services_offerts")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("created_at", { ascending: false });

    if (error) setMessage({ type: "err", texte: error.message });
    setServices(data || []);
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

  async function basculerVisibilite(s) {
    setEnCours(true);
    const { error } = await supabase
      .from("services_offerts")
      .update({ visible_membres: !s.visible_membres })
      .eq("id", s.id);
    setEnCours(false);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    charger();
  }

  async function basculerActif(s) {
    setEnCours(true);
    const { error } = await supabase
      .from("services_offerts")
      .update({ actif: !s.actif })
      .eq("id", s.id);
    setEnCours(false);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    charger();
  }

  async function supprimer(s) {
    setEnCours(true);
    const { error } = await supabase.from("services_offerts").delete().eq("id", s.id);
    setEnCours(false);
    setSuppression(null);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    notifier("Service retiré.");
    charger();
  }

  if (loading) {
    return (
      <div className="sv-wrap">
        <style>{CSS}</style>
        <div className="sv-skel" /><div className="sv-skel" />
      </div>
    );
  }

  return (
    <div className="sv-wrap">
      <style>{CSS}</style>

      {message && (
        <div className={`sv-msg ${message.type === "ok" ? "is-ok" : "is-err"}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} aria-label="Fermer"><X size={15} /></button>
        </div>
      )}

      <div className="sv-intro">
        <Briefcase size={16} />
        <span>
          Les services marqués « visible {mot("membres").toLowerCase()} » apparaissent dans
          l'espace personnel de chaque {mot("membre_singulier").toLowerCase()}. Un service
          désactivé reste visible dans son historique mais n'apparaît plus comme offert.
        </span>
      </div>

      <div className="sv-tools">
        <button className="sv-btn" onClick={() => setCreation(true)}>
          <Plus size={17} /> Ajouter un service
        </button>
      </div>

      {services.length === 0 ? (
        <div className="sv-vide">
          <Briefcase size={36} color={PALETTE.grey300} />
          <div className="sv-vide-titre">Aucun service</div>
          <div className="sv-vide-sub">
            Ajoutez les services proposés {mot("organisation_de")}.
          </div>
        </div>
      ) : (
        <ul className="sv-liste">
          {services.map((s) => (
            <li key={s.id} className={`sv-ligne ${!s.actif ? "is-inactif" : ""}`}>
              <div className="sv-ligne-corps">
                <div className="sv-ligne-titre">{s.nom}</div>
                {s.description && <div className="sv-ligne-desc">{s.description}</div>}
                {s.tarif != null && <div className="sv-ligne-tarif">{montant(s.tarif)} FCFA</div>}
              </div>

              <button
                className={`sv-visi ${s.visible_membres ? "is-on" : ""}`}
                onClick={() => basculerVisibilite(s)}
                disabled={enCours}
                title={s.visible_membres
                  ? `Visible par les ${mot("membres").toLowerCase()}`
                  : "Interne"}
              >
                {s.visible_membres ? <Eye size={14} /> : <EyeOff size={14} />}
                {s.visible_membres ? mot("membres") : "Interne"}
              </button>

              <div className="sv-ligne-actions">
                <button
                  className={`sv-toggle-actif ${s.actif ? "" : "is-off"}`}
                  onClick={() => basculerActif(s)}
                  disabled={enCours}
                >
                  {s.actif ? "Actif" : "Désactivé"}
                </button>
                <button onClick={() => setEdition(s)} title="Modifier">
                  <Pencil size={14} />
                </button>
                <button className="is-danger" onClick={() => setSuppression(s)} title="Retirer">
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creation || edition) && (
        <ModalService
          service={edition}
          organisationId={params.organisation_id}
          onCancel={() => { setCreation(false); setEdition(null); }}
          onDone={(texte) => { setCreation(false); setEdition(null); notifier(texte); charger(); }}
        />
      )}

      {suppression && (
        <div className="sv-overlay" onClick={() => setSuppression(null)}>
          <div className="sv-modal sv-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="sv-modal-titre">Retirer ce service ?</h3>
            <p className="sv-modal-texte">
              <strong>{suppression.nom}</strong> sera définitivement supprimé.
            </p>
            <div className="sv-modal-actions">
              <button className="sv-mbtn sv-mbtn-ghost" onClick={() => setSuppression(null)} disabled={enCours}>
                Annuler
              </button>
              <button className="sv-mbtn sv-mbtn-danger" onClick={() => supprimer(suppression)} disabled={enCours}>
                {enCours ? <><Loader2 size={16} className="sv-spin" /> Suppression…</> : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Formulaire (création / édition) ---------------- */

function ModalService({ service, organisationId, onCancel, onDone }) {
  const { mot } = useVocabulaire();
  const edition = Boolean(service);
  const [nom, setNom] = useState(service?.nom || "");
  const [description, setDescription] = useState(service?.description || "");
  const [tarif, setTarif] = useState(service?.tarif != null ? String(service.tarif) : "");
  const [visibleMembres, setVisibleMembres] = useState(service?.visible_membres || false);
  const [enCours, setEnCours] = useState(false);
  const [err, setErr] = useState("");

  async function valider() {
    if (!nom.trim()) { setErr("Indiquez le nom du service."); return; }

    setEnCours(true);
    setErr("");

    const donnees = {
      nom: nom.trim(),
      description: description.trim() || null,
      tarif: tarif ? parseInt(tarif, 10) : null,
      visible_membres: visibleMembres,
    };

    const { error } = edition
      ? await supabase.from("services_offerts").update(donnees).eq("id", service.id)
      : await supabase.from("services_offerts").insert({ ...donnees, organisation_id: organisationId });

    setEnCours(false);

    if (error) { setErr(error.message); return; }

    onDone(edition ? "Service modifié." : "Service ajouté.");
  }

  return (
    <div className="sv-overlay" onClick={onCancel}>
      <div className="sv-modal" onClick={(e) => e.stopPropagation()}>
        <header className="sv-modal-head">
          <h3 className="sv-modal-titre">{edition ? "Modifier le service" : "Nouveau service"}</h3>
          <button className="sv-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        <div className="sv-champ">
          <label className="sv-label" htmlFor="sv-nom">Nom du service</label>
          <input
            id="sv-nom" className="sv-fld" value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex : Accompagnement juridique"
          />
        </div>

        <div className="sv-champ">
          <label className="sv-label" htmlFor="sv-desc">
            Description <span className="sv-opt">— facultative</span>
          </label>
          <textarea
            id="sv-desc" rows={2} className="sv-fld"
            value={description} onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="sv-champ">
          <label className="sv-label" htmlFor="sv-tarif">
            Tarif <span className="sv-opt">— facultatif, laissez vide si inclus dans l'adhésion</span>
          </label>
          <div className="sv-fld-devise">
            <input
              id="sv-tarif" type="number" min="0" className="sv-fld"
              value={tarif} onChange={(e) => setTarif(e.target.value)}
            />
            <span>FCFA</span>
          </div>
        </div>

        <button
          className={`sv-bascule ${visibleMembres ? "is-on" : ""}`}
          onClick={() => setVisibleMembres((v) => !v)}
        >
          <span className="sv-case">{visibleMembres && <CheckCircle2 size={13} />}</span>
          <span>
            <strong>Visible par les {mot("membres").toLowerCase()}</strong>
            <em>Sinon, ce service reste interne</em>
          </span>
        </button>

        {err && <div className="sv-err"><AlertCircle size={15} /> {err}</div>}

        <div className="sv-modal-actions">
          <button className="sv-mbtn sv-mbtn-ghost" onClick={onCancel} disabled={enCours}>Annuler</button>
          <button className="sv-mbtn sv-mbtn-primary" onClick={valider} disabled={enCours}>
            {enCours
              ? <><Loader2 size={16} className="sv-spin" /> Envoi…</>
              : edition ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Styles ---------------- */

const CSS = `
.sv-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .sv-wrap{ padding:${S.lg}px; } }

.sv-msg{
  display:flex; align-items:center; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
}
.sv-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.sv-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }
.sv-msg button{ margin-left:auto; background:none; border:none; cursor:pointer; color:inherit; opacity:.7; display:flex; padding:0; }

.sv-intro{
  display:flex; align-items:flex-start; gap:9px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:12px 15px;
  font-size:13px; color:${C.textMuted}; line-height:1.55;
}

.sv-tools{ display:flex; align-items:center; }
.sv-btn{
  margin-left:auto; display:flex; align-items:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.sv-btn:hover{ background:${C.primaryDark}; }

.sv-liste{
  list-style:none; margin:0; padding:0;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; overflow:hidden; box-shadow:${SHADOW.xs};
}
.sv-ligne{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border};
  flex-wrap:wrap;
}
.sv-ligne:last-child{ border-bottom:none; }
.sv-ligne.is-inactif{ opacity:.55; }
.sv-ligne-corps{ flex:1; min-width:190px; }
.sv-ligne-titre{ font-size:14.5px; font-weight:600; }
.sv-ligne-desc{ font-size:13px; color:${C.textMuted}; margin-top:3px; line-height:1.5; }
.sv-ligne-tarif{ font-size:12.5px; color:${C.textSubtle}; margin-top:3px; font-weight:600; }

.sv-visi{
  flex-shrink:0; display:flex; align-items:center; gap:6px;
  background:${PALETTE.grey200}; color:${C.textMuted}; border:none;
  border-radius:${R.pill}px; padding:6px 12px; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:600;
  transition:background .16s ease, color .16s ease;
}
.sv-visi.is-on{ background:${PALETTE.blue100}; color:${C.primary}; }

.sv-ligne-actions{ display:flex; align-items:center; gap:5px; flex-shrink:0; }
.sv-toggle-actif{
  background:#DCFCE7; color:${C.success}; border:none;
  border-radius:${R.pill}px; padding:6px 12px; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:600;
}
.sv-toggle-actif.is-off{ background:${PALETTE.grey200}; color:${C.textSubtle}; }
.sv-ligne-actions button:not(.sv-toggle-actif){
  width:30px; height:30px; border-radius:${R.sm}px;
  background:${C.surface}; border:1px solid ${C.border};
  color:${C.textSubtle}; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .16s ease;
}
.sv-ligne-actions button:not(.sv-toggle-actif):hover{ border-color:${C.primary}; color:${C.primary}; }
.sv-ligne-actions button.is-danger:hover{ border-color:${C.danger}; color:${C.danger}; background:#FEE2E2; }

/* ---- Modale ---- */
.sv-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; overflow-y:auto;
}
.sv-modal{ width:100%; max-width:500px; background:${C.surface}; border-radius:${R.xxl}px; padding:${S.xl}px; box-shadow:${SHADOW.lg}; margin:auto; }
.sv-modal-court{ max-width:420px; }
.sv-modal-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; margin-bottom:${S.lg}px; }
.sv-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.sv-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:8px 0 ${S.md}px; }
.sv-close{ background:none; border:1px solid ${C.border}; border-radius:${R.sm}px; color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex; }
.sv-close:hover{ color:${C.danger}; border-color:${C.danger}; }

.sv-champ{ display:flex; flex-direction:column; gap:6px; margin-bottom:${S.md}px; }
.sv-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.sv-opt{ font-weight:400; color:${C.textSubtle}; }
.sv-fld{
  width:100%; box-sizing:border-box; padding:11px 13px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px; color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.sv-fld:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.sv-fld-devise{ display:flex; align-items:center; gap:8px; }
.sv-fld-devise span{ font-size:13px; color:${C.textSubtle}; flex-shrink:0; }

.sv-bascule{
  display:flex; align-items:flex-start; gap:11px; width:100%;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:12px 14px; cursor:pointer;
  font-family:inherit; text-align:left; transition:all .16s ease;
  margin-bottom:${S.md}px;
}
.sv-bascule:hover{ border-color:${PALETTE.grey300}; }
.sv-bascule.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.sv-case{
  width:19px; height:19px; border-radius:5px; flex-shrink:0; margin-top:1px;
  border:2px solid ${PALETTE.grey300}; color:#fff;
  display:flex; align-items:center; justify-content:center;
}
.sv-bascule.is-on .sv-case{ background:${C.primary}; border-color:${C.primary}; }
.sv-bascule strong{ display:block; font-size:13.5px; font-weight:600; }
.sv-bascule em{ font-style:normal; font-size:12px; color:${C.textSubtle}; }

.sv-err{
  display:flex; align-items:flex-start; gap:8px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:11px 13px; font-size:13px; line-height:1.5; margin-bottom:${S.md}px;
}

.sv-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }
.sv-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.sv-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.sv-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.sv-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.sv-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.sv-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.sv-mbtn-ghost{ flex:1; background:${C.surface}; color:${C.textMuted}; border:1.5px solid ${C.border}; }
.sv-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.sv-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.sv-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.sv-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:44ch; line-height:1.6; }
.sv-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:svShim 1.4s infinite;
}
.sv-spin{ animation:svSpin 1s linear infinite; }
@keyframes svSpin{ to{ transform:rotate(360deg); } }
@keyframes svShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;