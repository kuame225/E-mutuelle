import React, { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, Download, RefreshCw,
  ArrowUpRight, ArrowDownRight, Banknote, Smartphone, Search, Receipt, Ticket,
  HandCoins,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const FILTRES = [
  { id: "tout",    label: "Tout" },
  { id: "entrees", label: "Entrées" },
  { id: "sorties", label: "Sorties" },
];

export default function ComptabilitePage() {
  const { params } = useParametrage();
  const [operations, setOperations] = useState([]);
  const [balance, setBalance] = useState({ entrees: 0, sorties: 0, solde: 0 });
  const [parMode, setParMode] = useState({});
  const [parNature, setParNature] = useState({ cotisations: 0, droits: 0, tombola: 0, diverses: 0 });
  const [periodes, setPeriodes] = useState([]);
  const [periode, setPeriode] = useState("toutes");
  const [filtre, setFiltre] = useState("tout");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function charger() {
    setLoading(true);

    const [paieRes, aideRes, droitRes, baremeRes, tickRes, tirageRes, operRes] = await Promise.all([
      // paiements n'a pas de organisation_id propre : on filtre via la
      // cotisation liée, avec !inner pour que le filtre s'applique bien
      // (sinon .eq() sur une relation imbriquée sans !inner est ignoré).
      supabase.from("paiements")
        .select("*, cotisations!inner(periode, membres(nom), organisation_id)")
        .eq("statut_transaction", "confirme")
        .eq("cotisations.organisation_id", params.organisation_id)
        .order("created_at", { ascending: false }),
      supabase.from("aides_sociales")
        .select("*, membres(nom)")
        .eq("statut", "payee")
        .eq("organisation_id", params.organisation_id)
        .order("decide_le", { ascending: false }),
      supabase.from("membres")
        .select("id, nom, droit_adhesion_montant, droit_adhesion_paye_le, droit_adhesion_mode")
        .eq("organisation_id", params.organisation_id)
        .not("droit_adhesion_paye_le", "is", null),
      supabase.from("bareme_prestations")
        .select("type_aide, libelle")
        .eq("organisation_id", params.organisation_id),
      supabase.from("tombola_tickets")
        .select("*, membres(nom)")
        .eq("type_ticket", "payant")
        .eq("organisation_id", params.organisation_id)
        .gt("montant_paye", 0)
        .order("created_at", { ascending: false }),
      supabase.from("tombola_tirages")
        .select("*")
        .eq("statut", "tire")
        .eq("nature_lot", "especes")
        .eq("organisation_id", params.organisation_id)
        .gt("valeur_lot", 0)
        .order("date_tirage", { ascending: false }),
      supabase.from("operations_diverses")
        .select("*")
        .eq("organisation_id", params.organisation_id)
        .order("date_operation", { ascending: false }),
    ]);

    // Libellés officiels des prestations (article 19 et suivants)
    const libellesAide = {};
    (baremeRes.data || []).forEach((b) => { libellesAide[b.type_aide] = b.libelle; });

    // Entrées : cotisations encaissées
    const cotisations = (paieRes.data || []).map((p) => ({
      id: "p" + p.id,
      sens: "entree",
      nature: "cotisation",
      libelle: `Cotisation — ${p.cotisations?.membres?.nom || "—"}`,
      detail: p.cotisations?.periode ? formatPeriode(p.cotisations.periode) : "—",
      montant: p.montant,
      mode: p.mode_paiement,
      date: p.created_at,
    }));

    // Entrées : droits d'adhésion (articles 14 et 15)
    const droits = (droitRes.data || []).map((m) => ({
      id: "d" + m.id,
      sens: "entree",
      nature: "droit_adhesion",
      libelle: `Droit d'adhésion — ${m.nom}`,
      detail: "Article 15",
      montant: m.droit_adhesion_montant || 0,
      mode: m.droit_adhesion_mode || "cash",
      date: m.droit_adhesion_paye_le,
    }));

    // Entrées : tickets de tombola vendus (article 14 — autres apports)
    const tickets = (tickRes.data || []).map((t) => ({
      id: "t" + t.id,
      sens: "entree",
      nature: "tombola",
      libelle: `Ticket tombola — ${t.membres?.nom || "—"}`,
      detail: t.numero || t.trimestre,
      montant: t.montant_paye || 0,
      mode: t.mode_paiement || "cash",
      date: t.created_at,
    }));

    // Sorties : lots de tombola remis en espèces.
    // Un lot en nature n'entraîne aucun décaissement : il n'a pas sa place
    // au livre de comptes, seulement une valeur estimée dans la page Tombola.
    const lots = (tirageRes.data || []).map((t) => ({
      id: "l" + t.id,
      sens: "sortie",
      nature: "lot",
      libelle: `Lot de tombola — ${t.lot_attribue || "—"}`,
      detail: t.trimestre,
      montant: t.valeur_lot || 0,
      mode: "interne",
      date: t.date_tirage || t.created_at,
    }));

    // Opérations diverses : dons et subventions d'un côté, frais de
    // représentation et de fonctionnement de l'autre (articles 14, 30 et 31)
    const toutesOperations = operRes.data || [];

    const recettesDiverses = toutesOperations
      .filter((o) => o.sens === "recette")
      .map((o) => ({
        id: "o" + o.id,
        sens: "entree",
        nature: "diverse",
        libelle: o.libelle,
        detail: libelleCategorie(o.categorie),
        montant: o.montant,
        mode: o.mode_paiement || "cash",
        date: o.date_operation,
      }));

    const depensesDiverses = toutesOperations
      .filter((o) => o.sens === "depense")
      .map((o) => ({
        id: "o" + o.id,
        sens: "sortie",
        nature: "diverse",
        libelle: o.libelle,
        detail: libelleCategorie(o.categorie),
        montant: o.montant,
        mode: o.mode_paiement || "cash",
        date: o.date_operation,
      }));

    // Sorties : aides versées
    const aides = (aideRes.data || []).map((a) => ({
      id: "a" + a.id,
      sens: "sortie",
      nature: "aide",
      libelle: `Aide sociale — ${a.membres?.nom || "—"}`,
      detail: libellesAide[a.type_aide] || a.type_aide,
      montant: a.montant_valide || 0,
      mode: "interne",
      date: a.decide_le || a.created_at,
    }));

    const entrees = [...cotisations, ...droits, ...tickets, ...recettesDiverses];
    const sorties = [...aides, ...lots, ...depensesDiverses];

    const toutes = [...entrees, ...sorties]
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalE = entrees.reduce((s, o) => s + o.montant, 0);
    const totalS = sorties.reduce((s, o) => s + o.montant, 0);

    // Répartition des entrées par mode de règlement
    const modes = {};
    entrees.forEach((o) => {
      modes[o.mode] = (modes[o.mode] || 0) + o.montant;
    });

    // Mois disponibles
    const mois = [...new Set(toutes.map((o) => String(o.date).slice(0, 7)))]
      .sort().reverse();

    setOperations(toutes);
    setBalance({ entrees: totalE, sorties: totalS, solde: totalE - totalS });
    setParMode(modes);
    setParNature({
      cotisations: cotisations.reduce((s, o) => s + o.montant, 0),
      droits: droits.reduce((s, o) => s + o.montant, 0),
      tombola: tickets.reduce((s, o) => s + o.montant, 0),
      diverses: recettesDiverses.reduce((s, o) => s + o.montant, 0),
    });
    setPeriodes(mois);
    setLoading(false);
  }

  useEffect(() => { charger(); }, []);

  const visibles = operations.filter((o) => {
    if (periode !== "toutes" && String(o.date).slice(0, 7) !== periode) return false;
    if (filtre === "entrees" && o.sens !== "entree") return false;
    if (filtre === "sorties" && o.sens !== "sortie") return false;
    if (query && !o.libelle.toLowerCase().includes(query.toLowerCase().trim())) return false;
    return true;
  });

  // Totaux de la sélection courante
  const selE = visibles.filter((o) => o.sens === "entree").reduce((s, o) => s + o.montant, 0);
  const selS = visibles.filter((o) => o.sens === "sortie").reduce((s, o) => s + o.montant, 0);

  function exporterPDF() {
    const sigle = sansAccents(params.nom_mutuelle);
    const denomination = sansAccents(params.adresse || "");
    const localite = sansAccents(params.localite || "");

    const doc = new jsPDF();

    doc.setFillColor(13, 71, 161);
    doc.rect(0, 0, 210, 36, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.setFont("helvetica", "bold");
    doc.text(sigle, 20, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    if (denomination) doc.text(denomination, 20, 21);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("LIVRE DE COMPTES", 20, 31);

    doc.setTextColor(26, 26, 23);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Genere le " + new Date().toLocaleDateString("fr-FR"), 20, 45);
    if (periode !== "toutes") {
      doc.text("Periode : " + sansAccents(formatPeriode(periode)), 110, 45);
    }

    // Balance
    doc.setFillColor(245, 247, 250);
    doc.rect(15, 51, 180, 24, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);

    doc.setTextColor(46, 125, 50);
    doc.text("ENTREES", 22, 59);
    doc.setFontSize(12);
    doc.text(montant(balance.entrees) + " F", 22, 68);

    doc.setFontSize(8);
    doc.setTextColor(211, 47, 47);
    doc.text("SORTIES", 85, 59);
    doc.setFontSize(12);
    doc.text(montant(balance.sorties) + " F", 85, 68);

    doc.setFontSize(8);
    doc.setTextColor(13, 71, 161);
    doc.text("SOLDE", 148, 59);
    doc.setFontSize(12);
    doc.text(montant(balance.solde) + " F", 148, 68);

    // En-tête du tableau
    doc.setFillColor(13, 71, 161);
    doc.rect(15, 82, 180, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("DATE", 18, 87.5);
    doc.text("LIBELLE", 42, 87.5);
    doc.text("MODE", 122, 87.5);
    doc.text("TYPE", 150, 87.5);
    doc.text("MONTANT", 172, 87.5);

    let y = 96;
    doc.setFont("helvetica", "normal");

    visibles.slice(0, 34).forEach((o, i) => {
      if (y > 268) return;
      if (i % 2 === 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(15, y - 4.5, 180, 7, "F");
      }
      doc.setTextColor(26, 26, 23);
      doc.setFontSize(7.5);
      doc.text(new Date(o.date).toLocaleDateString("fr-FR"), 18, y);
      doc.text(sansAccents(o.libelle).slice(0, 42), 42, y);
      doc.text(sansAccents(libelleMode(o.mode)).slice(0, 14), 122, y);

      if (o.sens === "entree") {
        doc.setTextColor(46, 125, 50);
        doc.text("Entree", 150, y);
        doc.text("+ " + montant(o.montant), 172, y);
      } else {
        doc.setTextColor(211, 47, 47);
        doc.text("Sortie", 150, y);
        doc.text("- " + montant(o.montant), 172, y);
      }
      y += 7;
    });

    doc.setFillColor(13, 71, 161);
    doc.rect(0, 282, 210, 15, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Document genere par " + sigle + (localite ? " - " + localite : ""),
      20, 290
    );

    doc.save(
      "livre-comptes-" + motCle(sigle) + "-" +
      new Date().toISOString().slice(0, 10) + ".pdf"
    );
  }

  if (loading) {
    return (
      <div className="cp-wrap">
        <style>{CSS}</style>
        <div className="cp-skel cp-skel-lg" /><div className="cp-skel" />
      </div>
    );
  }

  return (
    <div className="cp-wrap">
      <style>{CSS}</style>

      {/* ---- Balance ---- */}
      <section className="cp-balance">
        <article className="cp-bal cp-bal-in">
          <span className="cp-bal-icon"><ArrowUpRight size={19} /></span>
          <div>
            <div className="cp-bal-lab">Total des entrées</div>
            <div className="cp-bal-val">{montant(balance.entrees)} <em>FCFA</em></div>
          </div>
        </article>

        <article className="cp-bal cp-bal-out">
          <span className="cp-bal-icon"><ArrowDownRight size={19} /></span>
          <div>
            <div className="cp-bal-lab">Total des sorties</div>
            <div className="cp-bal-val">{montant(balance.sorties)} <em>FCFA</em></div>
          </div>
        </article>

        <article className="cp-bal cp-bal-solde">
          <div className="cp-bal-glow" />
          <span className="cp-bal-icon"><Wallet size={19} /></span>
          <div>
            <div className="cp-bal-lab">Solde de la caisse</div>
            <div className="cp-bal-val">{montant(balance.solde)} <em>FCFA</em></div>
          </div>
        </article>
      </section>

      {/* ---- Origine des ressources (article 14) ---- */}
      {balance.entrees > 0 && (
        <section className="cp-card">
          <h3 className="cp-card-titre">Origine des ressources</h3>
          <ul className="cp-natures">
            <li className="cp-nature">
              <span className="cp-nature-icon"><Banknote size={16} /></span>
              <div className="cp-nature-body">
                <span className="cp-nature-nom">Cotisations</span>
                <span className="cp-nature-val">{montant(parNature.cotisations)} F</span>
              </div>
            </li>
            <li className="cp-nature">
              <span className="cp-nature-icon"><Receipt size={16} /></span>
              <div className="cp-nature-body">
                <span className="cp-nature-nom">Droits d'adhésion</span>
                <span className="cp-nature-val">{montant(parNature.droits)} F</span>
              </div>
            </li>
            {parNature.tombola > 0 && (
              <li className="cp-nature">
                <span className="cp-nature-icon"><Ticket size={16} /></span>
                <div className="cp-nature-body">
                  <span className="cp-nature-nom">Tickets de tombola</span>
                  <span className="cp-nature-val">{montant(parNature.tombola)} F</span>
                </div>
              </li>
            )}
            {parNature.diverses > 0 && (
              <li className="cp-nature">
                <span className="cp-nature-icon"><HandCoins size={16} /></span>
                <div className="cp-nature-body">
                  <span className="cp-nature-nom">Dons et subventions</span>
                  <span className="cp-nature-val">{montant(parNature.diverses)} F</span>
                </div>
              </li>
            )}
          </ul>
          <p className="cp-note">
            Les dons, legs et subventions de l'article 14 se saisissent dans
            « Opérations diverses », au même titre que les frais de
            représentation et de fonctionnement.
          </p>
        </section>
      )}

      {/* ---- Répartition par mode ---- */}
      {Object.keys(parMode).length > 0 && (
        <section className="cp-card">
          <h3 className="cp-card-titre">Encaissements par mode de règlement</h3>
          <ul className="cp-modes">
            {Object.entries(parMode)
              .sort(([, a], [, b]) => b - a)
              .map(([mode, total]) => {
                const part = balance.entrees ? (total / balance.entrees) * 100 : 0;
                return (
                  <li key={mode} className="cp-mode">
                    <span className="cp-mode-icon">
                      {mode === "cash" || mode === "especes"
                        ? <Banknote size={16} />
                        : <Smartphone size={16} />}
                    </span>
                    <div className="cp-mode-body">
                      <div className="cp-mode-head">
                        <span className="cp-mode-nom">{libelleMode(mode)}</span>
                        <span className="cp-mode-val">{montant(total)} F</span>
                      </div>
                      <div className="cp-mode-barre">
                        <div style={{ width: `${part}%` }} />
                      </div>
                    </div>
                    <span className="cp-mode-part">{Math.round(part)}%</span>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {/* ---- Outils ---- */}
      <div className="cp-tools">
        <div className="cp-search">
          <Search size={16} className="cp-search-icon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une opération…"
            className="cp-input"
          />
        </div>

        <select
          value={periode}
          onChange={(e) => setPeriode(e.target.value)}
          className="cp-select"
        >
          <option value="toutes">Toutes les périodes</option>
          {periodes.map((p) => (
            <option key={p} value={p}>{formatPeriode(p)}</option>
          ))}
        </select>

        <div className="cp-filtres">
          {FILTRES.map((f) => (
            <button
              key={f.id}
              className={`cp-filtre ${filtre === f.id ? "is-on" : ""}`}
              onClick={() => setFiltre(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="cp-actions">
          <button className="cp-btn-ghost" onClick={charger} title="Actualiser">
            <RefreshCw size={16} />
          </button>
          <button className="cp-btn" onClick={exporterPDF}>
            <Download size={16} /> Exporter
          </button>
        </div>
      </div>

      {/* ---- Journal ---- */}
      <section className="cp-card cp-card-flush">
        <header className="cp-journal-head">
          <span>{visibles.length} opération{visibles.length > 1 ? "s" : ""}</span>
          <span className="cp-journal-totaux">
            <em className="is-in">+ {montant(selE)}</em>
            <em className="is-out">− {montant(selS)}</em>
          </span>
        </header>

        {visibles.length === 0 ? (
          <div className="cp-vide">
            <Wallet size={34} color={PALETTE.grey300} />
            <div className="cp-vide-titre">Aucune opération</div>
            <div className="cp-vide-sub">
              Les encaissements et les aides versées apparaîtront ici.
            </div>
          </div>
        ) : (
          <ul className="cp-ops">
            {visibles.map((o) => (
              <li key={o.id} className="cp-op">
                <span className={`cp-op-icon ${o.sens === "entree" ? "is-in" : "is-out"}`}>
                  {o.sens === "entree" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </span>

                <div className="cp-op-text">
                  <div className="cp-op-lib">{o.libelle}</div>
                  <div className="cp-op-meta">
                    {new Date(o.date).toLocaleDateString("fr-FR")} · {o.detail} · {libelleMode(o.mode)}
                  </div>
                </div>

                <span className={`cp-op-montant ${o.sens === "entree" ? "is-in" : "is-out"}`}>
                  {o.sens === "entree" ? "+" : "−"} {montant(o.montant)} F
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------------- Utilitaires ---------------- */

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function libelleCategorie(c) {
  const map = {
    don: "Don", legs: "Legs", subvention: "Subvention",
    cotisation_exceptionnelle: "Cotisation exceptionnelle",
    autre_recette: "Autre recette",
    representation: "Représentation", fete_ceremonie: "Fête et cérémonie",
    fonctionnement: "Fonctionnement", achat_lot: "Achat de lot",
    autre_depense: "Autre dépense",
  };
  return map[c] || c;
}

function libelleMode(m) {
  const map = {
    cash: "Espèces",
    especes: "Espèces",
    orange_money: "Orange Money",
    mtn_money: "MTN Money",
    moov_money: "Moov Money",
    mobile_money: "Mobile money",
    wave: "Wave",
    virement: "Virement",
    prelevement: "Prélèvement sur intéressements",
    interne: "Virement interne",
  };
  return map[m] || m;
}

// jsPDF en police standard ne rend pas les accents : on les retire à l'export
function sansAccents(texte) {
  return String(texte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function motCle(texte) {
  return sansAccents(texte)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function formatPeriode(p) {
  const mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const [annee, m] = String(p).split("-");
  const index = parseInt(m, 10) - 1;
  return mois[index] ? `${mois[index]} ${annee}` : p;
}

/* ---------------- Styles ---------------- */

const CSS = `
.cp-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .cp-wrap{ padding:${S.lg}px; } }

/* ---- Balance ---- */
.cp-balance{
  display:grid; gap:${S.md}px;
  grid-template-columns:repeat(auto-fit, minmax(230px, 1fr));
}
.cp-bal{
  position:relative; overflow:hidden;
  display:flex; align-items:center; gap:${S.md}px;
  border-radius:${R.xl}px; padding:${S.lg}px;
  border:1px solid ${C.border}; background:${C.surface};
  box-shadow:${SHADOW.xs};
}
.cp-bal-icon{
  width:44px; height:44px; border-radius:${R.md}px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.cp-bal-lab{ font-size:12.5px; opacity:.78; }
.cp-bal-val{ font-size:21px; font-weight:700; letter-spacing:-.02em; margin-top:3px; }
.cp-bal-val em{ font-style:normal; font-size:12px; font-weight:600; opacity:.6; margin-left:4px; }
.cp-bal-in .cp-bal-icon{ background:#DCFCE7; color:${C.success}; }
.cp-bal-in .cp-bal-val{ color:${C.success}; }
.cp-bal-out .cp-bal-icon{ background:#FEE2E2; color:${C.danger}; }
.cp-bal-out .cp-bal-val{ color:${C.danger}; }
.cp-bal-solde{
  background:linear-gradient(135deg, ${PALETTE.blue800}, ${PALETTE.blue600});
  border-color:transparent; color:#fff; box-shadow:${SHADOW.md};
}
.cp-bal-solde .cp-bal-icon{ background:rgba(255,255,255,.18); color:#fff; }
.cp-bal-glow{
  position:absolute; width:150px; height:150px; border-radius:50%;
  background:rgba(255,255,255,.08); right:-50px; top:-60px;
}

/* ---- Cartes ---- */
.cp-card{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.cp-card-flush{ padding:0; overflow:hidden; }
.cp-card-titre{ font-size:15.5px; font-weight:600; margin:0 0 ${S.lg}px; letter-spacing:-.01em; }
.cp-note{
  font-size:12.5px; color:${C.textSubtle};
  line-height:1.55; margin:${S.md}px 0 0;
}

/* ---- Origine des ressources ---- */
.cp-natures{
  list-style:none; margin:0; padding:0; display:grid; gap:${S.md}px;
  grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));
}
.cp-nature{
  display:flex; align-items:center; gap:${S.md}px;
  background:${C.bg}; border-radius:${R.md}px; padding:${S.md}px ${S.lg}px;
}
.cp-nature-icon{
  width:36px; height:36px; border-radius:${R.sm}px; flex-shrink:0;
  background:${C.surface}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
  box-shadow:${SHADOW.xs};
}
.cp-nature-body{ display:flex; flex-direction:column; min-width:0; }
.cp-nature-nom{ font-size:13px; color:${C.textSubtle}; }
.cp-nature-val{ font-size:16px; font-weight:700; color:${C.text}; margin-top:2px; }

/* ---- Modes de règlement ---- */
.cp-modes{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:${S.md}px; }
.cp-mode{ display:flex; align-items:center; gap:${S.md}px; }
.cp-mode-icon{
  width:36px; height:36px; border-radius:${R.sm}px; flex-shrink:0;
  background:${PALETTE.blue50}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.cp-mode-body{ flex:1; min-width:0; }
.cp-mode-head{ display:flex; justify-content:space-between; gap:${S.md}px; }
.cp-mode-nom{ font-size:13.5px; font-weight:600; }
.cp-mode-val{ font-size:13.5px; font-weight:700; color:${C.success}; }
.cp-mode-barre{
  height:6px; border-radius:${R.pill}px; background:${PALETTE.grey200};
  margin-top:6px; overflow:hidden;
}
.cp-mode-barre div{
  height:100%; border-radius:${R.pill}px;
  background:linear-gradient(90deg, ${C.primary}, ${C.primaryLight});
  transition:width .5s ease;
}
.cp-mode-part{
  flex-shrink:0; font-size:12.5px; font-weight:700;
  color:${C.textSubtle}; min-width:38px; text-align:right;
}

/* ---- Outils ---- */
.cp-tools{ display:flex; gap:${S.md}px; flex-wrap:wrap; align-items:center; }
.cp-search{ position:relative; flex:1; min-width:200px; max-width:320px; }
.cp-search-icon{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:${C.textSubtle}; }
.cp-input{
  width:100%; box-sizing:border-box; padding:12px 16px 12px 42px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px;
  color:${C.text}; outline:none; transition:border-color .15s ease, box-shadow .15s ease;
}
.cp-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.cp-select{
  padding:12px 14px; border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14px;
  color:${C.textMuted}; cursor:pointer; outline:none;
}
.cp-select:focus{ border-color:${C.primary}; }
.cp-filtres{ display:flex; gap:3px; background:${C.bg}; padding:3px; border-radius:${R.md}px; }
.cp-filtre{
  border:none; background:transparent; cursor:pointer;
  padding:9px 15px; border-radius:${R.sm}px;
  font-family:inherit; font-size:13px; font-weight:600; color:${C.textSubtle};
  transition:all .16s ease;
}
.cp-filtre.is-on{ background:${C.surface}; color:${C.primary}; box-shadow:${SHADOW.xs}; }
.cp-actions{ margin-left:auto; display:flex; gap:${S.sm}px; }
.cp-btn{
  display:flex; align-items:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.cp-btn:hover{ background:${C.primaryDark}; }
.cp-btn-ghost{
  background:${C.surface}; border:1.5px solid ${C.border}; color:${C.textMuted};
  border-radius:${R.md}px; padding:12px; cursor:pointer; display:flex;
  transition:color .16s ease, border-color .16s ease;
}
.cp-btn-ghost:hover{ color:${C.primary}; border-color:${C.primary}; }

/* ---- Journal ---- */
.cp-journal-head{
  display:flex; align-items:center; justify-content:space-between;
  padding:${S.md}px ${S.lg}px; background:${C.bg};
  border-bottom:1px solid ${C.border};
  font-size:13px; color:${C.textSubtle}; font-weight:600;
}
.cp-journal-totaux{ display:flex; gap:${S.lg}px; }
.cp-journal-totaux em{ font-style:normal; font-weight:700; }
.cp-journal-totaux .is-in{ color:${C.success}; }
.cp-journal-totaux .is-out{ color:${C.danger}; }

.cp-ops{ list-style:none; margin:0; padding:0; }
.cp-op{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border};
}
.cp-op:last-child{ border-bottom:none; }
.cp-op-icon{
  width:36px; height:36px; border-radius:50%; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.cp-op-icon.is-in{ background:#DCFCE7; color:${C.success}; }
.cp-op-icon.is-out{ background:#FEE2E2; color:${C.danger}; }
.cp-op-text{ flex:1; min-width:0; }
.cp-op-lib{
  font-size:14.5px; font-weight:600;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.cp-op-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }
.cp-op-montant{
  flex-shrink:0; font-size:14.5px; font-weight:700;
  font-family:'JetBrains Mono',monospace; white-space:nowrap;
}
.cp-op-montant.is-in{ color:${C.success}; }
.cp-op-montant.is-out{ color:${C.danger}; }

/* ---- Divers ---- */
.cp-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.cp-vide-titre{ font-size:15.5px; font-weight:600; margin-top:${S.sm}px; }
.cp-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:38ch; line-height:1.55; }
.cp-skel{
  height:130px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:cpShim 1.4s infinite;
}
.cp-skel-lg{ height:110px; }
@keyframes cpShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;