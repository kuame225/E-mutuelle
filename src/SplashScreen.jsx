import React, { useEffect, useRef, useState } from "react";
import { useParametrage, LOGO_DEFAUT } from "./useParametrage";
import { C, PALETTE } from "./theme";

// Nom de la plateforme, défini dans .env
const NOM_PLATEFORME = import.meta.env.VITE_NOM_PLATEFORME || "";

/**
 * Écran de démarrage.
 *
 * Il n'est pas affiché pendant une durée fixe mais le temps du chargement
 * réel : dès que l'application est prête, il s'efface. Une durée minimale
 * évite un clignotement lorsque tout est déjà en cache.
 *
 * L'écran est composé à partir du logo et du nom de l'organisation : aucune
 * image à fournir par le Bureau, et un rendu toujours bien cadré quel que
 * soit le format d'écran.
 */
export default function SplashScreen({ onDone, pret = true, dureeMin = 700 }) {
  const { params } = useParametrage();
  const [minEcoule, setMinEcoule] = useState(false);
  const [sortie, setSortie] = useState(false);

  // onDone est souvent une fonction anonyme, recréée à chaque rendu du parent.
  // La conserver dans une référence évite que l'effet ne se relance et
  // n'annule son propre minuteur.
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  const logo = params.logo_url || LOGO_DEFAUT;
  const sigle = params.nom_mutuelle;

  useEffect(() => {
    const t = setTimeout(() => setMinEcoule(true), dureeMin);
    return () => clearTimeout(t);
  }, [dureeMin]);

  // Dépendances volontairement limitées à « pret » et « minEcoule » :
  // y ajouter « sortie » relancerait l'effet dès sa mise à jour, dont le
  // nettoyage annulerait le minuteur — et l'application ne démarrerait jamais.
  useEffect(() => {
    if (!pret || !minEcoule) return;

    setSortie(true);
    const t = setTimeout(() => {
      if (onDoneRef.current) onDoneRef.current();
    }, 380);

    return () => clearTimeout(t);
  }, [pret, minEcoule]);

  return (
    <div className={`sp-shell ${sortie ? "is-out" : ""}`}>
      <style>{CSS}</style>

      <div className="sp-halo sp-halo-1" />
      <div className="sp-halo sp-halo-2" />

      <div className="sp-contenu">
        <div className="sp-logo-cadre">
          <img
            src={logo}
            alt=""
            className="sp-logo"
            onError={(e) => { e.currentTarget.src = LOGO_DEFAUT; }}
          />
        </div>

        {sigle && <div className="sp-sigle">{sigle}</div>}

        <div className="sp-barre"><span /></div>
      </div>

      {NOM_PLATEFORME && (
        <div className="sp-plateforme">{NOM_PLATEFORME}</div>
      )}
    </div>
  );
}

const CSS = `
.sp-shell{
  position:fixed; inset:0; z-index:500; overflow:hidden;
  background:linear-gradient(165deg, ${PALETTE.blue800} 0%, ${PALETTE.blue900} 100%);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  font-family:'Inter','Poppins',system-ui,sans-serif;
  transition:opacity .36s ease;
}
.sp-shell.is-out{ opacity:0; pointer-events:none; }

.sp-halo{ position:absolute; border-radius:50%; }
.sp-halo-1{
  width:340px; height:340px; right:-110px; top:-120px;
  background:rgba(255,255,255,.06);
}
.sp-halo-2{
  width:260px; height:260px; left:-90px; bottom:-80px;
  background:rgba(255,255,255,.05);
}

.sp-contenu{
  position:relative; z-index:1;
  display:flex; flex-direction:column; align-items:center;
  padding:0 28px; max-width:340px; text-align:center;
  animation:spIn .5s cubic-bezier(.4,0,.2,1);
}

.sp-logo-cadre{
  width:104px; height:104px; border-radius:26px;
  background:#fff; padding:14px;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 14px 38px rgba(3,12,32,.34);
}
.sp-logo{ max-width:100%; max-height:100%; object-fit:contain; }

.sp-sigle{
  margin-top:22px; color:#fff;
  font-size:21px; font-weight:700; letter-spacing:-.01em;
  line-height:1.25; overflow-wrap:anywhere;
}

.sp-barre{
  width:120px; height:3px; border-radius:3px;
  background:rgba(255,255,255,.18);
  margin-top:26px; overflow:hidden;
}
.sp-barre span{
  display:block; width:40%; height:100%; border-radius:3px;
  background:rgba(255,255,255,.75);
  animation:spGlisse 1.1s ease-in-out infinite;
}

.sp-plateforme{
  position:absolute; bottom:30px; z-index:1;
  color:rgba(255,255,255,.5); font-size:12px;
  letter-spacing:.09em; text-transform:uppercase;
}

@keyframes spIn{
  from{ opacity:0; transform:translateY(10px) scale(.97); }
  to{ opacity:1; transform:none; }
}
@keyframes spGlisse{
  0%{ transform:translateX(-100%); }
  100%{ transform:translateX(250%); }
}

@media (prefers-reduced-motion:reduce){
  .sp-contenu{ animation:none; }
  .sp-barre span{ animation:none; width:100%; }
}
`;