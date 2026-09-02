import React, { useEffect, useState } from "react";
import {
  Coins, Plus, Loader2, Calendar, Users, ChevronLeft,
  AlertCircle, PartyPopper, History, Search, TrendingUp, Wallet,
  HeartHandshake, CheckCircle2, KeyRound, Lock,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

function montant(v) {
  return Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const VIDE = {
  titre: "", date_debut: "", valeur_part: "", max_parts_par_reunion: "5",
  montant_fonds_social: "", montant_amende_absence: "",
};

export default function EpargneAvecPage() {
  const { params } = useParametrage();
  const [active, setActive] = useState(null);
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creation, setCreation] = useState(false);
  const [gestionGardiens, setGestionGardiens] = useState(false);

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from("avec_cycles")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("created_at", { ascending: false });

    const liste = data || [];
    setActive(liste.find((c) => c.statut === "en_cours") || null);
    setHistorique(liste.filter((c) => c.statut === "cloture"));
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  if (loading) {
    return (
      <div className="av-wrap">
        <style>{CSS}</style>
        <div className="av-sk" />
      </div>
    );
  }

  if (gestionGardiens) {
    return <GestionGardiens onBack={() => setGestionGardiens(false)} />;
  }

  if (creation) {
    return (
      <CreationCycle
        onBack={() => setCreation(false)}
        onCree={() => { setCreation(false); charger(); }}
      />
    );
  }

  if (active) {
    return <FicheCycle cycle={active} onRefresh={charger} />;
  }

  return (
    <div className="av-wrap">
      <style>{CSS}</style>

      <header className="av-head">
        <div>
          <h1 className="av-titre"><Coins size={20} /> Épargne AVEC</h1>
          <p className="av-sous">Parts, prêts internes et partage de fin de cycle</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="av-btn-ghost" onClick={() => setGestionGardiens(true)}>
            <KeyRound size={15} /> Gardiens des clés
          </button>
          <button className="btn-primary" onClick={() => setCreation(true)}>
            <Plus size={16} /> Nouveau cycle
          </button>
        </div>
      </header>

      <div className="av-vide">
        <Coins size={38} color={C.textSubtle} />
        <div className="av-vide-titre">Aucun cycle en cours</div>
        <div className="av-vide-sous">Créez un nouveau cycle pour démarrer.</div>
      </div>

      {historique.length > 0 && (
        <section className="av-card">
          <h3 className="av-card-titre"><History size={16} /> Cycles précédents</h3>
          <ul className="av-histo">
            {historique.map((c) => (
              <li key={c.id}>
                <span className="av-histo-titre">{c.titre}</span>
                <span className="av-histo-meta">
                  Partagé : {montant(c.total_partage)} FCFA
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ---------------- Gestion des gardiens ---------------- */

function GestionGardiens({ onBack }) {
  const { params } = useParametrage();
  const [gardiens, setGardiens] = useState([]);
  const [membres, setMembres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ajout, setAjout] = useState(false);

  async function charger() {
    setLoading(true);
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from("avec_gardiens").select("*, membres(nom)")
        .eq("organisation_id", params.organisation_id)
        .order("created_at"),
      supabase.from("membres").select("id, nom")
        .eq("organisation_id", params.organisation_id)
        .eq("actif", true)
        .order("nom"),
    ]);
    setGardiens(g || []);
    setMembres(m || []);
    setLoading(false);
  }

  useEffect(() => { charger(); }, [params.organisation_id]);

  async function basculerActif(g) {
    await supabase.from("avec_gardiens").update({ actif: !g.actif }).eq("id", g.id);
    charger();
  }

  if (loading) return <div className="av-wrap"><style>{CSS}</style><div className="av-sk" /></div>;

  const dejaGardiens = new Set(gardiens.map((g) => g.membre_id));

  return (
    <div className="av-wrap">
      <style>{CSS}</style>

      <button className="av-retour" onClick={onBack}><ChevronLeft size={16} /> Retour</button>

      <header className="av-head">
        <div>
          <h1 className="av-titre"><KeyRound size={20} /> Gardiens des clés</h1>
          <p className="av-sous">
            Chacun détient un code personnel — tous doivent confirmer pour ouvrir ou
            clôturer une session de réunion.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAjout(true)}>
          <Plus size={16} /> Ajouter un gardien
        </button>
      </header>

      {gardiens.length === 0 ? (
        <div className="av-vide">
          <KeyRound size={38} color={C.textSubtle} />
          <div className="av-vide-titre">Aucun gardien enregistré</div>
          <div className="av-vide-sous">
            Ajoutez au moins un gardien avant de pouvoir ouvrir une session de réunion.
          </div>
        </div>
      ) : (
        <ul className="av-gardiens-liste">
          {gardiens.map((g) => (
            <li key={g.id} className="av-gardien-ligne">
              <div>
                <div className="av-gardien-nom">{g.membres?.nom || "—"}</div>
                <div className="av-gardien-statut">{g.actif ? "Actif" : "Désactivé"}</div>
              </div>
              <button className="av-btn-petit" onClick={() => basculerActif(g)}>
                {g.actif ? "Désactiver" : "Réactiver"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {ajout && (
        <ModalAjoutGardien
          membres={membres.filter((m) => !dejaGardiens.has(m.id))}
          onCancel={() => setAjout(false)}
          onCree={() => { setAjout(false); charger(); }}
        />
      )}
    </div>
  );
}

function ModalAjoutGardien({ membres, onCancel, onCree }) {
  const { params } = useParametrage();
  const [membreId, setMembreId] = useState(membres[0]?.id || "");
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function valider() {
    if (!membreId) { setErreur("Choisissez un membre."); return; }
    if (pin.length < 4) { setErreur("Le code doit comporter au moins 4 chiffres."); return; }
    if (pin !== confirmation) { setErreur("Les deux codes ne correspondent pas."); return; }

    setEnCours(true);
    setErreur("");

    const { error } = await supabase.rpc("creer_gardien_avec", {
      p_organisation_id: params.organisation_id,
      p_membre_id: membreId,
      p_pin: pin,
    });

    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    onCree();
  }

  return (
    <div className="av-overlay" onClick={onCancel}>
      <div className="av-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="av-modal-titre">Nouveau gardien</h3>

        <label className="av-label">Membre</label>
        <select
          className="av-input" value={membreId}
          onChange={(e) => setMembreId(e.target.value)}
        >
          {membres.length === 0 && <option value="">Aucun membre disponible</option>}
          {membres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>

        <label className="av-label">Code (4 à 6 chiffres)</label>
        <input
          className="av-input" type="password" inputMode="numeric" maxLength={6}
          value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />

        <label className="av-label">Confirmer le code</label>
        <input
          className="av-input" type="password" inputMode="numeric" maxLength={6}
          value={confirmation} onChange={(e) => setConfirmation(e.target.value.replace(/\D/g, ""))}
        />

        {erreur && <div className="av-erreur"><AlertCircle size={15} /> {erreur}</div>}

        <div className="av-modal-actions">
          <button className="av-btn-ghost" onClick={onCancel} disabled={enCours}>Annuler</button>
          <button className="btn-primary" onClick={valider} disabled={enCours}>
            {enCours ? "Création…" : "Créer le gardien"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Création ---------------- */

function CreationCycle({ onBack, onCree }) {
  const { params } = useParametrage();
  const [form, setForm] = useState(VIDE);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function creer() {
    if (!form.titre.trim()) { setErreur("Le titre est obligatoire."); return; }
    if (!form.date_debut) { setErreur("La date de début est obligatoire."); return; }
    if (!form.valeur_part || Number(form.valeur_part) <= 0) {
      setErreur("La valeur de la part doit être positive.");
      return;
    }
    if (!form.max_parts_par_reunion || Number(form.max_parts_par_reunion) <= 0) {
      setErreur("Le plafond de parts par réunion doit être positif.");
      return;
    }

    setEnvoi(true);
    setErreur("");

    const { error } = await supabase.rpc("creer_cycle_avec", {
      p_organisation_id: params.organisation_id,
      p_titre: form.titre.trim(),
      p_date_debut: form.date_debut,
      p_valeur_part: Number(form.valeur_part),
      p_max_parts_par_reunion: Number(form.max_parts_par_reunion),
      p_montant_fonds_social: Number(form.montant_fonds_social) || 0,
      p_montant_amende_absence: Number(form.montant_amende_absence) || 0,
    });

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }
    onCree();
  }

  return (
    <div className="av-wrap">
      <style>{CSS}</style>

      <button className="av-retour" onClick={onBack}><ChevronLeft size={16} /> Retour</button>

      <h1 className="av-titre"><Plus size={20} /> Nouveau cycle</h1>

      <section className="av-card">
        <label className="av-label">Titre</label>
        <input
          className="av-input" value={form.titre}
          onChange={(e) => setForm({ ...form, titre: e.target.value })}
          placeholder="Cycle 2026"
        />

        <label className="av-label">Date de début</label>
        <input
          className="av-input" type="date" value={form.date_debut}
          onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
        />

        <label className="av-label">Valeur de la part (FCFA)</label>
        <input
          className="av-input" type="number" min={1} value={form.valeur_part}
          onChange={(e) => setForm({ ...form, valeur_part: e.target.value })}
          placeholder="500"
        />

        <label className="av-label">Plafond de parts par réunion</label>
        <input
          className="av-input" type="number" min={1} value={form.max_parts_par_reunion}
          onChange={(e) => setForm({ ...form, max_parts_par_reunion: e.target.value })}
        />
        <p className="av-note">
          Chaque membre pourra acheter entre 1 et {form.max_parts_par_reunion || "…"} parts à
          chaque réunion, jamais un montant fixe imposé.
        </p>

        <label className="av-label">Fonds social — cotisation par réunion (FCFA)</label>
        <input
          className="av-input" type="number" min={0} value={form.montant_fonds_social}
          onChange={(e) => setForm({ ...form, montant_fonds_social: e.target.value })}
          placeholder="500 — laisser vide si aucun fonds social"
        />

        <label className="av-label">Amende pour absence injustifiée (FCFA)</label>
        <input
          className="av-input" type="number" min={0} value={form.montant_amende_absence}
          onChange={(e) => setForm({ ...form, montant_amende_absence: e.target.value })}
          placeholder="200 — laisser vide si aucune amende"
        />
        <p className="av-note">
          Due à la réunion suivante à laquelle le membre assiste, pas à celle où il est absent.
        </p>

        {erreur && <div className="av-erreur"><AlertCircle size={15} /> {erreur}</div>}

        <button className="btn-primary btn-full" onClick={creer} disabled={envoi}>
          {envoi ? <><Loader2 size={16} className="spin" /> Création…</> : "Démarrer le cycle"}
        </button>
      </section>
    </div>
  );
}

/* ---------------- Fiche du cycle actif ---------------- */

function FicheCycle({ cycle, onRefresh }) {
  const { params } = useParametrage();
  const [reunions, setReunions] = useState([]);
  const [achats, setAchats] = useState([]);
  const [presences, setPresences] = useState([]);
  const [gardiens, setGardiens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nouvelleReunion, setNouvelleReunion] = useState(false);
  const [dateReunion, setDateReunion] = useState("");
  const [reunionOuverte, setReunionOuverte] = useState(null);
  const [demandeCloture, setDemandeCloture] = useState(null); // reunion.id — verrou en mode fermeture
  const [confirmationCloture, setConfirmationCloture] = useState(false);
  const [resultatCloture, setResultatCloture] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function charger() {
    setLoading(true);
    const [{ data: r }, { data: g }] = await Promise.all([
      supabase.from("avec_reunions").select("*").eq("cycle_id", cycle.id).order("date_reunion"),
      supabase.from("avec_gardiens").select("*, membres(nom)")
        .eq("organisation_id", params.organisation_id).eq("actif", true),
    ]);
    const idsReunions = (r || []).map((x) => x.id);
    const [{ data: a }, { data: p }] = idsReunions.length
      ? await Promise.all([
          supabase.from("avec_achats_parts").select("*, membres(nom)").in("reunion_id", idsReunions),
          supabase.from("avec_presences").select("*").in("reunion_id", idsReunions),
        ])
      : [{ data: [] }, { data: [] }];
    setReunions(r || []);
    setGardiens(g || []);
    setAchats(a || []);
    setPresences(p || []);
    setLoading(false);
  }

  useEffect(() => { charger(); }, [cycle.id]);

  async function creerReunion() {
    if (!dateReunion) { setErreur("Choisissez une date."); return; }
    setEnCours(true);
    setErreur("");

    const { data, error } = await supabase.from("avec_reunions").insert({
      cycle_id: cycle.id,
      organisation_id: params.organisation_id,
      date_reunion: dateReunion,
    }).select().single();

    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setNouvelleReunion(false);
    setDateReunion("");
    await charger();
    setReunionOuverte(data.id);
  }

  async function cloturer() {
    setEnCours(true);
    setErreur("");
    const { data, error } = await supabase.rpc("cloturer_cycle_avec", { p_cycle_id: cycle.id });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setResultatCloture(data);
    setConfirmationCloture(false);
  }

  if (loading) return <div className="av-wrap"><style>{CSS}</style><div className="av-sk" /></div>;

  const capitalActuel = achats.reduce((s, a) => s + a.montant, 0);
  const partsParMembre = {};
  achats.forEach((a) => {
    const nom = a.membres?.nom || "—";
    partsParMembre[nom] = (partsParMembre[nom] || 0) + a.nombre_parts;
  });
  const societaires = Object.keys(partsParMembre).length;
  const totalPartsActuel = Object.values(partsParMembre).reduce((s, n) => s + n, 0);
  const fondsSocialCollecte = presences.reduce((s, p) => s + (p.montant_paye || 0), 0);

  if (resultatCloture) {
    return (
      <div className="av-wrap">
        <style>{CSS}</style>
        <div className="av-cloture-resultat">
          <PartyPopper size={40} color={C.success} />
          <h2>Cycle clôturé</h2>
          <p className="av-cloture-total">{montant(resultatCloture.total)} FCFA partagés</p>
          <div className="av-cloture-detail">
            <span>Capital : {montant(resultatCloture.capital)} FCFA</span>
            <span>Intérêts collectés : {montant(resultatCloture.interets)} FCFA</span>
          </div>

          <h3 className="av-card-titre" style={{ marginTop: 20 }}>Répartition par sociétaire</h3>
          <ul className="av-repartition">
            {Object.entries(partsParMembre).map(([nom, parts]) => {
              const part = totalPartsActuel > 0 ? (parts / totalPartsActuel) * resultatCloture.total : 0;
              return (
                <li key={nom}>
                  <span>{nom}</span>
                  <span>{parts} part{parts > 1 ? "s" : ""} — <strong>{montant(part)} FCFA</strong></span>
                </li>
              );
            })}
          </ul>

          <button className="btn-primary" onClick={onRefresh}>Terminer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="av-wrap">
      <style>{CSS}</style>

      <header className="av-head">
        <div>
          <h1 className="av-titre"><Coins size={20} /> {cycle.titre}</h1>
          <p className="av-sous">
            <Calendar size={13} /> Démarré le {new Date(cycle.date_debut).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <button className="av-btn-cloture" onClick={() => setConfirmationCloture(true)}>
          <PartyPopper size={15} /> Clôturer le cycle
        </button>
      </header>

      <div className="av-kpis">
        <div className="av-kpi">
          <span className="av-kpi-icone" style={{ background: PALETTE.blue100, color: C.primary }}>
            <Wallet size={18} />
          </span>
          <div>
            <div className="av-kpi-val">{montant(capitalActuel)} FCFA</div>
            <div className="av-kpi-label">Capital cumulé</div>
          </div>
        </div>
        <div className="av-kpi">
          <span className="av-kpi-icone" style={{ background: "#DCFCE7", color: C.success }}>
            <Users size={18} />
          </span>
          <div>
            <div className="av-kpi-val">{societaires}</div>
            <div className="av-kpi-label">Sociétaires actifs</div>
          </div>
        </div>
        <div className="av-kpi">
          <span className="av-kpi-icone" style={{ background: "#FEF3C7", color: C.warning }}>
            <TrendingUp size={18} />
          </span>
          <div>
            <div className="av-kpi-val">{montant(cycle.valeur_part)} FCFA</div>
            <div className="av-kpi-label">Valeur de la part</div>
          </div>
        </div>
        {cycle.montant_fonds_social > 0 && (
          <div className="av-kpi">
            <span className="av-kpi-icone" style={{ background: "#FEE2E2", color: C.danger }}>
              <HeartHandshake size={18} />
            </span>
            <div>
              <div className="av-kpi-val">{montant(fondsSocialCollecte)} FCFA</div>
              <div className="av-kpi-label">Fonds social collecté</div>
            </div>
          </div>
        )}
      </div>

      {erreur && <div className="av-erreur"><AlertCircle size={15} /> {erreur}</div>}

      <section className="av-card">
        <div className="av-card-entete">
          <h3 className="av-card-titre"><Calendar size={16} /> Réunions</h3>
          <button className="av-btn-petit" onClick={() => setNouvelleReunion(true)}>
            <Plus size={14} /> Nouvelle réunion
          </button>
        </div>

        {nouvelleReunion && (
          <div className="av-nouvelle-reunion">
            <input
              className="av-input" type="date" value={dateReunion}
              onChange={(e) => setDateReunion(e.target.value)}
            />
            <button className="btn-primary" onClick={creerReunion} disabled={enCours}>
              {enCours ? "…" : "Créer"}
            </button>
            <button className="av-btn-ghost" onClick={() => setNouvelleReunion(false)}>Annuler</button>
          </div>
        )}

        {reunions.length === 0 ? (
          <p className="av-vide-sous">Aucune réunion enregistrée pour ce cycle.</p>
        ) : (
          <ul className="av-reunions">
            {reunions.map((r) => {
              const achatsReunion = achats.filter((a) => a.reunion_id === r.id);
              const totalReunion = achatsReunion.reduce((s, a) => s + a.montant, 0);
              return (
                <li key={r.id}>
                  <button
                    className="av-reunion-ligne"
                    onClick={() => setReunionOuverte(reunionOuverte === r.id ? null : r.id)}
                  >
                    <span>{new Date(r.date_reunion).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
                    <span className="av-reunion-total">{montant(totalReunion)} FCFA</span>
                  </button>

                  {reunionOuverte === r.id && (
                    <>
                      {gardiens.length === 0 ? (
                        <div className="av-verrou-vide">
                          <KeyRound size={20} color={C.warning} />
                          Aucun gardien enregistré — une session ne peut pas s'ouvrir sans eux.
                          Retournez sur « Gardiens des clés » pour en ajouter au moins un.
                        </div>
                      ) : !r.session_ouverte ? (
                        <VerrouSession
                          reunion={r} gardiens={gardiens} action="ouverture"
                          onConfirme={charger}
                        />
                      ) : demandeCloture === r.id ? (
                        !r.verification_caisse_le ? (
                          <VerificationCaisse reunion={r} onVerifie={charger} />
                        ) : (
                          <VerrouSession
                            reunion={r} gardiens={gardiens} action="fermeture"
                            onConfirme={() => { setDemandeCloture(null); charger(); }}
                          />
                        )
                      ) : (
                        <>
                          <SectionPresence
                            reunion={r} cycle={cycle}
                            presencesReunion={presences.filter((p) => p.reunion_id === r.id)}
                            presencesCycle={presences}
                            onChange={charger}
                          />
                          <SaisieParts
                            reunion={r} cycle={cycle} achats={achatsReunion}
                            onChange={charger}
                          />
                          <SectionCredits reunion={r} cycle={cycle} params={params} />
                          <button
                            className="av-btn-cloture-session"
                            onClick={() => setDemandeCloture(r.id)}
                          >
                            <Lock size={14} /> Clôturer la session de cette réunion
                          </button>
                        </>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {confirmationCloture && (
        <div className="av-overlay" onClick={() => setConfirmationCloture(false)}>
          <div className="av-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="av-modal-titre">Clôturer ce cycle ?</h3>
            <p className="av-modal-texte">
              Le capital cumulé et les intérêts collectés sur les prêts internes remboursés
              pendant ce cycle seront répartis entre les sociétaires, au prorata de leurs
              parts. Cette action est définitive.
            </p>
            <div className="av-modal-actions">
              <button className="av-btn-ghost" onClick={() => setConfirmationCloture(false)} disabled={enCours}>
                Annuler
              </button>
              <button className="btn-primary" onClick={cloturer} disabled={enCours}>
                {enCours ? "Clôture…" : "Clôturer et partager"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Saisie des parts pour une réunion ---------------- */

// L'appel précède l'achat de parts, comme dans une vraie réunion. Le
// solde affiché par membre couvre TOUT ce qui reste dû sur le cycle
// entier — pas seulement la réunion du jour — puisqu'une amende née à
// une réunion passée (absence injustifiée) se règle à une réunion
// ultérieure, jamais à celle où le membre était absent.
// Chaque gardien confirme individuellement, jamais en groupe — la
// fonction ne bascule l'état de la session qu'une fois tous les
// gardiens actifs comptabilisés, jamais avant. Fonctionne à l'identique
// pour l'ouverture et la fermeture, seule l'action transmise change.
// Le montant attendu est calculé côté serveur, pas ici — parts et
// fonds social encaissés pendant cette réunion précise, moins les
// prêts décaissés pendant cette même réunion. Jamais deviné côté
// client : verifier_caisse_reunion() fait le calcul et l'enregistre.
function VerificationCaisse({ reunion, onVerifie }) {
  const [montantCompte, setMontantCompte] = useState("");
  const [resultat, setResultat] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function verifier() {
    if (montantCompte === "" || Number(montantCompte) < 0) {
      setErreur("Indiquez le montant compté.");
      return;
    }

    setEnCours(true);
    setErreur("");

    const { data, error } = await supabase.rpc("verifier_caisse_reunion", {
      p_reunion_id: reunion.id,
      p_montant_compte: Number(montantCompte),
    });

    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setResultat(data);
  }

  if (resultat) {
    const ok = resultat.ecart === 0;
    return (
      <div className="av-verrou">
        <div
          className="av-verrou-icone"
          style={{ background: ok ? "#DCFCE7" : "#FEE2E2", color: ok ? C.success : C.danger }}
        >
          {ok ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
        </div>
        <h3 className="av-verrou-titre">{ok ? "La caisse est juste" : "Écart constaté"}</h3>
        <p className="av-verrou-texte">
          Attendu : {montant(resultat.attendu)} FCFA · Compté : {montant(resultat.compte)} FCFA
          {!ok && ` · Écart : ${resultat.ecart > 0 ? "+" : ""}${montant(resultat.ecart)} FCFA`}
        </p>
        <button className="btn-primary" onClick={onVerifie}>Continuer vers la clôture</button>
      </div>
    );
  }

  return (
    <div className="av-verrou">
      <div className="av-verrou-icone"><Wallet size={22} /></div>
      <h3 className="av-verrou-titre">Vérification de caisse</h3>
      <p className="av-verrou-texte">
        Comptez l'argent physiquement présent et saisissez le montant — l'application le
        comparera à ce qu'elle attend pour cette réunion.
      </p>
      <div className="av-verrou-saisie">
        <input
          className="av-input" type="number" min={0} value={montantCompte}
          onChange={(e) => setMontantCompte(e.target.value)}
          placeholder="Montant compté (FCFA)"
          autoFocus
        />
        {erreur && <div className="av-erreur"><AlertCircle size={15} /> {erreur}</div>}
        <button className="btn-primary btn-full" onClick={verifier} disabled={enCours}>
          {enCours ? "Vérification…" : "Vérifier"}
        </button>
      </div>
    </div>
  );
}

function VerrouSession({ reunion, gardiens, action, onConfirme }) {
  const [confirmations, setConfirmations] = useState([]);
  const [gardienSelectionne, setGardienSelectionne] = useState(null);
  const [pin, setPin] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  async function chargerConfirmations() {
    const { data } = await supabase
      .from("avec_session_confirmations")
      .select("gardien_id")
      .eq("reunion_id", reunion.id)
      .eq("action", action);
    setConfirmations((data || []).map((c) => c.gardien_id));
    setChargement(false);
  }

  useEffect(() => { chargerConfirmations(); }, [reunion.id, action]);

  async function valider() {
    if (pin.length < 4) return;
    setEnCours(true);
    setErreur("");

    const { data, error } = await supabase.rpc("confirmer_gardien_avec", {
      p_reunion_id: reunion.id,
      p_gardien_id: gardienSelectionne.id,
      p_pin: pin,
      p_action: action,
    });

    setEnCours(false);
    setPin("");

    if (error) { setErreur(error.message); return; }
    if (!data.confirme) { setErreur(data.erreur || "Code incorrect."); return; }

    setGardienSelectionne(null);

    if (data.tous_confirmes) onConfirme();
    else chargerConfirmations();
  }

  if (chargement) return null;

  return (
    <div className="av-verrou">
      <div className="av-verrou-icone"><Lock size={24} /></div>
      <h3 className="av-verrou-titre">
        {action === "ouverture" ? "Ouverture de la session" : "Clôture de la session"}
      </h3>
      <p className="av-verrou-texte">
        Chaque gardien doit confirmer son code pour {action === "ouverture"
          ? "déverrouiller cette réunion." : "verrouiller définitivement cette réunion."}
      </p>

      <ul className="av-verrou-liste">
        {gardiens.map((g) => {
          const confirme = confirmations.includes(g.id);
          return (
            <li key={g.id} className="av-verrou-gardien">
              <span>{g.membres?.nom}</span>
              {confirme ? (
                <span className="av-verrou-ok"><CheckCircle2 size={15} color={C.success} /> Confirmé</span>
              ) : (
                <button
                  className="av-btn-petit"
                  onClick={() => { setGardienSelectionne(g); setPin(""); setErreur(""); }}
                >
                  Confirmer
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {gardienSelectionne && (
        <div className="av-verrou-saisie">
          <p className="av-verrou-saisie-titre">Code de {gardienSelectionne.membres?.nom}</p>
          <input
            className="av-input" type="password" inputMode="numeric" maxLength={6}
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          {erreur && <div className="av-erreur"><AlertCircle size={15} /> {erreur}</div>}
          <div className="av-verrou-saisie-actions">
            <button className="av-btn-ghost" onClick={() => setGardienSelectionne(null)} disabled={enCours}>
              Annuler
            </button>
            <button className="btn-primary" onClick={valider} disabled={enCours || pin.length < 4}>
              {enCours ? "…" : "Valider"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionPresence({ reunion, cycle, presencesReunion, presencesCycle, onChange }) {
  const { params } = useParametrage();
  const [membres, setMembres] = useState([]);
  const [enCours, setEnCours] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    supabase.from("membres").select("id, nom")
      .eq("organisation_id", params.organisation_id)
      .eq("actif", true)
      .order("nom")
      .then(({ data }) => setMembres(data || []));
  }, [params.organisation_id]);

  const presenceIciParMembre = {};
  presencesReunion.forEach((p) => { presenceIciParMembre[p.membre_id] = p; });

  const soldeParMembre = {};
  presencesCycle.forEach((p) => {
    const reste = (p.montant_du || 0) - (p.montant_paye || 0);
    if (reste > 0) soldeParMembre[p.membre_id] = (soldeParMembre[p.membre_id] || 0) + reste;
  });

  async function marquer(membreId, statut) {
    setEnCours(membreId);
    setErreur("");

    let montantDu = 0;
    if (statut === "present") montantDu = cycle.montant_fonds_social || 0;
    else if (statut === "absent_injustifie") montantDu = cycle.montant_amende_absence || 0;

    const existant = presenceIciParMembre[membreId];
    const { error } = existant
      ? await supabase.from("avec_presences")
          .update({ statut, montant_du: montantDu }).eq("id", existant.id)
      : await supabase.from("avec_presences").insert({
          reunion_id: reunion.id, organisation_id: params.organisation_id,
          membre_id: membreId, statut, montant_du: montantDu,
        });

    setEnCours(null);
    if (error) { setErreur(error.message); return; }
    onChange();
  }

  async function encaisserTout(membreId) {
    setEnCours(membreId + "-paye");
    setErreur("");

    const aRegler = presencesCycle.filter(
      (p) => p.membre_id === membreId && (p.montant_du || 0) > (p.montant_paye || 0)
    );

    for (const p of aRegler) {
      const { error } = await supabase.from("avec_presences")
        .update({ montant_paye: p.montant_du }).eq("id", p.id);
      if (error) { setErreur(error.message); setEnCours(null); return; }
    }

    setEnCours(null);
    onChange();
  }

  return (
    <div className="av-presence">
      <div className="av-presence-titre">Appel</div>
      {erreur && <div className="av-erreur"><AlertCircle size={15} /> {erreur}</div>}
      <ul className="av-presence-liste">
        {membres.map((m) => {
          const p = presenceIciParMembre[m.id];
          const solde = soldeParMembre[m.id] || 0;
          return (
            <li key={m.id} className="av-presence-ligne">
              <span className="av-presence-nom">{m.nom}</span>
              <div className="av-presence-boutons">
                <button
                  className={`av-presence-btn ${p?.statut === "present" ? "is-present" : ""}`}
                  onClick={() => marquer(m.id, "present")}
                  disabled={enCours === m.id}
                >
                  Présent
                </button>
                <button
                  className={`av-presence-btn ${p?.statut === "absent_excuse" ? "is-excuse" : ""}`}
                  onClick={() => marquer(m.id, "absent_excuse")}
                  disabled={enCours === m.id}
                >
                  Excusé
                </button>
                <button
                  className={`av-presence-btn ${p?.statut === "absent_injustifie" ? "is-injustifie" : ""}`}
                  onClick={() => marquer(m.id, "absent_injustifie")}
                  disabled={enCours === m.id}
                >
                  Injustifié
                </button>
              </div>
              {solde > 0 ? (
                <button
                  className="av-presence-encaisser"
                  onClick={() => encaisserTout(m.id)}
                  disabled={enCours === m.id + "-paye"}
                >
                  {enCours === m.id + "-paye" ? "…" : `Encaisser ${montant(solde)} F`}
                </button>
              ) : (
                p && (p.montant_du || 0) > 0 && (
                  <span className="av-presence-ok"><CheckCircle2 size={13} /> À jour</span>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SaisieParts({ reunion, cycle, achats, onChange }) {
  const { params } = useParametrage();
  const [membres, setMembres] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [nombreParts, setNombreParts] = useState({});
  const [enCours, setEnCours] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    supabase.from("membres").select("id, nom")
      .eq("organisation_id", params.organisation_id)
      .eq("actif", true)
      .order("nom")
      .then(({ data }) => setMembres(data || []));
  }, [params.organisation_id]);

  const dejaSaisis = new Set(achats.map((a) => a.membre_id));
  const disponibles = membres.filter(
    (m) => !dejaSaisis.has(m.id) && m.nom.toLowerCase().includes(recherche.toLowerCase())
  );

  async function enregistrer(membreId) {
    const n = Number(nombreParts[membreId]) || 1;
    if (n < 1 || n > cycle.max_parts_par_reunion) {
      setErreur(`Le nombre de parts doit être entre 1 et ${cycle.max_parts_par_reunion}.`);
      return;
    }

    setEnCours(membreId);
    setErreur("");

    const { error } = await supabase.from("avec_achats_parts").insert({
      reunion_id: reunion.id,
      organisation_id: params.organisation_id,
      membre_id: membreId,
      nombre_parts: n,
      montant: n * cycle.valeur_part,
    });

    setEnCours(null);
    if (error) { setErreur(error.message); return; }
    setRecherche("");
    onChange();
  }

  return (
    <div className="av-saisie">
      {achats.length > 0 && (
        <ul className="av-achats-liste">
          {achats.map((a) => (
            <li key={a.id}>
              <span>{a.membres?.nom}</span>
              <span>{a.nombre_parts} part{a.nombre_parts > 1 ? "s" : ""} — {montant(a.montant)} FCFA</span>
            </li>
          ))}
        </ul>
      )}

      <div className="av-recherche">
        <Search size={14} />
        <input
          value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Ajouter un sociétaire…"
        />
      </div>

      {erreur && <div className="av-erreur"><AlertCircle size={15} /> {erreur}</div>}

      {recherche && (
        <ul className="av-suggestions">
          {disponibles.length === 0 ? (
            <li className="av-suggestion-vide">Aucun sociétaire trouvé</li>
          ) : (
            disponibles.slice(0, 6).map((m) => (
              <li key={m.id} className="av-suggestion">
                <span>{m.nom}</span>
                <div className="av-suggestion-actions">
                  <input
                    type="number" min={1} max={cycle.max_parts_par_reunion}
                    value={nombreParts[m.id] || 1}
                    onChange={(e) => setNombreParts({ ...nombreParts, [m.id]: e.target.value })}
                    className="av-parts-input"
                  />
                  <button
                    className="av-btn-petit"
                    onClick={() => enregistrer(m.id)}
                    disabled={enCours === m.id}
                  >
                    {enCours === m.id ? "…" : "Ajouter"}
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// Octroi automatique — les trois règles d'éligibilité sont vérifiées
// côté serveur par demander_pret_avec(), jamais ici : ce composant se
// contente d'afficher le refus tel qu'il revient (montant maximum ou
// liquidités disponibles précisés dans le message lui-même).
function SectionCredits({ reunion, cycle, params }) {
  const [membres, setMembres] = useState([]);
  const [types, setTypes] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [membreChoisi, setMembreChoisi] = useState(null);
  const [typeChoisi, setTypeChoisi] = useState("");
  const [montantSaisi, setMontantSaisi] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [pretASigner, setPretASigner] = useState(null); // { id, membreNom, typeLibelle, montant, taux }
  const [accepteConditions, setAccepteConditions] = useState(false);
  const [signatureEnCours, setSignatureEnCours] = useState(false);

  useEffect(() => {
    supabase.from("membres").select("id, nom")
      .eq("organisation_id", params.organisation_id).eq("actif", true).order("nom")
      .then(({ data }) => setMembres(data || []));
    supabase.from("types_pret").select("*")
      .eq("organisation_id", params.organisation_id).eq("actif", true).order("ordre")
      .then(({ data }) => setTypes(data || []));
  }, [params.organisation_id]);

  const suggestions = recherche && !membreChoisi
    ? membres.filter((m) => m.nom.toLowerCase().includes(recherche.toLowerCase()))
    : [];

  async function demander() {
    if (!membreChoisi) { setErreur("Choisissez un membre."); return; }
    if (!typeChoisi) { setErreur("Choisissez un type de prêt."); return; }
    if (!montantSaisi || Number(montantSaisi) <= 0) { setErreur("Montant invalide."); return; }
    if (!dateDebut) { setErreur("La date de la première échéance est obligatoire."); return; }

    setEnCours(true);
    setErreur("");
    setSucces("");

    const { data, error } = await supabase.rpc("demander_pret_avec", {
      p_organisation_id: params.organisation_id,
      p_membre_id: membreChoisi.id,
      p_type_pret_id: typeChoisi,
      p_montant_principal: Number(montantSaisi),
      p_date_premiere_echeance: dateDebut,
      p_reunion_id: reunion.id,
    });

    setEnCours(false);
    if (error) { setErreur(error.message); return; }

    const typeChoisiObj = types.find((t) => t.id === typeChoisi);
    setPretASigner({
      id: data.pret_id,
      membreNom: membreChoisi.nom,
      typeLibelle: typeChoisiObj?.libelle || "",
      taux: typeChoisiObj?.taux_interet_pct || 0,
      echeances: typeChoisiObj?.nombre_echeances || 1,
      montant: Number(montantSaisi),
    });
    setAccepteConditions(false);
    setMembreChoisi(null);
    setRecherche("");
    setTypeChoisi("");
    setMontantSaisi("");
    setDateDebut("");
  }

  // Même principe que la signature du PV plus tôt cette nuit — une
  // confirmation explicite et tracée, pas un dessin qu'on pourrait
  // copier. Le téléphone passe au membre pour ce seul geste.
  async function signer() {
    setSignatureEnCours(true);
    const { error } = await supabase.rpc("confirmer_signature_pret", { p_pret_id: pretASigner.id });
    setSignatureEnCours(false);
    if (error) { setErreur(error.message); return; }
    setSucces(`Prêt accordé et signé par ${pretASigner.membreNom}.`);
    setPretASigner(null);
  }

  return (
    <div className="av-credits">
      <div className="av-presence-titre">Nouveaux crédits</div>

      {succes && <div className="av-credits-succes"><CheckCircle2 size={15} /> {succes}</div>}
      {erreur && <div className="av-erreur"><AlertCircle size={15} /> {erreur}</div>}

      {pretASigner ? (
        <div className="av-signature">
          <p className="av-signature-intro">
            Passez le téléphone à <strong>{pretASigner.membreNom}</strong> pour qu'il/elle
            confirme avoir accepté ces conditions.
          </p>
          <div className="av-signature-conditions">
            <div><span>Type</span><strong>{pretASigner.typeLibelle}</strong></div>
            <div><span>Montant</span><strong>{montant(pretASigner.montant)} FCFA</strong></div>
            <div><span>Taux</span><strong>{pretASigner.taux}%</strong></div>
            <div><span>Échéances</span><strong>{pretASigner.echeances}</strong></div>
          </div>
          <label className="av-signature-check">
            <input
              type="checkbox" checked={accepteConditions}
              onChange={(e) => setAccepteConditions(e.target.checked)}
            />
            J'ai lu et j'accepte ces conditions de remboursement.
          </label>
          <button
            className="btn-primary btn-full"
            onClick={signer}
            disabled={!accepteConditions || signatureEnCours}
          >
            {signatureEnCours ? "Signature…" : "Je confirme et je signe"}
          </button>
        </div>
      ) : types.length === 0 ? (
        <p className="av-vide-sous">
          Aucun type de prêt configuré — configurez-en un dans « Prêts et avances » avant de
          pouvoir octroyer un crédit interne.
        </p>
      ) : (
        <>
          {!membreChoisi ? (
            <div className="av-recherche">
              <Search size={14} />
              <input
                value={recherche} onChange={(e) => setRecherche(e.target.value)}
                placeholder="Chercher un membre…"
              />
            </div>
          ) : (
            <div className="av-credits-membre">
              <span>{membreChoisi.nom}</span>
              <button onClick={() => { setMembreChoisi(null); setRecherche(""); }}>Changer</button>
            </div>
          )}

          {suggestions.length > 0 && (
            <ul className="av-suggestions">
              {suggestions.slice(0, 6).map((m) => (
                <li
                  key={m.id} className="av-suggestion" style={{ cursor: "pointer" }}
                  onClick={() => { setMembreChoisi(m); setRecherche(""); }}
                >
                  <span>{m.nom}</span>
                </li>
              ))}
            </ul>
          )}

          {membreChoisi && (
            <>
              <label className="av-label">Type de prêt</label>
              <select className="av-input" value={typeChoisi} onChange={(e) => setTypeChoisi(e.target.value)}>
                <option value="">Choisir…</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.libelle} — {t.taux_interet_pct}% sur {t.nombre_echeances || 1} échéance(s)
                  </option>
                ))}
              </select>

              <label className="av-label">Montant demandé (FCFA)</label>
              <input
                className="av-input" type="number" min={1} value={montantSaisi}
                onChange={(e) => setMontantSaisi(e.target.value)}
              />

              <label className="av-label">Date de la première échéance</label>
              <input
                className="av-input" type="date" value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
              />

              <button className="btn-primary btn-full" onClick={demander} disabled={enCours}>
                {enCours ? "Vérification…" : "Octroyer le prêt"}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

const CSS = `
.av-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .av-wrap{ padding:${S.lg}px; } }

.av-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; flex-wrap:wrap; }
.av-titre{ display:flex; align-items:center; gap:8px; font-size:19px; margin:0; }
.av-sous{ display:flex; align-items:center; gap:5px; font-size:13px; color:${C.textSubtle}; margin:5px 0 0; }

.btn-primary{
  display:flex; align-items:center; justify-content:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
}
.btn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.btn-primary:disabled{ opacity:.6; cursor:not-allowed; }
.btn-full{ width:100%; }

.av-btn-cloture{
  display:flex; align-items:center; gap:8px;
  background:${C.success}; color:#fff; border:none;
  border-radius:${R.md}px; padding:11px 16px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600;
}
.av-btn-petit{
  display:flex; align-items:center; gap:6px;
  background:none; border:1.5px solid ${C.primary}; color:${C.primary};
  border-radius:${R.sm}px; padding:7px 12px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600;
}
.av-btn-petit:disabled{ opacity:.6; cursor:not-allowed; }
.av-btn-ghost{
  background:none; border:1.5px solid ${C.border}; color:${C.textMuted};
  border-radius:${R.md}px; padding:11px 16px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600;
}

.av-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
}
.av-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.av-vide-sous{ font-size:13.5px; color:${C.textSubtle}; }

.av-card{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:${S.lg}px; box-shadow:${SHADOW.xs}; display:flex; flex-direction:column; gap:${S.md}px;
}
.av-card-entete{ display:flex; align-items:center; justify-content:space-between; gap:${S.md}px; }
.av-card-titre{ display:flex; align-items:center; gap:8px; margin:0; font-size:15px; font-weight:600; }

.av-histo{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.av-histo li{ display:flex; justify-content:space-between; font-size:13.5px; padding:6px 0; border-bottom:1px solid ${C.border}; }
.av-histo li:last-child{ border-bottom:none; }
.av-histo-titre{ font-weight:600; }
.av-histo-meta{ color:${C.textSubtle}; }

.av-retour{
  display:inline-flex; align-items:center; gap:5px; align-self:flex-start;
  background:none; border:none; color:${C.textMuted}; font-family:inherit;
  font-size:13.5px; cursor:pointer; padding:4px 0;
}

.av-label{ font-size:12.5px; font-weight:600; color:${C.textMuted}; margin-top:6px; }
.av-input{
  width:100%; border:1px solid ${C.border}; border-radius:${R.md}px; padding:10px 12px;
  font-family:inherit; font-size:14px; box-sizing:border-box;
}
.av-note{ font-size:12px; color:${C.textSubtle}; line-height:1.5; margin:0; }

.av-erreur{
  display:flex; align-items:center; gap:8px; background:${C.dangerSoft}; color:${C.danger};
  border-radius:${R.md}px; padding:10px 14px; font-size:13.5px;
}

.av-kpis{ display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); }
.av-kpi{
  display:flex; align-items:center; gap:12px;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:14px 16px; box-shadow:${SHADOW.xs};
}
.av-kpi-icone{
  width:40px; height:40px; border-radius:${R.md}px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.av-kpi-val{ font-size:16px; font-weight:700; }
.av-kpi-label{ font-size:11.5px; color:${C.textSubtle}; margin-top:1px; }

.av-nouvelle-reunion{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.av-nouvelle-reunion .av-input{ flex:1; min-width:160px; }

.av-reunions{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.av-reunion-ligne{
  display:flex; justify-content:space-between; align-items:center; width:100%;
  background:${C.bg}; border:none; border-radius:${R.md}px; padding:11px 14px;
  cursor:pointer; font-family:inherit; font-size:13.5px; font-weight:500; color:${C.text};
}
.av-reunion-total{ font-weight:700; color:${C.primary}; }

.av-gardiens-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.av-gardien-ligne{
  display:flex; align-items:center; justify-content:space-between;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px;
  padding:14px 16px; box-shadow:${SHADOW.xs};
}
.av-gardien-nom{ font-size:14px; font-weight:600; }
.av-gardien-statut{ font-size:12px; color:${C.textSubtle}; margin-top:2px; }

.av-verrou-vide{
  display:flex; align-items:center; gap:10px; margin-top:8px;
  background:${C.warningSoft || "#FEF3C7"}; border:1px solid ${C.warning}44;
  border-radius:${R.md}px; padding:14px 16px; font-size:13.5px; color:#92400E; line-height:1.5;
}

.av-verrou{
  margin-top:8px; padding:20px; background:${C.surface};
  border:1px solid ${C.border}; border-radius:${R.lg}px;
  display:flex; flex-direction:column; align-items:center; text-align:center; gap:4px;
}
.av-verrou-icone{
  width:44px; height:44px; border-radius:50%; background:${PALETTE.blue100}; color:${C.primary};
  display:flex; align-items:center; justify-content:center; margin-bottom:6px;
}
.av-verrou-titre{ font-size:15.5px; font-weight:700; margin:0; }
.av-verrou-texte{ font-size:12.5px; color:${C.textSubtle}; margin:0 0 12px; max-width:36ch; line-height:1.5; }
.av-verrou-liste{
  list-style:none; margin:0; padding:0; width:100%; max-width:340px;
  display:flex; flex-direction:column; gap:7px;
}
.av-verrou-gardien{
  display:flex; align-items:center; justify-content:space-between;
  background:${C.bg}; border-radius:${R.md}px; padding:10px 14px; font-size:13.5px; font-weight:600;
}
.av-verrou-ok{ display:flex; align-items:center; gap:5px; color:${C.success}; font-size:12.5px; font-weight:600; }
.av-verrou-saisie{
  margin-top:14px; width:100%; max-width:260px;
  display:flex; flex-direction:column; gap:10px;
}
.av-verrou-saisie-titre{ font-size:13px; font-weight:600; margin:0; }
.av-verrou-saisie-actions{ display:flex; gap:8px; }
.av-verrou-saisie-actions button{ flex:1; }

.av-btn-cloture-session{
  display:flex; align-items:center; justify-content:center; gap:7px;
  width:100%; margin-top:8px; background:none; border:1.5px dashed ${C.border};
  color:${C.textMuted}; border-radius:${R.md}px; padding:11px 0; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:600;
}
.av-btn-cloture-session:hover{ border-color:${C.danger}; color:${C.danger}; }

.av-presence{
  margin-top:8px; padding:14px; background:${C.surface};
  border:1px solid ${C.border}; border-radius:${R.md}px;
  display:flex; flex-direction:column; gap:10px;
}
.av-presence-titre{ font-size:13px; font-weight:700; color:${C.text}; }
.av-presence-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.av-presence-ligne{
  display:flex; align-items:center; gap:10px; flex-wrap:wrap;
  padding:8px 0; border-bottom:1px solid ${C.border};
}
.av-presence-ligne:last-child{ border-bottom:none; }
.av-presence-nom{ flex:1; min-width:110px; font-size:13.5px; font-weight:600; }
.av-presence-boutons{ display:flex; gap:5px; }
.av-presence-btn{
  background:${C.bg}; border:1.5px solid ${C.border}; color:${C.textSubtle};
  border-radius:${R.sm}px; padding:6px 10px; cursor:pointer;
  font-family:inherit; font-size:11.5px; font-weight:600;
}
.av-presence-btn:disabled{ opacity:.6; cursor:not-allowed; }
.av-presence-btn.is-present{ background:#DCFCE7; border-color:${C.success}; color:${C.success}; }
.av-presence-btn.is-excuse{ background:${PALETTE.grey200}; border-color:${PALETTE.grey300}; color:${C.textMuted}; }
.av-presence-btn.is-injustifie{ background:${C.dangerSoft}; border-color:${C.danger}; color:${C.danger}; }
.av-presence-encaisser{
  background:${C.warning}; border:none; color:#fff;
  border-radius:${R.sm}px; padding:7px 12px; cursor:pointer;
  font-family:inherit; font-size:11.5px; font-weight:600; white-space:nowrap;
}
.av-presence-encaisser:disabled{ opacity:.6; cursor:not-allowed; }
.av-presence-ok{
  display:flex; align-items:center; gap:4px; font-size:11.5px;
  color:${C.success}; font-weight:600; white-space:nowrap;
}

.av-saisie{
  margin-top:8px; padding:14px; background:${C.surface};
  border:1px solid ${C.border}; border-radius:${R.md}px;
  display:flex; flex-direction:column; gap:10px;
}
.av-achats-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.av-achats-liste li{ display:flex; justify-content:space-between; font-size:13px; padding:5px 0; border-bottom:1px solid ${C.border}; }
.av-achats-liste li:last-child{ border-bottom:none; }

.av-credits{
  margin-top:8px; padding:14px; background:${C.surface};
  border:1px solid ${C.border}; border-radius:${R.md}px;
  display:flex; flex-direction:column; gap:10px;
}
.av-credits-succes{
  display:flex; align-items:center; gap:8px;
  background:#DCFCE7; color:${C.success}; border-radius:${R.md}px;
  padding:10px 14px; font-size:13px; font-weight:600;
}
.av-credits-membre{
  display:flex; align-items:center; justify-content:space-between;
  background:${C.bg}; border-radius:${R.md}px; padding:10px 14px;
  font-size:13.5px; font-weight:600;
}
.av-credits-membre button{
  background:none; border:none; color:${C.primary}; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600;
}

.av-signature{ display:flex; flex-direction:column; gap:12px; }
.av-signature-intro{ font-size:13.5px; color:${C.textMuted}; line-height:1.55; margin:0; }
.av-signature-conditions{
  background:${C.bg}; border-radius:${R.md}px; padding:14px;
  display:grid; grid-template-columns:1fr 1fr; gap:10px;
}
.av-signature-conditions div{ display:flex; flex-direction:column; gap:2px; }
.av-signature-conditions span{ font-size:11px; color:${C.textSubtle}; }
.av-signature-conditions strong{ font-size:14px; }
.av-signature-check{
  display:flex; align-items:flex-start; gap:9px; font-size:13.5px;
  color:${C.textMuted}; line-height:1.5; cursor:pointer;
}
.av-signature-check input{ margin-top:2px; accent-color:${C.primary}; flex-shrink:0; }

.av-recherche{
  display:flex; align-items:center; gap:8px; border:1px solid ${C.border}; border-radius:${R.md}px;
  padding:9px 12px; color:${C.textSubtle};
}
.av-recherche input{ border:none; outline:none; flex:1; font-family:inherit; font-size:14px; }
.av-suggestions{ list-style:none; margin:0; padding:0; border:1px solid ${C.border}; border-radius:${R.md}px; overflow:hidden; }
.av-suggestion{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 12px; font-size:13.5px; }
.av-suggestion-vide{ padding:10px 12px; color:${C.textSubtle}; font-size:13.5px; }
.av-suggestion-actions{ display:flex; align-items:center; gap:8px; }
.av-parts-input{
  width:48px; text-align:center; border:1px solid ${C.border}; border-radius:${R.sm}px;
  padding:6px 4px; font-family:inherit; font-size:13px;
}

.av-overlay{
  position:fixed; inset:0; z-index:200; background:rgba(10,20,40,.5);
  display:flex; align-items:center; justify-content:center; padding:20px;
}
.av-modal{ background:#fff; border-radius:20px; padding:24px; width:100%; max-width:420px; }
.av-modal-titre{ font-size:18px; font-weight:700; margin:0 0 10px; }
.av-modal-texte{ font-size:13.5px; color:${C.textMuted}; line-height:1.55; margin:0 0 18px; }
.av-modal-actions{ display:flex; gap:10px; }
.av-modal-actions button{ flex:1; }

.av-cloture-resultat{
  display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:${S.xxxl}px ${S.lg}px;
}
.av-cloture-resultat h2{ margin:8px 0 0; }
.av-cloture-total{ font-size:22px; font-weight:700; color:${C.success}; margin:4px 0; }
.av-cloture-detail{ display:flex; gap:20px; font-size:13px; color:${C.textSubtle}; margin-bottom:10px; }
.av-repartition{
  list-style:none; margin:0 0 20px; padding:0; width:100%; max-width:400px;
  display:flex; flex-direction:column; gap:6px; text-align:left;
}
.av-repartition li{ display:flex; justify-content:space-between; font-size:13.5px; padding:6px 0; border-bottom:1px solid ${C.border}; }
.av-repartition li:last-child{ border-bottom:none; }

.spin{ animation:spin 1s linear infinite; }
@keyframes spin{ to{ transform:rotate(360deg); } }
.av-sk{
  height:90px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:shimmer 1.4s infinite;
}
@keyframes shimmer{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
`;