import React, { useEffect, useState } from "react";
import { ArrowLeft, Coins, HeartHandshake, Banknote, CheckCircle2, Clock, WifiOff } from "lucide-react";
import { supabase } from "./supabaseClient";
import { sauverCache, lireCache } from "./offlineCache";
import { C, R, S, SHADOW, PALETTE } from "./theme";

function montant(v) {
  return Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const LABELS_STATUT_PRET = {
  en_attente: "En attente", approuve: "En cours", solde: "Soldé", rejete: "Rejeté",
};

export default function MembreEpargneAvec({ membre, onBack }) {
  const [cycle, setCycle] = useState(null);
  const [parts, setParts] = useState([]);
  const [presences, setPresences] = useState([]);
  const [pret, setPret] = useState(null);
  const [echeances, setEcheances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [depuisCache, setDepuisCache] = useState(false);
  const [horodatageCache, setHorodatageCache] = useState(null);

  useEffect(() => {
    async function charger() {
      const idCache = `epargne_avec_${membre.id}`;
      try {
        const { data: c } = await supabase
          .from("avec_cycles")
          .select("*")
          .eq("organisation_id", membre.organisation_id)
          .eq("statut", "en_cours")
          .maybeSingle();

        if (!c) {
          // Pas de cycle en cours : un état légitime, pas une panne
          // réseau — on met aussi le cache à jour, pour ne jamais
          // réafficher un ancien cycle déjà clôturé comme actif.
          sauverCache(idCache, { cycle: null, parts: [], presences: [], pret: null, echeances: [] });
          setCycle(null);
          setDepuisCache(false);
          setLoading(false);
          return;
        }
        setCycle(c);

        const { data: reunions } = await supabase
          .from("avec_reunions").select("id").eq("cycle_id", c.id);
        const idsReunions = (reunions || []).map((r) => r.id);

        const [{ data: p }, { data: pr }, { data: pret1 }] = await Promise.all([
          idsReunions.length
            ? supabase.from("avec_achats_parts").select("*").eq("membre_id", membre.id).in("reunion_id", idsReunions)
            : Promise.resolve({ data: [] }),
          idsReunions.length
            ? supabase.from("avec_presences").select("*").eq("membre_id", membre.id).in("reunion_id", idsReunions)
            : Promise.resolve({ data: [] }),
          supabase.from("prets").select("*")
            .eq("membre_id", membre.id).eq("organisation_id", membre.organisation_id)
            .in("statut", ["en_attente", "approuve"])
            .order("demande_le", { ascending: false })
            .limit(1).maybeSingle(),
        ]);

        let echeancesData = [];
        if (pret1) {
          const { data: e } = await supabase
            .from("pret_echeances").select("*").eq("pret_id", pret1.id).order("numero_echeance");
          echeancesData = e || [];
        }

        const resultat = {
          cycle: c, parts: p || [], presences: pr || [], pret: pret1 || null, echeances: echeancesData,
        };
        sauverCache(idCache, resultat);

        setParts(resultat.parts);
        setPresences(resultat.presences);
        setPret(resultat.pret);
        setEcheances(resultat.echeances);
        setDepuisCache(false);
        setLoading(false);
      } catch (e) {
        const secours = lireCache(idCache);
        if (secours) {
          setCycle(secours.donnees.cycle);
          setParts(secours.donnees.parts);
          setPresences(secours.donnees.presences);
          setPret(secours.donnees.pret);
          setEcheances(secours.donnees.echeances);
          setDepuisCache(true);
          setHorodatageCache(secours.horodatage);
        }
        setLoading(false);
      }
    }
    charger();
  }, [membre.id, membre.organisation_id]);

  if (loading) {
    return <div style={{ padding: 24, color: C.textSubtle }}>Chargement…</div>;
  }

  if (!cycle) {
    return (
      <div style={{ padding: 24 }}>
        <button onClick={onBack} style={boutonRetour}><ArrowLeft size={16} /> Retour</button>
        <div style={carteVide}>Aucun cycle d'épargne AVEC en cours pour le moment.</div>
      </div>
    );
  }

  const totalParts = parts.reduce((s, p) => s + p.nombre_parts, 0);
  const totalEpargne = parts.reduce((s, p) => s + p.montant, 0);
  const soldeDu = presences.reduce((s, p) => s + Math.max((p.montant_du || 0) - (p.montant_paye || 0), 0), 0);
  const totalRembourse = echeances.reduce((s, e) => s + (e.montant_paye || 0), 0);

  return (
    <div style={{ padding: 24 }}>
      <button onClick={onBack} style={boutonRetour}><ArrowLeft size={16} /> Retour</button>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Mon épargne AVEC</h2>
      <p style={{ fontSize: 13.5, color: C.textSubtle, marginBottom: 20 }}>{cycle.titre}</p>

      {depuisCache && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, background: "#FEF3C7",
          color: "#92400E", borderRadius: 10, padding: "10px 14px", fontSize: 12.5,
          marginBottom: 20, lineHeight: 1.4,
        }}>
          <WifiOff size={14} style={{ flexShrink: 0 }} />
          Dernières données connues du{" "}
          {new Date(horodatageCache).toLocaleDateString("fr-FR")} à{" "}
          {new Date(horodatageCache).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 20 }}>
        <div style={carte}>
          <div style={carteIcone(PALETTE.blue100, C.primary)}><Coins size={18} /></div>
          <div>
            <div style={carteVal}>{montant(totalEpargne)} FCFA</div>
            <div style={carteLabel}>{totalParts} part{totalParts > 1 ? "s" : ""} accumulée{totalParts > 1 ? "s" : ""}</div>
          </div>
        </div>

        {cycle.montant_fonds_social > 0 && (
          <div style={carte}>
            <div style={carteIcone(soldeDu > 0 ? "#FEE2E2" : "#DCFCE7", soldeDu > 0 ? C.danger : C.success)}>
              <HeartHandshake size={18} />
            </div>
            <div>
              <div style={carteVal}>{soldeDu > 0 ? `${montant(soldeDu)} FCFA dû` : "À jour"}</div>
              <div style={carteLabel}>Fonds social</div>
            </div>
          </div>
        )}
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Mon prêt</h3>
      {!pret ? (
        <div style={carteVide}>Aucun prêt en cours.</div>
      ) : (
        <div style={carteBloc}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{pret.libelle_type}</div>
            <span style={{
              fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
              background: pret.statut === "approuve" ? PALETTE.blue100 : PALETTE.grey200,
              color: pret.statut === "approuve" ? C.primary : C.textMuted,
            }}>
              {LABELS_STATUT_PRET[pret.statut] || pret.statut}
            </span>
          </div>
          <div style={{ fontSize: 13.5, color: C.textSubtle, marginBottom: 12 }}>
            {montant(totalRembourse)} / {montant(pret.montant_total_a_rembourser)} FCFA remboursés
          </div>
          {echeances.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {echeances.map((e) => (
                <li key={e.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  fontSize: 13, padding: "7px 0", borderBottom: `1px solid ${C.border}`,
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {e.montant_paye ? <CheckCircle2 size={14} color={C.success} /> : <Clock size={14} color={C.textSubtle} />}
                    Échéance {e.numero_echeance} — {new Date(e.date_prevue).toLocaleDateString("fr-FR")}
                  </span>
                  <strong>{montant(e.montant_prevu)} FCFA</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const boutonRetour = {
  display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
  color: C.primary, fontFamily: "inherit", fontSize: 13.5, fontWeight: 600,
  cursor: "pointer", padding: 0, marginBottom: 16,
};
const carte = {
  display: "flex", alignItems: "center", gap: 12,
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.xl,
  padding: "14px 16px", boxShadow: SHADOW.xs,
};
const carteIcone = (bg, color) => ({
  width: 40, height: 40, borderRadius: R.md, flexShrink: 0,
  background: bg, color, display: "flex", alignItems: "center", justifyContent: "center",
});
const carteVal = { fontSize: 15, fontWeight: 700 };
const carteLabel = { fontSize: 11.5, color: C.textSubtle, marginTop: 1 };
const carteBloc = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.xl,
  padding: 18, boxShadow: SHADOW.xs,
};
const carteVide = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.xl,
  padding: 30, textAlign: "center", color: C.textSubtle, fontSize: 13.5,
};