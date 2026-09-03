import React, { useEffect, useState } from "react";
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2, ArrowLeft,
  ChevronRight, GraduationCap, Check, MapPin, Users,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { useVocabulaire } from "./useVocabulaire";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const STATUTS = {
  planifiee: { label: "Planifiée", color: C.primary,  soft: PALETTE.blue100 },
  terminee:  { label: "Terminée",  color: C.success,   soft: "#DCFCE7" },
  annulee:   { label: "Annulée",   color: C.textSubtle, soft: PALETTE.grey200 },
};

export default function FormationsPage() {
  const { params } = useParametrage();
  const { mot } = useVocabulaire();
  const [formations, setFormations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creation, setCreation] = useState(false);
  const [selected, setSelected] = useState(null);

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from("formations")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("date_debut", { ascending: false });
    setFormations(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  if (selected) {
    return (
      <FicheFormation
        formation={selected}
        onBack={() => setSelected(null)}
        onDelete={() => { setSelected(null); charger(); }}
        onUpdate={(f) => { setSelected(f); charger(); }}
      />
    );
  }

  return (
    <div className="fo-wrap">
      <style>{CSS}</style>

      <div className="fo-tools">
        <button className="fo-btn" onClick={() => setCreation(true)}>
          <Plus size={17} /> Nouvelle formation
        </button>
      </div>

      {loading ? (
        <div className="fo-skel" />
      ) : formations.length === 0 ? (
        <div className="fo-vide">
          <GraduationCap size={36} color={PALETTE.grey300} />
          <div className="fo-vide-titre">Aucune formation</div>
          <div className="fo-vide-sub">
            Planifiez une formation pour que les {mot("membres").toLowerCase()} puissent s'inscrire.
          </div>
        </div>
      ) : (
        <ul className="fo-liste">
          {formations.map((f) => {
            const st = STATUTS[f.statut] || STATUTS.planifiee;
            return (
              <li key={f.id} className="fo-ligne" onClick={() => setSelected(f)}>
                <div className="fo-ligne-corps">
                  <div className="fo-ligne-titre">{f.titre}</div>
                  <div className="fo-ligne-meta">
                    {new Date(f.date_debut).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    {f.lieu && ` · ${f.lieu}`}
                  </div>
                </div>
                <span className="fo-badge" style={{ color: st.color, background: st.soft }}>
                  {st.label}
                </span>
                <ChevronRight size={18} color={PALETTE.grey300} />
              </li>
            );
          })}
        </ul>
      )}

      {creation && (
        <ModalFormation
          organisationId={params.organisation_id}
          onCancel={() => setCreation(false)}
          onCree={(f) => { setCreation(false); charger(); setSelected(f); }}
        />
      )}
    </div>
  );
}

/* ---------------- Fiche formation ---------------- */

function FicheFormation({ formation, onBack, onDelete, onUpdate }) {
  const { mot } = useVocabulaire();
  const [presences, setPresences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edition, setEdition] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [ajoutMembre, setAjoutMembre] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from("formation_presences")
      .select("*, membres(nom)")
      .eq("formation_id", formation.id)
      .order("inscrit_le");
    setPresences(data || []);
    setLoading(false);
  }

  useEffect(() => { charger(); }, [formation.id]);

  function notifier(texte) {
    setMessage({ type: "ok", texte });
    setTimeout(() => setMessage(null), 3000);
  }

  async function marquerStatut(p, statut) {
    setEnCours(true);
    const { error } = await supabase.from("formation_presences").update({ statut }).eq("id", p.id);
    setEnCours(false);
    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    charger();
  }

  async function retirer(p) {
    setEnCours(true);
    const { error } = await supabase.from("formation_presences").delete().eq("id", p.id);
    setEnCours(false);
    if (error) {
      setMessage({ type: "err", texte: "Le retrait n'a pas abouti. Vérifiez votre connexion et réessayez." });
      return;
    }
    charger();
  }

  async function supprimerFormation() {
    setEnCours(true);
    const { error } = await supabase.from("formations").delete().eq("id", formation.id);
    setEnCours(false);
    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    onDelete();
  }

  const st = STATUTS[formation.statut] || STATUTS.planifiee;
  const nbPresents = presences.filter((p) => p.statut === "present").length;

  return (
    <div className="fo-wrap">
      <style>{CSS}</style>

      <button className="fo-retour" onClick={onBack}>
        <ArrowLeft size={16} /> Retour aux formations
      </button>

      {message && (
        <div className={`fo-msg ${message.type === "ok" ? "is-ok" : "is-err"}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} aria-label="Fermer"><X size={15} /></button>
        </div>
      )}

      <header className="fo-entete">
        <div>
          <h1 className="fo-titre">{formation.titre}</h1>
          <div className="fo-sous-titre">
            {new Date(formation.date_debut).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {formation.lieu && <> · <MapPin size={12} style={{ display: "inline", verticalAlign: -1 }} /> {formation.lieu}</>}
          </div>
        </div>
        <span className="fo-badge fo-badge-lg" style={{ color: st.color, background: st.soft }}>
          {st.label}
        </span>
      </header>

      {formation.description && <p className="fo-description">{formation.description}</p>}

      <div className="fo-actions-entete">
        <button className="fo-lien" onClick={() => setEdition(true)}>Modifier</button>
        <button className="fo-lien fo-lien-danger" onClick={() => setSuppression(true)}>Supprimer</button>
      </div>

      <div className="fo-resume">
        <div>
          <span>{presences.length}{formation.capacite ? ` / ${formation.capacite}` : ""}</span>
          <small>Inscrit(e)s</small>
        </div>
        <div>
          <span>{nbPresents}</span>
          <small>Présent(e)s</small>
        </div>
      </div>

      <div className="fo-tools">
        <h2 className="fo-section-titre">Participants</h2>
        <button className="fo-btn" onClick={() => setAjoutMembre(true)}>
          <Plus size={17} /> Ajouter un {mot("membre_singulier").toLowerCase()}
        </button>
      </div>

      {loading ? (
        <div className="fo-skel" />
      ) : presences.length === 0 ? (
        <div className="fo-vide">
          <Users size={36} color={PALETTE.grey300} />
          <div className="fo-vide-titre">Aucun inscrit pour l'instant</div>
        </div>
      ) : (
        <ul className="fo-liste-presences">
          {presences.map((p) => (
            <li key={p.id} className="fo-ligne-presence">
              <span className="fo-presence-nom">{p.membres?.nom || "—"}</span>
              <div className="fo-presence-actions">
                <button
                  className={`fo-presence-btn ${p.statut === "present" ? "is-present" : ""}`}
                  onClick={() => marquerStatut(p, "present")}
                  disabled={enCours}
                >
                  Présent
                </button>
                <button
                  className={`fo-presence-btn ${p.statut === "absent" ? "is-absent" : ""}`}
                  onClick={() => marquerStatut(p, "absent")}
                  disabled={enCours}
                >
                  Absent
                </button>
                <button className="fo-presence-suppr" onClick={() => retirer(p)} title="Retirer">
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {edition && (
        <ModalFormation
          formation={formation}
          organisationId={formation.organisation_id}
          onCancel={() => setEdition(false)}
          onCree={(f) => { setEdition(false); onUpdate(f); }}
        />
      )}

      {ajoutMembre && (
        <ModalAjoutMembre
          formationId={formation.id}
          organisationId={formation.organisation_id}
          dejaInscrits={presences.map((p) => p.membre_id)}
          onCancel={() => setAjoutMembre(false)}
          onDone={(texte) => { setAjoutMembre(false); notifier(texte); charger(); }}
        />
      )}

      {suppression && (
        <div className="fo-overlay" onClick={() => setSuppression(false)}>
          <div className="fo-modal fo-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="fo-modal-titre">Supprimer cette formation ?</h3>
            <p className="fo-modal-texte">
              <strong>{formation.titre}</strong> et la liste de ses {presences.length} participant(s)
              seront définitivement supprimés.
            </p>
            <div className="fo-modal-actions">
              <button className="fo-mbtn fo-mbtn-ghost" onClick={() => setSuppression(false)} disabled={enCours}>
                Annuler
              </button>
              <button className="fo-mbtn fo-mbtn-danger" onClick={supprimerFormation} disabled={enCours}>
                {enCours ? <><Loader2 size={16} className="fo-spin" /> Suppression…</> : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Formulaire (création / édition) ---------------- */

function ModalFormation({ formation, organisationId, onCancel, onCree }) {
  const edition = Boolean(formation);
  const [titre, setTitre] = useState(formation?.titre || "");
  const [description, setDescription] = useState(formation?.description || "");
  const [dateDebut, setDateDebut] = useState(
    formation?.date_debut ? new Date(formation.date_debut).toISOString().slice(0, 16) : ""
  );
  const [lieu, setLieu] = useState(formation?.lieu || "");
  const [capacite, setCapacite] = useState(formation?.capacite != null ? String(formation.capacite) : "");
  const [statut, setStatut] = useState(formation?.statut || "planifiee");
  const [enCours, setEnCours] = useState(false);
  const [err, setErr] = useState("");

  async function valider() {
    if (!titre.trim()) { setErr("Indiquez le titre de la formation."); return; }
    if (!dateDebut) { setErr("Indiquez la date."); return; }

    setEnCours(true);
    setErr("");

    const donnees = {
      titre: titre.trim(),
      description: description.trim() || null,
      date_debut: new Date(dateDebut).toISOString(),
      lieu: lieu.trim() || null,
      capacite: capacite ? parseInt(capacite, 10) : null,
      statut,
    };

    const requete = edition
      ? supabase.from("formations").update(donnees).eq("id", formation.id).select().single()
      : supabase.from("formations").insert({ ...donnees, organisation_id: organisationId }).select().single();

    const { data, error } = await requete;

    setEnCours(false);

    if (error) { setErr(error.message); return; }

    onCree(data);
  }

  return (
    <div className="fo-overlay" onClick={onCancel}>
      <div className="fo-modal" onClick={(e) => e.stopPropagation()}>
        <header className="fo-modal-head">
          <h3 className="fo-modal-titre">{edition ? "Modifier la formation" : "Nouvelle formation"}</h3>
          <button className="fo-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        <div className="fo-champ">
          <label className="fo-label" htmlFor="fo-titre">Titre</label>
          <input
            id="fo-titre" className="fo-fld" value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Ex : Mise à jour réglementaire 2026"
          />
        </div>

        <div className="fo-champ">
          <label className="fo-label" htmlFor="fo-desc">
            Description <span className="fo-opt">— facultative</span>
          </label>
          <textarea
            id="fo-desc" rows={2} className="fo-fld"
            value={description} onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="fo-champ">
          <label className="fo-label" htmlFor="fo-date">Date et heure</label>
          <input
            id="fo-date" type="datetime-local" className="fo-fld"
            value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
          />
        </div>

        <div className="fo-deux-champs">
          <div className="fo-champ">
            <label className="fo-label" htmlFor="fo-lieu">
              Lieu <span className="fo-opt">— facultatif</span>
            </label>
            <input id="fo-lieu" className="fo-fld" value={lieu} onChange={(e) => setLieu(e.target.value)} />
          </div>
          <div className="fo-champ">
            <label className="fo-label" htmlFor="fo-capacite">
              Capacité <span className="fo-opt">— facultative</span>
            </label>
            <input
              id="fo-capacite" type="number" min="0" className="fo-fld"
              value={capacite} onChange={(e) => setCapacite(e.target.value)}
            />
          </div>
        </div>

        {edition && (
          <div className="fo-champ">
            <span className="fo-label">Statut</span>
            <div className="fo-choix">
              {Object.entries(STATUTS).map(([id, s]) => (
                <button
                  key={id}
                  className={`fo-choix-btn ${statut === id ? "is-on" : ""}`}
                  onClick={() => setStatut(id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {err && <div className="fo-err"><AlertCircle size={15} /> {err}</div>}

        <div className="fo-modal-actions">
          <button className="fo-mbtn fo-mbtn-ghost" onClick={onCancel} disabled={enCours}>Annuler</button>
          <button className="fo-mbtn fo-mbtn-primary" onClick={valider} disabled={enCours}>
            {enCours ? <><Loader2 size={16} className="fo-spin" /> Envoi…</> : edition ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Ajout manuel d'un participant ---------------- */

function ModalAjoutMembre({ formationId, organisationId, dejaInscrits, onCancel, onDone }) {
  const { mot } = useVocabulaire();
  const [membres, setMembres] = useState([]);
  const [choisi, setChoisi] = useState("");
  const [loading, setLoading] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase
      .from("membres")
      .select("id, nom")
      .eq("organisation_id", organisationId)
      .eq("actif", true)
      .order("nom")
      .then(({ data }) => {
        setMembres((data || []).filter((m) => !dejaInscrits.includes(m.id)));
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function valider() {
    if (!choisi) { setErr(`Choisissez un ${mot("membre_singulier").toLowerCase()}.`); return; }

    setEnCours(true);
    setErr("");

    const { error } = await supabase.from("formation_presences").insert({
      formation_id: formationId,
      organisation_id: organisationId,
      membre_id: choisi,
      statut: "inscrit",
    });

    setEnCours(false);

    if (error) { setErr(error.message); return; }

    onDone("Participant ajouté.");
  }

  return (
    <div className="fo-overlay" onClick={onCancel}>
      <div className="fo-modal fo-modal-court" onClick={(e) => e.stopPropagation()}>
        <header className="fo-modal-head">
          <h3 className="fo-modal-titre">Ajouter un participant</h3>
          <button className="fo-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        {loading ? (
          <div className="fo-skel" />
        ) : membres.length === 0 ? (
          <p className="fo-modal-texte">
            Tous les {mot("membres").toLowerCase()} actifs sont déjà inscrits.
          </p>
        ) : (
          <div className="fo-champ">
            <label className="fo-label" htmlFor="fo-membre">{mot("membre_singulier")}</label>
            <select id="fo-membre" className="fo-fld" value={choisi} onChange={(e) => setChoisi(e.target.value)}>
              <option value="">Choisir…</option>
              {membres.map((m) => (
                <option key={m.id} value={m.id}>{m.nom}</option>
              ))}
            </select>
          </div>
        )}

        {err && <div className="fo-err"><AlertCircle size={15} /> {err}</div>}

        <div className="fo-modal-actions">
          <button className="fo-mbtn fo-mbtn-ghost" onClick={onCancel} disabled={enCours}>Annuler</button>
          <button className="fo-mbtn fo-mbtn-primary" onClick={valider} disabled={enCours || membres.length === 0}>
            {enCours ? <><Loader2 size={16} className="fo-spin" /> Envoi…</> : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Styles ---------------- */

const CSS = `
.fo-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .fo-wrap{ padding:${S.lg}px; } }

.fo-msg{
  display:flex; align-items:center; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
}
.fo-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.fo-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }
.fo-msg button{ margin-left:auto; background:none; border:none; cursor:pointer; color:inherit; opacity:.7; display:flex; padding:0; }

.fo-tools{ display:flex; align-items:center; }
.fo-btn{
  margin-left:auto; display:flex; align-items:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.fo-btn:hover{ background:${C.primaryDark}; }

.fo-liste{
  list-style:none; margin:0; padding:0;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; overflow:hidden; box-shadow:${SHADOW.xs};
}
.fo-ligne{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border};
  cursor:pointer; transition:background .14s ease;
}
.fo-ligne:hover{ background:${C.bg}; }
.fo-ligne:last-child{ border-bottom:none; }
.fo-ligne-corps{ flex:1; min-width:0; }
.fo-ligne-titre{ font-size:14.5px; font-weight:600; }
.fo-ligne-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }

.fo-badge{ flex-shrink:0; border-radius:${R.pill}px; padding:5px 12px; font-size:12px; font-weight:700; }
.fo-badge-lg{ padding:7px 16px; font-size:13px; }

.fo-retour{
  display:flex; align-items:center; gap:7px; align-self:flex-start;
  background:none; border:none; color:${C.textMuted}; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; padding:0;
}
.fo-retour:hover{ color:${C.primary}; }

.fo-entete{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; }
.fo-titre{ font-size:22px; font-weight:700; letter-spacing:-.02em; margin:0; }
.fo-sous-titre{ font-size:13.5px; color:${C.textSubtle}; margin-top:4px; text-transform:capitalize; }
.fo-description{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:0; }

.fo-actions-entete{ display:flex; gap:${S.lg}px; }
.fo-lien{
  display:flex; align-items:center; gap:6px;
  background:none; border:none; color:${C.primary}; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:600; padding:0;
}
.fo-lien-danger{ color:${C.danger}; }

.fo-resume{ display:flex; gap:${S.md}px; }
.fo-resume > div{
  flex:1; background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px;
  padding:${S.md}px ${S.lg}px; display:flex; flex-direction:column; gap:2px;
}
.fo-resume span{ font-size:18px; font-weight:700; letter-spacing:-.01em; }
.fo-resume small{ font-size:12px; color:${C.textSubtle}; }

.fo-section-titre{ font-size:16px; font-weight:700; letter-spacing:-.01em; margin:0; }

.fo-liste-presences{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.fo-ligne-presence{
  display:flex; align-items:center; justify-content:space-between; gap:${S.md}px; flex-wrap:wrap;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.md}px;
  padding:10px 14px;
}
.fo-presence-nom{ font-size:14px; font-weight:600; }
.fo-presence-actions{ display:flex; align-items:center; gap:6px; }
.fo-presence-btn{
  background:${PALETTE.grey200}; color:${C.textMuted}; border:none;
  border-radius:${R.pill}px; padding:6px 12px; cursor:pointer;
  font-family:inherit; font-size:12px; font-weight:600;
}
.fo-presence-btn.is-present{ background:#DCFCE7; color:${C.success}; }
.fo-presence-btn.is-absent{ background:#FEE2E2; color:${C.danger}; }
.fo-presence-btn:disabled{ opacity:.6; cursor:not-allowed; }
.fo-presence-suppr{
  background:none; border:none; color:${C.textSubtle}; cursor:pointer; padding:4px; display:flex;
}
.fo-presence-suppr:hover{ color:${C.danger}; }

/* ---- Modale ---- */
.fo-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; overflow-y:auto;
}
.fo-modal{ width:100%; max-width:500px; background:${C.surface}; border-radius:${R.xxl}px; padding:${S.xl}px; box-shadow:${SHADOW.lg}; margin:auto; }
.fo-modal-court{ max-width:420px; }
.fo-modal-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; margin-bottom:${S.lg}px; }
.fo-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.fo-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:8px 0 ${S.md}px; }
.fo-close{ background:none; border:1px solid ${C.border}; border-radius:${R.sm}px; color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex; }
.fo-close:hover{ color:${C.danger}; border-color:${C.danger}; }

.fo-champ{ display:flex; flex-direction:column; gap:6px; margin-bottom:${S.md}px; }
.fo-deux-champs{ display:grid; grid-template-columns:1fr 1fr; gap:${S.md}px; }
.fo-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.fo-opt{ font-weight:400; color:${C.textSubtle}; }
.fo-fld{
  width:100%; box-sizing:border-box; padding:11px 13px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px; color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.fo-fld:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }

.fo-choix{ display:flex; flex-wrap:wrap; gap:${S.sm}px; }
.fo-choix-btn{
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.pill}px; padding:7px 13px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600; color:${C.textMuted};
  transition:all .16s ease;
}
.fo-choix-btn.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; color:${C.primary}; }

.fo-err{
  display:flex; align-items:flex-start; gap:8px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:11px 13px; font-size:13px; line-height:1.5; margin-bottom:${S.md}px;
}

.fo-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }
.fo-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.fo-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.fo-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.fo-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.fo-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.fo-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.fo-mbtn-ghost{ flex:1; background:${C.surface}; color:${C.textMuted}; border:1.5px solid ${C.border}; }
.fo-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.fo-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.fo-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.fo-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:44ch; line-height:1.6; }
.fo-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:foShim 1.4s infinite;
}
.fo-spin{ animation:foSpin 1s linear infinite; }
@keyframes foSpin{ to{ transform:rotate(360deg); } }
@keyframes foShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;