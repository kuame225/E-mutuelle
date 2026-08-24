import React, { useEffect, useState } from "react";
import {
  Gift, Ticket, Trophy, Loader2, RefreshCw, Plus, X,
  Sparkles, AlertCircle, Search, CheckCircle2, Ban, Bell,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage, moduleActif } from "./useParametrage";
import { notifierMembre } from "./notifier";
import { consigner, EVENEMENTS } from "./journal";

// Vocabulaire aligné sur celui de la table paiements, afin que le livre de
// comptes n'affiche pas deux libellés pour un même mode de règlement.
const MODES_PAIEMENT = [
  { id: "cash",         label: "Espèces" },
  { id: "orange_money", label: "Orange Money" },
  { id: "mtn_money",    label: "MTN Money" },
  { id: "moov_money",   label: "Moov Money" },
  { id: "wave",         label: "Wave" },
  { id: "prelevement",  label: "Prélèvement" },
];
import { C, R, S, SHADOW, PALETTE } from "./theme";

export default function TombolaPage() {
  const { params } = useParametrage();
  const [tirage, setTirage] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [membres, setMembres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null);
  const [dispo, setDispo] = useState(null);
  const [animation, setAnimation] = useState(null);
  const [message, setMessage] = useState(null);
  const [filtre, setFiltre] = useState("tous");

  const trimestre = trimestreCourant();

  async function charger() {
    // tombola_tirages est aussi filtrée : sans le filtre d'organisation,
    // deux mutuelles administrées par le même compte ayant chacune un
    // tirage sur le même trimestre feraient échouer maybeSingle().
    const [tirRes, tickRes, memRes] = await Promise.all([
      supabase.from("tombola_tirages").select("*")
        .eq("organisation_id", params.organisation_id)
        .eq("trimestre", trimestre).maybeSingle(),
      supabase.from("tombola_tickets").select("*")
        .eq("organisation_id", params.organisation_id)
        .eq("trimestre", trimestre)
        .order("numero", { ascending: true }),
      supabase.from("membres").select("id, nom, poste, photo_url, statut_cotisation")
        .eq("organisation_id", params.organisation_id)
        .eq("actif", true).order("nom"),
    ]);
    setTirage(tirRes.data || null);
    setTickets(tickRes.data || []);
    setMembres(memRes.data || []);
    setLoading(false);
  }

  useEffect(() => { charger(); }, [trimestre]);

  const parMembre = Object.fromEntries(membres.map((m) => [m.id, m]));
  const bonus = tickets.filter((t) => t.type_ticket === "bonus");
  const payants = tickets.filter((t) => t.type_ticket === "payant");
  const eligibles = tickets.filter((t) => t.eligible_gain);
  const cagnotte = payants.length * (params.prix_ticket_tombola || 1000);

  const gagnant = tirage?.ticket_gagnant_id
    ? tickets.find((t) => t.id === tirage.ticket_gagnant_id)
    : null;

  async function creerTirage(lot, valeur, nature) {
    setAction(null);
    const { error } = await supabase.from("tombola_tirages").insert({
      organisation_id: params.organisation_id,
      trimestre, lot_attribue: lot, valeur_lot: valeur,
      nature_lot: nature,
      cagnotte_totale: cagnotte, statut: "en_cours",
    });
    if (error) { setMessage({ type: "err", texte: error.message }); return; }
    setMessage({ type: "ok", texte: "Le tirage du trimestre est ouvert." });
    charger();
  }

  // L'achat passe par une fonction serveur : elle vérifie que le membre est
  // à jour de sa cotisation, insère la quantité demandée d'un seul geste, et
  // laisse le déclencheur attribuer le ticket bonus s'il y a lieu.
  async function vendreTickets(membreId, quantite, mode) {
    setAction(null);

    const { data, error } = await supabase.rpc("acheter_tickets", {
      p_membre_id: membreId,
      p_quantite: quantite,
      p_mode: mode,
    });

    if (error) { setMessage({ type: "err", texte: error.message }); return; }

    const nom = parMembre[membreId]?.nom || "ce membre";
    const pluriel = data.quantite > 1 ? "s" : "";

    setMessage({
      type: "ok",
      texte:
        `${data.quantite} ticket${pluriel} enregistré${pluriel} pour ${nom} — ` +
        `${montant(data.total)} FCFA à encaisser.` +
        (data.bonus > 0 ? " Son ticket bonus est acquis." : ""),
    });
    charger();
  }

  // Lance l'animation, puis enregistre le résultat une fois révélé
  function lancerTirage() {
    setMessage(null);
    const candidats = tickets.filter((t) => t.eligible_gain);

    if (candidats.length === 0) {
      setMessage({ type: "err", texte: "Aucun ticket éligible : le tirage ne peut pas avoir lieu." });
      return;
    }

    const elu = candidats[Math.floor(Math.random() * candidats.length)];
    setAnimation({ elu, candidats });
  }

  async function enregistrerResultat(elu) {
    const { error } = await supabase.from("tombola_tirages").update({
      ticket_gagnant_id: elu.id,
      date_tirage: new Date().toISOString(),
      cagnotte_totale: cagnotte,
      statut: "tire",
    }).eq("id", tirage.id);

    if (error) {
      setMessage({ type: "err", texte: error.message });
      return;
    }

    // Notification au gagnant : notifierMembre enregistre le message dans son
    // espace ET envoie l'alerte sur son téléphone. Pour annoncer un gain,
    // l'alerte compte au moins autant que la trace.
    await notifierMembre(elu.membre_id, {
      organisationId: params.organisation_id,
      type: "tombola",
      titre: "Vous avez gagné à la tombola !",
      message:
        `Votre ticket ${elu.numero} a été tiré au sort pour le trimestre ` +
        `${libelleTrimestre(trimestre)}. Vous remportez : ${tirage.lot_attribue}. ` +
        `Rapprochez-vous du Bureau pour la remise du lot.`,
    });

    consigner(EVENEMENTS.TOMBOLA_TIRAGE_EFFECTUE, {
      organisation_id: params.organisation_id,
      tirage_id: tirage.id,
      trimestre,
      membre_id: elu.membre_id,
      ticket: elu.numero,
      lot: tirage.lot_attribue,
    });

    setMessage({
      type: "ok",
      texte: `Ticket ${elu.numero} tiré. ${parMembre[elu.membre_id]?.nom} a été notifié.`,
    });
    charger();
  }

  const ticketsVus = tickets.filter((t) => {
    if (filtre === "bonus") return t.type_ticket === "bonus";
    if (filtre === "payant") return t.type_ticket === "payant";
    if (filtre === "eligibles") return t.eligible_gain;
    return true;
  });

  if (loading) {
    return (
      <div className="tb-wrap">
        <style>{CSS}</style>
        <div className="tb-skel tb-skel-lg" /><div className="tb-skel" />
      </div>
    );
  }

  return (
    <div className="tb-wrap">
      <style>{CSS}</style>

      {message && (
        <div className={`tb-msg ${message.type === "ok" ? "is-ok" : "is-err"}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} aria-label="Fermer"><X size={15} /></button>
        </div>
      )}

      {/* ---- Bandeau ---- */}
      {gagnant ? (
        <section className="tb-hero tb-hero-win">
          <div className="tb-hero-glow" />
          <Trophy size={44} className="tb-trophy" />
          <div className="tb-win-label">Ticket gagnant</div>
          <div className="tb-win-numero">{gagnant.numero}</div>
          <h2 className="tb-win-nom">{parMembre[gagnant.membre_id]?.nom || "—"}</h2>
          <p className="tb-win-lot">
            remporte <strong>{tirage.lot_attribue}</strong>
            {tirage.valeur_lot ? ` — ${montant(tirage.valeur_lot)} FCFA` : ""}
          </p>
          <div className="tb-win-meta">
            Ticket {gagnant.type_ticket === "bonus" ? "bonus" : "acheté"} ·
            Tirage du {new Date(tirage.date_tirage).toLocaleDateString("fr-FR")}
          </div>
          <div className="tb-win-notif">
            <Bell size={14} /> Le gagnant a été notifié dans son espace personnel.
          </div>
        </section>
      ) : (
        <section className="tb-hero">
          <div className="tb-hero-glow" />
          <div className="tb-hero-top">
            <div>
              <div className="tb-hero-label"><Gift size={14} /> Tombola trimestrielle</div>
              <h2 className="tb-hero-titre">{libelleTrimestre(trimestre)}</h2>
              <p className="tb-hero-sub">
                {tirage ? `Lot en jeu : ${tirage.lot_attribue}` : "Aucun tirage ouvert pour ce trimestre."}
              </p>
            </div>
            {tirage && (
              <div className="tb-cagnotte">
                <div className="tb-cagnotte-val">{montant(cagnotte)}</div>
                <div className="tb-cagnotte-lab">FCFA de cagnotte</div>
              </div>
            )}
          </div>

          <div className="tb-hero-actions">
            {!tirage ? (
              <button className="tb-btn tb-btn-light" onClick={() => setAction("creation")}>
                <Plus size={17} /> Ouvrir le tirage
              </button>
            ) : (
              <>
                <button
                  className="tb-btn tb-btn-light"
                  onClick={async () => {
                    setAction("vente");
                    const { data } = await supabase.rpc("tombola_disponibilite", {
                      p_org: params.organisation_id,
                    });
                    setDispo(data || null);
                  }}
                >
                  <Ticket size={17} /> Vendre un ticket
                </button>
                <button
                  className="tb-btn tb-btn-accent"
                  onClick={lancerTirage}
                  disabled={eligibles.length === 0}
                >
                  <Sparkles size={17} /> Procéder au tirage
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {/* ---- Indicateurs ---- */}
      <section className="tb-kpis">
        <Kpi valeur={bonus.length} label="Tickets bonus" sous="Régularité" Icon={Gift} couleur={C.success} />
        <Kpi valeur={payants.length} label="Tickets vendus" sous={`${montant(params.prix_ticket_tombola)} F l'unité`} Icon={Ticket} couleur={C.warning} />
        <Kpi valeur={eligibles.length} label="Tickets éligibles" sous="Membres à jour" Icon={Trophy} couleur={C.primary} />
      </section>

      <div className="tb-regle">
        <Ban size={16} />
        <span>
          Seuls les membres à jour au moment du tirage peuvent gagner. Les tickets
          des membres en retard restent enregistrés mais sont écartés automatiquement.
        </span>
      </div>

      {/* ---- Tickets ---- */}
      <section className="tb-card">
        <header className="tb-card-head">
          <h3 className="tb-card-titre">Tickets engagés</h3>
          <div className="tb-filtres">
            {[
              { id: "tous", label: "Tous" },
              { id: "bonus", label: "Bonus" },
              { id: "payant", label: "Payants" },
              { id: "eligibles", label: "Éligibles" },
            ].map((f) => (
              <button
                key={f.id}
                className={`tb-filtre ${filtre === f.id ? "is-on" : ""}`}
                onClick={() => setFiltre(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button className="tb-refresh" onClick={charger} title="Actualiser">
            <RefreshCw size={15} />
          </button>
        </header>

        {ticketsVus.length === 0 ? (
          <div className="tb-vide">
            <Ticket size={34} color={PALETTE.grey300} />
            <div className="tb-vide-titre">Aucun ticket</div>
            <div className="tb-vide-sub">
              Les tickets bonus sont attribués automatiquement dès qu'une
              cotisation est soldée.
            </div>
          </div>
        ) : (
          <ul className="tb-tickets">
            {ticketsVus.map((t) => {
              const m = parMembre[t.membre_id];
              const estGagnant = tirage?.ticket_gagnant_id === t.id;
              return (
                <li key={t.id} className={`tb-ticket ${estGagnant ? "is-win" : ""}`}>
                  <span className="tb-num">{t.numero || "—"}</span>

                  {m?.photo_url
                    ? <img src={m.photo_url} alt="" className="tb-avatar-img" />
                    : <span className="tb-avatar">{initiales(m?.nom)}</span>}

                  <div className="tb-ticket-info">
                    <div className="tb-ticket-nom">
                      {m?.nom || "—"}
                      {estGagnant && <span className="tb-win-tag"><Trophy size={11} /> Gagnant</span>}
                    </div>
                    <div className="tb-ticket-meta">
                      {t.type_ticket === "bonus"
                        ? "Ticket bonus"
                        : `Ticket acheté · ${montant(t.montant_paye)} F`}
                    </div>
                  </div>

                  <span
                    className="tb-chip"
                    style={{
                      background: t.eligible_gain ? "#DCFCE7" : "#FEE2E2",
                      color: t.eligible_gain ? C.success : C.danger,
                    }}
                  >
                    {t.eligible_gain ? "Éligible" : "Écarté"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- Modales ---- */}
      {action === "creation" && (
        <ModalCreation onCancel={() => setAction(null)} onConfirm={creerTirage} />
      )}
      {action === "vente" && (
        <ModalVente
          membres={membres}
          prix={params.prix_ticket_tombola || 1000}
          dispo={dispo}
          onCancel={() => { setAction(null); setDispo(null); }}
          onConfirm={vendreTickets}
        />
      )}
      {animation && (
        <AnimationTirage
          elu={animation.elu}
          candidats={animation.candidats}
          membre={parMembre[animation.elu.membre_id]}
          lot={tirage?.lot_attribue}
          onTermine={async () => {
            await enregistrerResultat(animation.elu);
            setAnimation(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Animation du tirage ---------------- */

function AnimationTirage({ elu, candidats, membre, lot, onTermine }) {
  const [phase, setPhase] = useState("decompte");   // decompte | defilement | revelation
  const [compte, setCompte] = useState(3);
  const [affiche, setAffiche] = useState(candidats[0]?.numero || "—");
  const [enregistre, setEnregistre] = useState(false);

  // Décompte 3 → 1
  useEffect(() => {
    if (phase !== "decompte") return;
    if (compte === 0) { setPhase("defilement"); return; }
    const t = setTimeout(() => setCompte((c) => c - 1), 900);
    return () => clearTimeout(t);
  }, [phase, compte]);

  // Défilement qui ralentit progressivement
  useEffect(() => {
    if (phase !== "defilement") return;
    let delai = 55;
    let timer;

    const tour = () => {
      const alea = candidats[Math.floor(Math.random() * candidats.length)];
      setAffiche(alea.numero);
      delai *= 1.14;
      if (delai < 420) {
        timer = setTimeout(tour, delai);
      } else {
        setAffiche(elu.numero);
        setPhase("revelation");
      }
    };

    timer = setTimeout(tour, delai);
    return () => clearTimeout(timer);
  }, [phase, candidats, elu]);

  // Enregistrement une fois le résultat révélé
  useEffect(() => {
    if (phase !== "revelation" || enregistre) return;
    setEnregistre(true);
    const t = setTimeout(() => onTermine(), 2600);
    return () => clearTimeout(t);
  }, [phase, enregistre, onTermine]);

  return (
    <div className="tb-anim">
      <style>{CSS_ANIM}</style>

      {phase === "decompte" && (
        <div className="ta-decompte">
          <div className="ta-label">Tirage au sort en cours…</div>
          <div className="ta-chiffre" key={compte}>{compte === 0 ? "GO" : compte}</div>
          <div className="ta-sous">{candidats.length} tickets éligibles</div>
        </div>
      )}

      {phase === "defilement" && (
        <div className="ta-defile">
          <div className="ta-label">Sélection du ticket gagnant</div>
          <div className="ta-numero is-roule">{affiche}</div>
          <div className="ta-barre"><span /></div>
        </div>
      )}

      {phase === "revelation" && (
        <div className="ta-final">
          <Trophy size={54} className="ta-trophy" />
          <div className="ta-label">Ticket gagnant</div>
          <div className="ta-numero is-final">{elu.numero}</div>
          <div className="ta-nom">{membre?.nom || "—"}</div>
          {lot && <div className="ta-lot">remporte {lot}</div>}
          <div className="ta-notif"><Bell size={14} /> Notification envoyée au gagnant</div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Modale : ouverture du tirage ---------------- */

function ModalCreation({ onCancel, onConfirm }) {
  const [lot, setLot] = useState("");
  const [valeur, setValeur] = useState("");
  const [nature, setNature] = useState("nature");
  const [err, setErr] = useState("");

  return (
    <div className="tb-overlay" onClick={onCancel}>
      <div className="tb-modal" onClick={(e) => e.stopPropagation()}>
        <header className="tb-modal-head">
          <h3 className="tb-modal-titre">Ouvrir le tirage du trimestre</h3>
          <button className="tb-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        <div className="tb-field">
          <label className="tb-label" htmlFor="lot">Lot mis en jeu</label>
          <input
            id="lot" value={lot} onChange={(e) => setLot(e.target.value)}
            placeholder="Ex : Téléphone Android, panier de vivres…"
            className="tb-input"
          />
        </div>

        <div className="tb-field">
          <span className="tb-label">Forme du lot</span>
          <div className="tb-natures">
            <button
              className={`tb-nature ${nature === "nature" ? "is-on" : ""}`}
              onClick={() => setNature("nature")}
            >
              <strong>En nature</strong>
              <em>Un bien remis au gagnant</em>
            </button>
            <button
              className={`tb-nature ${nature === "especes" ? "is-on" : ""}`}
              onClick={() => setNature("especes")}
            >
              <strong>En espèces</strong>
              <em>Une somme sortie de la caisse</em>
            </button>
          </div>
          <p className="tb-nature-aide">
            {nature === "especes"
              ? "Ce lot apparaîtra comme une sortie au livre de comptes."
              : "Sa valeur reste une estimation : aucune sortie n'est enregistrée."}
          </p>
        </div>

        <div className="tb-field">
          <label className="tb-label" htmlFor="val">
            {nature === "especes" ? "Montant du lot" : "Valeur estimée"}
            {nature === "nature" && <span className="tb-opt"> — facultatif</span>}
          </label>
          <div className="tb-input-wrap">
            <input
              id="val" type="number" value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              placeholder="0" className="tb-input"
            />
            <span className="tb-devise">FCFA</span>
          </div>
        </div>

        {err && <div className="tb-err"><AlertCircle size={15} /> {err}</div>}

        <div className="tb-modal-actions">
          <button className="tb-btn tb-btn-ghost" onClick={onCancel}>Annuler</button>
          <button
            className="tb-btn tb-btn-primary"
            onClick={() => {
              if (!lot.trim()) { setErr("Indiquez le lot mis en jeu."); return; }
              if (nature === "especes" && !(parseInt(valeur) > 0)) {
                setErr("Un lot en espèces demande un montant.");
                return;
              }
              onConfirm(lot.trim(), parseInt(valeur) || null, nature);
            }}
          >
            Ouvrir le tirage
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Modale : vente d'un ticket ---------------- */

function ModalVente({ membres, prix, dispo, onCancel, onConfirm }) {
  const [q, setQ] = useState("");
  const [choisi, setChoisi] = useState(null);
  const [quantite, setQuantite] = useState(1);
  const [mode, setMode] = useState("cash");

  const liste = membres.filter((m) =>
    m.nom.toLowerCase().includes(q.toLowerCase().trim())
  );

  const membreChoisi = membres.find((m) => m.id === choisi) || null;
  const total = (prix || 0) * quantite;

  // Plafond de tickets payants pour ce trimestre — null signifie illimité.
  // dispo vaut null pendant le chargement : on autorise la sélection en
  // attendant plutôt que de bloquer sur un état encore inconnu.
  const plafondActif = dispo && dispo.plafond != null;
  const restant = plafondActif ? Math.max(dispo.restant, 0) : null;
  const epuise = plafondActif && restant === 0;
  const maxQuantite = plafondActif ? Math.max(Math.min(50, restant), 1) : 50;

  function selectionner(m) {
    // Décision du Bureau : seul un membre à jour peut participer
    if (m.statut_cotisation !== "a_jour" || epuise) return;
    setChoisi(m.id);
  }

  function ajuster(delta) {
    setQuantite((n) => Math.min(maxQuantite, Math.max(1, n + delta)));
  }

  return (
    <div className="tb-overlay" onClick={onCancel}>
      <div className="tb-modal" onClick={(e) => e.stopPropagation()}>
        <header className="tb-modal-head">
          <div>
            <h3 className="tb-modal-titre">Vendre des tickets</h3>
            <p className="tb-modal-sub">
              {montant(prix)} FCFA l'unité · à encaisser auprès du membre
            </p>
          </div>
          <button className="tb-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        {plafondActif && (
          <div className={`tb-plafond ${epuise ? "is-epuise" : ""}`}>
            {epuise
              ? "Le plafond de tickets de ce trimestre est atteint."
              : `${restant} ticket${restant > 1 ? "s" : ""} restant${restant > 1 ? "s" : ""} sur ${dispo.plafond} pour ce trimestre.`}
          </div>
        )}

        <div className="tb-search">
          <Search size={16} className="tb-search-icon" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un membre…" className="tb-input tb-input-search"
          />
        </div>

        <ul className="tb-membres">
          {liste.slice(0, 40).map((m) => {
            const aJour = m.statut_cotisation === "a_jour";
            return (
              <li key={m.id}>
                <button
                  className={`tb-membre ${choisi === m.id ? "is-on" : ""} ${aJour ? "" : "is-bloque"}`}
                  onClick={() => selectionner(m)}
                  disabled={!aJour}
                  title={aJour ? undefined : "Ce membre doit d'abord régulariser sa cotisation."}
                >
                  {m.photo_url
                    ? <img src={m.photo_url} alt="" className="tb-avatar-img" />
                    : <span className="tb-avatar">{initiales(m.nom)}</span>}
                  <span className="tb-membre-text">
                    <strong>{m.nom}</strong>
                    <em>{m.poste || "—"}</em>
                  </span>
                  {!aJour && (
                    <span className="tb-membre-warn">
                      <Ban size={11} /> Cotisation à jour requise
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {liste.length === 0 && <li className="tb-membres-vide">Aucun membre trouvé.</li>}
        </ul>

        {/* ---- Quantité et coût ---- */}
        {membreChoisi && (
          <div className="tb-commande">
            <div className="tb-commande-ligne">
              <span className="tb-commande-lab">Nombre de tickets</span>
              <div className="tb-compteur">
                <button
                  onClick={() => ajuster(-1)}
                  disabled={quantite <= 1}
                  aria-label="Retirer un ticket"
                >−</button>
                <input
                  type="number" min={1} max={50} value={quantite}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setQuantite(Number.isNaN(n) ? 1 : Math.min(50, Math.max(1, n)));
                  }}
                />
                <button
                  onClick={() => ajuster(1)}
                  disabled={quantite >= 50}
                  aria-label="Ajouter un ticket"
                >+</button>
              </div>
            </div>

            <div className="tb-commande-total">
              <span>Montant à encaisser</span>
              <strong>{montant(total)} <em>FCFA</em></strong>
            </div>

            <div className="tb-commande-detail">
              {quantite} × {montant(prix)} F pour {membreChoisi.nom}
            </div>

            <div className="tb-commande-mode">
              <label htmlFor="mode-paiement">Mode de règlement</label>
              <select
                id="mode-paiement"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                {MODES_PAIEMENT.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="tb-modal-actions">
          <button className="tb-btn tb-btn-ghost" onClick={onCancel}>Annuler</button>
          <button
            className="tb-btn tb-btn-primary"
            disabled={!choisi || epuise}
            onClick={() => onConfirm(choisi, quantite, mode)}
          >
            {epuise
              ? "Plafond atteint"
              : quantite > 1
                ? `Enregistrer ${quantite} tickets`
                : "Enregistrer le ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Sous-composant ---------------- */

function Kpi({ valeur, label, sous, Icon, couleur }) {
  return (
    <article className="tb-kpi">
      <span className="tb-kpi-icon" style={{ background: couleur + "14", color: couleur }}>
        <Icon size={19} />
      </span>
      <div>
        <div className="tb-kpi-val" style={{ color: couleur }}>{valeur}</div>
        <div className="tb-kpi-lab">{label}</div>
        <div className="tb-kpi-sous">{sous}</div>
      </div>
    </article>
  );
}

/* ---------------- Utilitaires ---------------- */

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function initiales(nom) {
  if (!nom) return "?";
  return nom.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase();
}

function trimestreCourant() {
  const d = new Date();
  return `${d.getFullYear()}-T${Math.ceil((d.getMonth() + 1) / 3)}`;
}

function libelleTrimestre(t) {
  const [annee, tr] = t.split("-T");
  const periodes = {
    1: "Janvier — Mars", 2: "Avril — Juin",
    3: "Juillet — Septembre", 4: "Octobre — Décembre",
  };
  return `${periodes[tr]} ${annee}`;
}

/* ---------------- Styles de l'animation ---------------- */

const CSS_ANIM = `
.tb-anim{
  position:fixed; inset:0; z-index:300;
  background:linear-gradient(150deg, ${PALETTE.blue900} 0%, ${PALETTE.blue800} 60%, #0A2A5E 130%);
  display:flex; align-items:center; justify-content:center;
  color:#fff; font-family:'Inter','Poppins',system-ui,sans-serif;
  animation:taFade .3s ease;
}
.ta-decompte, .ta-defile, .ta-final{
  display:flex; flex-direction:column; align-items:center;
  text-align:center; padding:${S.xl}px;
}
.ta-label{
  font-size:13px; font-weight:600; letter-spacing:.12em;
  text-transform:uppercase; opacity:.7;
}
.ta-sous{ font-size:14px; opacity:.6; margin-top:${S.lg}px; }
.ta-chiffre{
  font-size:120px; font-weight:700; line-height:1;
  margin:${S.xl}px 0 0; letter-spacing:-.04em;
  animation:taPop .5s cubic-bezier(.2,.9,.3,1.4);
}
.ta-numero{
  font-family:'JetBrains Mono',monospace; font-weight:700;
  letter-spacing:.06em; margin:${S.xl}px 0 0;
}
.ta-numero.is-roule{
  font-size:46px; color:#FBBF24;
  text-shadow:0 0 26px rgba(251,191,36,.5);
}
.ta-numero.is-final{
  font-size:52px; color:#FBBF24;
  text-shadow:0 0 34px rgba(251,191,36,.65);
  animation:taPop .55s cubic-bezier(.2,.9,.3,1.4);
}
.ta-barre{
  width:220px; height:4px; border-radius:4px;
  background:rgba(255,255,255,.18); overflow:hidden; margin-top:${S.xl}px;
}
.ta-barre span{
  display:block; height:100%; width:40%; border-radius:4px;
  background:#FBBF24; animation:taGlisse 1s ease-in-out infinite;
}
.ta-trophy{ color:#FBBF24; animation:taPop .6s cubic-bezier(.2,.9,.3,1.4); }
.ta-nom{
  font-size:26px; font-weight:700; letter-spacing:-.02em;
  margin-top:${S.lg}px; animation:taMonte .5s ease .15s both;
}
.ta-lot{ font-size:16px; opacity:.85; margin-top:6px; animation:taMonte .5s ease .3s both; }
.ta-notif{
  display:flex; align-items:center; gap:8px;
  background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2);
  border-radius:${R.pill}px; padding:9px 16px;
  font-size:13px; margin-top:${S.xl}px;
  animation:taMonte .5s ease .45s both;
}
@keyframes taFade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes taPop{ from{ opacity:0; transform:scale(.5); } to{ opacity:1; transform:scale(1); } }
@keyframes taMonte{ from{ opacity:0; transform:translateY(12px); } to{ opacity:1; transform:none; } }
@keyframes taGlisse{
  0%{ transform:translateX(-100%); } 100%{ transform:translateX(250%); }
}
`;

/* ---------------- Styles de la page ---------------- */

const CSS = `
.tb-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .tb-wrap{ padding:${S.lg}px; } }

.tb-msg{
  display:flex; align-items:flex-start; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px; animation:tbIn .2s ease;
}
.tb-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.tb-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }
.tb-msg button{
  margin-left:auto; background:none; border:none; cursor:pointer;
  color:inherit; opacity:.7; padding:0; display:flex; flex-shrink:0;
}

/* ---- Bandeau ---- */
.tb-hero{
  position:relative; overflow:hidden; color:#fff;
  background:linear-gradient(135deg, ${PALETTE.blue900}, ${PALETTE.blue800} 55%, ${PALETTE.blue600} 130%);
  border-radius:${R.xxl}px; padding:${S.xl}px; box-shadow:${SHADOW.lg};
}
.tb-hero-win{
  background:linear-gradient(135deg, #B45309 0%, ${C.warning} 60%, #FBBF24 130%);
  text-align:center; padding:${S.xxl}px ${S.xl}px;
}
.tb-hero-glow{
  position:absolute; width:280px; height:280px; border-radius:50%;
  background:rgba(255,255,255,.07); right:-90px; top:-120px;
}
.tb-hero-top{
  position:relative; display:flex; align-items:flex-start;
  justify-content:space-between; gap:${S.lg}px; flex-wrap:wrap;
}
.tb-hero-label{
  display:flex; align-items:center; gap:7px;
  font-size:12px; font-weight:600; letter-spacing:.08em;
  text-transform:uppercase; opacity:.75;
}
.tb-hero-titre{ font-size:26px; font-weight:700; letter-spacing:-.02em; margin:6px 0 0; }
.tb-hero-sub{ font-size:14.5px; opacity:.82; margin:5px 0 0; }
.tb-cagnotte{
  background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2);
  border-radius:${R.lg}px; padding:${S.md}px ${S.lg}px; text-align:center;
}
.tb-cagnotte-val{ font-size:24px; font-weight:700; letter-spacing:-.02em; }
.tb-cagnotte-lab{ font-size:11.5px; opacity:.75; margin-top:2px; }
.tb-hero-actions{
  position:relative; display:flex; gap:${S.md}px;
  margin-top:${S.xl}px; flex-wrap:wrap;
}

/* ---- Gagnant ---- */
.tb-trophy{ position:relative; margin-bottom:${S.md}px; }
.tb-win-label{
  position:relative; font-size:12px; font-weight:600;
  letter-spacing:.1em; text-transform:uppercase; opacity:.85;
}
.tb-win-numero{
  position:relative; font-family:'JetBrains Mono',monospace;
  font-size:30px; font-weight:700; letter-spacing:.06em; margin-top:8px;
}
.tb-win-nom{
  position:relative; font-size:26px; font-weight:700;
  letter-spacing:-.02em; margin:${S.md}px 0 0;
}
.tb-win-lot{ position:relative; font-size:15.5px; opacity:.92; margin:6px 0 0; }
.tb-win-meta{ position:relative; font-size:13px; opacity:.75; margin-top:${S.md}px; }
.tb-win-notif{
  position:relative; display:inline-flex; align-items:center; gap:7px;
  background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.24);
  border-radius:${R.pill}px; padding:8px 15px;
  font-size:12.5px; margin-top:${S.lg}px;
}

/* ---- Boutons ---- */
.tb-btn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease, transform .12s ease;
}
.tb-btn:active:not(:disabled){ transform:translateY(1px); }
.tb-btn:disabled{ opacity:.55; cursor:not-allowed; }
.tb-btn-light{
  background:rgba(255,255,255,.16); color:#fff;
  border:1px solid rgba(255,255,255,.24);
}
.tb-btn-light:hover:not(:disabled){ background:rgba(255,255,255,.26); }
.tb-btn-accent{ background:${C.warning}; color:#fff; box-shadow:${SHADOW.sm}; }
.tb-btn-accent:hover:not(:disabled){ background:#DC6803; }
.tb-btn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.tb-btn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.tb-btn-ghost{
  flex:1; background:${C.surface}; color:${C.textMuted};
  border:1.5px solid ${C.border};
}
.tb-btn-ghost:hover{ border-color:${PALETTE.grey300}; }

/* ---- Indicateurs ---- */
.tb-kpis{
  display:grid; gap:${S.md}px;
  grid-template-columns:repeat(auto-fit, minmax(190px, 1fr));
}
.tb-kpi{
  display:flex; align-items:center; gap:${S.md}px;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.tb-kpi-icon{
  width:44px; height:44px; border-radius:${R.md}px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.tb-kpi-val{ font-size:26px; font-weight:700; line-height:1; letter-spacing:-.02em; }
.tb-kpi-lab{ font-size:13.5px; font-weight:600; margin-top:5px; }
.tb-kpi-sous{ font-size:12px; color:${C.textSubtle}; margin-top:2px; }

.tb-regle{
  display:flex; align-items:flex-start; gap:10px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:13px 16px;
  font-size:13.5px; color:${C.primary}; line-height:1.55;
}

/* ---- Carte ---- */
.tb-card{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.tb-card-head{
  display:flex; align-items:center; gap:${S.md}px;
  margin-bottom:${S.lg}px; flex-wrap:wrap;
}
.tb-card-titre{ font-size:16px; font-weight:600; margin:0; letter-spacing:-.01em; }
.tb-filtres{ display:flex; gap:3px; background:${C.bg}; padding:3px; border-radius:${R.md}px; }
.tb-filtre{
  border:none; background:transparent; cursor:pointer;
  padding:7px 13px; border-radius:${R.sm}px;
  font-family:inherit; font-size:12.5px; font-weight:600; color:${C.textSubtle};
  transition:all .16s ease;
}
.tb-filtre.is-on{ background:${C.surface}; color:${C.primary}; box-shadow:${SHADOW.xs}; }
.tb-refresh{
  margin-left:auto; background:none; border:1px solid ${C.border};
  border-radius:${R.sm}px; color:${C.textSubtle}; cursor:pointer;
  padding:7px; display:flex; transition:color .16s ease, border-color .16s ease;
}
.tb-refresh:hover{ color:${C.primary}; border-color:${C.primary}; }

/* ---- Tickets ---- */
.tb-tickets{ list-style:none; margin:0; padding:0; }
.tb-ticket{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px 0; border-bottom:1px solid ${C.border};
}
.tb-ticket:last-child{ border-bottom:none; }
.tb-ticket.is-win{
  background:#FFFBEB; border-radius:${R.md}px;
  padding-left:${S.md}px; padding-right:${S.md}px;
}
.tb-num{
  flex-shrink:0; font-family:'JetBrains Mono',monospace;
  font-size:11.5px; font-weight:600; letter-spacing:.04em;
  background:${C.bg}; color:${C.textMuted};
  border:1px solid ${C.border}; border-radius:${R.sm}px;
  padding:5px 9px; white-space:nowrap;
}
.tb-ticket.is-win .tb-num{
  background:${C.warning}; color:#fff; border-color:${C.warning};
}
.tb-avatar, .tb-avatar-img{ width:38px; height:38px; border-radius:50%; flex-shrink:0; }
.tb-avatar{
  background:linear-gradient(135deg, ${PALETTE.blue800}, ${PALETTE.blue600});
  color:#fff; display:flex; align-items:center; justify-content:center;
  font-size:13px; font-weight:700;
}
.tb-avatar-img{ object-fit:cover; background:${PALETTE.grey200}; }
.tb-ticket-info{ flex:1; min-width:0; }
.tb-ticket-nom{ display:flex; align-items:center; gap:8px; font-size:14.5px; font-weight:600; flex-wrap:wrap; }
.tb-win-tag{
  display:inline-flex; align-items:center; gap:4px;
  background:${C.warning}; color:#fff; font-size:10.5px; font-weight:700;
  padding:2px 8px; border-radius:${R.pill}px;
}
.tb-ticket-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }
.tb-chip{
  flex-shrink:0; padding:5px 11px; border-radius:${R.pill}px;
  font-size:11.5px; font-weight:600;
}

/* ---- Modales ---- */
.tb-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; animation:tbFade .18s ease; overflow-y:auto;
}
.tb-modal{
  width:100%; max-width:480px; background:${C.surface}; margin:auto;
  border-radius:${R.xxl}px; padding:${S.xl}px;
  box-shadow:${SHADOW.lg}; animation:tbUp .22s cubic-bezier(.4,0,.2,1);
}
.tb-modal-head{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:${S.md}px; margin-bottom:${S.lg}px;
}
.tb-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.tb-modal-sub{ font-size:13.5px; color:${C.textSubtle}; margin:4px 0 0; }

.tb-plafond{
  background:${PALETTE.blue50}; color:${C.primary};
  border:1px solid ${PALETTE.blue100}; border-radius:${R.md}px;
  padding:9px 13px; font-size:12.5px; font-weight:600;
  margin:${S.md}px 0;
}
.tb-plafond.is-epuise{
  background:#FEE2E2; color:${C.danger}; border-color:${C.danger}33;
}
.tb-close{
  background:none; border:1px solid ${C.border}; border-radius:${R.sm}px;
  color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex;
}
.tb-close:hover{ color:${C.danger}; border-color:${C.danger}; }
.tb-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }

/* ---- Commande groupée ---- */
.tb-commande{
  background:${C.bg}; border:1px solid ${C.border};
  border-radius:${R.md}px; padding:${S.md}px ${S.lg}px; margin-top:${S.md}px;
}
.tb-commande-ligne{
  display:flex; align-items:center; justify-content:space-between; gap:${S.md}px;
}
.tb-commande-lab{ font-size:13.5px; font-weight:600; color:${C.textMuted}; }
.tb-compteur{
  display:flex; align-items:center; gap:2px;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.sm}px; overflow:hidden;
}
.tb-compteur button{
  width:34px; height:36px; border:none; background:transparent;
  cursor:pointer; font-size:19px; font-weight:600; color:${C.primary};
  line-height:1;
}
.tb-compteur button:disabled{ opacity:.35; cursor:not-allowed; }
.tb-compteur input{
  width:52px; height:36px; border:none; outline:none; background:transparent;
  text-align:center; font-family:'JetBrains Mono',monospace;
  font-size:15px; font-weight:600; color:${C.text};
  -moz-appearance:textfield;
}
.tb-compteur input::-webkit-outer-spin-button,
.tb-compteur input::-webkit-inner-spin-button{ -webkit-appearance:none; margin:0; }

.tb-commande-total{
  display:flex; align-items:baseline; justify-content:space-between;
  gap:${S.md}px; margin-top:${S.md}px; padding-top:${S.md}px;
  border-top:1px solid ${C.border};
  font-size:13.5px; color:${C.textMuted};
}
.tb-commande-total strong{
  font-size:21px; font-weight:700; color:${C.primary}; letter-spacing:-.02em;
}
.tb-commande-total em{ font-style:normal; font-size:12px; font-weight:600; opacity:.7; }
.tb-commande-detail{ font-size:12.5px; color:${C.textSubtle}; margin-top:3px; }
.tb-commande-mode{
  display:flex; align-items:center; justify-content:space-between;
  gap:${S.md}px; margin-top:${S.md}px; padding-top:${S.md}px;
  border-top:1px solid ${C.border};
}
.tb-commande-mode label{ font-size:13.5px; font-weight:600; color:${C.textMuted}; }
.tb-commande-mode select{
  border:1.5px solid ${C.border}; border-radius:${R.sm}px;
  background:${C.surface}; padding:9px 12px; cursor:pointer;
  font-family:inherit; font-size:13.5px; color:${C.text}; outline:none;
}
.tb-commande-mode select:focus{ border-color:${C.primary}; }

/* ---- Forme du lot ---- */
.tb-natures{ display:grid; grid-template-columns:1fr 1fr; gap:${S.sm}px; }
.tb-nature{
  display:flex; flex-direction:column; gap:2px; text-align:left;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:12px 14px; cursor:pointer;
  font-family:inherit; transition:all .16s ease;
}
.tb-nature:hover{ border-color:${PALETTE.grey300}; }
.tb-nature.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.tb-nature strong{ font-size:14px; font-weight:600; color:${C.text}; }
.tb-nature em{ font-style:normal; font-size:12px; color:${C.textSubtle}; }
.tb-nature-aide{ font-size:12.5px; color:${C.textSubtle}; margin:8px 0 0; line-height:1.5; }

.tb-membre.is-bloque{ opacity:.55; cursor:not-allowed; }
.tb-membre.is-bloque:hover{ border-color:${C.border}; }
.tb-membre-warn{ display:inline-flex; align-items:center; gap:4px; }

.tb-field{ margin-bottom:${S.lg}px; }
.tb-label{ display:block; font-size:13.5px; font-weight:600; color:${C.textMuted}; margin-bottom:8px; }
.tb-opt{ font-weight:400; color:${C.textSubtle}; }
.tb-input{
  width:100%; box-sizing:border-box; padding:13px 15px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:15px;
  color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.tb-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.tb-input-wrap{ position:relative; }
.tb-input-wrap .tb-input{ padding-right:58px; }
.tb-devise{
  position:absolute; right:15px; top:50%; transform:translateY(-50%);
  font-size:13px; font-weight:600; color:${C.textSubtle}; pointer-events:none;
}
.tb-search{ position:relative; margin-bottom:${S.md}px; }
.tb-search-icon{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:${C.textSubtle}; }
.tb-input-search{ padding-left:40px; }

.tb-membres{
  list-style:none; margin:0; padding:0; max-height:280px; overflow-y:auto;
  display:flex; flex-direction:column; gap:5px;
}
.tb-membre{
  display:flex; align-items:center; gap:${S.md}px; width:100%;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:10px 13px; cursor:pointer;
  font-family:inherit; text-align:left; transition:all .16s ease;
}
.tb-membre:hover{ border-color:${PALETTE.grey300}; }
.tb-membre.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.tb-membre-text{ flex:1; min-width:0; display:flex; flex-direction:column; }
.tb-membre-text strong{ font-size:14px; font-weight:600; }
.tb-membre-text em{ font-style:normal; font-size:12px; color:${C.textSubtle}; }
.tb-membre-warn{
  flex-shrink:0; font-size:11px; font-weight:600;
  background:#FEE2E2; color:${C.danger};
  padding:3px 9px; border-radius:${R.pill}px;
}
.tb-membres-vide{ padding:${S.lg}px; text-align:center; color:${C.textSubtle}; font-size:13.5px; }

.tb-err{
  display:flex; align-items:center; gap:8px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:11px 14px; font-size:13.5px; margin-bottom:${S.md}px;
}

/* ---- Divers ---- */
.tb-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  padding:${S.xxl}px ${S.lg}px; gap:${S.sm}px;
}
.tb-vide-titre{ font-size:15px; font-weight:600; margin-top:${S.sm}px; }
.tb-vide-sub{ font-size:13px; color:${C.textSubtle}; max-width:38ch; line-height:1.55; }
.tb-skel{
  height:130px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:tbShim 1.4s infinite;
}
.tb-skel-lg{ height:200px; border-radius:${R.xxl}px; }
.tb-spin{ animation:tbSpin 1s linear infinite; }
@keyframes tbSpin{ to{ transform:rotate(360deg); } }
@keyframes tbShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
@keyframes tbFade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes tbUp{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
@keyframes tbIn{ from{ opacity:0; transform:translateY(-4px); } to{ opacity:1; transform:none; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;