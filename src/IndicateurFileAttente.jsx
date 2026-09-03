import React, { useState, useEffect } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { tailleFile, surChangementFile, synchroniser } from "./offlineQueue";
import { C, R, S } from "./theme";

// Affiché en haut de chaque réunion AVEC ouverte — montre combien
// d'écritures attendent encore d'être envoyées, et permet de forcer
// une tentative de synchronisation sans attendre le prochain
// déclenchement automatique.
export default function IndicateurFileAttente() {
  const [taille, setTaille] = useState(0);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => surChangementFile((file) => setTaille(file.length)), []);

  if (taille === 0) return null;

  async function forcerSync() {
    setEnCours(true);
    await synchroniser();
    setEnCours(false);
  }

  return (
    <div style={styles.bandeau}>
      <CloudOff size={15} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>
        {taille} action{taille > 1 ? "s" : ""} en attente de synchronisation
      </span>
      <button style={styles.btn} onClick={forcerSync} disabled={enCours}>
        <RefreshCw size={13} className={enCours ? "ifa-spin" : ""} />
        {enCours ? "…" : "Réessayer"}
      </button>
      <style>{`.ifa-spin{ animation:ifaSpin 1s linear infinite; } @keyframes ifaSpin{ to{ transform:rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  bandeau: {
    display: "flex", alignItems: "center", gap: 10,
    background: "#FEF3C7", color: "#92400E", borderRadius: R.md,
    padding: "10px 14px", fontSize: 13, fontWeight: 600, marginBottom: S.md,
  },
  btn: {
    display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
    background: "none", border: "1.5px solid #92400E44", color: "#92400E",
    borderRadius: R.sm, padding: "5px 10px", cursor: "pointer",
    fontFamily: "inherit", fontSize: 12, fontWeight: 700,
  },
};