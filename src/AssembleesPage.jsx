import React, { useEffect, useState } from "react";
import {
  Users, Plus, X, Loader2, Calendar, MapPin, ClipboardList,
  QrCode, CheckCircle2, Circle, FileText, Upload, Copy, Check,
  ChevronLeft, AlertCircle, ShieldCheck,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { diffuserCommunique } from "./notifier";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const STATUTS = {
  planifiee: { label: "Planifiée", color: C.textMuted, soft: "#EEF1F5" },
  convoquee: { label: "Convoquée", color: C.primary, soft: PALETTE.blue100 },
  cloturee:  { label: "Clôturée",  color: C.success,  soft: "#DCFCE7" },
};

const VIDE = { titre: "", date_prevue: "", lieu: "", ordre_du_jour: "", quorum_requis_pct: 50 };

export default function AssembleesPage() {
  const { params } = useParametrage();
  const [assemblees, setAssemblees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(VIDE);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from("assemblees")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("date_prevue", { ascending: false });
    setAssemblees(data || []);
    setLoading(false);
    // Garder la fiche ouverte synchronisée après une action
    if (selected) {
      const maj = (data || []).find((a) => a.id === selected.id);
      if (maj) setSelected(maj);
    }
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  async function creer() {
    if (!form.titre.trim()) { setErreur("Le titre est obligatoire."); return; }
    if (!form.date_prevue) { setErreur("La date est obligatoire."); return; }

    setEnvoi(true);
    setErreur("");

    const { error } = await supabase.from("assemblees").insert({
      organisation_id: params.organisation_id,
      titre: form.titre.trim(),
      date_prevue: form.date_prevue,
      lieu: form.lieu.trim() || null,
      ordre_du_jour: form.ordre_du_jour.trim() || null,
      quorum_requis_pct: form.quorum_requis_pct,
    });

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }

    // Convocation aux membres. Un échec d'envoi ne remet pas en cause
    // la création de l'assemblée elle-même.
    diffuserCommunique({
      cible: "tous",
      titre: `Convocation — ${form.titre.trim()}`,
      message: `Vous êtes convoqué(e) le ${new Date(form.date_prevue).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}${form.lieu.trim() ? ` à ${form.lieu.trim()}` : ""}.`,
      organisationId: params.organisation_id,
    });

    setModal(false);
    setForm(VIDE);
    charger();
  }

  if (loading) {
    return (
      <div className="ag-wrap">
        <style>{CSS}</style>
        <div className="ag-sk" />
        <div className="ag-sk" />
      </div>
    );
  }

  if (selected) {
    return (
      <FicheAssemblee
        assemblee={selected}
        onBack={() => setSelected(null)}
        onRefresh={charger}
      />
    );
  }

  return (
    <div className="ag-wrap">
      <style>{CSS}</style>

      <header className="ag-head">
        <div>
          <h1 className="ag-titre"><Users size={20} /> Assemblées générales</h1>
          <p className="ag-sous">Convocation, émargement et procès-verbal</p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}>
          <Plus size={16} /> Nouvelle AG
        </button>
      </header>

      {assemblees.length === 0 ? (
        <div className="ag-vide">
          <Users size={38} color={C.textSubtle} />
          <div className="ag-vide-titre">Aucune assemblée pour l'instant</div>
          <div className="ag-vide-sous">Créez la première convocation.</div>
        </div>
      ) : (
        <ul className="ag-liste">
          {assemblees.map((a) => {
            const st = STATUTS[a.statut];
            return (
              <li key={a.id} className="ag-item" onClick={() => setSelected(a)}>
                <div className="ag-item-main">
                  <div className="ag-item-titre">{a.titre}</div>
                  <div className="ag-item-meta">
                    <Calendar size={13} /> {new Date(a.date_prevue).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                    {a.lieu && <> · <MapPin size={13} /> {a.lieu}</>}
                  </div>
                </div>
                <span className="ag-badge" style={{ background: st.soft, color: st.color }}>
                  {st.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {modal && (
        <div className="ag-overlay" onClick={() => setModal(false)}>
          <div className="ag-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ag-modal-head">
              <h3>Nouvelle assemblée générale</h3>
              <button className="ag-x" onClick={() => setModal(false)}><X size={18} /></button>
            </div>

            <label className="ag-label">Titre</label>
            <input
              className="ag-input"
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              placeholder="Assemblée générale ordinaire 2026"
            />

            <label className="ag-label">Date et heure</label>
            <input
              className="ag-input"
              type="datetime-local"
              value={form.date_prevue}
              onChange={(e) => setForm({ ...form, date_prevue: e.target.value })}
            />

            <label className="ag-label">Lieu (optionnel)</label>
            <input
              className="ag-input"
              value={form.lieu}
              onChange={(e) => setForm({ ...form, lieu: e.target.value })}
              placeholder="Salle des fêtes, Dabakala"
            />

            <label className="ag-label">Ordre du jour (optionnel)</label>
            <textarea
              className="ag-textarea"
              rows={4}
              value={form.ordre_du_jour}
              onChange={(e) => setForm({ ...form, ordre_du_jour: e.target.value })}
              placeholder="1. Bilan de l'exercice&#10;2. Élection du Bureau&#10;3. Questions diverses"
            />

            <label className="ag-label">Quorum requis (%)</label>
            <input
              className="ag-input"
              type="number"
              min={1}
              max={100}
              value={form.quorum_requis_pct}
              onChange={(e) => setForm({ ...form, quorum_requis_pct: Number(e.target.value) })}
            />

            {erreur && <div className="ag-erreur"><AlertCircle size={15} /> {erreur}</div>}

            <button className="btn-primary btn-full" onClick={creer} disabled={envoi}>
              {envoi ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Créer l'AG
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Fiche d'une assemblée ---------------- */

function FicheAssemblee({ assemblee, onBack, onRefresh }) {
  const { params } = useParametrage();
  const [membres, setMembres] = useState([]);
  const [presences, setPresences] = useState({});
  const [loading, setLoading] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [codeCopie, setCodeCopie] = useState(false);
  const [pvTexte, setPvTexte] = useState(assemblee.pv_texte || "");
  const [uploadPv, setUploadPv] = useState(false);

  async function charger() {
    setLoading(true);
    const [memRes, presRes] = await Promise.all([
      supabase.from("membres")
        .select("id, nom, poste")
        .eq("organisation_id", params.organisation_id)
        .eq("actif", true)
        .order("nom"),
      supabase.from("assemblee_presences")
        .select("*")
        .eq("assemblee_id", assemblee.id),
    ]);
    setMembres(memRes.data || []);
    const map = {};
    (presRes.data || []).forEach((p) => { map[p.membre_id] = p; });
    setPresences(map);
    setLoading(false);
  }

  useEffect(() => { charger(); }, [assemblee.id]);

  const presentsCount = Object.values(presences).filter((p) => p.present).length;
  const tauxPresence = membres.length ? Math.round((presentsCount / membres.length) * 100) : 0;
  const quorumAtteint = tauxPresence >= assemblee.quorum_requis_pct;
  const codeValide = assemblee.code_emargement
    && assemblee.code_emargement_expire_le
    && new Date(assemblee.code_emargement_expire_le) > new Date();

  async function basculerPresence(membreId, present) {
    setEnCours(true);
    await supabase.from("assemblee_presences").upsert({
      assemblee_id: assemblee.id,
      organisation_id: params.organisation_id,
      membre_id: membreId,
      present,
      methode: "manuel",
      emarge_le: new Date().toISOString(),
    }, { onConflict: "assemblee_id,membre_id" });
    setEnCours(false);
    charger();
  }

  async function genererCode() {
    setEnCours(true);
    setErreur("");
    const { data, error } = await supabase.rpc("generer_code_emargement", {
      p_assemblee_id: assemblee.id,
    });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    onRefresh();
  }

  function copierCode() {
    navigator.clipboard.writeText(assemblee.code_emargement);
    setCodeCopie(true);
    setTimeout(() => setCodeCopie(false), 2000);
  }

  async function cloturer() {
    setEnCours(true);
    await supabase.from("assemblees")
      .update({ statut: "cloturee" })
      .eq("id", assemblee.id).eq("organisation_id", assemblee.organisation_id);
    setEnCours(false);
    onRefresh();
  }

  async function enregistrerPvTexte() {
    setEnCours(true);
    await supabase.from("assemblees")
      .update({ pv_texte: pvTexte.trim() || null })
      .eq("id", assemblee.id).eq("organisation_id", assemblee.organisation_id);
    setEnCours(false);
    onRefresh();
  }

  async function televerserPv(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setErreur("Fichier trop lourd (8 Mo maximum).");
      return;
    }

    setUploadPv(true);
    setErreur("");

    const ext = file.name.split(".").pop().toLowerCase();
    const chemin = `${assemblee.id}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("pv-assemblees")
      .upload(chemin, file, { upsert: true, contentType: file.type });

    if (upErr) {
      setUploadPv(false);
      setErreur("Échec du téléversement : " + upErr.message);
      return;
    }

    const { data } = supabase.storage.from("pv-assemblees").getPublicUrl(chemin);
    const url = `${data.publicUrl}?v=${Date.now()}`;

    await supabase.from("assemblees").update({ pv_url: url })
      .eq("id", assemblee.id).eq("organisation_id", assemblee.organisation_id);

    setUploadPv(false);
    onRefresh();
  }

  return (
    <div className="ag-wrap">
      <style>{CSS}</style>

      <button className="ag-retour" onClick={onBack}>
        <ChevronLeft size={16} /> Retour
      </button>

      <header className="fa-head">
        <h1 className="ag-titre">{assemblee.titre}</h1>
        <p className="ag-sous">
          <Calendar size={13} /> {new Date(assemblee.date_prevue).toLocaleString("fr-FR", {
            dateStyle: "long", timeStyle: "short",
          })}
          {assemblee.lieu && <> · <MapPin size={13} /> {assemblee.lieu}</>}
        </p>
      </header>

      {assemblee.ordre_du_jour && (
        <section className="fa-card">
          <h3 className="fa-card-titre"><ClipboardList size={16} /> Ordre du jour</h3>
          <p className="fa-ordre">{assemblee.ordre_du_jour}</p>
        </section>
      )}

      {/* ---- Quorum ---- */}
      <section className="fa-card">
        <div className="fa-quorum-head">
          <h3 className="fa-card-titre"><Users size={16} /> Émargement</h3>
          <span
            className="fa-quorum-badge"
            style={{
              background: quorumAtteint ? "#DCFCE7" : "#FEF3C7",
              color: quorumAtteint ? C.success : C.warning,
            }}
          >
            {quorumAtteint ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            Quorum {quorumAtteint ? "atteint" : "non atteint"} ({tauxPresence}% / {assemblee.quorum_requis_pct}% requis)
          </span>
        </div>
        <div className="fa-quorum-chiffre">
          {presentsCount} <span>présent{presentsCount > 1 ? "s" : ""} sur {membres.length} membre{membres.length > 1 ? "s" : ""} actif{membres.length > 1 ? "s" : ""}</span>
        </div>

        {/* Auto-pointage */}
        <div className="fa-code-bloc">
          {codeValide ? (
            <>
              <div className="fa-code-info">
                <QrCode size={16} />
                <span>Code d'auto-pointage actif — expire à {new Date(assemblee.code_emargement_expire_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <button className="fa-code-copie" onClick={copierCode}>
                <span className="fa-code-valeur">{assemblee.code_emargement}</span>
                {codeCopie ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </>
          ) : (
            <button className="btn-secondary" onClick={genererCode} disabled={enCours}>
              <QrCode size={15} /> Générer un code d'auto-pointage (valable 4h)
            </button>
          )}
        </div>

        {/* Liste manuelle */}
        <ul className="fa-membres">
          {membres.map((m) => {
            const p = presences[m.id];
            const present = p?.present || false;
            return (
              <li key={m.id} className="fa-membre-item">
                <div>
                  <div className="fa-membre-nom">{m.nom}</div>
                  {p?.methode === "auto" && <div className="fa-membre-auto">Auto-pointage</div>}
                </div>
                <button
                  className={`fa-toggle ${present ? "fa-toggle-on" : ""}`}
                  onClick={() => basculerPresence(m.id, !present)}
                  disabled={enCours}
                >
                  {present ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  {present ? "Présent" : "Absent"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- Procès-verbal ---- */}
      <section className="fa-card">
        <h3 className="fa-card-titre"><FileText size={16} /> Procès-verbal</h3>

        <label className="ag-label">Rédigé directement dans l'appli</label>
        <textarea
          className="ag-textarea"
          rows={6}
          value={pvTexte}
          onChange={(e) => setPvTexte(e.target.value)}
          placeholder="Compte rendu de la séance…"
        />
        <button className="btn-secondary" onClick={enregistrerPvTexte} disabled={enCours}>
          Enregistrer le texte
        </button>

        <div className="fa-separateur">— ou —</div>

        <label className="ag-label">Document à téléverser (PDF, image)</label>
        {assemblee.pv_url && (
          <a href={assemblee.pv_url} target="_blank" rel="noreferrer" className="fa-pv-lien">
            <FileText size={14} /> Document actuel
          </a>
        )}
        <label className="btn-secondary fa-upload-btn">
          {uploadPv ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
          {uploadPv ? "Envoi…" : "Choisir un fichier"}
          <input type="file" accept="application/pdf,image/*" onChange={televerserPv} hidden />
        </label>
      </section>

      {erreur && <div className="ag-erreur"><AlertCircle size={15} /> {erreur}</div>}

      {assemblee.statut !== "cloturee" && (
        <button className="btn-primary btn-full" onClick={cloturer} disabled={enCours}>
          <ShieldCheck size={16} /> Clôturer l'assemblée
        </button>
      )}
    </div>
  );
}

const CSS = `
.ag-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .ag-wrap{ padding:${S.lg}px; } }

.ag-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; flex-wrap:wrap; }
.ag-titre{ display:flex; align-items:center; gap:8px; font-size:19px; margin:0; }
.ag-sous{ display:flex; align-items:center; gap:5px; font-size:13px; color:${C.textSubtle}; margin:5px 0 0; }

.btn-primary{
  display:flex; align-items:center; justify-content:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600;
  box-shadow:${SHADOW.sm}; transition:background .18s ease;
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
.btn-secondary:hover:not(:disabled){ background:${PALETTE.blue100}; }

.ag-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
}
.ag-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.ag-vide-sous{ font-size:13.5px; color:${C.textSubtle}; }

.ag-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.ag-item{
  display:flex; align-items:center; justify-content:space-between; gap:${S.md}px;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px;
  padding:${S.md}px ${S.lg}px; cursor:pointer; transition:border-color .15s ease;
}
.ag-item:hover{ border-color:${C.primary}; }
.ag-item-titre{ font-size:15px; font-weight:600; }
.ag-item-meta{ display:flex; align-items:center; gap:5px; font-size:12.5px; color:${C.textSubtle}; margin-top:3px; }
.ag-badge{ font-size:12px; font-weight:600; padding:5px 11px; border-radius:${R.pill}px; white-space:nowrap; }

.ag-retour{
  display:inline-flex; align-items:center; gap:5px; align-self:flex-start;
  background:none; border:none; color:${C.textMuted}; font-family:inherit;
  font-size:13.5px; cursor:pointer; padding:4px 0;
}

.fa-head{ margin-bottom:-${S.sm}px; }
.fa-card{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:${S.lg}px; box-shadow:${SHADOW.xs}; display:flex; flex-direction:column; gap:${S.md}px;
}
.fa-card-titre{ display:flex; align-items:center; gap:8px; margin:0; font-size:15px; font-weight:600; }
.fa-ordre{ white-space:pre-line; font-size:14px; color:${C.textMuted}; line-height:1.6; margin:0; }

.fa-quorum-head{ display:flex; align-items:center; justify-content:space-between; gap:${S.md}px; flex-wrap:wrap; }
.fa-quorum-badge{
  display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600;
  padding:6px 12px; border-radius:${R.pill}px;
}
.fa-quorum-chiffre{ font-size:26px; font-weight:700; }
.fa-quorum-chiffre span{ font-size:13px; font-weight:500; color:${C.textSubtle}; margin-left:6px; }

.fa-code-bloc{ padding:${S.md}px 0; border-top:1px solid ${C.border}; border-bottom:1px solid ${C.border}; }
.fa-code-info{ display:flex; align-items:center; gap:8px; font-size:13px; color:${C.textMuted}; margin-bottom:8px; }
.fa-code-copie{
  display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%;
  background:${PALETTE.blue100}; border:1px dashed ${C.primary}; border-radius:${R.md}px;
  padding:12px 16px; cursor:pointer; font-family:inherit;
}
.fa-code-valeur{ font-size:22px; font-weight:700; letter-spacing:.15em; color:${C.primary}; }

.fa-membres{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.fa-membre-item{
  display:flex; align-items:center; justify-content:space-between; gap:${S.md}px;
  padding:9px 0; border-bottom:1px solid ${C.border};
}
.fa-membre-item:last-child{ border-bottom:none; }
.fa-membre-nom{ font-size:14px; font-weight:500; }
.fa-membre-auto{ font-size:11.5px; color:${C.primary}; margin-top:2px; }
.fa-toggle{
  display:flex; align-items:center; gap:6px; font-family:inherit; font-size:12.5px; font-weight:600;
  border:1px solid ${C.border}; background:${C.surface}; color:${C.textSubtle};
  border-radius:${R.pill}px; padding:6px 12px; cursor:pointer;
}
.fa-toggle-on{ background:#DCFCE7; border-color:${C.success}; color:${C.success}; }

.fa-separateur{ text-align:center; font-size:12px; color:${C.textSubtle}; }
.fa-upload-btn{ width:fit-content; }
.fa-pv-lien{ display:inline-flex; align-items:center; gap:6px; font-size:13px; color:${C.primary}; margin-bottom:6px; }

.ag-overlay{
  position:fixed; inset:0; background:rgba(15,23,42,.45); z-index:50;
  display:flex; align-items:center; justify-content:center; padding:${S.lg}px;
}
.ag-modal{
  background:#fff; border-radius:${R.xl}px; padding:${S.xl}px; width:100%; max-width:460px;
  max-height:88vh; overflow-y:auto; display:flex; flex-direction:column; gap:${S.sm}px;
}
.ag-modal-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:${S.sm}px; }
.ag-modal-head h3{ margin:0; font-size:17px; }
.ag-x{ background:none; border:none; cursor:pointer; color:${C.textMuted}; }

.ag-label{ font-size:12.5px; font-weight:600; color:${C.textMuted}; margin-top:6px; }
.ag-input, .ag-textarea{
  width:100%; border:1px solid ${C.border}; border-radius:${R.md}px; padding:10px 12px;
  font-family:inherit; font-size:14px; box-sizing:border-box; resize:vertical;
}
.ag-erreur{
  display:flex; align-items:center; gap:8px; background:${C.dangerSoft}; color:${C.danger};
  border-radius:${R.md}px; padding:10px 14px; font-size:13.5px;
}

.spin{ animation:spin 1s linear infinite; }
@keyframes spin{ to{ transform:rotate(360deg); } }
.ag-sk{
  height:90px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:shimmer 1.4s infinite;
}
@keyframes shimmer{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
`;