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
import { blocsAAfficher, BLOCS } from "./compositionTableauBord";
import {
  BlocRecouvrement, BlocCapitalSocial, BlocEpargneAvec, BlocAppuisAgr,
  BlocTresorerie, BlocAides, BlocPrets, BlocProjets, BlocDons, BlocEffectif,
} from "./BlocsTableauBord";
import { C, R, S, SHADOW, PALETTE } from "./theme";

export default function TableauBordFinancier() {
  const { params } = useParametrage();
  const [stats, setStats] = useState(null);
  const [statsCoop, setStatsCoop] = useState(null);
  const [statsBlocs, setStatsBlocs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // La composition du tableau de bord dépend du type d'organisation et
  // de ses modules actifs — voir compositionTableauBord.js. Chaque type voit
  // ce qui le concerne : une ONG ses appuis AGR, une coopérative son
  // capital social, une mutuelle son taux de recouvrement.
  const blocs = blocsAAfficher(params);
  const aBloc = (id) => blocs.includes(id);

  const estCooperative = params.type_organisation === "cooperative";

  // Charge uniquement ce que les blocs affichés réclament — inutile
  // d'interroger les appuis AGR pour une mutuelle qui ne les montre pas.
  async function chargerBlocsSpecifiques() {
    const resultat = {};

    if (aBloc(BLOCS.APPUIS_AGR)) {
      const [{ data: benef }, { data: appuis }, { data: versements }] = await Promise.all([
        supabase.from("beneficiaires_ong").select("id")
          .eq("organisation_id", params.organisation_id),
        supabase.from("appuis_agr").select("statut, montant_accorde, montant_a_rembourser")
          .eq("organisation_id", params.organisation_id),
        supabase.from("appuis_agr_versements").select("montant, statut")
          .eq("organisation_id", params.organisation_id),
      ]);

      const listeAppuis = appuis || [];
      resultat.agr = {
        beneficiaires: (benef || []).length,
        enAttente: listeAppuis.filter((a) => a.statut === "transmis").length,
        totalAccorde: listeAppuis.reduce((s, a) => s + Number(a.montant_accorde || 0), 0),
        totalARembourser: listeAppuis.reduce((s, a) => s + Number(a.montant_a_rembourser || 0), 0),
        totalRembourse: (versements || [])
          .filter((v) => v.statut === "depose")
          .reduce((s, v) => s + Number(v.montant), 0),
      };
    }

    if (aBloc(BLOCS.EPARGNE_AVEC)) {
      const { data: cycle } = await supabase.from("avec_cycles")
        .select("id").eq("organisation_id", params.organisation_id)
        .eq("statut", "en_cours").maybeSingle();

      if (cycle) {
        const { data: reunions } = await supabase.from("avec_reunions")
          .select("id").eq("cycle_id", cycle.id);
        const ids = (reunions || []).map((r) => r.id);
        const { data: achats } = ids.length
          ? await supabase.from("avec_achats_parts").select("membre_id, montant").in("reunion_id", ids)
          : { data: [] };

        resultat.avec = {
          cycleEnCours: true,
          capital: (achats || []).reduce((s, a) => s + Number(a.montant), 0),
          societaires: new Set((achats || []).map((a) => a.membre_id)).size,
        };
      } else {
        resultat.avec = { cycleEnCours: false, capital: 0, societaires: 0 };
      }
    }

    if (aBloc(BLOCS.PRETS) && !estCooperative) {
      const { data: prets } = await supabase.from("prets")
        .select("statut, montant_principal")
        .eq("organisation_id", params.organisation_id);
      const liste = prets || [];
      const enCours = liste.filter((p) => p.statut === "approuve");
      resultat.prets = {
        enCours: enCours.length,
        encours: enCours.reduce((s, p) => s + Number(p.montant_principal || 0), 0),
        enAttente: liste.filter((p) => p.statut === "en_attente").length,
      };
    }

    if (aBloc(BLOCS.PROJETS)) {
      const { data: projets } = await supabase.from("projets_ong")
        .select("statut, budget_total")
        .eq("organisation_id", params.organisation_id);
      const liste = projets || [];
      resultat.projets = {
        enCours: liste.filter((p) => p.statut === "en_cours").length,
        budgetTotal: liste.reduce((s, p) => s + Number(p.budget_total || 0), 0),
      };
    }

    if (aBloc(BLOCS.DONS)) {
      const { data: dons } = await supabase.from("dons")
        .select("montant, statut")
        .eq("organisation_id", params.organisation_id);
      const confirmes = (dons || []).filter((d) => d.statut === "confirme");
      resultat.dons = {
        total: confirmes.reduce((s, d) => s + Number(d.montant || 0), 0),
        nombre: confirmes.length,
      };
    }

    // Une organisation sans cotisation (une ONG) n'a pas de solde
    // "cotisations moins aides" : sa trésorerie, ce sont les fonds
    // reçus (dons, opérations de recette) moins ce qui sort — appuis
    // décaissés et dépenses de fonctionnement.
    if (aBloc(BLOCS.TRESORERIE) && Number(params.montant_cotisation ?? 0) <= 0) {
      const { data: operations } = await supabase.from("operations_diverses")
        .select("sens, montant")
        .eq("organisation_id", params.organisation_id);

      const liste = operations || [];
      const recettes = liste.filter((o) => o.sens === "recette")
        .reduce((s, o) => s + Number(o.montant || 0), 0);
      const depenses = liste.filter((o) => o.sens === "depense")
        .reduce((s, o) => s + Number(o.montant || 0), 0);

      const totalDons = resultat.dons?.total || 0;
      const appuisDecaisses = resultat.agr?.totalAccorde || 0;
      const appuisRembourses = resultat.agr?.totalRembourse || 0;

      const entrees = recettes + totalDons + appuisRembourses;
      resultat.tresorerieOng = {
        entrees,
        solde: entrees - depenses - appuisDecaisses,
      };
    }

    setStatsBlocs(resultat);
  }

  async function charger() {
    setLoading(true);
    setError("");
    try {
      if (estCooperative) {
        const [mouvementsRes, pretsRes] = await Promise.all([
          supabase.from("parts_sociales_mouvements")
            .select("membre_id, type_mouvement, nombre_parts, montant")
            .eq("organisation_id", params.organisation_id),
          supabase.from("prets")
            .select("membre_id, statut, montant_principal, montant_total_a_rembourser")
            .eq("organisation_id", params.organisation_id),
        ]);

        const mouvements = mouvementsRes.data || [];
        const prets = pretsRes.data || [];

        const capitalSocial = mouvements.reduce(
          (s, m) => s + (m.type_mouvement === "souscription" ? m.montant : -m.montant), 0
        );

        const partsParMembre = {};
        mouvements.forEach((m) => {
          const delta = m.type_mouvement === "souscription" ? m.nombre_parts : -m.nombre_parts;
          partsParMembre[m.membre_id] = (partsParMembre[m.membre_id] || 0) + delta;
        });
        const societaires = Object.values(partsParMembre).filter((n) => n > 0).length;

        const pretsEnCours = prets.filter((p) => p.statut === "approuve");
        const pretsEnAttente = prets.filter((p) => p.statut === "en_attente").length;
        const encoursPrets = pretsEnCours.reduce((s, p) => s + (p.montant_principal || 0), 0);

        setStatsCoop({
          capitalSocial, societaires,
          nombrePretsEnCours: pretsEnCours.length, encoursPrets, pretsEnAttente,
        });
      } else {
        await chargerCotisations();
      }

      // Les blocs propres au type (appuis AGR, épargne AVEC, projets,
      // dons…) se chargent dans tous les cas — ils ne dépendent pas du
      // découpage historique coopérative / reste.
      await chargerBlocsSpecifiques();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function chargerCotisations() {
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

  // Le rendu est désormais piloté par compositionTableauBord.js : chaque type
  // affiche les blocs qui le concernent, dans l'ordre déclaré. Le
  // premier bloc de bandeau rencontré occupe la tête de l'écran.
  const objectif = params.objectif_recouvrement || 90;

  const bandeau = aBloc(BLOCS.RECOUVREMENT) ? (
    <BlocRecouvrement stats={stats} objectif={objectif} />
  ) : aBloc(BLOCS.CAPITAL_SOCIAL) && statsCoop ? (
    <BlocCapitalSocial statsCoop={statsCoop} />
  ) : aBloc(BLOCS.EPARGNE_AVEC) && statsBlocs.avec ? (
    <BlocEpargneAvec statsAvec={statsBlocs.avec} />
  ) : aBloc(BLOCS.APPUIS_AGR) && statsBlocs.agr ? (
    <BlocAppuisAgr statsAgr={statsBlocs.agr} />
  ) : null;

  return (
    <div className="tb-wrap">
      <style>{CSS}</style>

      {bandeau}

      <section className="kpi-grid">
        {aBloc(BLOCS.TRESORERIE) && (
          statsBlocs.tresorerieOng ? (
            <BlocTresorerie stats={{
              labelSolde: "Trésorerie disponible",
              solde: statsBlocs.tresorerieOng.solde,
              hintSolde: "Entrées \u2212 appuis décaissés \u2212 dépenses",
              labelEncaisse: "Fonds reçus",
              totalPaye: statsBlocs.tresorerieOng.entrees,
              hintEncaisse: "Dons et opérations de recette",
            }} />
          ) : stats ? (
            <BlocTresorerie stats={{
              solde: stats.solde,
              totalPaye: stats.totalPaye,
              hintSolde: "Cotisations \u2212 aides versées",
              hintEncaisse: `sur ${montant(stats.totalDu)} F attendus`,
            }} />
          ) : null
        )}
        {aBloc(BLOCS.AIDES) && stats && (
          <BlocAides stats={{
            totalAides: stats.totalAides,
            hintAides: `${stats.aidesEnCours} demande${stats.aidesEnCours > 1 ? "s" : ""} en cours`,
          }} />
        )}
        {aBloc(BLOCS.PRETS) && (statsBlocs.prets || statsCoop) && (
          <BlocPrets statsPrets={statsBlocs.prets || {
            enCours: statsCoop.nombrePretsEnCours,
            encours: statsCoop.encoursPrets,
            enAttente: statsCoop.pretsEnAttente,
          }} />
        )}
        {aBloc(BLOCS.PROJETS) && statsBlocs.projets && (
          <BlocProjets statsProjets={statsBlocs.projets} />
        )}
        {aBloc(BLOCS.DONS) && statsBlocs.dons && (
          <BlocDons statsDons={statsBlocs.dons} />
        )}
        {aBloc(BLOCS.EFFECTIF) && stats && (
          <BlocEffectif stats={stats} />
        )}
      </section>

      {/* ---- Graphiques ---- */}
      {(aBloc(BLOCS.EVOLUTION) || aBloc(BLOCS.REPARTITION)) && stats && (
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
      )}

      {/* ---- Retardataires ---- */}
      {aBloc(BLOCS.RETARDATAIRES) && stats?.retardataires?.length > 0 && (
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