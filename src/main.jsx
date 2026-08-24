import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerSW } from "virtual:pwa-register";

// Le Service Worker gardait une ancienne version en cache indéfiniment,
// sans jamais détecter qu'un nouveau déploiement était disponible — d'où
// des correctifs qui semblaient ne jamais arriver en ligne, alors que le
// déploiement lui-même avait réussi. onNeedRefresh() applique désormais
// la nouvelle version et recharge automatiquement, dès qu'une mise à
// jour est détectée en tâche de fond.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {},
});

// Titre de l'onglet, repris du nom défini dans .env.
// Le remplacement direct dans index.html s'avérant peu fiable selon les
// versions de Vite, il est fixé ici, où import.meta.env est toujours résolu.
const NOM_PLATEFORME = import.meta.env.VITE_NOM_PLATEFORME;
if (NOM_PLATEFORME) document.title = NOM_PLATEFORME;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);