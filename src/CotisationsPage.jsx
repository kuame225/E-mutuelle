import React, { useEffect, useState } from "react";
import {
  Plus, RefreshCw, Loader2, Search, ChevronDown, ChevronUp,
  CheckCircle2, Clock, AlertTriangle, Wallet, TrendingUp,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";
import PaiementModal from "./PaiementModal";

const STATUT = {
  paye:       { label: "Payé",       color: C.success,   soft: "#DCFCE7", Icon: CheckCircle2 },
  partiel:    { label: "Partiel",    color: C.warning,   soft: "#FEF3C7", Icon: Clock },
  en_attente: { label: "En attente", color: C.textMuted, soft: PALETTE.grey200, Icon: Clock },
  en_retard:  { label: "En retard",  color: C.danger,    soft: "#FEE2E2", Icon: AlertTriangle },
  exempte:    { label: "Exempté",    color: C.textSubtle, soft: PALETTE.grey200, Icon: CheckCircle2 },
};

const FILTRES = [
  { id: "tous",     label: "Toutes" },
  { id: "impayees", label: "À régler" },
  { id: "paye",     label: "Réglées" },
];

export default function CotisationsPage() {
  const { params } = useParametrage();
  const [cotisations, setCotisations] = useState([]);
  const [membres, setMembres] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState(null);
  const [query, setQuery] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [replies, setReplies] = useState({});

  async function charger() {
    setLoading(true);
    const [cotRes, memRes] = await Promise.all([
      supabase.from("cotisations").select("*")
        .eq("organisation_id", params.organisation_id)
        .order("periode", { ascending: false }),
      supabase.from("membres").select("id, nom, poste, photo_url")
        .eq("organisation_id", params.organisation_id),
    ]);
    const map = {};
    (memRes.data || []).forEach((m) => { map[m.id] = m; });
    setMembres(map);
    setCotisations(cotRes.data || []);
    setLoading(false);
  }

  useEffect(() => { charger(); }, []);

  async function genererMois() {
    setGenerating(true);
    setMessage(null);
    const now = new Date();
    const periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dateLimite = new Date(now.getFullYear(), now.getMonth() + 1, 5)
      .toISOString().split("T")[0];

    const { data, error } = await supabase.rpc("generer_cotisations_mois", {
      p_periode: periode,
      p_date_lim: dateLimite,
      p_org: params.organisation_id,
    });
    setGenerating(false);

    if (error) {
      setMessage({ type: "err", texte: error.message });
      return;
    }
    // « Zéro cotisation générée » recouvre deux situations très différentes :
    // soit elles existaient déjà, soit la mutuelle n'a encore aucun membre.
    // Les confondre laissait croire à un travail déjà fait alors qu'il n'y
    // avait simplement personne.
    const aucunMembre = Object.keys(membres).length === 0;

    setMessage({
      type: data === 0 && aucunMembre ? "info" : "ok",
      texte: data > 0
        ? `${data} cotisation${data > 1 ? "s" : ""} générée${data > 1 ? "s" : ""} pour ${formatPeriode(periode)}.`
        : aucunMembre
          ? "Aucun membre dans cette mutuelle : il n'y a pas encore de cotisation à générer."
          : `Les cotisations de ${formatPeriode(periode)} existent déjà.`,
    });
    charger();
  }

  // Filtrage
  const visibles = cotisations.filter((c) => {
    const m = membres[c.membre_id];
    if (!m) return false;
    if (query && !m.nom.toLowerCase().includes(query.toLowerCase().trim())) return false;
    if (filtre === "paye") return c.statut === "paye";
    if (filtre === "impayees") return c.statut !== "paye" && c.statut !== "exempte";
    return true;
  });

  // Regroupement par période
  const groupes = {};
  visibles.forEach((c) => {
    if (!groupes[c.periode]) groupes[c.periode] = [];
    groupes[c.periode].push(c);
  });
  const periodes = Object.keys(groupes).sort().reverse();

  // Totaux généraux
  const totalDu = cotisations.reduce((s, c) => s + c.montant_du, 0);
  const totalPaye = cotisations.reduce((s, c) => s + c.montant_paye, 0);
  const nbRegle = cotisations.filter((c) => c.statut === "paye").length;

  const basculer = (p) => setReplies((r) => ({ ...r, [p]: !r[p] }));

  if (loading) {
    return (
      <div className="ct-wrap">
        <style>{CSS}</style>
        <div className="ct-skel" /><div className="ct-skel" />
      </div>
    );
  }

  return (
    <div className="ct-wrap">
      <style>{CSS}</style>

      {/* ---- Résumé ---- */}
      <section className="ct-summary">
        <div className="ct-sum-item">
          <span className="ct-sum-icon" style={{ background: PALETTE.blue100, color: C.primary }}>
            <Wallet size={18} />
          </span>
          <div>
            <div className="ct-sum-val">{montant(totalPaye)} <em>FCFA</em></div>
            <div className="ct-sum-lab">Encaissé sur {montant(totalDu)} attendus</div>
          </div>
        </div>

        <div className="ct-sum-item">
          <span className="ct-sum-icon" style={{ background: "#DCFCE7", color: C.success }}>
            <TrendingUp size={18} />
          </span>
          <div>
            <div className="ct-sum-val">
              {nbRegle}<em>/{cotisations.length}</em>
            </div>
            <div className="ct-sum-lab">Cotisations réglées</div>
          </div>
        </div>

        <div className="ct-actions">
          <button className="ct-btn-ghost" onClick={charger} title="Actualiser">
            <RefreshCw size={16} />
          </button>
          <button className="ct-btn" onClick={genererMois} disabled={generating}>
            {generating
              ? <><Loader2 size={16} className="ct-spin" /> Génération…</>
              : <><Plus size={16} /> Générer le mois</>}
          </button>
        </div>
      </section>

      {message && (
        <div className={`ct-msg is-${message.type}`}>
          {message.texte}
        </div>
      )}

      {/* ---- Outils ---- */}
      <div className="ct-tools">
        <div className="ct-search">
          <Search size={17} className="ct-search-icon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un membre…"
            className="ct-input"
          />
        </div>
        <div className="ct-filters">
          {FILTRES.map((f) => (
            <button
              key={f.id}
              className={`ct-filter ${filtre === f.id ? "is-on" : ""}`}
              onClick={() => setFiltre(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Périodes ---- */}
      {periodes.length === 0 ? (
        <div className="ct-empty">
          <Wallet size={36} color={PALETTE.grey300} />
          <div className="ct-empty-title">
            {cotisations.length === 0 ? "Aucune cotisation" : "Aucun résultat"}
          </div>
          <div className="ct-empty-sub">
            {cotisations.length === 0
              ? `Cliquez sur « Générer le mois » pour créer les cotisations de ${montant(params.montant_cotisation)} FCFA.`
              : "Essayez un autre nom ou changez de filtre."}
          </div>
        </div>
      ) : (
        periodes.map((periode) => {
          const lignes = groupes[periode];
          const du = lignes.reduce((s, c) => s + c.montant_du, 0);
          const paye = lignes.reduce((s, c) => s + c.montant_paye, 0);
          const regles = lignes.filter((c) => c.statut === "paye").length;
          const taux = du ? Math.round((paye / du) * 100) : 0;
          const replie = replies[periode];

          return (
            <section key={periode} className="ct-periode">
              <button className="ct-periode-head" onClick={() => basculer(periode)}>
                <div className="ct-periode-left">
                  <h3 className="ct-periode-titre">{formatPeriode(periode)}</h3>
                  <span className="ct-periode-meta">
                    {regles}/{lignes.length} réglées · {montant(paye)} / {montant(du)} FCFA
                  </span>
                </div>

                <div className="ct-periode-right">
                  <div className="ct-gauge">
                    <div
                      className="ct-gauge-fill"
                      style={{
                        width: `${taux}%`,
                        background: taux >= 100 ? C.success : taux >= 50 ? C.primaryLight : C.warning,
                      }}
                    />
                  </div>
                  <span className="ct-taux">{taux}%</span>
                  {replie ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </div>
              </button>

              {!replie && (
                <ul className="ct-list">
                  {lignes.map((c) => {
                    const m = membres[c.membre_id];
                    const st = STATUT[c.statut] || STATUT.en_attente;
                    const reste = c.montant_du - c.montant_paye;
                    const enRetard = c.statut !== "paye"
                      && c.statut !== "exempte"
                      && new Date(c.date_limite) < new Date();

                    return (
                      <li key={c.id} className="ct-row">
                        <Avatar membre={m} />

                        <div className="ct-row-text">
                          <div className="ct-row-nom">{m.nom}</div>
                          <div className="ct-row-sub">
                            {montant(c.montant_paye)} / {montant(c.montant_du)} FCFA
                            {enRetard && <span className="ct-late"> · échéance dépassée</span>}
                          </div>
                        </div>

                        <span className="ct-chip" style={{ background: st.soft, color: st.color }}>
                          <st.Icon size={12} /> {st.label}
                        </span>

                        {c.statut !== "paye" && c.statut !== "exempte" && (
                          <button
                            className="ct-pay"
                            onClick={() => setSelected({ cotisation: c, membre: m })}
                          >
                            Encaisser {montant(reste)} F
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      )}

      {selected && (
        <PaiementModal
          cotisation={selected.cotisation}
          membre={selected.membre}
          onClose={() => { setSelected(null); charger(); }}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}

/* ---------------- Sous-composants ---------------- */

function Avatar({ membre }) {
  if (!membre) return null;
  if (membre.photo_url) {
    return <img src={membre.photo_url} alt="" className="ct-avatar-img" />;
  }
  const ini = membre.nom.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase();
  return <div className="ct-avatar">{ini}</div>;
}

/* ---------------- Utilitaires ---------------- */

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatPeriode(p) {
  const mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const [annee, m] = p.split("-");
  return `${mois[parseInt(m) - 1]} ${annee}`;
}

/* ---------------- Styles ---------------- */

const CSS = `
.ct-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .ct-wrap{ padding:${S.lg}px; } }

/* ---- Résumé ---- */
.ct-summary{
  display:flex; align-items:center; gap:${S.xl}px; flex-wrap:wrap;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px ${S.xl}px; box-shadow:${SHADOW.xs};
}
.ct-sum-item{ display:flex; align-items:center; gap:${S.md}px; }
.ct-sum-icon{
  width:42px; height:42px; border-radius:${R.md}px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.ct-sum-val{ font-size:19px; font-weight:700; letter-spacing:-.02em; }
.ct-sum-val em{ font-style:normal; font-size:13px; font-weight:600; color:${C.textSubtle}; }
.ct-sum-lab{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }
.ct-actions{ margin-left:auto; display:flex; gap:${S.sm}px; }
.ct-btn{
  display:flex; align-items:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.ct-btn:hover:not(:disabled){ background:${C.primaryDark}; }
.ct-btn:disabled{ opacity:.6; cursor:not-allowed; }
.ct-btn-ghost{
  background:${C.surface}; border:1.5px solid ${C.border}; color:${C.textMuted};
  border-radius:${R.md}px; padding:12px; cursor:pointer; display:flex;
  transition:color .16s ease, border-color .16s ease;
}
.ct-btn-ghost:hover{ color:${C.primary}; border-color:${C.primary}; }

/* ---- Message ---- */
.ct-msg{ border-radius:${R.md}px; padding:12px 16px; font-size:14px; }
.ct-msg.is-ok{ background:#DCFCE7; color:${C.success}
.ct-msg.is-info{ background:${PALETTE.blue50}; color:${C.primary}; border:1px solid ${PALETTE.blue100}; }; border:1px solid ${C.success}33; }
.ct-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }

/* ---- Outils ---- */
.ct-tools{ display:flex; gap:${S.md}px; flex-wrap:wrap; align-items:center; }
.ct-search{ position:relative; flex:1; min-width:220px; max-width:360px; }
.ct-search-icon{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:${C.textSubtle}; }
.ct-input{
  width:100%; box-sizing:border-box; padding:12px 16px 12px 42px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px;
  color:${C.text}; outline:none; transition:border-color .15s ease, box-shadow .15s ease;
}
.ct-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.ct-filters{ display:flex; gap:${S.xs}px; background:${C.bg}; padding:4px; border-radius:${R.md}px; }
.ct-filter{
  border:none; background:transparent; cursor:pointer;
  padding:9px 16px; border-radius:${R.sm}px;
  font-family:inherit; font-size:13.5px; font-weight:600; color:${C.textSubtle};
  transition:all .16s ease;
}
.ct-filter.is-on{ background:${C.surface}; color:${C.primary}; box-shadow:${SHADOW.xs}; }

/* ---- Période ---- */
.ct-periode{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; overflow:hidden; box-shadow:${SHADOW.xs};
}
.ct-periode-head{
  display:flex; align-items:center; justify-content:space-between;
  gap:${S.lg}px; width:100%; padding:${S.lg}px;
  background:none; border:none; cursor:pointer; font-family:inherit;
  text-align:left; transition:background .16s ease;
}
.ct-periode-head:hover{ background:${C.bg}; }
.ct-periode-titre{ font-size:16px; font-weight:700; margin:0; letter-spacing:-.01em; }
.ct-periode-meta{ font-size:12.5px; color:${C.textSubtle}; }
.ct-periode-right{ display:flex; align-items:center; gap:${S.md}px; color:${C.textSubtle}; flex-shrink:0; }
.ct-gauge{
  width:90px; height:7px; border-radius:${R.pill}px;
  background:${PALETTE.grey200}; overflow:hidden;
}
@media (max-width:520px){ .ct-gauge{ display:none; } }
.ct-gauge-fill{ height:100%; border-radius:${R.pill}px; transition:width .5s ease; }
.ct-taux{ font-size:13px; font-weight:700; color:${C.text}; min-width:38px; text-align:right; }

/* ---- Lignes ---- */
.ct-list{ list-style:none; margin:0; padding:0; border-top:1px solid ${C.border}; }
.ct-row{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border};
  flex-wrap:wrap;
}
.ct-row:last-child{ border-bottom:none; }
.ct-avatar, .ct-avatar-img{
  width:38px; height:38px; border-radius:50%; flex-shrink:0;
}
.ct-avatar{
  background:linear-gradient(135deg, ${PALETTE.blue800}, ${PALETTE.blue600});
  color:#fff; display:flex; align-items:center; justify-content:center;
  font-size:13px; font-weight:700;
}
.ct-avatar-img{ object-fit:cover; background:${PALETTE.grey200}; }
.ct-row-text{ flex:1; min-width:140px; }
.ct-row-nom{ font-size:14.5px; font-weight:600; }
.ct-row-sub{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }
.ct-late{ color:${C.danger}; font-weight:600; }
.ct-chip{
  display:inline-flex; align-items:center; gap:5px; flex-shrink:0;
  padding:5px 11px; border-radius:${R.pill}px;
  font-size:12px; font-weight:600; white-space:nowrap;
}
.ct-pay{
  flex-shrink:0; background:${C.warning}; color:#fff; border:none;
  border-radius:${R.sm}px; padding:9px 14px; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:600; white-space:nowrap;
  transition:background .16s ease;
}
.ct-pay:hover{ background:#DC6803; }

/* ---- Divers ---- */
.ct-empty{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.ct-empty-title{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.ct-empty-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:42ch; line-height:1.55; }
.ct-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:ctShim 1.4s infinite;
}
.ct-spin{ animation:ctSpin 1s linear infinite; }
@keyframes ctSpin{ to{ transform:rotate(360deg); } }
@keyframes ctShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;