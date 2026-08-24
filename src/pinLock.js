// Gestion locale du code PIN : hachage, tentatives, blocage progressif.
// Les clés sont préfixées par l'identifiant du compte : un PIN défini par un
// membre n'affecte plus les autres comptes utilisés sur le même appareil.

const PREFIXE = "mephda_pin";

const clePin        = (uid) => `${PREFIXE}_hash_${uid}`;
const cleTentatives = (uid) => `${PREFIXE}_tentatives_${uid}`;
const cleBlocage    = (uid) => `${PREFIXE}_blocage_${uid}`;

// Nettoyage des anciennes clés globales (version précédente)
["mephda_pin_hash", "mephda_pin_tentatives", "mephda_pin_blocage_jusqu_a"]
  .forEach((k) => localStorage.removeItem(k));

const PALIERS = [
  { apres: 3, secondes: 30 },
  { apres: 5, secondes: 60 },
  { apres: 7, secondes: 300 },
];
const SEUIL_DECONNEXION = 8;

async function hacher(pin, uid) {
  const donnees = new TextEncoder().encode(pin + ":" + uid);
  const buffer = await crypto.subtle.digest("SHA-256", donnees);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function definirPin(pin, uid) {
  localStorage.setItem(clePin(uid), await hacher(pin, uid));
  localStorage.removeItem(cleTentatives(uid));
  localStorage.removeItem(cleBlocage(uid));
}

export function pinEstDefini(uid) {
  if (!uid) return false;
  return !!localStorage.getItem(clePin(uid));
}

export function supprimerPin(uid) {
  localStorage.removeItem(clePin(uid));
  localStorage.removeItem(cleTentatives(uid));
  localStorage.removeItem(cleBlocage(uid));
}

export function blocageActif(uid) {
  const jusqu = parseInt(localStorage.getItem(cleBlocage(uid)) || "0", 10);
  const reste = jusqu - Date.now();
  return reste > 0 ? Math.ceil(reste / 1000) : 0;
}

export async function verifierPin(pin, uid) {
  const bloque = blocageActif(uid);
  if (bloque > 0) {
    return { ok: false, bloque: true, secondesRestantes: bloque, deconnexion: false };
  }

  const empreinte = await hacher(pin, uid);

  if (empreinte === localStorage.getItem(clePin(uid))) {
    localStorage.removeItem(cleTentatives(uid));
    localStorage.removeItem(cleBlocage(uid));
    return { ok: true, bloque: false, secondesRestantes: 0, deconnexion: false };
  }

  const tentatives = parseInt(localStorage.getItem(cleTentatives(uid)) || "0", 10) + 1;
  localStorage.setItem(cleTentatives(uid), String(tentatives));

  if (tentatives >= SEUIL_DECONNEXION) {
    supprimerPin(uid);
    return { ok: false, bloque: false, secondesRestantes: 0, deconnexion: true };
  }

  const palier = [...PALIERS].reverse().find((p) => tentatives >= p.apres);
  if (palier) {
    localStorage.setItem(cleBlocage(uid), String(Date.now() + palier.secondes * 1000));
    return { ok: false, bloque: true, secondesRestantes: palier.secondes, deconnexion: false };
  }

  return { ok: false, bloque: false, secondesRestantes: 0, deconnexion: false };
}