import React, { useEffect, useState } from "react";
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2, Pencil,
  HeartHandshake, PartyPopper, Info, Eye, EyeOff,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { consigner, EVENEMENTS } from "./journal";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const CATEGORIES = [
  { id: "heureux",    label: "Événements heureux",    Icon: PartyPopper,     couleur: C.success },
  { id: "malheureux", label: "Événements malheureux", Icon: HeartHandshake,  couleur: C.primary },
];

export default function BaremePage() {
  const { params } = useParametrage();
  const [lignes, setLignes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edition, setEdition] = useState(null);   // ligne en cours de modification
  const [creation, setCreation] = useState(false);
  const [suppression, setSuppression] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const [montrerInactifs, setMontrerInactifs] = useState(false);

  async function charger() {
    const { data, error } = await supabase
      .from("bareme_prestations")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("ordre");

    if (error) setMessage({ type: "err", texte: error.message });
    setLignes(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  function notifier(texte) {
    setMessage({ type: "ok", texte });
    setTimeout(() => setMessage(null), 3500);
  }

  async function enregistrer(valeurs, typeAide) {
    setEnCours(true);
    setMessage(null);

    const donnees = {
      libelle: valeurs.libelle.trim(),
      categorie: valeurs.categorie,
      montant_membre: valeurs.montant_membre,
      montant_don: valeurs.montant_don,
      une_seule_fois: valeurs.une_seule_fois,
      article: valeurs.article.trim() || null,
      actif: valeurs.actif,
    };

    let error;

    if (typeAide) {
      ({ error } = await supabase
        .from("bareme_prestations")
        .update(donnees)
        .eq("type_aide", typeAide)
        .eq("organisation_id", params.organisation_id));
    } else {
      const code = codeDepuisLibelle(valeurs.libelle);

      if (lignes.some((l) => l.type_aide === code)) {
        setEnCours(false);
        setMessage({
          type: "err",
          texte: "Une prestation portant un libellé très proche existe déjà.",
        });
        return;
      }

      ({ error } = await supabase.from("bareme_prestations").insert({
        ...donnees,
        organisation_id: params.organisation_id,
        type_aide: code,
        ordre: Math.max(0, ...lignes.map((l) => l.ordre || 0)) + 1,
        montant_calcule: false,
      }));
    }

    setEnCours(false);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }

    setEdition(null);
    setCreation(false);
    notifier(typeAide ? "Prestation mise à jour." : "Prestation ajoutée au barème.");

    consigner(
      typeAide ? EVENEMENTS.BAREME_PRESTATION_MODIFIEE : EVENEMENTS.BAREME_PRESTATION_AJOUTEE,
      {
        organisation_id: params.organisation_id,
        type_aide: typeAide || undefined,
        libelle: donnees.libelle,
      }
    );

    charger();
  }

  async function basculerActif(ligne) {
    setEnCours(true);
    const { error } = await supabase
      .from("bareme_prestations")
      .update({ actif: !ligne.actif })
      .eq("type_aide", ligne.type_aide)
      .eq("organisation_id", params.organisation_id);
    setEnCours(false);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }

    // Seule la désactivation est tracée : réactiver une prestation revient
    // à un état déjà connu, sans conséquence pour les demandes en cours.
    if (ligne.actif) {
      consigner(EVENEMENTS.BAREME_PRESTATION_DESACTIVEE, {
        organisation_id: params.organisation_id,
        type_aide: ligne.type_aide,
        libelle: ligne.libelle,
      });
    }

    charger();
  }

  async function supprimer(ligne) {
    setEnCours(true);
    const { error } = await supabase
      .from("bareme_prestations")
      .delete()
      .eq("type_aide", ligne.type_aide)
      .eq("organisation_id", params.organisation_id);
    setEnCours(false);
    setSuppression(null);

    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    notifier("Prestation retirée du barème.");
    charger();
  }

  const visibles = montrerInactifs ? lignes : lignes.filter((l) => l.actif !== false);
  const nbInactifs = lignes.filter((l) => l.actif === false).length;

  if (loading) {
    return (
      <div className="bp-wrap">
        <style>{CSS}</style>
        <div className="bp-skel" /><div className="bp-skel" />
      </div>
    );
  }

  return (
    <div className="bp-wrap">
      <style>{CSS}</style>

      {message && (
        <div className={`bp-msg ${message.type === "ok" ? "is-ok" : "is-err"}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} aria-label="Fermer"><X size={15} /></button>
        </div>
      )}

      <div className="bp-intro">
        <Info size={16} />
        <span>
          Ce barème détermine le montant proposé au Bureau lors de l'instruction
          d'une demande. Le modifier n'a aucun effet sur les aides déjà accordées.
        </span>
      </div>

      <div className="bp-tools">
        {nbInactifs > 0 && (
          <button
            className="bp-lien"
            onClick={() => setMontrerInactifs((v) => !v)}
          >
            {montrerInactifs
              ? <><EyeOff size={15} /> Masquer les {nbInactifs} prestations désactivées</>
              : <><Eye size={15} /> Afficher les {nbInactifs} prestations désactivées</>}
          </button>
        )}

        <button className="bp-btn" onClick={() => { setCreation(true); setMessage(null); }}>
          <Plus size={17} /> Ajouter une prestation
        </button>
      </div>

      {CATEGORIES.map((cat) => {
        const groupe = visibles.filter((l) => l.categorie === cat.id);
        if (groupe.length === 0) return null;

        return (
          <section key={cat.id} className="bp-groupe">
            <h2 className="bp-groupe-titre">
              <span className="bp-groupe-icon" style={{ background: cat.couleur + "18", color: cat.couleur }}>
                <cat.Icon size={17} />
              </span>
              {cat.label}
            </h2>

            <ul className="bp-liste">
              {groupe.map((l) => (
                <li key={l.type_aide} className={`bp-ligne ${l.actif === false ? "is-off" : ""}`}>
                  <div className="bp-ligne-corps">
                    <div className="bp-ligne-titre">
                      {l.libelle}
                      {l.actif === false && <span className="bp-etiq">Désactivée</span>}
                      {l.une_seule_fois && <span className="bp-etiq bp-etiq-doux">Une seule fois</span>}
                    </div>
                    <div className="bp-ligne-meta">
                      {l.article || "Sans référence"}
                      {" · "}
                      <span className="bp-code">{l.type_aide}</span>
                    </div>
                  </div>

                  <div className="bp-ligne-montants">
                    {l.montant_calcule ? (
                      <span className="bp-calcule">Calculé sur les cotisations</span>
                    ) : l.montant_membre > 0 ? (
                      <>
                        <strong>{montant(l.montant_membre)} F</strong>
                        {l.montant_don > 0 && (
                          <em>+ {montant(l.montant_don)} F de don</em>
                        )}
                      </>
                    ) : (
                      <span className="bp-calcule">Arrêté en Assemblée Générale</span>
                    )}
                  </div>

                  <div className="bp-ligne-actions">
                    <button
                      onClick={() => basculerActif(l)}
                      disabled={enCours}
                      title={l.actif === false ? "Réactiver" : "Désactiver"}
                    >
                      {l.actif === false ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <button onClick={() => { setEdition(l); setMessage(null); }} title="Modifier">
                      <Pencil size={15} />
                    </button>
                    <button
                      className="is-danger"
                      onClick={() => setSuppression(l)}
                      title="Retirer du barème"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {visibles.length === 0 && (
        <div className="bp-vide">
          <HeartHandshake size={36} color={PALETTE.grey300} />
          <div className="bp-vide-titre">Aucune prestation au barème</div>
          <div className="bp-vide-sub">
            Ajoutez les événements ouvrant droit à une aide, tels que les
            prévoient les textes de votre mutuelle.
          </div>
        </div>
      )}

      {(edition || creation) && (
        <ModalPrestation
          ligne={edition}
          enCours={enCours}
          onCancel={() => { setEdition(null); setCreation(false); }}
          onConfirm={(v) => enregistrer(v, edition?.type_aide)}
        />
      )}

      {suppression && (
        <div className="bp-overlay" onClick={() => setSuppression(null)}>
          <div className="bp-modal bp-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="bp-modal-titre">Retirer cette prestation ?</h3>
            <p className="bp-modal-texte">
              <strong>{suppression.libelle}</strong> disparaîtra du barème et ne
              pourra plus être demandée.
            </p>
            <div className="bp-conseil">
              <Info size={14} />
              <span>
                Si des demandes portent déjà ce motif, préférez la désactiver :
                l'historique reste lisible et la catégorie n'est plus proposée.
              </span>
            </div>
            <div className="bp-modal-actions">
              <button
                className="bp-mbtn bp-mbtn-ghost"
                onClick={() => setSuppression(null)}
                disabled={enCours}
              >
                Annuler
              </button>
              <button
                className="bp-mbtn bp-mbtn-danger"
                onClick={() => supprimer(suppression)}
                disabled={enCours}
              >
                {enCours
                  ? <><Loader2 size={16} className="bp-spin" /> Suppression…</>
                  : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Formulaire ---------------- */

function ModalPrestation({ ligne, enCours, onCancel, onConfirm }) {
  const [libelle, setLibelle] = useState(ligne?.libelle || "");
  const [categorie, setCategorie] = useState(ligne?.categorie || "heureux");
  const [montantMembre, setMontantMembre] = useState(String(ligne?.montant_membre ?? 0));
  const [montantDon, setMontantDon] = useState(String(ligne?.montant_don ?? 0));
  const [uneSeuleFois, setUneSeuleFois] = useState(Boolean(ligne?.une_seule_fois));
  const [article, setArticle] = useState(ligne?.article || "");
  const [actif, setActif] = useState(ligne?.actif !== false);
  const [err, setErr] = useState("");

  const calcule = Boolean(ligne?.montant_calcule);

  function valider() {
    if (!libelle.trim()) { setErr("Indiquez le libellé de la prestation."); return; }
    if (libelle.trim().length > 60) { setErr("Le libellé doit rester court."); return; }

    const m = parseInt(montantMembre, 10) || 0;
    const d = parseInt(montantDon, 10) || 0;

    if (m < 0 || d < 0) { setErr("Les montants ne peuvent pas être négatifs."); return; }

    onConfirm({
      libelle, categorie,
      montant_membre: m,
      montant_don: d,
      une_seule_fois: uneSeuleFois,
      article, actif,
    });
  }

  return (
    <div className="bp-overlay" onClick={onCancel}>
      <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
        <header className="bp-modal-head">
          <div>
            <h3 className="bp-modal-titre">
              {ligne ? "Modifier la prestation" : "Nouvelle prestation"}
            </h3>
            <p className="bp-modal-sub">
              Reprenez les termes de vos textes : ce libellé sera lu par les membres.
            </p>
          </div>
          <button className="bp-close" onClick={onCancel} aria-label="Fermer">
            <X size={20} />
          </button>
        </header>

        <div className="bp-champ">
          <label className="bp-label" htmlFor="bp-lib">Libellé</label>
          <input
            id="bp-lib"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex : Décès du conjoint déclaré"
            className="bp-input"
          />
        </div>

        <div className="bp-champ">
          <span className="bp-label">Catégorie</span>
          <div className="bp-choix">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`bp-choix-btn ${categorie === c.id ? "is-on" : ""}`}
                onClick={() => setCategorie(c.id)}
              >
                <c.Icon size={15} /> {c.label}
              </button>
            ))}
          </div>
        </div>

        {calcule ? (
          <div className="bp-info">
            <Info size={15} />
            <span>
              Le montant de cette prestation est calculé automatiquement à partir
              des cotisations versées par le membre. Il n'est pas modifiable ici.
            </span>
          </div>
        ) : (
          <div className="bp-duo">
            <div className="bp-champ">
              <label className="bp-label" htmlFor="bp-m">Montant au membre</label>
              <div className="bp-input-devise">
                <input
                  id="bp-m" type="number" min={0}
                  value={montantMembre}
                  onChange={(e) => setMontantMembre(e.target.value)}
                  className="bp-input"
                />
                <span>FCFA</span>
              </div>
              <span className="bp-aide">
                Zéro si le montant est arrêté au cas par cas en Assemblée Générale.
              </span>
            </div>

            <div className="bp-champ">
              <label className="bp-label" htmlFor="bp-d">Don à la famille</label>
              <div className="bp-input-devise">
                <input
                  id="bp-d" type="number" min={0}
                  value={montantDon}
                  onChange={(e) => setMontantDon(e.target.value)}
                  className="bp-input"
                />
                <span>FCFA</span>
              </div>
              <span className="bp-aide">Remis en sus, lors des condoléances.</span>
            </div>
          </div>
        )}

        <div className="bp-champ">
          <label className="bp-label" htmlFor="bp-art">
            Référence <span className="bp-opt">— facultative</span>
          </label>
          <input
            id="bp-art"
            value={article}
            onChange={(e) => setArticle(e.target.value)}
            placeholder="Ex : Article 26"
            className="bp-input"
          />
          <span className="bp-aide">
            Article du règlement intérieur qui prévoit cette prestation.
          </span>
        </div>

        <div className="bp-bascules">
          <button
            className={`bp-bascule ${uneSeuleFois ? "is-on" : ""}`}
            onClick={() => setUneSeuleFois((v) => !v)}
          >
            <span className="bp-case">{uneSeuleFois && <CheckCircle2 size={13} />}</span>
            <span>
              <strong>Accordée une seule fois</strong>
              <em>Le membre ne peut en bénéficier qu'à une reprise</em>
            </span>
          </button>

          <button
            className={`bp-bascule ${actif ? "is-on" : ""}`}
            onClick={() => setActif((v) => !v)}
          >
            <span className="bp-case">{actif && <CheckCircle2 size={13} />}</span>
            <span>
              <strong>Proposée aux membres</strong>
              <em>Décochez pour la retirer sans perdre l'historique</em>
            </span>
          </button>
        </div>

        {err && <div className="bp-err"><AlertCircle size={15} /> {err}</div>}

        <div className="bp-modal-actions">
          <button className="bp-mbtn bp-mbtn-ghost" onClick={onCancel} disabled={enCours}>
            Annuler
          </button>
          <button className="bp-mbtn bp-mbtn-primary" onClick={valider} disabled={enCours}>
            {enCours
              ? <><Loader2 size={16} className="bp-spin" /> Enregistrement…</>
              : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Utilitaires ---------------- */

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Code technique dérivé du libellé : il sert de clé et n'est jamais affiché
// aux membres. Volontairement stable, pour ne pas rompre l'historique.
function codeDepuisLibelle(libelle) {
  return String(libelle)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

/* ---------------- Styles ---------------- */

const CSS = `
.bp-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  max-width:880px; font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .bp-wrap{ padding:${S.lg}px; } }

.bp-msg{
  display:flex; align-items:center; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
  animation:bpIn .2s ease;
}
.bp-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.bp-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }
.bp-msg button{
  margin-left:auto; background:none; border:none; cursor:pointer;
  color:inherit; opacity:.7; display:flex; padding:0;
}

.bp-intro{
  display:flex; align-items:flex-start; gap:9px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:12px 15px;
  font-size:13px; color:${C.textMuted}; line-height:1.55;
}

.bp-tools{ display:flex; align-items:center; gap:${S.md}px; flex-wrap:wrap; }
.bp-lien{
  display:flex; align-items:center; gap:7px;
  background:none; border:none; padding:0; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; color:${C.primary};
}
.bp-lien:hover{ text-decoration:underline; }
.bp-btn{
  margin-left:auto; display:flex; align-items:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.bp-btn:hover{ background:${C.primaryDark}; }

/* ---- Groupes ---- */
.bp-groupe-titre{
  display:flex; align-items:center; gap:10px;
  font-size:16px; font-weight:700; letter-spacing:-.01em; margin:0 0 ${S.md}px;
}
.bp-groupe-icon{
  width:34px; height:34px; border-radius:${R.sm}px;
  display:flex; align-items:center; justify-content:center;
}

.bp-liste{
  list-style:none; margin:0; padding:0;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; overflow:hidden; box-shadow:${SHADOW.xs};
}
.bp-ligne{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border};
  flex-wrap:wrap;
}
.bp-ligne:last-child{ border-bottom:none; }
.bp-ligne.is-off{ background:${C.bg}; opacity:.72; }
.bp-ligne-corps{ flex:1; min-width:190px; }
.bp-ligne-titre{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  font-size:14.5px; font-weight:600;
}
.bp-ligne-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:3px; }
.bp-code{ font-family:'JetBrains Mono',monospace; font-size:11.5px; opacity:.8; }
.bp-etiq{
  font-size:11px; font-weight:600; padding:2px 8px; border-radius:${R.pill}px;
  background:${PALETTE.grey200}; color:${C.textMuted};
}
.bp-etiq-doux{ background:${PALETTE.blue100}; color:${C.primary}; }

.bp-ligne-montants{
  display:flex; flex-direction:column; align-items:flex-end;
  flex-shrink:0; text-align:right;
}
.bp-ligne-montants strong{
  font-family:'JetBrains Mono',monospace; font-size:15px;
  font-weight:700; color:${C.text};
}
.bp-ligne-montants em{ font-style:normal; font-size:12px; color:${C.textSubtle}; }
.bp-calcule{ font-size:12.5px; color:${C.textSubtle}; font-style:italic; }

.bp-ligne-actions{ display:flex; gap:5px; flex-shrink:0; }
.bp-ligne-actions button{
  width:32px; height:32px; border-radius:${R.sm}px;
  background:${C.surface}; border:1px solid ${C.border};
  color:${C.textSubtle}; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .16s ease;
}
.bp-ligne-actions button:hover:not(:disabled){ border-color:${C.primary}; color:${C.primary}; }
.bp-ligne-actions button.is-danger:hover{ border-color:${C.danger}; color:${C.danger}; background:#FEE2E2; }
.bp-ligne-actions button:disabled{ opacity:.5; cursor:not-allowed; }

/* ---- Modale ---- */
.bp-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; animation:bpFade .18s ease; overflow-y:auto;
}
.bp-modal{
  width:100%; max-width:520px; background:${C.surface};
  border-radius:${R.xxl}px; padding:${S.xl}px;
  box-shadow:${SHADOW.lg}; animation:bpUp .22s cubic-bezier(.4,0,.2,1);
  margin:auto;
}
.bp-modal-court{ max-width:420px; }
.bp-modal-head{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:${S.md}px; margin-bottom:${S.lg}px;
}
.bp-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.bp-modal-sub{ font-size:13px; color:${C.textSubtle}; margin:4px 0 0; line-height:1.5; }
.bp-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:8px 0 ${S.md}px; }
.bp-close{
  background:none; border:1px solid ${C.border}; border-radius:${R.sm}px;
  color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex;
}
.bp-close:hover{ color:${C.danger}; border-color:${C.danger}; }

.bp-champ{ display:flex; flex-direction:column; gap:6px; margin-bottom:${S.md}px; }
.bp-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.bp-opt{ font-weight:400; color:${C.textSubtle}; }
.bp-aide{ font-size:12px; color:${C.textSubtle}; line-height:1.5; }
.bp-duo{ display:grid; gap:${S.md}px; grid-template-columns:1fr; }
@media (min-width:480px){ .bp-duo{ grid-template-columns:1fr 1fr; } }

.bp-input{
  width:100%; box-sizing:border-box; padding:12px 14px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px;
  color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.bp-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.bp-input-devise{ position:relative; display:flex; align-items:center; }
.bp-input-devise .bp-input{ padding-right:58px; }
.bp-input-devise span{
  position:absolute; right:14px; font-size:13px;
  font-weight:600; color:${C.textSubtle}; pointer-events:none;
}

.bp-choix{ display:grid; grid-template-columns:1fr 1fr; gap:${S.sm}px; }
.bp-choix-btn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:12px 10px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; color:${C.textMuted};
  transition:all .16s ease;
}
.bp-choix-btn:hover{ border-color:${PALETTE.grey300}; }
.bp-choix-btn.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; color:${C.primary}; }

.bp-bascules{ display:flex; flex-direction:column; gap:${S.sm}px; margin-bottom:${S.md}px; }
.bp-bascule{
  display:flex; align-items:flex-start; gap:11px;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:12px 14px; cursor:pointer;
  font-family:inherit; text-align:left; transition:all .16s ease;
}
.bp-bascule:hover{ border-color:${PALETTE.grey300}; }
.bp-bascule.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.bp-case{
  width:19px; height:19px; border-radius:5px; flex-shrink:0; margin-top:1px;
  border:2px solid ${PALETTE.grey300}; color:#fff;
  display:flex; align-items:center; justify-content:center;
}
.bp-bascule.is-on .bp-case{ background:${C.primary}; border-color:${C.primary}; }
.bp-bascule strong{ display:block; font-size:13.5px; font-weight:600; }
.bp-bascule em{ font-style:normal; font-size:12px; color:${C.textSubtle}; }

.bp-info, .bp-conseil{
  display:flex; align-items:flex-start; gap:9px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:11px 13px;
  font-size:12.5px; color:${C.textMuted}; line-height:1.55;
  margin-bottom:${S.md}px;
}
.bp-err{
  display:flex; align-items:flex-start; gap:8px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:11px 13px; font-size:13px;
  line-height:1.5; margin-bottom:${S.md}px;
}

.bp-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }
.bp-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.bp-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.bp-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.bp-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.bp-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.bp-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.bp-mbtn-ghost{
  flex:1; background:${C.surface}; color:${C.textMuted};
  border:1.5px solid ${C.border};
}
.bp-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.bp-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.bp-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.bp-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:44ch; line-height:1.6; }
.bp-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:bpShim 1.4s infinite;
}
.bp-spin{ animation:bpSpin 1s linear infinite; }
@keyframes bpSpin{ to{ transform:rotate(360deg); } }
@keyframes bpShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
@keyframes bpFade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes bpUp{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
@keyframes bpIn{ from{ opacity:0; transform:translateY(-4px); } to{ opacity:1; transform:none; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;