import React, { useState } from "react";
import { X, Smartphone, Banknote, Check, Loader2, Download } from "lucide-react";
import { supabase } from "./supabaseClient";
import { genererRecu } from "./RecuPaiement";
import { C, serif, mono } from "./theme";
import { useParametrage } from "./useParametrage";

const MODES = [
  { id: "cash", label: "Espèces (cash)", icon: Banknote, desc: "Enregistrement manuel par le trésorier" },
  { id: "orange_money", label: "Orange Money", icon: Smartphone, desc: "Paiement Mobile Money" },
  { id: "mtn_money", label: "MTN Money", icon: Smartphone, desc: "Paiement Mobile Money" },
  { id: "moov_money", label: "Moov Money", icon: Smartphone, desc: "Paiement Mobile Money" },
  { id: "wave", label: "Wave", icon: Smartphone, desc: "Paiement Mobile Money" },
];

export default function PaiementModal({ cotisation, membre, onClose, onSuccess }) {
  const { params } = useParametrage();
  const [mode, setMode] = useState("cash");
  const [montant, setMontant] = useState(cotisation.montant_du - cotisation.montant_paye);
  const [fractionne, setFractionne] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [paiementInfo, setPaiementInfo] = useState(null);

  const resteAPayer = cotisation.montant_du - cotisation.montant_paye;

  async function handlePayer() {
    setLoading(true);
    setError("");

    const { error } = await supabase.rpc("enregistrer_paiement", {
      p_cotisation_id: cotisation.id,
      p_montant: montant,
      p_mode: mode,
      p_reference: null,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Stocker les infos pour le reçu
    setPaiementInfo({
      id: crypto.randomUUID(),
      montant,
      mode_paiement: mode,
      reference_transaction: null,
      created_at: new Date().toISOString(),
    });

    setDone(true);
  }

  function handleRecu() {
    if (!paiementInfo) return;
    genererRecu({
      membre,
      cotisation: {
        ...cotisation,
        montant_paye: cotisation.montant_paye + montant,
      },
      paiement: paiementInfo,
    });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "#00000055",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.paper, borderRadius: 16, padding: 28,
          width: "100%", maxWidth: 480,
          boxShadow: "0 20px 60px -10px #00000033",
        }}
      >
        {done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: C.tealLight + "22",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
            }}>
              <Check size={28} color={C.tealLight} strokeWidth={3} />
            </div>
            <div style={{ ...serif, fontSize: 18, fontWeight: 600, color: C.teal }}>
              Paiement enregistré !
            </div>
            <div style={{ fontSize: 13, color: C.ink + "88", marginTop: 6, marginBottom: 22 }}>
              Le statut du membre a été mis à jour automatiquement.
            </div>
            <button
              onClick={handleRecu}
              style={{
                width: "100%", background: C.teal, color: "#fff", border: "none",
                borderRadius: 10, padding: "12px 0", fontWeight: 700, fontSize: 14,
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 8, marginBottom: 10,
              }}
            >
              <Download size={16} /> Télécharger le reçu PDF
            </button>
            <button
              onClick={onClose}
              style={{
                width: "100%", background: "transparent", color: C.teal,
                border: `1.5px solid ${C.teal}33`, borderRadius: 10,
                padding: "11px 0", fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ ...serif, fontSize: 17, fontWeight: 600 }}>Enregistrer un paiement</div>
                <div style={{ fontSize: 12.5, color: C.ink + "77", marginTop: 2 }}>
                  {membre.nom} · {cotisation.periode}
                </div>
              </div>
              <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer" }}>
                <X size={20} color={C.ink + "66"} />
              </button>
            </div>

            {/* Résumé cotisation */}
            <div style={{ background: C.cream, borderRadius: 10, padding: "12px 14px", marginBottom: 18 }}>
              {[
                ["Montant dû", cotisation.montant_du.toLocaleString("fr-FR") + " FCFA"],
                ["Déjà payé", cotisation.montant_paye.toLocaleString("fr-FR") + " FCFA"],
                ["Reste à payer", resteAPayer.toLocaleString("fr-FR") + " FCFA"],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                  <span style={{ color: C.ink + "88" }}>{l}</span>
                  <span style={{ fontWeight: 700, ...mono }}>{v}</span>
                </div>
              ))}
              <div style={{ height: 6, background: C.teal + "14", borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
                <div style={{
                  width: `${(cotisation.montant_paye / cotisation.montant_du) * 100}%`,
                  height: "100%", background: C.tealLight,
                }} />
              </div>
            </div>

            {/* Option fractionnée */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={fractionne} onChange={(e) => {
                setFractionne(e.target.checked);
                setMontant(e.target.checked
                  ? Math.floor(resteAPayer / params.max_fractions)
                  : resteAPayer);
              }} style={{ accentColor: C.teal }} />
              Paiement fractionné ({params.max_fractions} versements de{" "}
              {Math.floor(resteAPayer / params.max_fractions).toLocaleString("fr-FR")} FCFA)
            </label>

            {fractionne && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: C.teal, display: "block", marginBottom: 6 }}>
                  Montant de ce versement (FCFA)
                </label>
                <input
                  type="number"
                  value={montant}
                  onChange={(e) => setMontant(parseInt(e.target.value) || 0)}
                  min={100}
                  max={resteAPayer}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    border: `1.5px solid ${C.teal}22`, fontSize: 14,
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {/* Modes de paiement */}
            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.teal, marginBottom: 8 }}>
              Mode de paiement
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>
              {MODES.map((m) => (
                <button key={m.id} onClick={() => setMode(m.id)} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  border: `1.5px solid ${mode === m.id ? C.teal : C.teal + "22"}`,
                  background: mode === m.id ? C.teal + "0D" : "transparent",
                  borderRadius: 10, padding: "10px 14px", cursor: "pointer", textAlign: "left",
                }}>
                  <m.icon size={16} color={C.teal} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: C.ink + "77" }}>{m.desc}</div>
                  </div>
                  {mode === m.id && <Check size={14} color={C.teal} style={{ marginLeft: "auto" }} />}
                </button>
              ))}
            </div>

            {error && (
              <div style={{
                background: C.brick + "0D", border: `1px solid ${C.brick}33`,
                borderRadius: 8, padding: "9px 12px", fontSize: 12.5,
                color: C.brick, marginBottom: 14,
              }}>
                {error}
              </div>
            )}

            <button
              disabled={loading}
              onClick={handlePayer}
              style={{
                width: "100%", background: loading ? C.teal + "55" : C.teal,
                color: "#fff", border: "none", borderRadius: 10, padding: "13px 0",
                fontWeight: 700, fontSize: 14,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading
                ? <><Loader2 size={16} /> Traitement...</>
                : `Confirmer — ${montant.toLocaleString("fr-FR")} FCFA`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}