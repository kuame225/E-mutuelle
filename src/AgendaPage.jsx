import React, { useEffect, useState } from "react";
import {
  CalendarDays, Plus, Trash2, X, Loader2, Receipt, Gift,
  Users, Bell, ChevronLeft, ChevronRight, AlertCircle, Pencil,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const TYPES = {
  echeance_cotisation: { label: "Échéance cotisation", court: "Cotisation", Icon: Receipt,      color: C.primary },
  tirage_tombola:      { label: "Tirage tombola",      court: "Tombola",    Icon: Gift,         color: C.warning },
  assemblee_generale:  { label: "Assemblée générale",  court: "AG",         Icon: Users,        color: C.success },
  autre:               { label: "Autre événement",     court: "Autre",      Icon: CalendarDays, color: C.textMuted },
};

const VIDE = { titre: "", type: "echeance_cotisation", date: "", description: "" };
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function AgendaPage() {
  const { params } = useParametrage();
  const [evenements, setEvenements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [curseur, setCurseur] = useState(() => {
    const d = new Date();
    return { annee: d.getFullYear(), mois: d.getMonth() };
  });

  async function charger() {
    const { data } = await supabase
      .from("agenda")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("date");
    setEvenements(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  async function enregistrer() {
    const f = modal.data;
    if (!f.titre.trim()) { setErreur("Le titre est obligatoire."); return; }
    if (!f.date) { setErreur("La date est obligatoire."); return; }

    setEnvoi(true);
    setErreur("");

    const charge = {
      titre: f.titre.trim(),
      type: f.type,
      date: f.date,
      description: f.description.trim() || null,
    };

    const { error } = modal.mode === "edition"
      ? await supabase.from("agenda").update(charge).eq("id", f.id)
      : await supabase.from("agenda").insert({
          ...charge,
          organisation_id: params.organisation_id,
        });

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }

    setModal(null);
    charger();
  }

  async function supprimer(id) {
    setEnvoi(true);
    await supabase.from("agenda").delete().eq("id", id);
    setEnvoi(false);
    setConfirmation(null);
    charger();
  }

  const majForm = (champ, valeur) =>
    setModal((m) => ({ ...m, data: { ...m.data, [champ]: valeur } }));

  // Calendrier du mois affiché
  const premier = new Date(curseur.annee, curseur.mois, 1);
  const nbJours = new Date(curseur.annee, curseur.mois + 1, 0).getDate();
  const decalage = (premier.getDay() + 6) % 7;   // lundi en première colonne
  const cles = `${curseur.annee}-${String(curseur.mois + 1).padStart(2, "0")}`;

  const duMois = {};
  evenements.forEach((e) => {
    if (e.date.slice(0, 7) === cles) {
      const jour = parseInt(e.date.slice(8, 10));
      if (!duMois[jour]) duMois[jour] = [];
      duMois[jour].push(e);
    }
  });

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const aVenir = evenements
    .filter((e) => e.date >= aujourdhui)
    .slice(0, 6);

  function naviguer(pas) {
    setCurseur((c) => {
      const d = new Date(c.annee, c.mois + pas, 1);
      return { annee: d.getFullYear(), mois: d.getMonth() };
    });
  }

  if (loading) {
    return (
      <div className="ag-wrap">
        <style>{CSS}</style>
        <div className="ag-skel" />
      </div>
    );
  }

  return (
    <div className="ag-wrap">
      <style>{CSS}</style>

      <header className="ag-head">
        <div>
          <h1 className="ag-titre">Agenda de la mutuelle</h1>
          <p className="ag-sub">
            Échéances, tirages et rendez-vous du Bureau.
          </p>
        </div>
        <button
          className="ag-btn"
          onClick={() => { setModal({ mode: "ajout", data: { ...VIDE } }); setErreur(""); }}
        >
          <Plus size={17} /> Ajouter
        </button>
      </header>

      <div className="ag-grid">

        {/* ---- Calendrier ---- */}
        <section className="ag-card">
          <div className="ag-cal-head">
            <button className="ag-nav" onClick={() => naviguer(-1)} aria-label="Mois précédent">
              <ChevronLeft size={18} />
            </button>
            <h2 className="ag-mois">{nomMois(curseur.mois)} {curseur.annee}</h2>
            <button className="ag-nav" onClick={() => naviguer(1)} aria-label="Mois suivant">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="ag-jours">
            {JOURS.map((j) => <span key={j}>{j}</span>)}
          </div>

          <div className="ag-cases">
            {Array.from({ length: decalage }).map((_, i) => (
              <div key={"v" + i} className="ag-case is-vide" />
            ))}

            {Array.from({ length: nbJours }).map((_, i) => {
              const jour = i + 1;
              const dateJour = `${cles}-${String(jour).padStart(2, "0")}`;
              const liste = duMois[jour] || [];
              const estAujourdhui = dateJour === aujourdhui;

              return (
                <button
                  key={jour}
                  className={`ag-case ${estAujourdhui ? "is-today" : ""} ${liste.length ? "has-ev" : ""}`}
                  onClick={() => {
                    setModal({ mode: "ajout", data: { ...VIDE, date: dateJour } });
                    setErreur("");
                  }}
                >
                  <span className="ag-num">{jour}</span>
                  {liste.length > 0 && (
                    <span className="ag-points">
                      {liste.slice(0, 3).map((e, k) => (
                        <i key={k} style={{ background: (TYPES[e.type] || TYPES.autre).color }} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <ul className="ag-legende">
            {Object.entries(TYPES).map(([id, t]) => (
              <li key={id}>
                <i style={{ background: t.color }} /> {t.court}
              </li>
            ))}
          </ul>
        </section>

        {/* ---- À venir ---- */}
        <section className="ag-card">
          <h2 className="ag-card-titre"><Bell size={16} /> Prochains rendez-vous</h2>

          {aVenir.length === 0 ? (
            <div className="ag-vide">
              <CalendarDays size={32} color={PALETTE.grey300} />
              <div className="ag-vide-titre">Rien de prévu</div>
              <div className="ag-vide-sub">
                Ajoutez les échéances de cotisation et les dates d'assemblée.
              </div>
            </div>
          ) : (
            <ul className="ag-liste">
              {aVenir.map((e) => {
                const t = TYPES[e.type] || TYPES.autre;
                const jours = Math.ceil(
                  (new Date(e.date) - new Date(aujourdhui)) / 86400000
                );
                return (
                  <li key={e.id} className="ag-item">
                    <span className="ag-date" style={{ background: t.color + "14", color: t.color }}>
                      <em>{new Date(e.date).getDate()}</em>
                      {nomMoisCourt(new Date(e.date).getMonth())}
                    </span>

                    <div className="ag-item-body">
                      <div className="ag-item-type" style={{ color: t.color }}>
                        <t.Icon size={12} /> {t.label}
                      </div>
                      <div className="ag-item-titre">{e.titre}</div>
                      {e.description && <div className="ag-item-desc">{e.description}</div>}
                      <div className="ag-item-delai">
                        {jours === 0 ? "Aujourd'hui" : jours === 1 ? "Demain" : `Dans ${jours} jours`}
                      </div>
                    </div>

                    <div className="ag-item-actions">
                      <button
                        className="ag-icon-btn"
                        onClick={() => {
                          setModal({
                            mode: "edition",
                            data: {
                              id: e.id, titre: e.titre, type: e.type,
                              date: e.date, description: e.description || "",
                            },
                          });
                          setErreur("");
                        }}
                        aria-label="Modifier"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="ag-icon-btn is-danger"
                        onClick={() => setConfirmation(e)}
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
        </section>
      </div>

      {/* ---- Modale ---- */}
      {modal && (
        <div className="ag-overlay" onClick={() => setModal(null)}>
          <div className="ag-modal" onClick={(ev) => ev.stopPropagation()}>
            <header className="ag-modal-head">
              <h3 className="ag-modal-titre">
                {modal.mode === "edition" ? "Modifier l'événement" : "Nouvel événement"}
              </h3>
              <button className="ag-close" onClick={() => setModal(null)} aria-label="Fermer">
                <X size={20} />
              </button>
            </header>

            <div className="ag-field">
              <label className="ag-label" htmlFor="titre">Intitulé</label>
              <input
                id="titre"
                value={modal.data.titre}
                onChange={(e) => majForm("titre", e.target.value)}
                placeholder="Ex : Échéance cotisation d'août"
                className="ag-input"
              />
            </div>

            <div className="ag-field">
              <span className="ag-label">Type</span>
              <div className="ag-types">
                {Object.entries(TYPES).map(([id, t]) => (
                  <button
                    key={id}
                    className={`ag-type ${modal.data.type === id ? "is-on" : ""}`}
                    onClick={() => majForm("type", id)}
                    style={modal.data.type === id
                      ? { borderColor: t.color, background: t.color + "12", color: t.color }
                      : {}}
                  >
                    <t.Icon size={15} /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ag-field">
              <label className="ag-label" htmlFor="date">Date</label>
              <input
                id="date" type="date"
                value={modal.data.date}
                onChange={(e) => majForm("date", e.target.value)}
                className="ag-input"
              />
            </div>

            <div className="ag-field">
              <label className="ag-label" htmlFor="desc">
                Précisions <span className="ag-opt">— facultatif</span>
              </label>
              <textarea
                id="desc" rows={3}
                value={modal.data.description}
                onChange={(e) => majForm("description", e.target.value)}
                placeholder="Lieu, heure, ordre du jour…"
                className="ag-input ag-textarea"
              />
            </div>

            {erreur && (
              <div className="ag-erreur"><AlertCircle size={16} /> {erreur}</div>
            )}

            <div className="ag-modal-actions">
              <button className="ag-mbtn ag-mbtn-ghost" onClick={() => setModal(null)} disabled={envoi}>
                Annuler
              </button>
              <button className="ag-mbtn ag-mbtn-primary" onClick={enregistrer} disabled={envoi}>
                {envoi
                  ? <><Loader2 size={16} className="ag-spin" /> Enregistrement…</>
                  : modal.mode === "edition" ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Confirmation ---- */}
      {confirmation && (
        <div className="ag-overlay" onClick={() => setConfirmation(null)}>
          <div className="ag-modal ag-modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="ag-modal-titre">Supprimer cet événement ?</h3>
            <p className="ag-confirm">
              <strong>{confirmation.titre}</strong> sera retiré de l'agenda.
            </p>
            <div className="ag-modal-actions">
              <button className="ag-mbtn ag-mbtn-ghost" onClick={() => setConfirmation(null)} disabled={envoi}>
                Annuler
              </button>
              <button className="ag-mbtn ag-mbtn-danger" onClick={() => supprimer(confirmation.id)} disabled={envoi}>
                {envoi ? <><Loader2 size={16} className="ag-spin" /> Suppression…</> : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Utilitaires ---------------- */

function nomMois(m) {
  return ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][m];
}

function nomMoisCourt(m) {
  return ["janv.", "févr.", "mars", "avr.", "mai", "juin",
    "juil.", "août", "sept.", "oct.", "nov.", "déc."][m];
}

/* ---------------- Styles ---------------- */

const CSS = `
.ag-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .ag-wrap{ padding:${S.lg}px; } }

.ag-head{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:${S.md}px; flex-wrap:wrap;
}
.ag-titre{ font-size:22px; font-weight:700; letter-spacing:-.02em; margin:0; }
.ag-sub{ font-size:14px; color:${C.textSubtle}; margin:4px 0 0; }
.ag-btn{
  display:flex; align-items:center; gap:7px; flex-shrink:0;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.ag-btn:hover{ background:${C.primaryDark}; }

.ag-grid{ display:grid; gap:${S.lg}px; grid-template-columns:1fr; }
@media (min-width:900px){ .ag-grid{ grid-template-columns:1.15fr 1fr; } }

.ag-card{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.ag-card-titre{
  display:flex; align-items:center; gap:8px;
  font-size:15.5px; font-weight:600; margin:0 0 ${S.lg}px; letter-spacing:-.01em;
}

/* ---- Calendrier ---- */
.ag-cal-head{
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:${S.lg}px;
}
.ag-mois{ font-size:16px; font-weight:600; margin:0; letter-spacing:-.01em; }
.ag-nav{
  width:34px; height:34px; border-radius:${R.sm}px;
  background:${C.surface}; border:1px solid ${C.border};
  color:${C.textMuted}; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .16s ease;
}
.ag-nav:hover{ border-color:${C.primary}; color:${C.primary}; }

.ag-jours{
  display:grid; grid-template-columns:repeat(7, 1fr);
  gap:4px; margin-bottom:6px;
}
.ag-jours span{
  text-align:center; font-size:11px; font-weight:600;
  color:${C.textSubtle}; text-transform:uppercase; letter-spacing:.04em;
}
.ag-cases{ display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; }
.ag-case{
  position:relative; aspect-ratio:1;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:3px; border:1px solid transparent; border-radius:${R.sm}px;
  background:${C.bg}; cursor:pointer; font-family:inherit;
  transition:all .14s ease;
}
.ag-case:hover{ border-color:${C.primary}44; background:${PALETTE.blue50}; }
.ag-case.is-vide{ background:transparent; cursor:default; pointer-events:none; }
.ag-case.is-today{ background:${C.primary}; }
.ag-case.is-today .ag-num{ color:#fff; font-weight:700; }
.ag-case.has-ev{ background:${C.surface}; border-color:${C.border}; }
.ag-case.is-today.has-ev{ background:${C.primary}; }
.ag-num{ font-size:13px; font-weight:500; color:${C.text}; }
.ag-points{ display:flex; gap:2.5px; }
.ag-points i{ width:5px; height:5px; border-radius:50%; display:block; }
.ag-case.is-today .ag-points i{ background:#fff !important; }

.ag-legende{
  list-style:none; margin:${S.lg}px 0 0; padding:0;
  display:flex; flex-wrap:wrap; gap:${S.md}px;
}
.ag-legende li{
  display:flex; align-items:center; gap:6px;
  font-size:12px; color:${C.textSubtle};
}
.ag-legende i{ width:8px; height:8px; border-radius:50%; }

/* ---- Liste à venir ---- */
.ag-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:${S.sm}px; }
.ag-item{
  display:flex; align-items:flex-start; gap:${S.md}px;
  padding:${S.md}px; border-radius:${R.md}px; background:${C.bg};
}
.ag-date{
  flex-shrink:0; width:50px; border-radius:${R.sm}px;
  padding:8px 0; text-align:center;
  font-size:11px; font-weight:600; text-transform:uppercase;
}
.ag-date em{
  display:block; font-style:normal;
  font-size:20px; font-weight:700; line-height:1.1;
}
.ag-item-body{ flex:1; min-width:0; }
.ag-item-type{
  display:flex; align-items:center; gap:5px;
  font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.04em;
}
.ag-item-titre{ font-size:14.5px; font-weight:600; margin-top:3px; }
.ag-item-desc{ font-size:12.5px; color:${C.textSubtle}; margin-top:3px; line-height:1.5; }
.ag-item-delai{ font-size:12px; color:${C.textMuted}; font-weight:600; margin-top:5px; }
.ag-item-actions{ display:flex; gap:5px; flex-shrink:0; }
.ag-icon-btn{
  width:30px; height:30px; border-radius:${R.sm}px;
  background:${C.surface}; border:1px solid ${C.border};
  color:${C.textSubtle}; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .16s ease;
}
.ag-icon-btn:hover{ border-color:${C.primary}; color:${C.primary}; }
.ag-icon-btn.is-danger:hover{ border-color:${C.danger}; color:${C.danger}; background:#FEE2E2; }

/* ---- Modale ---- */
.ag-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; animation:agFade .18s ease; overflow-y:auto;
}
.ag-modal{
  width:100%; max-width:470px; background:${C.surface}; margin:auto;
  border-radius:${R.xxl}px; padding:${S.xl}px;
  box-shadow:${SHADOW.lg}; animation:agUp .22s cubic-bezier(.4,0,.2,1);
}
.ag-modal-sm{ max-width:400px; }
.ag-modal-head{
  display:flex; align-items:center; justify-content:space-between;
  gap:${S.md}px; margin-bottom:${S.lg}px;
}
.ag-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.ag-close{
  background:none; border:1px solid ${C.border}; border-radius:${R.sm}px;
  color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex;
}
.ag-close:hover{ color:${C.danger}; border-color:${C.danger}; }
.ag-confirm{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:0 0 ${S.xl}px; }

.ag-field{ margin-bottom:${S.lg}px; }
.ag-label{ display:block; font-size:13.5px; font-weight:600; color:${C.textMuted}; margin-bottom:8px; }
.ag-opt{ font-weight:400; color:${C.textSubtle}; }
.ag-input{
  width:100%; box-sizing:border-box; padding:13px 15px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:15px;
  color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.ag-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.ag-textarea{ resize:vertical; line-height:1.55; }

.ag-types{ display:flex; flex-wrap:wrap; gap:${S.sm}px; }
.ag-type{
  display:flex; align-items:center; gap:6px;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.pill}px; padding:9px 14px; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:600; color:${C.textMuted};
  transition:all .16s ease;
}
.ag-type:hover{ border-color:${PALETTE.grey300}; }

.ag-erreur{
  display:flex; align-items:center; gap:9px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:12px 14px; font-size:13.5px; margin-bottom:${S.lg}px;
}

.ag-modal-actions{ display:flex; gap:${S.md}px; }
.ag-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.ag-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.ag-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.ag-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.ag-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.ag-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.ag-mbtn-ghost{
  flex:1; background:${C.surface}; color:${C.textMuted};
  border:1.5px solid ${C.border};
}
.ag-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.ag-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  padding:${S.xxl}px ${S.lg}px; gap:${S.sm}px;
}
.ag-vide-titre{ font-size:15px; font-weight:600; margin-top:${S.sm}px; }
.ag-vide-sub{ font-size:13px; color:${C.textSubtle}; max-width:34ch; line-height:1.55; }
.ag-skel{
  height:340px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:agShim 1.4s infinite;
}
.ag-spin{ animation:agSpin 1s linear infinite; }
@keyframes agSpin{ to{ transform:rotate(360deg); } }
@keyframes agShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
@keyframes agFade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes agUp{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;