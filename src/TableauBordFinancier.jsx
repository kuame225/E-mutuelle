import React, { useEffect, useState } from "react";
import {
  TrendingUp, Wallet, Users, AlertTriangle, HandHeart,
  Gift, RefreshCw, CheckCircle2, ArrowUpRight, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "./supabaseClient";
import { useParametrage, moduleActif } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

export default function TableauBordFinancier() {
  const { params } = useParametrage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function charger() {
    setLoading(true);
    setError("");
    try {
      const [membresRes, cotisRes, aidesRes, ticketsRes] = await Promise.all([
        supabase.from("membres")
          .select("id, nom, poste, statut_cotisation, actif")
          .eq("organisation_id", params.organisation_id),
        supabase.from("cotisations")
          .select("periode, montant_du, montant_paye, statut, membre_id")
          .eq("organisation_id", params.organisation_id),
        supabase.from("aides_sociales")
          .select("montant_valide, statut")
          .eq("organisation_id", params.organisation_id),
        supabase.from("tombola_tickets")
          .select("type_ticket")
          .eq("organisation_id", params.organisation_id),
      ]);

      const membres = membresRes.data || [];
      const cotisations = cotisRes.data || [];
      const aides = aidesRes.data || [];
      const tickets = ticketsRes.data || [];

      const actifs = membres.filter((m) => m.actif);
      const aJour = actifs.filter((m) => m.statut_cotisation === "a_jour").length;
      const partiel = actifs.filter((m) => m.statut_cotisation === "partiel").length;
      const nouveaux = actifs.filter((m) => m.statut_cotisation === "nouveau").length;
      const enRetard = actifs.filter((m) => m.statut_cotisation === "retard").length;
      const taux = actifs.length ? Math.round((aJour / actifs.length) * 100) : 0;

      const totalPaye = cotisations.reduce((s, c) => s + c.montant_paye, 0);
      const totalDu = cotisations.reduce((s, c) => s + c.montant_du, 0);
      const totalAides = aides
        .filter((a) => a.statut === "payee" && a.montant_valide)
        .reduce((s, a) => s + a.montant_valide, 0);
      const cagnotte = tickets.filter((t) => t.type_ticket === "payant").length
        * (params.prix_ticket_tombola || 1000);

      const parPeriode = {};
      cotisations.forEach((c) => {
        if (!parPeriode[c.periode]) parPeriode[c.periode] = { du: 0, paye: 0 };
        parPeriode[c.periode].du += c.montant_du;
        parPeriode[c.periode].paye += c.montant_paye;
      });
      const evolution = Object.entries(parPeriode)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([periode, v]) => ({
          mois: moisCourt(periode),
          Encaissé: v.paye,
          Attendu: v.du,
        }));

      const repartition = [
        { name: "À jour", value: aJour, color: C.success },
        { name: "Partiel", value: partiel, color: C.warning },
        { name: "En retard", value: enRetard, color: C.danger },
        { name: "Nouveaux", value: nouveaux, color: C.primaryLight },
      ].filter((r) => r.value > 0);

      const retardataires = actifs
        .filter((m) => m.statut_cotisation === "retard" || m.statut_cotisation === "partiel")
        .map((m) => ({
          ...m,
          impayes: cotisations.filter((c) => c.membre_id === m.id && c.statut !== "paye").length,
        }))
        .sort((a, b) => b.impayes - a.impayes)
        .slice(0, 6);

      setStats({
        totalMembres: actifs.length, aJour, partiel, enRetard, nouveaux, taux,
        totalPaye, totalDu, totalAides, cagnotte,
        solde: totalPaye - totalAides,
        evolution, repartition, retardataires,
        aidesEnCours: aides.filter((a) => ["en_attente", "en_examen"].includes(a.statut)).length,
      });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    // On attend que l'organisation active soit connue, sinon les requêtes
    // filtreraient sur organisation_id = null et ne renverraient rien.
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id, params.prix_ticket_tombola]);

  if (loading) {
    return (
      <div className="tb-wrap">
        <style>{CSS}</style>
        <div className="sk sk-hero" />
        <div className="sk-grid">
          {[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-kpi" />)}
        </div>
        <div className="sk sk-chart" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="tb-wrap">
        <style>{CSS}</style>
        <div className="alert-box">
          <AlertTriangle size={18} /> {error}
        </div>
      </div>
    );
  }

  const objectif = params.objectif_recouvrement || 90;
  const atteint = stats.taux >= objectif;

  return (
    <div className="tb-wrap">
      <style>{CSS}</style>

      {/* ---- Bandeau objectif ---- */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-inner">
          <div className="hero-left">
            <div className="hero-label">
              <Target size={14} /> Membres à jour
            </div>
            <div className="hero-value">
              {stats.taux}<span className="hero-pct">%</span>
            </div>
            <div className="hero-detail">
              {stats.aJour} membre{stats.aJour > 1 ? "s" : ""} à jour sur {stats.totalMembres}
              {stats.nouveaux > 0 && (
                <> · dont {stats.nouveaux} nouveau{stats.nouveaux > 1 ? "x" : ""} sans cotisation</>
              )}
            </div>
          </div>

          <div className={`hero-badge ${atteint ? "is-ok" : ""}`}>
            {atteint ? <CheckCircle2 size={26} /> : <TrendingUp size={26} />}
            <div className="hero-badge-text">
              <div className="hero-badge-title">
                {atteint ? "Objectif atteint" : "En progression"}
              </div>
              <div className="hero-badge-sub">Cible : {objectif} %</div>
            </div>
          </div>
        </div>

        <div className="gauge">
          <div
            className="gauge-fill"
            style={{
              width: `${Math.min(stats.taux, 100)}%`,
              background: atteint
                ? `linear-gradient(90deg, ${C.success}, #4ADE80)`
                : `linear-gradient(90deg, ${C.warning}, #FBBF24)`,
            }}
          />
          <div className="gauge-mark" style={{ left: `${objectif}%` }} />
        </div>
        <div className="gauge-legend">
          <span>0 %</span>
          <span className="gauge-target" style={{ left: `${objectif}%` }}>
            Objectif {objectif} %
          </span>
          <span>100 %</span>
        </div>
      </section>

      {/* ---- Indicateurs ---- */}
      <section className="kpi-grid">
        <Kpi
          label="Solde de la caisse"
          value={montant(stats.solde)}
          unit="FCFA"
          hint="Cotisations − aides versées"
          Icon={Wallet}
          color={C.primary}
        />
        <Kpi
          label="Total encaissé"
          value={montant(stats.totalPaye)}
          unit="FCFA"
          hint={`sur ${montant(stats.totalDu)} F attendus`}
          Icon={ArrowUpRight}
          color={C.success}
        />
        <Kpi
          label="Aides versées"
          value={montant(stats.totalAides)}
          unit="FCFA"
          hint={`${stats.aidesEnCours} demande${stats.aidesEnCours > 1 ? "s" : ""} en cours`}
          Icon={HandHeart}
          color={C.warning}
        />
        {moduleActif(params, "module_tombola") && (
          <Kpi
            label="Cagnotte tombola"
            value={montant(stats.cagnotte)}
            unit="FCFA"
            hint="Circuit financier séparé"
            Icon={Gift}
            color={C.primaryLight}
          />
        )}
      </section>

      {/* ---- Graphiques ---- */}
      <section className="charts">
        <article className="card card-chart">
          <header className="card-head">
            <div>
              <h3 className="card-title">Évolution des encaissements</h3>
              <p className="card-sub">6 dernières périodes</p>
            </div>
            <button className="btn-icon" onClick={charger} title="Actualiser">
              <RefreshCw size={16} />
            </button>
          </header>

          {stats.evolution.length ? (
            <div className="chart-zone">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.evolution} barGap={6}>
                  <CartesianGrid stroke={C.border} vertical={false} />
                  <XAxis
                    dataKey="mois" axisLine={false} tickLine={false}
                    tick={{ fontSize: 12, fill: C.textSubtle }}
                  />
                  <YAxis
                    axisLine={false} tickLine={false}
                    tick={{ fontSize: 12, fill: C.textSubtle }}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  />
                  <Tooltip
                    cursor={{ fill: PALETTE.blue50 }}
                    contentStyle={{
                      borderRadius: 12, border: `1px solid ${C.border}`,
                      boxShadow: SHADOW.md, fontSize: 13, fontFamily: "Inter, sans-serif",
                    }}
                    formatter={(v, n) => [`${montant(v)} FCFA`, n]}
                  />
                  <Bar dataKey="Attendu" fill={PALETTE.grey200} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Encaissé" fill={C.primary} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty">Aucune cotisation enregistrée.</div>
          )}
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <h3 className="card-title">Répartition des membres</h3>
              <p className="card-sub">{stats.totalMembres} membres actifs</p>
            </div>
          </header>

          {stats.repartition.length ? (
            <>
              <div className="donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.repartition} dataKey="value"
                      innerRadius="66%" outerRadius="92%"
                      paddingAngle={3} strokeWidth={0}
                    >
                      {stats.repartition.map((r, i) => <Cell key={i} fill={r.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12, border: `1px solid ${C.border}`,
                        boxShadow: SHADOW.md, fontSize: 13, fontFamily: "Inter, sans-serif",
                      }}
                      formatter={(v, n) => [`${v} membre${v > 1 ? "s" : ""}`, n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <div className="donut-num">{stats.totalMembres}</div>
                  <div className="donut-lab">membres</div>
                </div>
              </div>

              <ul className="legend">
                {stats.repartition.map((r) => (
                  <li key={r.name}>
                    <span className="dot" style={{ background: r.color }} />
                    <span className="legend-name">{r.name}</span>
                    <span className="legend-val" style={{ color: r.color }}>{r.value}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="empty">Aucun membre actif.</div>
          )}
        </article>
      </section>

      {/* ---- Retardataires ---- */}
      {stats.retardataires.length > 0 && (
        <section className="card">
          <header className="card-head">
            <div>
              <h3 className="card-title card-title-warn">
                <AlertTriangle size={17} /> Situations à régulariser
              </h3>
              <p className="card-sub">
                {stats.retardataires.length} membre{stats.retardataires.length > 1 ? "s" : ""} concerné{stats.retardataires.length > 1 ? "s" : ""}
              </p>
            </div>
          </header>

          <ul className="retard-grid">
            {stats.retardataires.map((m) => {
              const grave = m.statut_cotisation === "retard";
              return (
                <li
                  key={m.id}
                  className="retard-item"
                  style={{
                    background: grave ? C.dangerSoft : C.warningSoft,
                    borderColor: (grave ? C.danger : C.warning) + "33",
                  }}
                >
                  <div className="retard-info">
                    <div className="retard-nom">{m.nom}</div>
                    {m.poste && <div className="retard-poste">{m.poste}</div>}
                  </div>
                  <span
                    className="retard-badge"
                    style={{
                      background: grave ? C.danger : C.warning,
                      color: "#fff",
                    }}
                  >
                    {grave
                      ? `${m.impayes} impayé${m.impayes > 1 ? "s" : ""}`
                      : "Partiel"}
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

/* ---------------- Sous-composant ---------------- */

function Kpi({ label, value, unit, hint, Icon, color }) {
  return (
    <article className="kpi">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon" style={{ background: color + "14", color }}>
          <Icon size={18} />
        </span>
      </div>
      <div className="kpi-value" style={{ color }}>
        {value}<span className="kpi-unit">{unit}</span>
      </div>
      <div className="kpi-hint">{hint}</div>
    </article>
  );
}

/* ---------------- Helpers ---------------- */

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function moisCourt(periode) {
  const m = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
    "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  const [, mois] = periode.split("-");
  return m[parseInt(mois) - 1] || periode;
}

/* ---------------- Styles ---------------- */

const CSS = `
.tb-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.xl}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .tb-wrap{ padding:${S.lg}px; gap:${S.lg}px; } }

/* ---- Bandeau objectif ---- */
.hero{
  position:relative; overflow:hidden;
  background:linear-gradient(135deg, ${PALETTE.blue900} 0%, ${PALETTE.blue800} 55%, ${PALETTE.blue600} 130%);
  color:#fff; border-radius:${R.xxl}px; padding:${S.xl}px;
  box-shadow:${SHADOW.lg};
}
.hero-glow{
  position:absolute; width:320px; height:320px; border-radius:50%;
  background:rgba(255,255,255,.06); right:-100px; top:-140px;
}
.hero-inner{
  position:relative; display:flex; align-items:flex-start;
  justify-content:space-between; gap:${S.lg}px; flex-wrap:wrap;
}
.hero-label{
  display:flex; align-items:center; gap:7px;
  font-size:12.5px; font-weight:600; letter-spacing:.07em;
  text-transform:uppercase; opacity:.75;
}
.hero-value{ font-size:52px; font-weight:700; letter-spacing:-.03em; line-height:1.05; margin-top:6px; }
.hero-pct{ font-size:28px; font-weight:600; opacity:.8; margin-left:3px; }
.hero-detail{ font-size:14.5px; opacity:.8; margin-top:4px; }
.hero-badge{
  display:flex; align-items:center; gap:${S.md}px;
  background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2);
  border-radius:${R.lg}px; padding:${S.md}px ${S.lg}px;
}
.hero-badge.is-ok{ background:rgba(74,222,128,.18); border-color:rgba(74,222,128,.4); }
.hero-badge-title{ font-size:15px; font-weight:600; }
.hero-badge-sub{ font-size:12.5px; opacity:.75; }

.gauge{
  position:relative; height:10px; border-radius:${R.pill}px;
  background:rgba(255,255,255,.18); margin-top:${S.xl}px; overflow:visible;
}
.gauge-fill{
  height:100%; border-radius:${R.pill}px;
  transition:width .7s cubic-bezier(.4,0,.2,1);
}
.gauge-mark{
  position:absolute; top:-4px; width:2px; height:18px;
  background:rgba(255,255,255,.85); border-radius:2px;
}
.gauge-legend{
  position:relative; display:flex; justify-content:space-between;
  font-size:11.5px; opacity:.65; margin-top:9px;
}
.gauge-target{
  position:absolute; transform:translateX(-50%);
  white-space:nowrap; font-weight:600; opacity:.9;
}

/* ---- KPI ---- */
.kpi-grid{
  display:grid; gap:${S.lg}px;
  grid-template-columns:repeat(auto-fit, minmax(215px, 1fr));
}
.kpi{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px;
  box-shadow:${SHADOW.xs};
  transition:transform .15s ease, box-shadow .18s ease;
}
.kpi:hover{ transform:translateY(-2px); box-shadow:${SHADOW.md}; }
.kpi-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.sm}px; }
.kpi-label{ font-size:13px; font-weight:500; color:${C.textSubtle}; line-height:1.35; }
.kpi-icon{
  width:38px; height:38px; border-radius:${R.md}px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.kpi-value{
  font-size:26px; font-weight:700; letter-spacing:-.02em;
  margin-top:${S.md}px; line-height:1.15;
}
.kpi-unit{ font-size:13px; font-weight:600; opacity:.65; margin-left:5px; }
.kpi-hint{ font-size:12.5px; color:${C.textSubtle}; margin-top:5px; }

/* ---- Cartes ---- */
.card{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.card-head{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:${S.md}px; margin-bottom:${S.lg}px;
}
.card-title{
  display:flex; align-items:center; gap:8px;
  font-size:16px; font-weight:600; margin:0; letter-spacing:-.01em;
}
.card-title-warn{ color:${C.danger}; }
.card-sub{ font-size:13px; color:${C.textSubtle}; margin:3px 0 0; }
.btn-icon{
  background:none; border:1px solid ${C.border}; border-radius:${R.sm}px;
  color:${C.textSubtle}; cursor:pointer; padding:7px; flex-shrink:0;
  display:flex; transition:color .16s ease, border-color .16s ease;
}
.btn-icon:hover{ color:${C.primary}; border-color:${C.primary}; }

.charts{
  display:grid; gap:${S.lg}px;
  grid-template-columns:1fr;
}
@media (min-width:1000px){
  .charts{ grid-template-columns:1.55fr 1fr; }
}
.chart-zone{ height:250px; }
.empty{
  height:180px; display:flex; align-items:center; justify-content:center;
  color:${C.textSubtle}; font-size:14px;
}

/* ---- Donut ---- */
.donut{ position:relative; height:200px; }
.donut-center{
  position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; pointer-events:none;
}
.donut-num{ font-size:30px; font-weight:700; letter-spacing:-.02em; }
.donut-lab{ font-size:12px; color:${C.textSubtle}; }
.legend{ list-style:none; margin:${S.lg}px 0 0; padding:0; display:flex; flex-direction:column; gap:11px; }
.legend li{ display:flex; align-items:center; gap:10px; font-size:13.5px; }
.dot{ width:9px; height:9px; border-radius:50%; flex-shrink:0; }
.legend-name{ flex:1; color:${C.textMuted}; }
.legend-val{ font-weight:700; }

/* ---- Retardataires ---- */
.retard-grid{
  list-style:none; margin:0; padding:0; display:grid; gap:${S.md}px;
  grid-template-columns:repeat(auto-fit, minmax(255px, 1fr));
}
.retard-item{
  display:flex; align-items:center; justify-content:space-between; gap:${S.md}px;
  border:1px solid; border-radius:${R.md}px; padding:${S.md}px ${S.lg}px;
}
.retard-info{ min-width:0; }
.retard-nom{ font-size:14.5px; font-weight:600; }
.retard-poste{
  font-size:12.5px; color:${C.textSubtle}; margin-top:2px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.retard-badge{
  font-size:11.5px; font-weight:600; padding:5px 11px;
  border-radius:${R.pill}px; flex-shrink:0; white-space:nowrap;
}

/* ---- Alerte ---- */
.alert-box{
  display:flex; align-items:center; gap:10px;
  background:${C.dangerSoft}; color:${C.danger};
  border:1px solid ${C.danger}33; border-radius:${R.md}px;
  padding:14px 16px; font-size:14px;
}

/* ---- Skeletons ---- */
.sk{
  border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:shimmer 1.4s infinite;
}
.sk-hero{ height:190px; border-radius:${R.xxl}px; }
.sk-grid{ display:grid; gap:${S.lg}px; grid-template-columns:repeat(auto-fit, minmax(215px, 1fr)); }
.sk-kpi{ height:130px; }
.sk-chart{ height:300px; }
@keyframes shimmer{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
`;