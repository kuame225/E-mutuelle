import React, { useEffect, useState } from "react";
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2, Pencil,
  Wallet, Upload, Image as ImageIcon,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { useVocabulaire } from "./useVocabulaire";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const BUCKET_QR = "qr-paiement";

const TYPES = [
  { id: "wave",         label: "Wave" },
  { id: "orange_money",  label: "Orange Money" },
  { id: "mtn_money",     label: "MTN Money" },
  { id: "moov_money",    label: "Moov Money" },
  { id: "autre",         label: "Autre" },
];

export default function MoyensPaiementPage() {
  const { params } = useParametrage();
  const { mot } = useVocabulaire();

  const [moyens, setMoyens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creation, setCreation] = useState(false);
  const [edition, setEdition] = useState(null);
  const [suppression, setSuppression] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function charger() {
    const { data, error } = await supabase
      .from("moyens_paiement")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("ordre");

    if (error) setMessage({ type: "err", texte: error.message });
    setMoyens(data || []);
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

  async function basculerActif(m) {
    setEnCours(true);
    const { error } = await supabase
      .from("moyens_paiement")
      .update({ actif: !m.actif })
      .eq("id", m.id);
    setEnCours(false);
    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    charger();
  }

  async function supprimer(m) {
    setEnCours(true);
    if (m.qr_code_chemin) {
      await supabase.storage.from(BUCKET_QR).remove([m.qr_code_chemin]);
    }
    const { error } = await supabase.from("moyens_paiement").delete().eq("id", m.id);
    setEnCours(false);
    setSuppression(null);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    notifier("Moyen de paiement retiré.");
    charger();
  }

  if (loading) {
    return (
      <div className="mp-wrap">
        <style>{CSS}</style>
        <div className="mp-skel" />
      </div>
    );
  }

  return (
    <div className="mp-wrap">
      <style>{CSS}</style>

      {message && (
        <div className={`mp-msg ${message.type === "ok" ? "is-ok" : "is-err"}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} aria-label="Fermer"><X size={15} /></button>
        </div>
      )}

      <div className="mp-intro">
        <Wallet size={16} />
        <span>
          Ces coordonnées s'affichent directement aux {mot("membres").toLowerCase()} au moment
          de payer. Sans agrément auprès d'un agrégateur, il n'y a pas de confirmation
          automatique : chaque {mot("membre_singulier").toLowerCase()} peut déclarer avoir payé,
          et {mot("bureau_le")} confirme ensuite dans « Paiements déclarés ».
        </span>
      </div>

      <SectionWave organisationId={params.organisation_id} />

      <div className="mp-tools">
        <button className="mp-btn" onClick={() => setCreation(true)}>
          <Plus size={17} /> Ajouter un moyen de paiement
        </button>
      </div>

      {moyens.length === 0 ? (
        <div className="mp-vide">
          <Wallet size={36} color={PALETTE.grey300} />
          <div className="mp-vide-titre">Aucun moyen de paiement configuré</div>
          <div className="mp-vide-sub">
            Ajoutez un lien Wave, un numéro Orange Money ou tout autre compte marchand
            utilisé {mot("organisation_de")}.
          </div>
        </div>
      ) : (
        <ul className="mp-liste">
          {moyens.map((m) => (
            <li key={m.id} className={`mp-ligne ${!m.actif ? "is-inactif" : ""}`}>
              {m.qr_code_chemin ? (
                <img
                  className="mp-qr-apercu"
                  src={supabase.storage.from(BUCKET_QR).getPublicUrl(m.qr_code_chemin).data.publicUrl}
                  alt="QR code"
                />
              ) : (
                <span className="mp-icon"><Wallet size={18} /></span>
              )}

              <div className="mp-ligne-corps">
                <div className="mp-ligne-titre">
                  {m.libelle || TYPES.find((t) => t.id === m.type)?.label || m.type}
                </div>
                <div className="mp-ligne-meta">
                  {m.lien && <span>{m.lien}</span>}
                  {m.numero && <span>{m.numero}</span>}
                  {!m.lien && !m.numero && !m.qr_code_chemin && <span>QR code ou instructions seulement</span>}
                </div>
              </div>

              <div className="mp-ligne-actions">
                <button
                  className={`mp-toggle ${m.actif ? "" : "is-off"}`}
                  onClick={() => basculerActif(m)}
                  disabled={enCours}
                >
                  {m.actif ? "Actif" : "Désactivé"}
                </button>
                <button onClick={() => setEdition(m)} title="Modifier"><Pencil size={14} /></button>
                <button className="is-danger" onClick={() => setSuppression(m)} title="Retirer">
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creation || edition) && (
        <ModalMoyen
          moyen={edition}
          organisationId={params.organisation_id}
          nbExistants={moyens.length}
          onCancel={() => { setCreation(false); setEdition(null); }}
          onDone={(texte) => { setCreation(false); setEdition(null); notifier(texte); charger(); }}
        />
      )}

      {suppression && (
        <div className="mp-overlay" onClick={() => setSuppression(null)}>
          <div className="mp-modal mp-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="mp-modal-titre">Retirer ce moyen de paiement ?</h3>
            <p className="mp-modal-texte">
              <strong>{suppression.libelle || TYPES.find((t) => t.id === suppression.type)?.label}</strong>{" "}
              ne s'affichera plus aux {mot("membres").toLowerCase()}.
            </p>
            <div className="mp-modal-actions">
              <button className="mp-mbtn mp-mbtn-ghost" onClick={() => setSuppression(null)} disabled={enCours}>
                Annuler
              </button>
              <button className="mp-mbtn mp-mbtn-danger" onClick={() => supprimer(suppression)} disabled={enCours}>
                {enCours ? <><Loader2 size={16} className="mp-spin" /> Suppression…</> : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Intégration Wave Business (automatique) ---------------- */

function SectionWave({ organisationId }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [edition, setEdition] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [environnement, setEnvironnement] = useState("sandbox");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  async function charger() {
    const { data } = await supabase
      .from("integrations_paiement")
      .select("*")
      .eq("organisation_id", organisationId)
      .eq("fournisseur", "wave")
      .maybeSingle();
    setConfig(data);
    setLoading(false);
  }

  useEffect(() => { charger(); }, [organisationId]);

  async function enregistrer() {
    if (!apiKey.trim() || !signingSecret.trim()) {
      setErreur("Indiquez la clé API et le secret de signature.");
      return;
    }
    setEnCours(true);
    setErreur("");
    const { error } = await supabase.rpc("enregistrer_integration_wave", {
      p_organisation_id: organisationId,
      p_api_key: apiKey.trim(),
      p_signing_secret: signingSecret.trim(),
      p_environnement: environnement,
    });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setApiKey(""); setSigningSecret(""); setEdition(false);
    setMessage("Intégration Wave enregistrée.");
    setTimeout(() => setMessage(""), 3000);
    charger();
  }

  async function desactiver() {
    setEnCours(true);
    await supabase.rpc("desactiver_integration_wave", { p_organisation_id: organisationId });
    setEnCours(false);
    charger();
  }

  const webhookUrl = `${supabase.supabaseUrl}/functions/v1/webhook-wave/${organisationId}`;

  function copierWebhook() {
    navigator.clipboard.writeText(webhookUrl);
    setMessage("Adresse copiée.");
    setTimeout(() => setMessage(""), 2000);
  }

  if (loading) return null;

  return (
    <div className="mp-wave">
      <div className="mp-wave-entete">
        <div>
          <div className="mp-wave-titre">Wave Business (automatique)</div>
          <div className="mp-wave-sous">
            {config?.actif
              ? `Configuré — environnement ${config.environnement === "production" ? "production" : "sandbox (test)"}`
              : "Non configuré : sans ça, les membres n'ont accès qu'à la déclaration manuelle ci-dessous."}
          </div>
        </div>
        {config?.actif ? (
          <button className="mp-wave-lien mp-wave-lien-danger" onClick={desactiver} disabled={enCours}>
            Désactiver
          </button>
        ) : (
          <button className="mp-wave-lien" onClick={() => setEdition(true)}>
            Configurer
          </button>
        )}
      </div>

      {config?.actif && !edition && (
        <div className="mp-wave-webhook">
          <span>Adresse de webhook à coller dans le tableau de bord Wave Business :</span>
          <div className="mp-wave-webhook-val">
            <code>{webhookUrl}</code>
            <button onClick={copierWebhook}>Copier</button>
          </div>
        </div>
      )}

      {message && <div className="mp-wave-msg">{message}</div>}

      {edition && (
        <div className="mp-wave-form">
          <div className="mp-champ">
            <label className="mp-label" htmlFor="wave-key">Clé API</label>
            <input
              id="wave-key" className="mp-fld" value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="wave_ci_prod_… ou wave_ci_sandbox_…"
            />
          </div>
          <div className="mp-champ">
            <label className="mp-label" htmlFor="wave-secret">Secret de signature</label>
            <input
              id="wave-secret" type="password" className="mp-fld"
              value={signingSecret} onChange={(e) => setSigningSecret(e.target.value)}
            />
          </div>
          <div className="mp-champ">
            <span className="mp-label">Environnement</span>
            <div className="mp-choix">
              <button
                className={`mp-choix-btn ${environnement === "sandbox" ? "is-on" : ""}`}
                onClick={() => setEnvironnement("sandbox")}
              >
                Sandbox (test)
              </button>
              <button
                className={`mp-choix-btn ${environnement === "production" ? "is-on" : ""}`}
                onClick={() => setEnvironnement("production")}
              >
                Production
              </button>
            </div>
          </div>
          {erreur && <div className="mp-err"><AlertCircle size={15} /> {erreur}</div>}
          <div className="mp-modal-actions">
            <button className="mp-mbtn mp-mbtn-ghost" onClick={() => setEdition(false)} disabled={enCours}>
              Annuler
            </button>
            <button className="mp-mbtn mp-mbtn-primary" onClick={enregistrer} disabled={enCours}>
              {enCours ? <><Loader2 size={16} className="mp-spin" /> Envoi…</> : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Formulaire (création / édition) ---------------- */

function ModalMoyen({ moyen, organisationId, nbExistants, onCancel, onDone }) {
  const edition = Boolean(moyen);
  const [type, setType] = useState(moyen?.type || "wave");
  const [libelle, setLibelle] = useState(moyen?.libelle || "");
  const [lien, setLien] = useState(moyen?.lien || "");
  const [numero, setNumero] = useState(moyen?.numero || "");
  const [instructions, setInstructions] = useState(moyen?.instructions || "");
  const [qrFichier, setQrFichier] = useState(null);
  const [qrApercu, setQrApercu] = useState(
    moyen?.qr_code_chemin
      ? supabase.storage.from(BUCKET_QR).getPublicUrl(moyen.qr_code_chemin).data.publicUrl
      : null
  );
  const [enCours, setEnCours] = useState(false);
  const [err, setErr] = useState("");

  function choisirQr(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { setErr("Image trop lourde (3 Mo maximum)."); return; }
    setErr("");
    setQrFichier(f);
    setQrApercu(URL.createObjectURL(f));
  }

  async function valider() {
    if (!lien.trim() && !numero.trim() && !qrFichier && !moyen?.qr_code_chemin) {
      setErr("Indiquez au moins un lien, un numéro, ou un QR code.");
      return;
    }

    setEnCours(true);
    setErr("");

    let qrChemin = moyen?.qr_code_chemin || null;

    if (qrFichier) {
      const ext = qrFichier.name.split(".").pop();
      const chemin = `${organisationId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET_QR)
        .upload(chemin, qrFichier, { contentType: qrFichier.type });

      if (upErr) { setEnCours(false); setErr("Échec du téléversement : " + upErr.message); return; }

      if (moyen?.qr_code_chemin) {
        await supabase.storage.from(BUCKET_QR).remove([moyen.qr_code_chemin]);
      }
      qrChemin = chemin;
    }

    const donnees = {
      type,
      libelle: libelle.trim() || null,
      lien: lien.trim() || null,
      numero: numero.trim() || null,
      instructions: instructions.trim() || null,
      qr_code_chemin: qrChemin,
    };

    const { error } = edition
      ? await supabase.from("moyens_paiement").update(donnees).eq("id", moyen.id)
      : await supabase.from("moyens_paiement").insert({ ...donnees, organisation_id: organisationId, ordre: nbExistants });

    setEnCours(false);

    if (error) { setErr(error.message); return; }

    onDone(edition ? "Moyen de paiement modifié." : "Moyen de paiement ajouté.");
  }

  return (
    <div className="mp-overlay" onClick={onCancel}>
      <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
        <header className="mp-modal-head">
          <h3 className="mp-modal-titre">{edition ? "Modifier" : "Nouveau moyen de paiement"}</h3>
          <button className="mp-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        <div className="mp-champ">
          <span className="mp-label">Type</span>
          <div className="mp-choix">
            {TYPES.map((t) => (
              <button
                key={t.id}
                className={`mp-choix-btn ${type === t.id ? "is-on" : ""}`}
                onClick={() => setType(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mp-champ">
          <label className="mp-label" htmlFor="mp-libelle">
            Libellé <span className="mp-opt">— facultatif</span>
          </label>
          <input
            id="mp-libelle" className="mp-fld" value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex : Trésorerie ANAPROCI"
          />
        </div>

        <div className="mp-champ">
          <label className="mp-label" htmlFor="mp-lien">
            Lien de paiement <span className="mp-opt">— facultatif</span>
          </label>
          <input
            id="mp-lien" className="mp-fld" value={lien}
            onChange={(e) => setLien(e.target.value)}
            placeholder="https://pay.wave.com/..."
          />
        </div>

        <div className="mp-champ">
          <label className="mp-label" htmlFor="mp-numero">
            Numéro marchand <span className="mp-opt">— facultatif</span>
          </label>
          <input
            id="mp-numero" className="mp-fld" value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ex : 07 00 00 00 00"
          />
        </div>

        <div className="mp-champ">
          <label className="mp-label" htmlFor="mp-qr">
            QR code <span className="mp-opt">— facultatif</span>
          </label>
          {qrApercu ? (
            <div className="mp-qr-choisi">
              <img src={qrApercu} alt="Aperçu QR" />
              <label htmlFor="mp-qr" className="mp-qr-changer">Changer</label>
            </div>
          ) : (
            <label className="mp-drop" htmlFor="mp-qr">
              <Upload size={18} /> Choisir une image…
            </label>
          )}
          <input id="mp-qr" type="file" accept="image/*" onChange={choisirQr} style={{ display: "none" }} />
        </div>

        <div className="mp-champ">
          <label className="mp-label" htmlFor="mp-instr">
            Instructions <span className="mp-opt">— facultatives</span>
          </label>
          <textarea
            id="mp-instr" rows={2} className="mp-fld" value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Ex : Composez #144# puis suivez les instructions."
          />
        </div>

        {err && <div className="mp-err"><AlertCircle size={15} /> {err}</div>}

        <div className="mp-modal-actions">
          <button className="mp-mbtn mp-mbtn-ghost" onClick={onCancel} disabled={enCours}>Annuler</button>
          <button className="mp-mbtn mp-mbtn-primary" onClick={valider} disabled={enCours}>
            {enCours
              ? <><Loader2 size={16} className="mp-spin" /> Envoi…</>
              : edition ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Styles ---------------- */

const CSS = `
.mp-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .mp-wrap{ padding:${S.lg}px; } }

.mp-msg{
  display:flex; align-items:center; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
}
.mp-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.mp-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }
.mp-msg button{ margin-left:auto; background:none; border:none; cursor:pointer; color:inherit; opacity:.7; display:flex; padding:0; }

.mp-intro{
  display:flex; align-items:flex-start; gap:9px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:12px 15px;
  font-size:13px; color:${C.textMuted}; line-height:1.55;
}

/* ---- Intégration Wave ---- */
.mp-wave{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.mp-wave-entete{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; }
.mp-wave-titre{ font-size:15px; font-weight:700; }
.mp-wave-sous{ font-size:12.5px; color:${C.textSubtle}; margin-top:3px; }
.mp-wave-lien{
  flex-shrink:0; background:none; border:1.5px solid ${C.primary}; color:${C.primary};
  border-radius:${R.pill}px; padding:7px 14px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600;
}
.mp-wave-lien-danger{ border-color:${C.danger}; color:${C.danger}; }
.mp-wave-webhook{
  margin-top:${S.md}px; background:${C.bg}; border-radius:${R.md}px; padding:11px 14px;
  font-size:12px; color:${C.textMuted};
}
.mp-wave-webhook-val{ display:flex; align-items:center; gap:8px; margin-top:6px; }
.mp-wave-webhook-val code{
  flex:1; font-size:11.5px; background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.sm}px; padding:6px 9px; overflow-x:auto; white-space:nowrap;
}
.mp-wave-webhook-val button{
  flex-shrink:0; background:${C.primary}; color:#fff; border:none;
  border-radius:${R.sm}px; padding:6px 11px; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:600;
}
.mp-wave-msg{ font-size:12.5px; color:${C.success}; margin-top:8px; font-weight:600; }
.mp-wave-form{ margin-top:${S.md}px; padding-top:${S.md}px; border-top:1px solid ${C.border}; }

.mp-tools{ display:flex; align-items:center; }
.mp-btn{
  margin-left:auto; display:flex; align-items:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.mp-btn:hover{ background:${C.primaryDark}; }

.mp-liste{
  list-style:none; margin:0; padding:0;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; overflow:hidden; box-shadow:${SHADOW.xs};
}
.mp-ligne{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border}; flex-wrap:wrap;
}
.mp-ligne:last-child{ border-bottom:none; }
.mp-ligne.is-inactif{ opacity:.55; }
.mp-icon{
  width:38px; height:38px; border-radius:${R.sm}px; flex-shrink:0;
  background:${PALETTE.blue50}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.mp-qr-apercu{ width:38px; height:38px; border-radius:${R.sm}px; object-fit:cover; flex-shrink:0; border:1px solid ${C.border}; }
.mp-ligne-corps{ flex:1; min-width:180px; }
.mp-ligne-titre{ font-size:14.5px; font-weight:600; }
.mp-ligne-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; display:flex; gap:8px; flex-wrap:wrap; }

.mp-ligne-actions{ display:flex; align-items:center; gap:5px; flex-shrink:0; }
.mp-toggle{
  background:#DCFCE7; color:${C.success}; border:none;
  border-radius:${R.pill}px; padding:6px 12px; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:600;
}
.mp-toggle.is-off{ background:${PALETTE.grey200}; color:${C.textSubtle}; }
.mp-ligne-actions button:not(.mp-toggle){
  width:30px; height:30px; border-radius:${R.sm}px;
  background:${C.surface}; border:1px solid ${C.border};
  color:${C.textSubtle}; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .16s ease;
}
.mp-ligne-actions button:not(.mp-toggle):hover{ border-color:${C.primary}; color:${C.primary}; }
.mp-ligne-actions button.is-danger:hover{ border-color:${C.danger}; color:${C.danger}; background:#FEE2E2; }

/* ---- Modale ---- */
.mp-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; overflow-y:auto;
}
.mp-modal{ width:100%; max-width:480px; background:${C.surface}; border-radius:${R.xxl}px; padding:${S.xl}px; box-shadow:${SHADOW.lg}; margin:auto; }
.mp-modal-court{ max-width:420px; }
.mp-modal-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; margin-bottom:${S.lg}px; }
.mp-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.mp-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:8px 0 ${S.md}px; }
.mp-close{ background:none; border:1px solid ${C.border}; border-radius:${R.sm}px; color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex; }
.mp-close:hover{ color:${C.danger}; border-color:${C.danger}; }

.mp-champ{ display:flex; flex-direction:column; gap:6px; margin-bottom:${S.md}px; }
.mp-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.mp-opt{ font-weight:400; color:${C.textSubtle}; }
.mp-fld{
  width:100%; box-sizing:border-box; padding:11px 13px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px; color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.mp-fld:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }

.mp-choix{ display:flex; flex-wrap:wrap; gap:${S.sm}px; }
.mp-choix-btn{
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.pill}px; padding:7px 13px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600; color:${C.textMuted};
  transition:all .16s ease;
}
.mp-choix-btn.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; color:${C.primary}; }

.mp-drop{
  display:flex; align-items:center; gap:9px;
  border:1.5px dashed ${C.border}; border-radius:${R.md}px;
  padding:14px 15px; cursor:pointer; font-size:14px; color:${C.textMuted};
}
.mp-drop:hover{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.mp-qr-choisi{ display:flex; align-items:center; gap:12px; }
.mp-qr-choisi img{ width:64px; height:64px; object-fit:cover; border-radius:${R.md}px; border:1px solid ${C.border}; }
.mp-qr-changer{
  font-size:13px; font-weight:600; color:${C.primary}; cursor:pointer;
}

.mp-err{
  display:flex; align-items:flex-start; gap:8px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:11px 13px; font-size:13px; line-height:1.5; margin-bottom:${S.md}px;
}

.mp-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }
.mp-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.mp-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.mp-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.mp-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.mp-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.mp-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.mp-mbtn-ghost{ flex:1; background:${C.surface}; color:${C.textMuted}; border:1.5px solid ${C.border}; }
.mp-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.mp-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.mp-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.mp-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:44ch; line-height:1.6; }
.mp-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:mpShim 1.4s infinite;
}
.mp-spin{ animation:mpSpin 1s linear infinite; }
@keyframes mpSpin{ to{ transform:rotate(360deg); } }
@keyframes mpShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;