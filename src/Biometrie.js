// Déverrouillage biométrique (empreinte / reconnaissance faciale) via WebAuthn.
//
// Même principe que le code PIN : tout reste sur l'appareil. La clé créée ici
// ne sert qu'à ouvrir l'écran de verrouillage — elle ne remplace pas la session
// Supabase et ne donne aucun accès supplémentaire.
//
// residentKey: "discouraged" est volontaire : on crée une clé liée à CET
// appareil, et non une clé d'accès (passkey) synchronisée dans le gestionnaire
// de mots de passe Google. Rien n'est donc rattaché au compte Google du membre,
// et son nom n'apparaît nulle part en dehors du téléphone.
//
// Les clés de stockage sont préfixées par l'identifiant du compte, pour qu'un
// membre n'hérite jamais de la configuration d'un autre sur le même téléphone.

const cleCredential = (uid) => `mephda_bio_${uid}`;

/* ---------------- Disponibilité ---------------- */

export function biometrieDisponible() {
  return !!(
    typeof window !== "undefined" &&
    window.PublicKeyCredential &&
    navigator.credentials
  );
}

// L'appareil dispose-t-il d'un capteur intégré (empreinte, visage) ?
export async function biometrieSupportee() {
  if (!biometrieDisponible()) return false;
  try {
    return await window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function biometrieActivee(uid) {
  if (!uid) return false;
  return !!localStorage.getItem(cleCredential(uid));
}

export function desactiverBiometrie(uid) {
  localStorage.removeItem(cleCredential(uid));
}

/* ---------------- Activation ---------------- */

export async function activerBiometrie(uid, nomAffiche) {
  if (!biometrieDisponible()) {
    return { ok: false, motif: "non_supporte" };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const identifiant = new TextEncoder().encode(uid);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "MEPHDA Connect" },
        user: {
          id: identifiant,
          // Libellé neutre : la clé n'est pas synchronisée, mais autant ne pas
          // exposer le nom du membre au système d'exploitation.
          name: "Espace MEPHDA",
          displayName: nomAffiche ? nomAffiche.split(" ")[0] : "Espace MEPHDA",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },    // ES256
          { type: "public-key", alg: -257 },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "discouraged",
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: "none",
      },
    });

    if (!credential) return { ok: false, motif: "annule" };

    localStorage.setItem(cleCredential(uid), bufferEnBase64(credential.rawId));
    return { ok: true };
  } catch (e) {
    return { ok: false, motif: motifErreur(e) };
  }
}

/* ---------------- Déverrouillage ---------------- */

export async function deverrouillerParBiometrie(uid) {
  const stocke = localStorage.getItem(cleCredential(uid));
  if (!stocke) return { ok: false, motif: "non_configure" };

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            type: "public-key",
            id: base64EnBuffer(stocke),
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    });

    return assertion ? { ok: true } : { ok: false, motif: "annule" };
  } catch (e) {
    const motif = motifErreur(e);

    // La clé n'existe plus sur l'appareil (réinitialisation, empreintes
    // supprimées) : on nettoie pour ne plus proposer une option morte.
    if (motif === "introuvable") {
      desactiverBiometrie(uid);
    }

    return { ok: false, motif };
  }
}

/* ---------------- Utilitaires ---------------- */

function motifErreur(e) {
  if (e?.name === "NotAllowedError") return "annule";
  if (e?.name === "InvalidStateError") return "introuvable";
  if (e?.name === "NotSupportedError") return "non_supporte";
  if (e?.name === "SecurityError") return "contexte";
  if (e?.name === "AbortError") return "annule";
  return "erreur";
}

function bufferEnBase64(buffer) {
  const octets = new Uint8Array(buffer);
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire);
}

function base64EnBuffer(base64) {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets.buffer;
}