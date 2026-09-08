import React, { useEffect, useState } from "react";
import {
  ArrowLeft, HandCoins, Users, Clock, CheckCircle2, Banknote,
  XCircle, AlertCircle, Eye,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { sauverCache, lireCache, ressembleAUneCoupureReseau } from "./offlineCache";
import { C, R, S, SHADOW, PALETTE } from "./theme";

function montant(v) {
  return Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const STATUTS = {
  transmis: { label: "Transmis", couleur: C.warning, fond: "#FEF3C7", Icone: Clock },
  accorde: { label: "Accordé", couleur: C.primary, fond: PALETTE.blue100, Icone: CheckCircle2 },
  decaisse: { label: "Décaissé", couleur: C.success, fond: "#DCFCE7", Icone: Banknote },
  solde: { label: "Soldé", couleur: C.textMuted, fond: PALETTE.grey200, Icone: CheckCircle2 },
  rejete: { label: "Rejeté", couleur: C.danger, fond: "#FEE2E2", Icone: XCircle },
};

// Écran de consultation seule : le superviseur voit l'activité des ASC
// et du responsable AGR, sans aucun moyen d'y intervenir. Aucun bouton
// d'action n'y figure — la sécurité côté serveur le refuserait de
// toute façon, mais montrer des boutons inopérants serait trompeur.
export default function MembreSupervisionAgr({ membre, onBack }) {
  const [appuis, setAppuis] = useState([]);
  const [versements, setVersements] = useState([]);
  const [beneficiaires, setBeneficiaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [depuisCache, setDepuisCache] = useState(false);
  const [horodatageCache, setHorodatageCache] = useState(null);
  const [filtre, setFiltre] = useState("tous");

  useEffect(() => {
    async function charger() {
      const idCache = `supervision_agr_${membre.id}`;

      const dejaEnCache = lireCache(idCache);
      if (dejaEnCache) {
        setAppuis(dejaEnCache.donnees.appuis);
        setVersements(dejaEnCache.donnees.versements);
        setBeneficiaires(dejaEnCache.donnees.beneficiaires);
        setLoading(false);
      }

      try {
        const [appuisRes, versRes, benefRes] = await Promise.all([
          supabase.from("appuis_agr").select("*, beneficiaires_ong(nom, contact)")
            .eq("organisation_id", membre.organisation_id)
            .order("transmis_le", { ascending: false }),
          supabase.from("appuis_agr_versements").select("*")
            .eq("organisation_id", membre.organisation_id),
          supabase.from("beneficiaires_ong").select("id, nom, created_at")
            .eq("organisation_id", membre.organisation_id),
        ]);

        for (const r of [appuisRes, versRes, benefRes]) {
          if (r.error && ressembleAUneCoupureReseau(r.error)) throw r.error;
        }

        const resultat = {
          appuis: appuisRes.data || [],
          versements: versRes.data || [],
          beneficiaires: benefRes.data || [],
        };
        sauverCache(idCache, resultat);

        setAppuis(resultat.appuis);
        setVersements(resultat.versements);
        setBeneficiaires(resultat.beneficiaires);
        setDepuisCache(false);
        setLoading(false);
      } catch (e) {
        const secours = lireCache(idCache);
        if (secours) {
          setAppuis(secours.donnees.appuis);
          setVersements(secours.donnees.versements);
          setBeneficiaires(secours.donnees.beneficiaires);
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

  const totalDecaisse = appuis
    .filter((a) => a.statut === "decaisse" || a.statut === "solde")
    .reduce((s, a) => s + Number(a.montant_accorde || 0), 0);

  const totalRembourse = versements
    .filter((v) => v.statut === "depose")
    .reduce((s, v) => s + Number(v.montant), 0);

  const enAttente = appuis.filter((a) => a.statut === "transmis").length;

  const filtres = appuis.filter((a) => {
    if (filtre === "attente") return a.statut === "transmis";
    if (filtre === "cours") return a.statut === "decaisse";
    if (filtre === "soldes") return a.statut === "solde";
    return true;
  });

  return (
    <div style={{ padding: 24 }}>
      <button onClick={onBack} style={styles.retour}><ArrowLeft size={16} /> Retour</button>

      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Supervision des appuis</h2>
      <p style={{ fontSize: 13.5, color: C.textSubtle, marginBottom: 20 }}>
        Consultation de l'activité des ASC et des décaissements — sans intervention possible.
      </p>

      {depuisCache && (
        <div style={styles.horsLigne}>
          Dernières données connues du{" "}
          {new Date(horodatageCache).toLocaleDateString("fr-FR")} à{" "}
          {new Date(horodatageCache).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}

      <div style={styles.kpis}>
        <div style={styles.kpi}>
          <div style={styles.kpiIcone(PALETTE.blue100, C.primary)}><Users size={17} /></div>
          <div>
            <div style={styles.kpiVal}>{beneficiaires.length}</div>
            <div style={styles.kpiLabel}>Bénéficiaires suivis</div>
          </div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiIcone("#DCFCE7", C.success)}><Banknote size={17} /></div>
          <div>
            <div style={styles.kpiVal}>{montant(totalDecaisse)} F</div>
            <div style={styles.kpiLabel}>Total décaissé</div>
          </div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiIcone(PALETTE.blue100, C.primaryLight)}><CheckCircle2 size={17} /></div>
          <div>
            <div style={styles.kpiVal}>{montant(totalRembourse)} F</div>
            <div style={styles.kpiLabel}>Total remboursé</div>
          </div>
        </div>
        {enAttente > 0 && (
          <div style={styles.kpi}>
            <div style={styles.kpiIcone("#FEF3C7", C.warning)}><Clock size={17} /></div>
            <div>
              <div style={styles.kpiVal}>{enAttente}</div>
              <div style={styles.kpiLabel}>En attente de décision</div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.filtres}>
        {[
          { id: "tous", label: "Tous" },
          { id: "attente", label: "En attente" },
          { id: "cours", label: "En cours" },
          { id: "soldes", label: "Soldés" },
        ].map((f) => (
          <button
            key={f.id}
            style={{ ...styles.filtre, ...(filtre === f.id ? styles.filtreActif : {}) }}
            onClick={() => setFiltre(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtres.length === 0 ? (
        <div style={styles.vide}>
          <HandCoins size={34} color={C.textSubtle} />
          <div style={{ marginTop: 10 }}>Aucun appui à afficher.</div>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {filtres.map((a) => {
            const s = STATUTS[a.statut] || STATUTS.transmis;
            const depose = versements
              .filter((v) => v.appui_id === a.id && v.statut === "depose")
              .reduce((t, v) => t + Number(v.montant), 0);
            const reste = a.montant_a_rembourser != null
              ? Math.max(a.montant_a_rembourser - depose, 0) : null;

            return (
              <li key={a.id} style={styles.carte}>
                <div style={styles.carteHaut}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>
                      {a.beneficiaires_ong?.nom || "—"}
                    </div>
                    <div style={{ fontSize: 12.5, color: C.textSubtle, marginTop: 3 }}>
                      {a.type_agr || a.activite_a_entreprendre || "Activité non précisée"}
                    </div>
                  </div>
                  <span style={{ ...styles.chip, background: s.fond, color: s.couleur }}>
                    <s.Icone size={12} /> {s.label}
                  </span>
                </div>

                <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 8 }}>
                  {a.montant_accorde != null
                    ? <>Accordé : <strong>{montant(a.montant_accorde)} F</strong></>
                    : <>Demandé : <strong>{montant(a.montant_demande)} F</strong></>}
                  {a.montant_a_rembourser != null && (
                    <> · Remboursé : <strong>{montant(depose)} / {montant(a.montant_a_rembourser)} F</strong></>
                  )}
                </div>

                {a.date_decaissement && (
                  <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 3 }}>
                    Décaissé le {new Date(a.date_decaissement).toLocaleDateString("fr-FR")}
                  </div>
                )}

                {a.montant_a_rembourser != null && reste != null && (
                  <div style={styles.jauge}>
                    <div style={{
                      width: `${Math.min((depose / a.montant_a_rembourser) * 100, 100)}%`,
                      height: "100%", borderRadius: 999,
                      background: reste === 0 ? C.success : C.primary,
                    }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const styles = {
  retour: {
    display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
    color: C.primary, fontFamily: "inherit", fontSize: 13.5, fontWeight: 600,
    cursor: "pointer", padding: 0, marginBottom: 16,
  },
  horsLigne: {
    display: "flex", alignItems: "center", gap: 8, background: "#FEF3C7",
    color: "#92400E", borderRadius: 10, padding: "10px 14px",
    fontSize: 12.5, marginBottom: 16, lineHeight: 1.4,
  },
  kpis: {
    display: "grid", gap: 12, marginBottom: 20,
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  },
  kpi: {
    display: "flex", alignItems: "center", gap: 11,
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.xl,
    padding: "13px 15px", boxShadow: SHADOW.xs,
  },
  kpiIcone: (bg, color) => ({
    width: 38, height: 38, borderRadius: R.md, flexShrink: 0, background: bg, color,
    display: "flex", alignItems: "center", justifyContent: "center",
  }),
  kpiVal: { fontSize: 15, fontWeight: 700 },
  kpiLabel: { fontSize: 11.5, color: C.textSubtle, marginTop: 1 },
  filtres: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" },
  filtre: {
    background: C.bg, border: "none", borderRadius: R.sm, padding: "8px 14px",
    cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
    color: C.textSubtle,
  },
  filtreActif: { background: C.primary, color: "#fff" },
  carte: {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg,
    padding: "14px 16px", boxShadow: SHADOW.xs,
  },
  carteHaut: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    gap: 10, flexWrap: "wrap",
  },
  chip: {
    display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999,
    padding: "4px 11px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap",
  },
  jauge: {
    height: 6, borderRadius: 999, background: PALETTE.grey200,
    overflow: "hidden", marginTop: 10,
  },
  vide: {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.xl,
    padding: 40, textAlign: "center", color: C.textSubtle, fontSize: 13.5,
  },
};