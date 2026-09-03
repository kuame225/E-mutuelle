import React, { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { surMiseAJourDisponible, fonctionMiseAJour } from "./pwaUpdate";
import { C, R, S, SHADOW } from "./theme";

// Affiché à la racine de l'application (voir App.jsx), donc visible
// quel que soit l'écran ouvert au moment où une nouvelle version est
// détectée en tâche de fond — jamais de rechargement surprise, la
// personne choisit le moment.
export default function BandeauMiseAJour() {
  const [disponible, setDisponible] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [masque, setMasque] = useState(false);

  useEffect(() => surMiseAJourDisponible(() => setDisponible(true)), []);

  if (!disponible || masque) return null;

  function appliquer() {
    setEnCours(true);
    fonctionMiseAJour.actuelle?.();
  }

  return (
    <div style={styles.bandeau}>
      <span style={styles.texte}>Une nouvelle version est disponible.</span>
      <button style={styles.btnMaj} onClick={appliquer} disabled={enCours}>
        <RefreshCw size={14} className={enCours ? "bmaj-spin" : ""} />
        {enCours ? "Mise à jour…" : "Mettre à jour"}
      </button>
      {!enCours && (
        <button style={styles.btnFermer} onClick={() => setMasque(true)} aria-label="Plus tard">
          <X size={15} />
        </button>
      )}
      <style>{`
        .bmaj-spin{ animation: bmajSpin 1s linear infinite; }
        @keyframes bmajSpin{ to{ transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles = {
  bandeau: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 400,
    display: "flex", alignItems: "center", gap: 12,
    background: C.primaryDark, color: "#fff",
    padding: "12px 16px", boxShadow: SHADOW.lg,
    fontFamily: "inherit", fontSize: 13.5,
  },
  texte: { flex: 1, minWidth: 0 },
  btnMaj: {
    display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
    background: "#fff", color: C.primaryDark, border: "none",
    borderRadius: R.md, padding: "8px 14px", cursor: "pointer",
    fontFamily: "inherit", fontSize: 13, fontWeight: 700,
  },
  btnFermer: {
    background: "none", border: "none", color: "rgba(255,255,255,.75)",
    cursor: "pointer", padding: 4, flexShrink: 0,
  },
};