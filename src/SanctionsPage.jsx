import React, { useEffect, useState } from "react";
import {
  ShieldAlert, ShieldCheck, RefreshCw, Loader2, Gift,
  HandHeart, UserX, History, CheckCircle2, Info,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const TYPES = {
  tombola_suspendue: {
    label: "Tombola suspendue",
    court: "Tombola",
    Icon: Gift,
    color: C.warning,
    soft: C.warningSoft,
  },
  aides_suspendues: {
    label: "Aides sociales suspendues",
    court: "Aides",
    Icon: HandHeart,
    color: C.danger,
    soft: C.dangerSoft,
  },
  membre_suspendu: {
    label: "Membre suspendu",
    court: "Membre",
    Icon: UserX,
    color: PALETTE.red600,
    soft: C.dangerSoft,
  },
};

export default function SanctionsPage() {
  const { params } = useParametrage();
  const [actives, setActives] = useState([]);
  const [levees, setLevees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calcul, setCalcul] = useState(false);
  const [message, setMessage] = useState(null);

  async function charger() {
    setLoading(true);
    const [a, l] = await Promise.all([
      supabase
        .from("sanctions_acces")
        .select("*, membres(nom, poste, statut_cotisation)")
        .eq("organisation_id", params.organisation_id)
        .is("date_levee", null)
        .order("date_debut", { ascending: false }),
      supabase
        .from("sanctions_acces")
        .select("*, membres(nom)")
        .eq("organisation_id", params.organisation_id)
        .not("date_levee", "is", null)
        .order("date_levee", { ascending: false })
        .limit(8),
    ]);
    setActives(a.data || []);
    setLevees(l.data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  async function recalculer() {
    setCalcul(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("appliquer_sanctions");
    setCalcul(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    setMessage({
      type: "ok",
      text: data === 0
        ? "Aucun membre ne remplit les conditions d'une sanction."
        : `${data} membre${data > 1 ? "s" : ""} sous sanction après recalcul.`,
    });
    charger();
  }

  // Regrouper les sanctions actives par membre
  const parMembre = {};
  actives.forEach((s) => {
    const k = s.membre_id;
    if (!parMembre[k]) {
      parMembre[k] = { membre: s.membres, sanctions: [], depuis: s.date_debut, motif: s.motif };
    }
    parMembre[k].sanctions.push(s.type_sanction);
    if (s.date_debut < parMembre[k].depuis) parMembre[k].depuis = s.date_debut;
  });
  const membres = Object.values(parMembre);

  const compte = (type) => actives.filter((s) => s.type_sanction === type).length;

  const bareme = [
    { seuil: `Moins de ${params.seuil_sanction_tombola} mois`, effet: "Aucune sanction — simple rappel", color: C.success },
    { seuil: `${params.seuil_sanction_tombola} mois de retard`, effet: "Perte d'éligibilité à la tombola", color: C.warning },
    { seuil: `${params.seuil_sanction_aides} mois de retard`, effet: "Accès aux aides sociales suspendu", color: C.danger },
    { seuil: `${params.seuil_suspension} mois de retard`, effet: "Statut de membre actif suspendu", color: PALETTE.red600 },
  ];

  if (loading) {
    return (
      <div className="sc-wrap">
        <style>{CSS}</style>
        <div className="sk sk-row" />
        <div className="sk sk-row" />
      </div>
    );
  }

  return (
    <div className="sc-wrap">
      <style>{CSS}</style>

      {/* ---- Barre d'action ---- */}
      <section className="action-bar">
        <div className="action-text">
          <div className="action-title">
            {membres.length === 0
              ? "Aucune sanction active"
              : `${membres.length} membre${membres.length > 1 ? "s" : ""} sous sanction`}
          </div>
          <div className="action-sub">
            Les sanctions sont recalculées automatiquement à chaque paiement enregistré.
          </div>
        </div>
        <button className="btn-recalc" onClick={recalculer} disabled={calcul}>
          {calcul
            ? <><Loader2 size={16} className="spin" /> Calcul…</>
            : <><RefreshCw size={16} /> Recalculer maintenant</>}
        </button>
      </section>

      {message && (
        <div className={`msg ${message.type === "ok" ? "msg-ok" : "msg-err"}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <ShieldAlert size={17} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* ---- Compteurs ---- */}
      <section className="counters">
        {Object.entries(TYPES).map(([key, t]) => (
          <article key={key} className="counter">
            <span className="counter-icon" style={{ background: t.soft, color: t.color }}>
              <t.Icon size={19} />
            </span>
            <div>
              <div className="counter-num" style={{ color: t.color }}>{compte(key)}</div>
              <div className="counter-label">{t.label}</div>
            </div>
          </article>
        ))}
      </section>

      {/* ---- Barème ---- */}
      <section className="card">
        <header className="card-head">
          <h3 className="card-title"><Info size={17} /> Barème appliqué</h3>
          <span className="card-note">Modifiable dans Paramètres</span>
        </header>
        <ul className="bareme">
          {bareme.map((b) => (
            <li key={b.seuil}>
              <span className="bareme-dot" style={{ background: b.color }} />
              <span className="bareme-seuil">{b.seuil}</span>
              <span className="bareme-effet">{b.effet}</span>
            </li>
          ))}
        </ul>
        <div className="rappel">
          <ShieldCheck size={16} />
          <span>
            Toute sanction est levée automatiquement dès régularisation.
            Aucune pénalité financière n'est appliquée.
          </span>
        </div>
      </section>

      {/* ---- Membres sanctionnés ---- */}
      {membres.length > 0 ? (
        <section className="card">
          <header className="card-head">
            <h3 className="card-title card-title-warn">
              <ShieldAlert size={17} /> Membres concernés
            </h3>
          </header>
          <ul className="membres">
            {membres.map((m, i) => (
              <li key={i} className="membre-item">
                <div className="membre-info">
                  <div className="membre-nom">{m.membre?.nom || "—"}</div>
                  <div className="membre-meta">
                    {m.membre?.poste ? `${m.membre.poste} · ` : ""}
                    {m.motif || "—"}
                    {" · depuis le "}
                    {new Date(m.depuis).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                <div className="membre-tags">
                  {m.sanctions.map((s) => {
                    const t = TYPES[s];
                    if (!t) return null;
                    return (
                      <span key={s} className="tag" style={{ background: t.soft, color: t.color }}>
                        <t.Icon size={12} /> {t.court}
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="card empty-card">
          <ShieldCheck size={38} color={C.success} />
          <div className="empty-title">Aucun membre sous sanction</div>
          <div className="empty-sub">
            Tous les membres sont à jour ou dans les délais de tolérance.
          </div>
        </section>
      )}

      {/* ---- Historique ---- */}
      {levees.length > 0 && (
        <section className="card">
          <header className="card-head">
            <h3 className="card-title"><History size={17} /> Sanctions levées récemment</h3>
          </header>
          <ul className="historique">
            {levees.map((s) => {
              const t = TYPES[s.type_sanction];
              return (
                <li key={s.id}>
                  <span className="hist-dot" style={{ background: C.success }} />
                  <span className="hist-nom">{s.membres?.nom || "—"}</span>
                  <span className="hist-type">{t ? t.label : s.type_sanction}</span>
                  <span className="hist-date">
                    {new Date(s.date_levee).toLocaleDateString("fr-FR")}
                    {s.levee_automatiquement && <em> · automatique</em>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

const CSS = `
.sc-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .sc-wrap{ padding:${S.lg}px; } }

/* Barre d'action */
.action-bar{
  display:flex; align-items:center; justify-content:space-between;
  gap:${S.lg}px; flex-wrap:wrap;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px ${S.xl}px; box-shadow:${SHADOW.xs};
}
.action-title{ font-size:17px; font-weight:600; letter-spacing:-.01em; }
.action-sub{ font-size:13px; color:${C.textSubtle}; margin-top:3px; }
.btn-recalc{
  display:flex; align-items:center; gap:8px; flex-shrink:0;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600;
  box-shadow:${SHADOW.sm}; transition:background .18s ease;
}
.btn-recalc:hover:not(:disabled){ background:${C.primaryDark}; }
.btn-recalc:disabled{ opacity:.6; cursor:not-allowed; }

/* Message */
.msg{
  display:flex; align-items:center; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
  animation:slide .2s ease;
}
.msg-ok{ background:${C.successSoft}; color:${C.success}; border:1px solid ${C.success}33; }
.msg-err{ background:${C.dangerSoft}; color:${C.danger}; border:1px solid ${C.danger}33; }

/* Compteurs */
.counters{
  display:grid; gap:${S.lg}px;
  grid-template-columns:repeat(auto-fit, minmax(230px, 1fr));
}
.counter{
  display:flex; align-items:center; gap:${S.md}px;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.counter-icon{
  width:44px; height:44px; border-radius:${R.md}px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.counter-num{ font-size:26px; font-weight:700; line-height:1; letter-spacing:-.02em; }
.counter-label{ font-size:13px; color:${C.textSubtle}; margin-top:4px; }

/* Cartes */
.card{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.card-head{
  display:flex; align-items:center; justify-content:space-between;
  gap:${S.md}px; margin-bottom:${S.lg}px; flex-wrap:wrap;
}
.card-title{
  display:flex; align-items:center; gap:8px; margin:0;
  font-size:16px; font-weight:600; letter-spacing:-.01em;
}
.card-title-warn{ color:${C.danger}; }
.card-note{ font-size:12.5px; color:${C.textSubtle}; }

/* Barème */
.bareme{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:${S.md}px; }
.bareme li{ display:flex; align-items:center; gap:${S.md}px; font-size:14px; flex-wrap:wrap; }
.bareme-dot{ width:9px; height:9px; border-radius:50%; flex-shrink:0; }
.bareme-seuil{ font-weight:600; min-width:165px; }
.bareme-effet{ color:${C.textMuted}; }
.rappel{
  display:flex; align-items:flex-start; gap:10px; margin-top:${S.lg}px;
  background:${C.successSoft}; color:${C.success};
  border-radius:${R.md}px; padding:12px 14px; font-size:13.5px; line-height:1.5;
}

/* Membres */
.membres{ list-style:none; margin:0; padding:0; }
.membre-item{
  display:flex; align-items:center; justify-content:space-between; gap:${S.md}px;
  padding:${S.md}px 0; border-bottom:1px solid ${C.border}; flex-wrap:wrap;
}
.membre-item:last-child{ border-bottom:none; }
.membre-nom{ font-size:15px; font-weight:600; }
.membre-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:3px; }
.membre-tags{ display:flex; gap:7px; flex-wrap:wrap; }
.tag{
  display:inline-flex; align-items:center; gap:5px;
  font-size:11.5px; font-weight:600;
  padding:5px 10px; border-radius:${R.pill}px;
}

/* Vide */
.empty-card{
  display:flex; flex-direction:column; align-items:center;
  text-align:center; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.empty-title{ font-size:17px; font-weight:600; margin-top:${S.sm}px; }
.empty-sub{ font-size:14px; color:${C.textSubtle}; }

/* Historique */
.historique{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:${S.md}px; }
.historique li{ display:flex; align-items:center; gap:${S.md}px; font-size:13.5px; flex-wrap:wrap; }
.hist-dot{ width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.hist-nom{ font-weight:600; min-width:145px; }
.hist-type{ color:${C.textMuted}; flex:1; }
.hist-date{ color:${C.textSubtle}; font-size:12.5px; }
.hist-date em{ font-style:normal; color:${C.success}; }

/* Divers */
.spin{ animation:spin 1s linear infinite; }
@keyframes spin{ to{ transform:rotate(360deg); } }
@keyframes slide{ from{ opacity:0; transform:translateY(-4px); } to{ opacity:1; transform:none; } }
.sk{
  height:110px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:shimmer 1.4s infinite;
}
@keyframes shimmer{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;