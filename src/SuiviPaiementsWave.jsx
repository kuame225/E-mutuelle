import React, { useEffect, useState } from "react";
import { Wallet, CheckCircle2, Clock, Search } from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW } from "./theme";

function montant(v) {
  return Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function SuiviPaiementsWave() {
  const { params } = useParametrage();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtre, setFiltre] = useState("tous"); // tous | payes | attente

  useEffect(() => {
    if (!params.organisation_id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("transactions_wave")
        .select("*, membres(nom)")
        .eq("organisation_id", params.organisation_id)
        .order("created_at", { ascending: false })
        .limit(200);
      setTransactions(data || []);
      setLoading(false);
    })();
  }, [params.organisation_id]);

  const filtrees = transactions
    .filter((t) => (t.membres?.nom || "").toLowerCase().includes(query.toLowerCase().trim()))
    .filter((t) => {
      if (filtre === "payes") return Boolean(t.completed_at);
      if (filtre === "attente") return !t.completed_at;
      return true;
    });

  const totalPayes = transactions.filter((t) => t.completed_at).length;
  const totalEnAttente = transactions.length - totalPayes;

  return (
    <div className="sw-wrap">
      <style>{CSS}</style>

      <header className="sw-head">
        <div>
          <h1 className="sw-titre"><Wallet size={20} /> Suivi des paiements Wave</h1>
          <p className="sw-sous">
            Chaque lien de paiement envoyé, et s'il a réellement mené à un paiement confirmé
            par Wave — pas seulement s'il a été ouvert.
          </p>
        </div>
      </header>

      <div className="sw-kpis">
        <div className="sw-kpi">
          <span className="sw-kpi-icone" style={{ background: "#DCFCE7", color: C.success }}>
            <CheckCircle2 size={18} />
          </span>
          <div>
            <div className="sw-kpi-val">{totalPayes}</div>
            <div className="sw-kpi-label">Payés</div>
          </div>
        </div>
        <div className="sw-kpi">
          <span className="sw-kpi-icone" style={{ background: "#FEF3C7", color: C.warning }}>
            <Clock size={18} />
          </span>
          <div>
            <div className="sw-kpi-val">{totalEnAttente}</div>
            <div className="sw-kpi-label">En attente</div>
          </div>
        </div>
      </div>

      <div className="sw-tools">
        <div className="sw-search">
          <Search size={16} className="sw-search-icone" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher un membre…" className="sw-input"
          />
        </div>
        <div className="sw-filtres">
          {[
            { id: "tous", label: "Tous" },
            { id: "payes", label: "Payés" },
            { id: "attente", label: "En attente" },
          ].map((f) => (
            <button
              key={f.id} className={`sw-filtre ${filtre === f.id ? "is-on" : ""}`}
              onClick={() => setFiltre(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="sw-vide">Chargement…</div>
      ) : filtrees.length === 0 ? (
        <div className="sw-vide">
          {transactions.length === 0
            ? "Aucun lien de paiement Wave n'a encore été envoyé."
            : "Aucun résultat pour ce filtre."}
        </div>
      ) : (
        <ul className="sw-liste">
          {filtrees.map((t) => (
            <li key={t.id} className="sw-ligne">
              <div className="sw-ligne-nom">{t.membres?.nom || "—"}</div>
              <div className="sw-ligne-montant">{montant(t.montant)} FCFA</div>
              <div className="sw-ligne-date">
                Lien envoyé le {new Date(t.created_at).toLocaleDateString("fr-FR")}
              </div>
              {t.completed_at ? (
                <span className="sw-badge sw-badge-paye">
                  <CheckCircle2 size={13} /> Payé le {new Date(t.completed_at).toLocaleDateString("fr-FR")}
                </span>
              ) : (
                <span className="sw-badge sw-badge-attente">
                  <Clock size={13} /> En attente{t.statut ? ` (${t.statut})` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CSS = `
.sw-wrap{ padding:${S.xl}px; max-width:900px; }
.sw-head{ margin-bottom:${S.lg}px; }
.sw-titre{ display:flex; align-items:center; gap:9px; font-size:20px; font-weight:700; margin:0; }
.sw-sous{ font-size:13.5px; color:${C.textSubtle}; margin:6px 0 0; max-width:60ch; line-height:1.5; }

.sw-kpis{ display:flex; gap:${S.md}px; margin-bottom:${S.lg}px; }
.sw-kpi{
  display:flex; align-items:center; gap:12px; flex:1;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:14px 16px; box-shadow:${SHADOW.xs};
}
.sw-kpi-icone{
  width:40px; height:40px; border-radius:${R.md}px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.sw-kpi-val{ font-size:20px; font-weight:700; }
.sw-kpi-label{ font-size:12px; color:${C.textSubtle}; }

.sw-tools{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:${S.lg}px; align-items:center; }
.sw-search{ position:relative; flex:1; min-width:200px; }
.sw-search-icone{ position:absolute; left:12px; top:50%; transform:translateY(-50%); color:${C.textSubtle}; }
.sw-input{
  width:100%; box-sizing:border-box; padding:10px 14px 10px 36px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  font-family:inherit; font-size:13.5px; outline:none;
}
.sw-filtres{ display:flex; gap:6px; }
.sw-filtre{
  background:${C.bg}; border:none; border-radius:${R.sm}px;
  padding:9px 14px; cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:600;
  color:${C.textSubtle};
}
.sw-filtre.is-on{ background:${C.primary}; color:#fff; }

.sw-vide{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:40px; text-align:center; color:${C.textSubtle}; font-size:13.5px;
}

.sw-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.sw-ligne{
  display:grid; grid-template-columns:1fr auto auto auto; gap:14px; align-items:center;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px;
  padding:13px 16px; font-size:13px;
}
@media (max-width:640px){
  .sw-ligne{ grid-template-columns:1fr 1fr; }
}
.sw-ligne-nom{ font-weight:600; }
.sw-ligne-montant{ font-weight:700; color:${C.primary}; }
.sw-ligne-date{ color:${C.textSubtle}; font-size:12px; }
.sw-badge{
  display:flex; align-items:center; gap:5px; white-space:nowrap;
  border-radius:999px; padding:5px 11px; font-size:11.5px; font-weight:600;
}
.sw-badge-paye{ background:#DCFCE7; color:${C.success}; }
.sw-badge-attente{ background:#FEF3C7; color:${C.warning}; }
`;