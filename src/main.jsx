import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import BandeauMiseAJour from "./BandeauMiseAJour";
import { registerSW } from "virtual:pwa-register";
import { annoncerMiseAJourDisponible, fonctionMiseAJour } from "./pwaUpdate";

// Un rechargement silencieux et automatique surprenait en pleine
// utilisation — l'écran se rafraîchissait sans prévenir, parfois au
// milieu d'une saisie. La nouvelle version est maintenant détectée en
// tâche de fond mais son application attend un geste explicite : un
// bandeau (BandeauMiseAJour.jsx) prévient et propose "Mettre à jour",
// qui appelle fonctionMiseAJour.actuelle() au moment choisi.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    fonctionMiseAJour.actuelle = () => updateSW(true);
    annoncerMiseAJourDisponible();
  },
  onOfflineReady() {},
});

// Filet de sécurité : si un service worker était déjà en attente avant
// même que registerSW() ne démarre, onNeedRefresh peut ne jamais se
// déclencher. On interroge donc directement le navigateur au démarrage.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (reg?.waiting) {
      fonctionMiseAJour.actuelle = () => updateSW(true);
      annoncerMiseAJourDisponible();
    }
  }).catch(() => {});
}

// Titre de l'onglet, repris du nom défini dans .env.
// Le remplacement direct dans index.html s'avérant peu fiable selon les
// versions de Vite, il est fixé ici, où import.meta.env est toujours résolu.
const NOM_PLATEFORME = import.meta.env.VITE_NOM_PLATEFORME || "Babamoo";
if (NOM_PLATEFORME) document.title = NOM_PLATEFORME;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Racine séparée, indépendante de l'arbre principal — visible quel que
// soit l'écran affiché par <App /> (connexion, PIN, admin, membre…)
// sans avoir à toucher chacune de ses nombreuses branches.
const conteneurBandeau = document.createElement("div");
conteneurBandeau.id = "bandeau-maj-root";
document.body.appendChild(conteneurBandeau);
ReactDOM.createRoot(conteneurBandeau).render(
  <React.StrictMode>
    <BandeauMiseAJour />
  </React.StrictMode>
);