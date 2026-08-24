import React, { useRef, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useParametrage, construireMatricule, LOGO_DEFAUT } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

export default function CarteMembreModal({ membre, onClose }) {
  const { params, loading } = useParametrage();
  const carteRef = useRef(null);
  const [dl, setDl] = useState(false);

  const sigle = params.nom_mutuelle;
  const denomination = params.adresse;
  const localite = params.localite;
  const logo = params.logo_url || LOGO_DEFAUT;
  const matricule = construireMatricule(params, membre);

  // Charge utile du QR : de quoi vérifier une carte, sans exposer
  // davantage de renseignements personnels que nécessaire.
  const qrData = JSON.stringify({
    org: sigle,
    mat: matricule,
    id: membre.id,
    nom: membre.nom,
  });

  async function telecharger() {
    setDl(true);
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(carteRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "transparent",
      });
      const a = document.createElement("a");
      a.download = `carte-${motCle(sigle)}-${motCle(membre.nom)}.png`;
      a.href = url;
      a.click();
    } catch (e) {
      console.error(e);
    }
    setDl(false);
  }

  const initiales = membre.nom.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase();

  const STATUT = {
    a_jour:   { label: "À jour",    color: "#4ADE80" },
    partiel:  { label: "Partiel",   color: "#FCD34D" },
    retard:   { label: "En retard", color: "#FCA5A5" },
    suspendu: { label: "Suspendu",  color: "#FCA5A5" },
  };
  const st = STATUT[membre.statut_cotisation] || STATUT.a_jour;

  return (
    <div className="cm-overlay" onClick={onClose}>
      <style>{CSS}</style>

      <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
        <header className="cm-head">
          <div>
            <h3 className="cm-title">Ma carte de membre</h3>
            <p className="cm-sub">Présentez-la lors de vos démarches</p>
          </div>
          <button className="cm-close" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </header>

        {/* ---------- La carte ---------- */}
        <div className="cm-stage">
          <div className="cm-card" ref={carteRef}>
            <div className="cm-inner">
              <div className="cm-shine" />

              {/* Bandeau supérieur */}
              <div className="cm-card-top">
                <div className="cm-brand">
                  <img
                    src={logo}
                    alt=""
                    className="cm-logo"
                    crossOrigin="anonymous"
                    onError={(e) => { e.currentTarget.src = LOGO_DEFAUT; }}
                  />
                  <div className="cm-brand-text">
                    <div
                      className="cm-brand-name"
                      style={{ fontSize: tailleSigle(sigle) }}
                    >
                      {sigle}
                    </div>
                    {denomination && (
                      <div className="cm-brand-sub">{denomination}</div>
                    )}
                  </div>
                </div>
                <span className="cm-status" style={{ color: st.color }}>
                  <span className="cm-dot" style={{ background: st.color }} />
                  {st.label}
                </span>
              </div>

              {/* Corps : occupe l'espace restant et se centre */}
              <div className="cm-card-body">
                <div className="cm-identity">
                  <div className="cm-avatar">{initiales}</div>
                  <div className="cm-names">
                    <div
                      className="cm-nom"
                      style={{ fontSize: tailleNom(membre.nom) }}
                    >
                      {membre.nom}
                    </div>
                    {membre.poste && <div className="cm-poste">{membre.poste}</div>}
                    {membre.service && <div className="cm-service">{membre.service}</div>}
                  </div>
                </div>

                <div className="cm-qr">
                  <QRCodeSVG value={qrData} size={200} level="M" fgColor={PALETTE.blue900} />
                </div>
              </div>

              {/* Pied */}
              <div className="cm-card-foot">
                <span className="cm-matricule">{matricule}</span>
                <span className="cm-since">
                  {localite ? `${localite} · ` : ""}
                  Membre depuis {membre.date_adhesion
                    ? new Date(membre.date_adhesion).toLocaleDateString("fr-FR")
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <button className="cm-dl" onClick={telecharger} disabled={dl || loading}>
          {dl
            ? <><Loader2 size={18} className="cm-spin" /> Génération…</>
            : <><Download size={18} /> Télécharger ma carte</>}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Utilitaires ---------------- */

// La carte a une largeur fixe : un nom long doit rétrécir plutôt que d'être coupé
function tailleNom(nom) {
  const n = String(nom || "").length;
  if (n <= 16) return "5cqw";
  if (n <= 22) return "4.2cqw";
  if (n <= 28) return "3.6cqw";
  return "3.1cqw";
}

function tailleSigle(sigle) {
  const n = String(sigle || "").length;
  if (n <= 10) return "4.2cqw";
  if (n <= 16) return "3.5cqw";
  return "2.9cqw";
}

// Transforme un libellé en fragment de nom de fichier
function motCle(texte) {
  return String(texte || "carte")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

const CSS = `
.cm-overlay{
  position:fixed; inset:0; z-index:200;
  background:rgba(10,20,40,.55); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; animation:cmFade .18s ease;
  font-family:'Inter','Poppins',system-ui,sans-serif;
}
.cm-modal{
  width:100%; max-width:460px; background:${C.surface};
  border-radius:${R.xxl}px; padding:${S.xl}px;
  box-shadow:${SHADOW.lg}; animation:cmUp .22s cubic-bezier(.4,0,.2,1);
}
.cm-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; margin-bottom:${S.lg}px; }
.cm-title{ font-size:18px; font-weight:600; margin:0; letter-spacing:-.01em; color:${C.text}; }
.cm-sub{ font-size:13px; color:${C.textSubtle}; margin:3px 0 0; }
.cm-close{
  background:none; border:1px solid ${C.border}; border-radius:${R.sm}px;
  color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex;
  transition:color .16s ease, border-color .16s ease;
}
.cm-close:hover{ color:${C.danger}; border-color:${C.danger}; }

/* ---- La carte ----
   La hauteur est imposée par padding-bottom : 63,05 % est l'inverse de 1,586,
   rapport exact d'une carte bancaire. Le contenu est placé en absolu. */
.cm-stage{ margin-bottom:${S.lg}px; }
.cm-card{
  position:relative; overflow:hidden;
  width:100%; height:0; padding-bottom:63.05%;
  container-type:inline-size;
  border-radius:4cqw;
  background:linear-gradient(135deg, ${PALETTE.blue900} 0%, ${PALETTE.blue800} 55%, ${PALETTE.blue600} 125%);
  color:#fff;
  box-shadow:${SHADOW.lg};
}
.cm-inner{
  position:absolute; inset:0; padding:5cqw;
  display:flex; flex-direction:column;
}
.cm-shine{
  position:absolute; width:60cqw; height:60cqw; border-radius:50%;
  background:rgba(255,255,255,.07); right:-18cqw; top:-26cqw;
}

.cm-card-top{
  position:relative; flex-shrink:0;
  display:flex; align-items:flex-start; justify-content:space-between; gap:2cqw;
}
.cm-brand{ display:flex; align-items:center; gap:2.2cqw; min-width:0; }
.cm-logo{
  width:9cqw; height:9cqw; object-fit:contain; flex-shrink:0;
  background:#fff; border-radius:1.8cqw; padding:1cqw;
}
.cm-brand-text{ min-width:0; }
.cm-brand-name{
  font-weight:700; letter-spacing:.06em; line-height:1.15;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.cm-brand-sub{
  font-size:2.3cqw; opacity:.72; line-height:1.3; margin-top:.3cqw;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
  overflow:hidden;
}
.cm-status{
  display:inline-flex; align-items:center; gap:1.2cqw; flex-shrink:0;
  font-size:2.5cqw; font-weight:600;
  background:rgba(255,255,255,.14); border:.25cqw solid rgba(255,255,255,.22);
  padding:1cqw 2.2cqw; border-radius:10cqw;
}
.cm-dot{ width:1.6cqw; height:1.6cqw; border-radius:50%; }

/* Le corps prend tout l'espace disponible et s'y centre :
   plus de trou entre le service et le matricule. */
.cm-card-body{
  position:relative; flex:1;
  display:flex; align-items:center;
  justify-content:space-between; gap:3cqw;
}
.cm-identity{ display:flex; align-items:center; gap:3cqw; min-width:0; }
.cm-avatar{
  width:13cqw; height:13cqw; border-radius:3cqw; flex-shrink:0;
  background:rgba(255,255,255,.16); border:.25cqw solid rgba(255,255,255,.25);
  display:flex; align-items:center; justify-content:center;
  font-size:5cqw; font-weight:700; letter-spacing:-.02em;
}
.cm-names{ min-width:0; }
.cm-nom{
  font-weight:700; letter-spacing:-.02em; line-height:1.2;
  overflow-wrap:anywhere;
}
.cm-poste{ font-size:2.9cqw; opacity:.85; margin-top:.6cqw;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cm-service{ font-size:2.5cqw; opacity:.62; margin-top:.2cqw;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.cm-qr{
  flex-shrink:0; background:#fff; border-radius:2.2cqw; padding:1.4cqw;
  width:19cqw; height:19cqw; display:flex; align-items:center; justify-content:center;
}
.cm-qr svg{ width:100%; height:100%; }

.cm-card-foot{
  position:relative; flex-shrink:0;
  display:flex; align-items:center; justify-content:space-between;
  gap:2cqw; padding-top:2.5cqw; border-top:.25cqw solid rgba(255,255,255,.16);
  font-size:2.4cqw; opacity:.7;
}
.cm-matricule{ font-family:'JetBrains Mono',monospace; letter-spacing:.08em; flex-shrink:0; }
.cm-since{
  min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  text-align:right;
}

/* ---- Bouton ---- */
.cm-dl{
  display:flex; align-items:center; justify-content:center; gap:9px; width:100%;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:15px 0; cursor:pointer;
  font-family:inherit; font-size:15px; font-weight:600;
  box-shadow:${SHADOW.sm}; transition:background .18s ease;
}
.cm-dl:hover:not(:disabled){ background:${C.primaryDark}; }
.cm-dl:disabled{ opacity:.65; cursor:not-allowed; }
.cm-spin{ animation:cmSpin 1s linear infinite; }

@keyframes cmSpin{ to{ transform:rotate(360deg); } }
@keyframes cmFade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes cmUp{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
`;