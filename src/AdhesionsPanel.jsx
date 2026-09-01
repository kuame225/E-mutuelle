import React, { useEffect, useState } from "react";
import {
  FileCheck2, Check, X, Loader2, Mail, Phone, Briefcase,
  Clock, CheckCircle2, XCircle, AlertTriangle, Inbox,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const ONGLETS = [
  { id: "en_attente", label: "En attente", Icon: Clock },
  { id: "validee",    label: "Validées",   Icon: CheckCircle2 },
  { id: "rejetee",    label: "Rejetées",   Icon: XCircle },
];

export default function AdhesionsPanel() {
  const { params } = useParametrage();
  const [demandes, setDemandes] = useState([]);
  const [onglet, setOnglet] = useState("en_attente");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);
  const [rejet, setRejet] = useState(null);

  async function charger() {
    setLoading(true);
    const { data, error } = await supabase
      .from("adhesions")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("created_at", { ascending: false });
    if (error) console.error("[AdhesionsPanel] chargement échoué :", error);
    setDemandes(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  async function valider(demande) {
    setBusy(demande.id);
    setMessage(null);

    const { error } = await supabase.rpc("valider_adhesion", {
      adhesion_id: demande.id,
    });

    if (error) {
      setBusy(null);
      setMessage({ type: "err", texte: error.message });
      return;
    }

    // Invitation par e-mail pour créer l'accès
    if (demande.email) {
      await supabase.auth.signInWithOtp({
        email: demande.email,
        options: { shouldCreateUser: true },
      });
    }

    setBusy(null);
    setMessage({
      type: "ok",
      texte: demande.email
        ? `${demande.nom} est désormais membre. Un lien de connexion lui a été envoyé.`
        : `${demande.nom} est désormais membre. Aucune adresse e-mail : son accès devra être créé manuellement.`,
    });
    charger();
  }

  async function confirmerRejet(motif) {
    const demande = rejet;
    setBusy(demande.id);
    setRejet(null);

    const { error } = await supabase
      .from("adhesions")
      .update({
        statut: "rejetee",
        motif_rejet: motif,
        decide_le: new Date().toISOString(),
      })
      .eq("id", demande.id);

    setBusy(null);
    if (error) {
      setMessage({ type: "err", texte: error.message });
      return;
    }
    setMessage({ type: "ok", texte: `La demande de ${demande.nom} a été rejetée.` });
    charger();
  }

  const visibles = demandes.filter((d) => d.statut === onglet);
  const compte = (id) => demandes.filter((d) => d.statut === id).length;

  if (loading) {
    return (
      <div className="ad-wrap">
        <style>{CSS}</style>
        <div className="ad-skel" /><div className="ad-skel" />
      </div>
    );
  }

  return (
    <div className="ad-wrap">
      <style>{CSS}</style>

      {/* ---- Onglets ---- */}
      <nav className="ad-tabs">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            className={`ad-tab ${onglet === o.id ? "is-on" : ""}`}
            onClick={() => setOnglet(o.id)}
          >
            <o.Icon size={16} />
            {o.label}
            <span className="ad-tab-count">{compte(o.id)}</span>
          </button>
        ))}
      </nav>

      {message && (
        <div className={`ad-msg ${message.type === "ok" ? "is-ok" : "is-err"}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} aria-label="Fermer"><X size={15} /></button>
        </div>
      )}

      {/* ---- Liste ---- */}
      {visibles.length === 0 ? (
        <div className="ad-empty">
          <Inbox size={38} color={PALETTE.grey300} />
          <div className="ad-empty-title">
            {onglet === "en_attente" && "Aucune demande en attente"}
            {onglet === "validee" && "Aucune adhésion validée"}
            {onglet === "rejetee" && "Aucune demande rejetée"}
          </div>
          <div className="ad-empty-sub">
            {onglet === "en_attente"
              ? "Les nouvelles demandes d'adhésion apparaîtront ici."
              : "L'historique se remplira au fil des décisions du Bureau."}
          </div>
        </div>
      ) : (
        <ul className="ad-list">
          {visibles.map((d) => (
            <li key={d.id} className="ad-card">
              <div className="ad-card-head">
                <span className="ad-icon"><FileCheck2 size={19} /></span>
                <div className="ad-identite">
                  <div className="ad-nom">{d.nom}</div>
                  <div className="ad-date">
                    Demande du {new Date(d.created_at).toLocaleDateString("fr-FR")}
                    {d.is_migration && <span className="ad-tag">Migration</span>}
                  </div>
                </div>

                {d.statut !== "en_attente" && (
                  <span
                    className="ad-statut"
                    style={{
                      background: d.statut === "validee" ? "#DCFCE7" : "#FEE2E2",
                      color: d.statut === "validee" ? C.success : C.danger,
                    }}
                  >
                    {d.statut === "validee" ? "Validée" : "Rejetée"}
                  </span>
                )}
              </div>

              <dl className="ad-infos">
                {d.poste && <Info Icon={Briefcase} label="Profession ou activité" value={d.poste} />}
                {d.service && <Info Icon={Briefcase} label="Précision" value={d.service} />}
                <Info Icon={Phone} label="Téléphone" value={d.telephone} />
                <Info
                  Icon={Mail}
                  label="Adresse e-mail"
                  value={d.email || "Non renseignée"}
                  alerte={!d.email}
                />
              </dl>

              {!d.email && d.statut === "en_attente" && (
                <div className="ad-warn">
                  <AlertTriangle size={15} />
                  <span>
                    Sans adresse e-mail, ce membre ne recevra pas de lien de connexion
                    et ne pourra pas accéder à son espace.
                  </span>
                </div>
              )}

              {d.motif_rejet && (
                <div className="ad-motif">
                  <strong>Motif du rejet :</strong> {d.motif_rejet}
                </div>
              )}

              {d.statut === "en_attente" && (
                <div className="ad-actions">
                  <button
                    className="ad-btn ad-btn-ok"
                    onClick={() => valider(d)}
                    disabled={busy === d.id}
                  >
                    {busy === d.id
                      ? <><Loader2 size={15} className="ad-spin" /> Traitement…</>
                      : <><Check size={15} /> Valider l'adhésion</>}
                  </button>
                  <button
                    className="ad-btn ad-btn-no"
                    onClick={() => setRejet(d)}
                    disabled={busy === d.id}
                  >
                    <X size={15} /> Rejeter
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {rejet && (
        <ModalRejet
          demande={rejet}
          onCancel={() => setRejet(null)}
          onConfirm={confirmerRejet}
        />
      )}
    </div>
  );
}

/* ---------------- Modale de rejet ---------------- */

function ModalRejet({ demande, onCancel, onConfirm }) {
  const [motif, setMotif] = useState("");

  return (
    <div className="ad-overlay" onClick={onCancel}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="ad-modal-titre">Rejeter la demande</h3>
        <p className="ad-modal-sub">
          Le motif sera conservé dans l'historique et pourra être communiqué à
          <strong> {demande.nom}</strong>.
        </p>

        <label className="ad-label" htmlFor="motif">Motif du rejet</label>
        <textarea
          id="motif"
          rows={4}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Ex : informations incomplètes, agent non rattaché à l'établissement…"
          className="ad-textarea"
        />

        <div className="ad-modal-actions">
          <button className="ad-btn ad-btn-ghost" onClick={onCancel}>
            Annuler
          </button>
          <button
            className="ad-btn ad-btn-no ad-btn-solid"
            onClick={() => onConfirm(motif.trim() || "Non précisé")}
          >
            Confirmer le rejet
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Sous-composant ---------------- */

function Info({ Icon, label, value, alerte }) {
  return (
    <div className="ad-info">
      <span className="ad-info-icon" style={alerte ? { background: "#FEE2E2", color: C.danger } : {}}>
        <Icon size={15} />
      </span>
      <div>
        <dt>{label}</dt>
        <dd style={alerte ? { color: C.danger } : {}}>{value || "—"}</dd>
      </div>
    </div>
  );
}

/* ---------------- Styles ---------------- */

const CSS = `
.ad-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .ad-wrap{ padding:${S.lg}px; } }

/* ---- Onglets ---- */
.ad-tabs{
  display:flex; gap:${S.xs}px; background:${C.bg};
  padding:4px; border-radius:${R.md}px; align-self:flex-start; flex-wrap:wrap;
}
.ad-tab{
  display:flex; align-items:center; gap:7px;
  border:none; background:transparent; cursor:pointer;
  padding:10px 16px; border-radius:${R.sm}px;
  font-family:inherit; font-size:13.5px; font-weight:600; color:${C.textSubtle};
  transition:all .16s ease;
}
.ad-tab:hover{ color:${C.primary}; }
.ad-tab.is-on{ background:${C.surface}; color:${C.primary}; box-shadow:${SHADOW.xs}; }
.ad-tab-count{
  background:${PALETTE.grey200}; color:${C.textMuted};
  border-radius:${R.pill}px; padding:1px 7px; font-size:11.5px; font-weight:700;
}
.ad-tab.is-on .ad-tab-count{ background:${PALETTE.blue100}; color:${C.primary}; }

/* ---- Message ---- */
.ad-msg{
  display:flex; align-items:flex-start; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px; line-height:1.5;
  animation:adIn .2s ease;
}
.ad-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.ad-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }
.ad-msg button{
  margin-left:auto; background:none; border:none; cursor:pointer;
  color:inherit; opacity:.7; padding:0; display:flex; flex-shrink:0;
}

/* ---- Cartes ---- */
.ad-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:${S.md}px; }
.ad-card{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.ad-card-head{ display:flex; align-items:center; gap:${S.md}px; }
.ad-icon{
  width:42px; height:42px; border-radius:${R.md}px; flex-shrink:0;
  background:${PALETTE.blue50}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.ad-identite{ flex:1; min-width:0; }
.ad-nom{ font-size:16px; font-weight:700; letter-spacing:-.01em; }
.ad-date{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ad-tag{
  background:${PALETTE.blue100}; color:${C.primary};
  padding:2px 8px; border-radius:${R.pill}px; font-size:11px; font-weight:600;
}
.ad-statut{
  flex-shrink:0; padding:6px 13px; border-radius:${R.pill}px;
  font-size:12.5px; font-weight:600;
}

/* ---- Informations ---- */
.ad-infos{
  display:grid; gap:${S.md}px; margin:${S.lg}px 0 0; padding:0;
  grid-template-columns:1fr;
}
@media (min-width:560px){ .ad-infos{ grid-template-columns:1fr 1fr; } }
.ad-info{ display:flex; align-items:flex-start; gap:${S.md}px; }
.ad-info-icon{
  width:32px; height:32px; border-radius:${R.sm}px; flex-shrink:0;
  background:${C.bg}; color:${C.textMuted};
  display:flex; align-items:center; justify-content:center;
}
.ad-info dt{ font-size:11.5px; color:${C.textSubtle}; }
.ad-info dd{ font-size:14px; font-weight:600; margin:2px 0 0; word-break:break-word; }

.ad-justif{
  display:flex; align-items:center; gap:8px; margin-top:${S.md}px;
  font-size:13px; color:${C.textMuted};
}
.ad-warn{
  display:flex; align-items:flex-start; gap:9px; margin-top:${S.md}px;
  background:#FEF3C7; color:#B45309; border-radius:${R.md}px;
  padding:11px 13px; font-size:13px; line-height:1.5;
}
.ad-motif{
  margin-top:${S.md}px; background:${C.bg}; border-radius:${R.md}px;
  padding:11px 14px; font-size:13.5px; color:${C.textMuted}; line-height:1.5;
}

/* ---- Actions ---- */
.ad-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; flex-wrap:wrap; }
.ad-btn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:12px 20px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; border:none;
  transition:background .18s ease, border-color .18s ease;
}
.ad-btn:disabled{ opacity:.6; cursor:not-allowed; }
.ad-btn-ok{ background:${C.success}; color:#fff; box-shadow:${SHADOW.sm}; flex:1; }
.ad-btn-ok:hover:not(:disabled){ background:#166534; }
.ad-btn-no{
  background:${C.surface}; color:${C.danger}; border:1.5px solid ${C.danger}44;
}
.ad-btn-no:hover:not(:disabled){ background:#FEE2E2; border-color:${C.danger}; }
.ad-btn-solid{ background:${C.danger}; color:#fff; border-color:${C.danger}; }
.ad-btn-solid:hover{ background:#B91C1C; }
.ad-btn-ghost{ background:${C.surface}; color:${C.textMuted}; border:1.5px solid ${C.border}; }
.ad-btn-ghost:hover{ border-color:${PALETTE.grey300}; }

/* ---- Modale ---- */
.ad-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center; padding:${S.lg}px;
  animation:adFade .18s ease;
}
.ad-modal{
  width:100%; max-width:460px; background:${C.surface};
  border-radius:${R.xxl}px; padding:${S.xl}px; box-shadow:${SHADOW.lg};
  animation:adUp .22s cubic-bezier(.4,0,.2,1);
}
.ad-modal-titre{ font-size:19px; font-weight:700; margin:0 0 6px; letter-spacing:-.01em; }
.ad-modal-sub{ font-size:14px; color:${C.textSubtle}; margin:0 0 ${S.lg}px; line-height:1.55; }
.ad-label{ display:block; font-size:13.5px; font-weight:600; color:${C.textMuted}; margin-bottom:7px; }
.ad-textarea{
  width:100%; box-sizing:border-box; padding:13px 15px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px;
  color:${C.text}; outline:none; resize:vertical; line-height:1.55;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.ad-textarea:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.ad-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }
.ad-modal-actions .ad-btn{ flex:1; }

/* ---- Divers ---- */
.ad-empty{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.ad-empty-title{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.ad-empty-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:40ch; line-height:1.55; }
.ad-skel{
  height:150px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:adShim 1.4s infinite;
}
.ad-spin{ animation:adSpin 1s linear infinite; }
@keyframes adSpin{ to{ transform:rotate(360deg); } }
@keyframes adShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
@keyframes adFade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes adUp{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
@keyframes adIn{ from{ opacity:0; transform:translateY(-4px); } to{ opacity:1; transform:none; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;