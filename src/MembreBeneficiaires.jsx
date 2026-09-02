import React, { useEffect, useState } from "react";
import {
  Plus, ArrowLeft, Loader2, Users, X, Trash2, Pencil,
  AlertCircle, Heart, Baby, UserRound, User, WifiOff,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { sauverCache, lireCache } from "./offlineCache";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const LIENS = [
  { id: "conjoint", label: "Conjoint(e)", Icon: Heart,      color: C.danger },
  { id: "enfant",   label: "Enfant",      Icon: Baby,       color: C.primaryLight },
  { id: "pere",     label: "Père",        Icon: UserRound,  color: C.primary },
  { id: "mere",     label: "Mère",        Icon: UserRound,  color: C.primary },
  { id: "frere",    label: "Frère",       Icon: User,       color: C.success },
  { id: "soeur",    label: "Sœur",        Icon: User,       color: C.success },
  { id: "autre",    label: "Autre",       Icon: User,       color: C.textMuted },
];

const VIDE = { nom: "", lien_parente: "conjoint", date_naissance: "", telephone: "" };

export default function MembreBeneficiaires({ membre, onBack }) {
  const [liste, setListe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);      // { mode: "ajout" | "edition", data }
  const [confirmation, setConfirmation] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [depuisCache, setDepuisCache] = useState(false);
  const [horodatageCache, setHorodatageCache] = useState(null);

  async function charger() {
    const idCache = `beneficiaires_${membre.id}`;
    try {
      const { data } = await supabase
        .from("beneficiaires")
        .select("*")
        .eq("membre_id", membre.id)
        .order("created_at", { ascending: true });

      sauverCache(idCache, data || []);
      setListe(data || []);
      setDepuisCache(false);
      setLoading(false);
    } catch (e) {
      const secours = lireCache(idCache);
      if (secours) {
        setListe(secours.donnees);
        setDepuisCache(true);
        setHorodatageCache(secours.horodatage);
      }
      setLoading(false);
    }
  }

  useEffect(() => { charger(); }, [membre.id]);

  async function enregistrer() {
    const f = modal.data;
    if (!f.nom.trim()) {
      setErreur("Le nom est obligatoire.");
      return;
    }

    setEnvoi(true);
    setErreur("");

    const charge = {
      membre_id: membre.id,
      nom: f.nom.trim(),
      lien_parente: f.lien_parente,
      date_naissance: f.date_naissance || null,
      telephone: f.telephone.trim() || null,
    };

    const { error } = modal.mode === "edition"
      ? await supabase.from("beneficiaires").update(charge).eq("id", f.id)
      : await supabase.from("beneficiaires").insert(charge);

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }

    setModal(null);
    charger();
  }

  async function supprimer(id) {
    setEnvoi(true);
    await supabase.from("beneficiaires").delete().eq("id", id);
    setEnvoi(false);
    setConfirmation(null);
    charger();
  }

  const majForm = (champ, valeur) =>
    setModal((m) => ({ ...m, data: { ...m.data, [champ]: valeur } }));

  return (
    <div className="bf-wrap">
      <style>{CSS}</style>

      <button className="bf-back" onClick={onBack}>
        <ArrowLeft size={16} /> Retour
      </button>

      <header className="bf-head">
        <div>
          <h1 className="bf-titre">Mes bénéficiaires</h1>
          <p className="bf-sub">
            Les proches pouvant être concernés par vos demandes d'aide.
          </p>
        </div>
        <button
          className="bf-btn-new"
          onClick={() => { setModal({ mode: "ajout", data: { ...VIDE } }); setErreur(""); }}
        >
          <Plus size={17} /> Ajouter
        </button>
      </header>

      {depuisCache && (
        <div className="bf-hors-ligne">
          <WifiOff size={14} />
          Dernières données connues du{" "}
          {new Date(horodatageCache).toLocaleDateString("fr-FR")} à{" "}
          {new Date(horodatageCache).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}

      {/* ---- Liste ---- */}
      {loading ? (
        <div className="bf-skel" />
      ) : liste.length === 0 ? (
        <div className="bf-empty">
          <Users size={38} color={PALETTE.grey300} />
          <div className="bf-empty-titre">Aucun bénéficiaire déclaré</div>
          <div className="bf-empty-sub">
            Déclarez vos proches à l'avance : le traitement de vos demandes
            d'aide en sera facilité.
          </div>
          <button
            className="bf-btn-new bf-btn-center"
            onClick={() => { setModal({ mode: "ajout", data: { ...VIDE } }); setErreur(""); }}
          >
            <Plus size={17} /> Ajouter un bénéficiaire
          </button>
        </div>
      ) : (
        <ul className="bf-list">
          {liste.map((b) => {
            const lien = LIENS.find((l) => l.id === b.lien_parente) || LIENS[6];
            const age = calculerAge(b.date_naissance);
            return (
              <li key={b.id} className="bf-card">
                <span
                  className="bf-icon"
                  style={{ background: lien.color + "14", color: lien.color }}
                >
                  <lien.Icon size={20} />
                </span>

                <div className="bf-info">
                  <div className="bf-nom">{b.nom}</div>
                  <div className="bf-meta">
                    {lien.label}
                    {age !== null && ` · ${age} an${age > 1 ? "s" : ""}`}
                    {b.telephone && ` · ${b.telephone}`}
                  </div>
                </div>

                <div className="bf-actions">
                  <button
                    className="bf-icon-btn"
                    onClick={() => {
                      setModal({
                        mode: "edition",
                        data: {
                          id: b.id,
                          nom: b.nom,
                          lien_parente: b.lien_parente,
                          date_naissance: b.date_naissance || "",
                          telephone: b.telephone || "",
                        },
                      });
                      setErreur("");
                    }}
                    aria-label="Modifier"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="bf-icon-btn is-danger"
                    onClick={() => setConfirmation(b)}
                    aria-label="Retirer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ---- Modale d'ajout / modification ---- */}
      {modal && (
        <div className="bf-overlay" onClick={() => setModal(null)}>
          <div className="bf-modal" onClick={(e) => e.stopPropagation()}>
            <header className="bf-modal-head">
              <h2 className="bf-modal-titre">
                {modal.mode === "edition" ? "Modifier le bénéficiaire" : "Nouveau bénéficiaire"}
              </h2>
              <button className="bf-close" onClick={() => setModal(null)} aria-label="Fermer">
                <X size={20} />
              </button>
            </header>

            <div className="bf-field">
              <label className="bf-label" htmlFor="nom">Nom et prénoms</label>
              <input
                id="nom"
                value={modal.data.nom}
                onChange={(e) => majForm("nom", e.target.value)}
                placeholder="Ex : Koné Marie"
                className="bf-input"
              />
            </div>

            <div className="bf-field">
              <span className="bf-label">Lien de parenté</span>
              <div className="bf-liens">
                {LIENS.map((l) => (
                  <button
                    key={l.id}
                    className={`bf-lien ${modal.data.lien_parente === l.id ? "is-on" : ""}`}
                    onClick={() => majForm("lien_parente", l.id)}
                  >
                    <l.Icon size={15} /> {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bf-row">
              <div className="bf-field">
                <label className="bf-label" htmlFor="naiss">
                  Naissance <span className="bf-opt">— facultatif</span>
                </label>
                <input
                  id="naiss"
                  type="date"
                  value={modal.data.date_naissance}
                  onChange={(e) => majForm("date_naissance", e.target.value)}
                  className="bf-input"
                />
              </div>

              <div className="bf-field">
                <label className="bf-label" htmlFor="tel">
                  Téléphone <span className="bf-opt">— facultatif</span>
                </label>
                <input
                  id="tel"
                  type="tel"
                  value={modal.data.telephone}
                  onChange={(e) => majForm("telephone", e.target.value)}
                  placeholder="07 12 34 56 78"
                  className="bf-input"
                />
              </div>
            </div>

            {erreur && (
              <div className="bf-erreur">
                <AlertCircle size={16} /> {erreur}
              </div>
            )}

            <div className="bf-modal-actions">
              <button
                className="bf-btn bf-btn-ghost"
                onClick={() => setModal(null)}
                disabled={envoi}
              >
                Annuler
              </button>
              <button
                className="bf-btn bf-btn-primary"
                onClick={enregistrer}
                disabled={envoi}
              >
                {envoi
                  ? <><Loader2 size={17} className="bf-spin" /> Enregistrement…</>
                  : modal.mode === "edition" ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Confirmation de suppression ---- */}
      {confirmation && (
        <div className="bf-overlay" onClick={() => setConfirmation(null)}>
          <div className="bf-modal bf-modal-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="bf-modal-titre">Retirer ce bénéficiaire ?</h2>
            <p className="bf-confirm-texte">
              <strong>{confirmation.nom}</strong> ne figurera plus parmi vos
              bénéficiaires déclarés. Cette action est définitive.
            </p>
            <div className="bf-modal-actions">
              <button
                className="bf-btn bf-btn-ghost"
                onClick={() => setConfirmation(null)}
                disabled={envoi}
              >
                Annuler
              </button>
              <button
                className="bf-btn bf-btn-danger"
                onClick={() => supprimer(confirmation.id)}
                disabled={envoi}
              >
                {envoi
                  ? <><Loader2 size={17} className="bf-spin" /> Suppression…</>
                  : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function calculerAge(date) {
  if (!date) return null;
  const n = new Date(date);
  if (isNaN(n)) return null;
  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - n.getFullYear();
  const m = aujourdhui.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && aujourdhui.getDate() < n.getDate())) age--;
  return age >= 0 ? age : null;
}

const CSS = `
.bf-wrap{
  max-width:640px; margin:0 auto; padding:${S.lg}px ${S.lg}px ${S.xxxl}px;
  display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
.bf-back{
  display:flex; align-items:center; gap:7px; align-self:flex-start;
  background:none; border:none; padding:0; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; color:${C.primary};
}
.bf-back:hover{ text-decoration:underline; }

.bf-head{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:${S.md}px; flex-wrap:wrap;
}
.bf-titre{ font-size:22px; font-weight:700; letter-spacing:-.02em; margin:0; }
.bf-sub{ font-size:14px; color:${C.textSubtle}; margin:4px 0 0; }
.bf-btn-new{
  display:flex; align-items:center; gap:7px; flex-shrink:0;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.bf-btn-new:hover{ background:${C.primaryDark}; }

.bf-hors-ligne{
  display:flex; align-items:center; gap:8px;
  background:#FEF3C7; color:#92400E; border-radius:${R.md}px;
  padding:10px 14px; font-size:12.5px; line-height:1.4;
}
.bf-btn-center{ margin-top:${S.md}px; }

/* ---- Liste ---- */
.bf-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:${S.sm}px; }
.bf-card{
  display:flex; align-items:center; gap:${S.md}px;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.lg}px; padding:${S.md}px ${S.lg}px;
  box-shadow:${SHADOW.xs}; transition:border-color .18s ease;
}
.bf-card:hover{ border-color:${PALETTE.grey300}; }
.bf-icon{
  width:44px; height:44px; border-radius:${R.md}px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.bf-info{ flex:1; min-width:0; }
.bf-nom{ font-size:15px; font-weight:600; }
.bf-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }
.bf-actions{ display:flex; gap:6px; flex-shrink:0; }
.bf-icon-btn{
  width:34px; height:34px; border-radius:${R.sm}px;
  background:${C.surface}; border:1px solid ${C.border};
  color:${C.textMuted}; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .16s ease;
}
.bf-icon-btn:hover{ border-color:${C.primary}; color:${C.primary}; }
.bf-icon-btn.is-danger:hover{ border-color:${C.danger}; color:${C.danger}; background:#FEE2E2; }

/* ---- Modale ---- */
.bf-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; animation:bfFade .18s ease; overflow-y:auto;
}
.bf-modal{
  width:100%; max-width:500px; background:${C.surface};
  border-radius:${R.xxl}px; padding:${S.xl}px; margin:auto;
  box-shadow:${SHADOW.lg}; animation:bfUp .22s cubic-bezier(.4,0,.2,1);
}
.bf-modal-sm{ max-width:410px; }
.bf-modal-head{
  display:flex; align-items:center; justify-content:space-between;
  gap:${S.md}px; margin-bottom:${S.xl}px;
}
.bf-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.bf-close{
  background:none; border:1px solid ${C.border}; border-radius:${R.sm}px;
  color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex;
}
.bf-close:hover{ color:${C.danger}; border-color:${C.danger}; }
.bf-confirm-texte{
  font-size:14.5px; color:${C.textMuted}; line-height:1.6;
  margin:0 0 ${S.xl}px;
}

/* ---- Champs ---- */
.bf-field{ margin-bottom:${S.lg}px; flex:1; }
.bf-row{ display:flex; gap:${S.md}px; flex-wrap:wrap; }
.bf-row .bf-field{ min-width:150px; }
.bf-label{
  display:block; font-size:14px; font-weight:600;
  color:${C.textMuted}; margin-bottom:8px;
}
.bf-opt{ font-weight:400; color:${C.textSubtle}; }
.bf-input{
  width:100%; box-sizing:border-box; padding:13px 15px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:15px;
  color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.bf-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.bf-input::placeholder{ color:${PALETTE.grey300}; }

.bf-liens{ display:flex; flex-wrap:wrap; gap:${S.sm}px; }
.bf-lien{
  display:flex; align-items:center; gap:6px;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.pill}px; padding:9px 14px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; color:${C.textMuted};
  transition:all .16s ease;
}
.bf-lien:hover{ border-color:${PALETTE.grey300}; }
.bf-lien.is-on{ background:${C.primary}; border-color:${C.primary}; color:#fff; }

.bf-erreur{
  display:flex; align-items:center; gap:9px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:12px 14px; font-size:13.5px;
  margin-bottom:${S.lg}px;
}

.bf-modal-actions{ display:flex; gap:${S.md}px; }
.bf-btn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:14px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:15px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.bf-btn:disabled{ opacity:.6; cursor:not-allowed; }
.bf-btn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.bf-btn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.bf-btn-danger{ flex:2; background:${C.danger}; color:#fff; box-shadow:${SHADOW.sm}; }
.bf-btn-danger:hover:not(:disabled){ background:#B91C1C; }
.bf-btn-ghost{
  flex:1; background:${C.surface}; color:${C.textMuted};
  border:1.5px solid ${C.border};
}
.bf-btn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.bf-empty{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.bf-empty-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.bf-empty-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:38ch; line-height:1.6; }
.bf-skel{
  height:80px; border-radius:${R.lg}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:bfShim 1.4s infinite;
}
.bf-spin{ animation:bfSpin 1s linear infinite; }
@keyframes bfSpin{ to{ transform:rotate(360deg); } }
@keyframes bfShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
@keyframes bfFade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes bfUp{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;