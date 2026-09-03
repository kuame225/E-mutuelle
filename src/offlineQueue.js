// File d'attente locale pour les écritures pendant une session AVEC en
// cours — l'ouverture et la clôture de session exigent toujours un
// instant de connexion (la vérification des gardiens reste côté
// serveur), mais tout ce qui se passe entre les deux (appel, achat de
// parts, crédits, signature, vérification de caisse) peut continuer
// hors ligne : chaque écriture qui échoue faute de réseau se met de
// côté ici, plutôt que de se perdre, et se rejoue dès que la connexion
// revient.

import { supabase } from "./supabaseClient";
import { ressembleAUneCoupureReseau } from "./offlineCache";

const CLE_FILE = "babamoo_file_attente_avec";
const abonnes = new Set();

function lireFile() {
  try {
    const brut = localStorage.getItem(CLE_FILE);
    return brut ? JSON.parse(brut) : [];
  } catch {
    return [];
  }
}

function ecrireFile(liste) {
  try {
    localStorage.setItem(CLE_FILE, JSON.stringify(liste));
  } catch {
    // Quota dépassé ou navigation privée — best effort, jamais bloquant.
  }
  abonnes.forEach((cb) => cb(liste));
}

function mettreEnFile(operation) {
  const file = lireFile();
  const entree = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    creee_le: Date.now(),
    ...operation,
  };
  file.push(entree);
  ecrireFile(file);
  return entree.id;
}

export function tailleFile() {
  return lireFile().length;
}

export function fileActuelle() {
  return lireFile();
}

export function surChangementFile(callback) {
  abonnes.add(callback);
  callback(lireFile());
  return () => abonnes.delete(callback);
}

async function executer(item) {
  if (item.type === "insert") {
    return supabase.from(item.table).insert(item.donnees);
  }
  if (item.type === "update") {
    let requete = supabase.from(item.table).update(item.donnees);
    for (const [colonne, valeur] of Object.entries(item.filtre || {})) {
      requete = requete.eq(colonne, valeur);
    }
    return requete;
  }
  return supabase.rpc(item.fonction, item.parametres);
}

/**
 * Tente une écriture tout de suite. En cas de coupure réseau (détectée
 * par exception ou par la forme de l'erreur renvoyée), la met en file
 * au lieu de la perdre. L'appelant reçoit toujours une réponse : soit
 * le vrai résultat, soit la confirmation qu'elle est en attente.
 *
 * @param {object} operation - { type: "insert"|"update"|"rpc", ... }
 * @returns {Promise<{enFile: boolean, data: any, error: any}>}
 */
export async function ecrireOuMettreEnFile(operation) {
  try {
    const resultat = await executer(operation);

    if (resultat.error && ressembleAUneCoupureReseau(resultat.error)) {
      mettreEnFile(operation);
      return { enFile: true, data: null, error: null };
    }

    return { enFile: false, data: resultat.data, error: resultat.error || null };
  } catch (e) {
    mettreEnFile(operation);
    return { enFile: true, data: null, error: null };
  }
}

let enCoursDeSync = false;

/**
 * Rejoue la file dans l'ordre, une entrée à la fois. S'arrête au
 * premier échec qui ressemble encore à une coupure — inutile
 * d'épuiser toute la file si le réseau n'est toujours pas revenu — et
 * réessaiera au prochain déclenchement. Une vraie erreur applicative
 * (jamais liée au réseau) retire l'entrée : la rejouer indéfiniment
 * ne la résoudrait jamais.
 */
export async function synchroniser() {
  if (enCoursDeSync) return;
  enCoursDeSync = true;

  try {
    let file = lireFile();

    while (file.length > 0) {
      const item = file[0];

      try {
        const resultat = await executer(item);

        if (resultat.error && ressembleAUneCoupureReseau(resultat.error)) {
          break; // toujours hors ligne : on s'arrête, on retentera plus tard
        }

        file = file.slice(1);
        ecrireFile(file);
      } catch (e) {
        break; // exception réseau : idem, on s'arrête ici
      }
    }
  } finally {
    enCoursDeSync = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { synchroniser(); });
  setInterval(() => { if (tailleFile() > 0) synchroniser(); }, 20000);
}