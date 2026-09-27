import React, { useEffect, useState } from "react";
import {
  Plus, RefreshCw, Loader2, Search, ChevronDown, ChevronUp,
  CheckCircle2, Clock, AlertTriangle, Wallet, TrendingUp, Zap, Check,
  Banknote, Smartphone,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { useVocabulaire } from "./useVocabulaire";
import { de } from "./vocabulaire";
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

// Modes disponibles pour la saisie rapide / le mode collecte — un seul mode
// actif à la fois pour toute la séance, pour ne pas réintroduire un choix
// par ligne (ce serait retomber dans la friction qu'on cherche à retirer).
const MODES_RAPIDES = [
  { id: "cash",         label: "Cash",         Icon: Banknote },
  { id: "orange_money", label: "Orange Money", Icon: Smartphone },
  { id: "mtn_money",    label: "MTN Money",    Icon: Smartphone },
  { id: "moov_money",   label: "Moov Money",   Icon: Smartphone },
  { id: "wave",         label: "Wave",         Icon: Smartphone },
];

export default function CotisationsPage() {
  const { params } = useParametrage();
  const { mot } = useVocabulaire();
  const [cotisations, setCotisations] = useState([]);
  const [membres, setMembres] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState(null);
  const [query, setQuery] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [replies, setReplies] = useState({});

  // --- Saisie rapide / mode collecte ---
  const [collecteActive, setCollecteActive] = useState(false);
  const [selection, setSelection] = useState({}); // { [cotisation.id]: true }
  const [payingIds, setPayingIds] = useState({}); // { [cotisation.id]: true } — spinner par ligne
  const [bulkLoading, setBulkLoading] = useState(false);
  const [modePaiement, setModePaiement] = useState("cash"); // mode actif pour la séance en cours
  const modeActif = MODES_RAPIDES.find((m) => m.id === modePaiement) || MODES_RAPIDES[0];

  // Mémorisation du mode par organisation (clé par organisation_id pour
  // qu'un même appareil administrant plusieurs organisations ne mélange pas
  // leurs habitudes de collecte respectives).
  useEffect(() => {
    if (!params.organisation_id) return;
    try {
      const stocke = localStorage.getItem(`baamo_mode_paiement_${params.organisation_id}`);
      if (stocke && MODES_RAPIDES.some((m) => m.id === stocke)) {
        setModePaiement(stocke);
      }
    } catch (_) {
      // localStorage indisponible (navigation privée, etc.) — on reste sur "cash".
    }
  }, [params.organisation_id]);

  useEffect(() => {
    if (!params.organisation_id) return;
    try {
      localStorage.setItem(`baamo_mode_paiement_${params.organisation_id}`, modePaiement);
    } catch (_) {
      // Rien de grave si l'écriture échoue — juste pas de mémorisation cette fois.
    }
  }, [modePaiement, params.organisation_id]);

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
        ? `${data} ${data > 1 ? mot("cotisations").toLowerCase() : mot("cotisation").toLowerCase()} générée${data > 1 ? "s" : ""} pour ${formatPeriode(periode)}.`
        : aucunMembre
          ? `Pas encore ${de(mot("membres").toLowerCase())} : il n'y a pas encore ${de(mot("cotisation").toLowerCase())} à générer.`
          : `Les ${mot("cotisations").toLowerCase()} de ${formatPeriode(periode)} existent déjà.`,
    });
    charger();
  }

  // --- Paiement rapide (un membre, montant complet, cash) ---
  async function payerRapide(cotisation) {
    setPayingIds((p) => ({ ...p, [cotisation.id]: true }));
    setMessage(null);

    const reste = cotisation.montant_du - cotisation.montant_paye;
    const { error } = await supabase.rpc("enregistrer_paiement", {
      p_cotisation_id: cotisation.id,
      p_montant: reste,
      p_mode: modePaiement,
      p_reference: null,
    });

    setPayingIds((p) => {
      const next = { ...p };
      delete next[cotisation.id];
      return next;
    });

    if (error) {
      setMessage({ type: "err", texte: `Échec pour ${membres[cotisation.membre_id]?.nom || "ce membre"} : ${error.message}` });
      return;
    }

    // Retrait de la sélection si elle y était, puis rechargement des données.
    setSelection((s) => {
      if (!s[cotisation.id]) return s;
      const next = { ...s };
      delete next[cotisation.id];
      return next;
    });
    charger();
  }

  function toggleCollecte() {
    setCollecteActive((v) => !v);
    setSelection({});
  }

  function toggleSelect(id) {
    setSelection((s) => {
      const next = { ...s };
      if (next[id]) delete next[id]; else next[id] = true;
      return next;
    });
  }

  function toggleSelectPeriode(lignesImpayees) {
    const idsPeriode = lignesImpayees.map((c) => c.id);
    const tousDejaSelectionnes = idsPeriode.length > 0 && idsPeriode.every((id) => selection[id]);
    setSelection((s) => {
      const next = { ...s };
      idsPeriode.forEach((id) => {
        if (tousDejaSelectionnes) delete next[id]; else next[id] = true;
      });
      return next;
    });
  }

  // --- Confirmation groupée de la sélection ---
  const idsSelectionnes = Object.keys(selection).filter((id) => selection[id]);
  const cotisationsSelectionnees = cotisations.filter((c) => selection[c.id]);
  const totalSelection = cotisationsSelectionnees.reduce(
    (s, c) => s + (c.montant_du - c.montant_paye), 0
  );

  async function confirmerSelection() {
    if (idsSelectionnes.length === 0) return;
    setBulkLoading(true);
    setMessage(null);

    const resultats = await Promise.allSettled(
      cotisationsSelectionnees.map((c) =>
        supabase.rpc("enregistrer_paiement", {
          p_cotisation_id: c.id,
          p_montant: c.montant_du - c.montant_paye,
          p_mode: modePaiement,
          p_reference: null,
        }).then(({ error }) => {
          if (error) throw error;
          return c.id;
        })
      )
    );

    const reussis = resultats.filter((r) => r.status === "fulfilled").length;
    const echoues = resultats.length - reussis;

    setBulkLoading(false);
    setSelection({});

    setMessage({
      type: echoues === 0 ? "ok" : "err",
      texte: echoues === 0
        ? `${reussis} paiement${reussis > 1 ? "s" : ""} confirmé${reussis > 1 ? "s" : ""}.`
        : `${reussis} paiement${reussis > 1 ? "s" : ""} confirmé${reussis > 1 ? "s" : ""}, ${echoues} en échec — réessayez pour ceux-là.`,
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
            <div className="ct-sum-lab">{mot("cotisations")} réglées</div>
          </div>
        </div>

        <div className="ct-actions">
          <button
            className={`ct-btn-collecte ${collecteActive ? "is-on" : ""}`}
            onClick={toggleCollecte}
            title="Mode collecte : saisie groupée pour une séance"
          >
            <Zap size={16} /> {collecteActive ? "Quitter la collecte" : "Mode collecte"}
          </button>
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

      {/* ---- Mode de paiement actif pour la saisie rapide ---- */}
      <div className="ct-mode-select">
        <span className="ct-mode-label">Mode pour la saisie rapide :</span>
        <div className="ct-mode-pills">
          {MODES_RAPIDES.map((m) => (
            <button
              key={m.id}
              className={`ct-mode-pill ${modePaiement === m.id ? "is-on" : ""}`}
              onClick={() => setModePaiement(m.id)}
              title={`Les paiements "Payé" en un clic et le mode collecte utiliseront ${m.label}`}
            >
              <m.Icon size={13} /> {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Outils ---- */}
      <div className="ct-tools">
        <div className="ct-search">
          <Search size={17} className="ct-search-icon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Rechercher ${mot("membre_un")}…`}
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
            {cotisations.length === 0 ? `Aucune ${mot("cotisation").toLowerCase()}` : "Aucun résultat"}
          </div>
          <div className="ct-empty-sub">
            {cotisations.length === 0
              ? `Cliquez sur « Générer le mois » pour créer les ${mot("cotisations").toLowerCase()} de ${montant(params.montant_cotisation)} FCFA.`
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
          const lignesImpayees = lignes.filter((c) => c.statut !== "paye" && c.statut !== "exempte");
          const tousSelectionnes = lignesImpayees.length > 0
            && lignesImpayees.every((c) => selection[c.id]);

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
                <>
                  {collecteActive && lignesImpayees.length > 0 && (
                    <div className="ct-select-all">
                      <label>
                        <input
                          type="checkbox"
                          checked={tousSelectionnes}
                          onChange={() => toggleSelectPeriode(lignesImpayees)}
                        />
                        Tout sélectionner ({lignesImpayees.length} à régler)
                      </label>
                    </div>
                  )}

                  <ul className="ct-list">
                    {lignes.map((c) => {
                      const m = membres[c.membre_id];
                      const st = STATUT[c.statut] || STATUT.en_attente;
                      const reste = c.montant_du - c.montant_paye;
                      const enRetard = c.statut !== "paye"
                        && c.statut !== "exempte"
                        && new Date(c.date_limite) < new Date();
                      const enCours = !!payingIds[c.id];
                      const reglable = c.statut !== "paye" && c.statut !== "exempte";

                      return (
                        <li key={c.id} className="ct-row">
                          {collecteActive && reglable && (
                            <input
                              type="checkbox"
                              className="ct-row-check"
                              checked={!!selection[c.id]}
                              onChange={() => toggleSelect(c.id)}
                            />
                          )}

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

                          {reglable && (
                            <div className="ct-row-actions">
                              <button
                                className="ct-quickpay"
                                disabled={enCours}
                                onClick={() => payerRapide(c)}
                                title={`Encaisser ${montant(reste)} FCFA — ${modeActif.label}`}
                              >
                                {enCours
                                  ? <Loader2 size={14} className="ct-spin" />
                                  : <Check size={14} />}
                                {" "}Payé ({modeActif.label})
                              </button>
                              <button
                                className="ct-pay-autre"
                                onClick={() => setSelected({ cotisation: c, membre: m })}
                              >
                                Autre
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
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

      {collecteActive && idsSelectionnes.length > 0 && (
        <div className="ct-bulkbar">
          <div className="ct-bulkbar-info">
            <strong>{idsSelectionnes.length}</strong> sélectionné{idsSelectionnes.length > 1 ? "s" : ""}
            {" · "}{montant(totalSelection)} FCFA
          </div>
          <button
            className="ct-btn-bulk"
            disabled={bulkLoading}
            onClick={confirmerSelection}
          >
            {bulkLoading
              ? <><Loader2 size={16} className="ct-spin" /> Confirmation…</>
              : <><Check size={16} /> Confirmer les paiements ({modeActif.label})</>}
          </button>
        </div>
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
.ct-btn-collecte{
  display:flex; align-items:center; gap:8px;
  background:${C.surface}; border:1.5px solid ${C.border}; color:${C.textMuted};
  border-radius:${R.md}px; padding:12px 16px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600;
  transition:all .16s ease;
}
.ct-btn-collecte.is-on{
  background:${C.primary}; border-color:${C.primary}; color:#fff;
}

/* ---- Message ---- */
.ct-msg{ border-radius:${R.md}px; padding:12px 16px; font-size:14px; }
.ct-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.ct-msg.is-info{ background:${PALETTE.blue50}; color:${C.primary}; border:1px solid ${PALETTE.blue100}; }
.ct-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }

/* ---- Sélecteur de mode (saisie rapide) ---- */
.ct-mode-select{ display:flex; align-items:center; gap:${S.sm}px; flex-wrap:wrap; }
.ct-mode-label{ font-size:12.5px; font-weight:600; color:${C.textSubtle}; }
.ct-mode-pills{ display:flex; gap:6px; flex-wrap:wrap; }
.ct-mode-pill{
  display:flex; align-items:center; gap:6px;
  background:${C.surface}; border:1.5px solid ${C.border}; color:${C.textMuted};
  border-radius:${R.pill}px; padding:6px 12px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600;
  transition:all .16s ease;
}
.ct-mode-pill.is-on{
  background:${C.primary}; border-color:${C.primary}; color:#fff;
}

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

/* ---- Sélection groupée ---- */
.ct-select-all{
  padding:${S.sm}px ${S.lg}px; border-top:1px solid ${C.border};
  background:${C.bg};
}
.ct-select-all label{
  display:flex; align-items:center; gap:8px; font-size:13px;
  font-weight:600; color:${C.textMuted}; cursor:pointer;
}

/* ---- Lignes ---- */
.ct-list{ list-style:none; margin:0; padding:0; border-top:1px solid ${C.border}; }
.ct-row{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border};
  flex-wrap:wrap;
}
.ct-row:last-child{ border-bottom:none; }
.ct-row-check{ flex-shrink:0; width:18px; height:18px; accent-color:${C.primary}; cursor:pointer; }
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
.ct-row-actions{ display:flex; align-items:center; gap:6px; flex-shrink:0; }
.ct-quickpay{
  display:flex; align-items:center; gap:6px;
  background:${C.success}; color:#fff; border:none;
  border-radius:${R.sm}px; padding:9px 14px; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:700; white-space:nowrap;
  transition:background .16s ease;
}
.ct-quickpay:hover:not(:disabled){ background:#15803D; }
.ct-quickpay:disabled{ opacity:.65; cursor:not-allowed; }
.ct-pay-autre{
  background:transparent; border:none; color:${C.textSubtle};
  font-family:inherit; font-size:12px; font-weight:600; cursor:pointer;
  padding:6px 4px; text-decoration:underline;
}

/* ---- Barre de confirmation groupée ---- */
.ct-bulkbar{
  position:sticky; bottom:${S.lg}px; z-index:10;
  display:flex; align-items:center; justify-content:space-between; gap:${S.lg}px;
  background:${C.text}; color:#fff;
  border-radius:${R.xl}px; padding:${S.md}px ${S.lg}px;
  box-shadow:${SHADOW.md || SHADOW.sm};
}
.ct-bulkbar-info{ font-size:13.5px; }
.ct-btn-bulk{
  display:flex; align-items:center; gap:8px;
  background:${C.success}; color:#fff; border:none;
  border-radius:${R.md}px; padding:11px 18px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:700;
  transition:background .16s ease;
}
.ct-btn-bulk:hover:not(:disabled){ background:#15803D; }
.ct-btn-bulk:disabled{ opacity:.7; cursor:not-allowed; }

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
