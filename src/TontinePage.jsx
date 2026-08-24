import React, { useEffect, useState } from "react";
import {
  RefreshCw, Plus, X, Loader2, Calendar, Coins, Users,
  CheckCircle2, Circle, ChevronUp, ChevronDown, ChevronLeft,
  AlertCircle, PartyPopper, History, Search,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { notifierMembre } from "./notifier";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const PERIODICITES = [
  { id: "hebdomadaire", label: "Hebdomadaire" },
  { id: "mensuelle",    label: "Mensuelle" },
];

const VIDE = { titre: "", montant_part: "", periodicite: "mensuelle", date_debut: "" };

export default function TontinePage() {
  const { params } = useParametrage();
  const [active, setActive] = useState(null);
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creation, setCreation] = useState(false);

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from("tontines")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("cree_le", { ascending: false });

    const liste = data || [];
    setActive(liste.find((t) => t.statut === "en_cours") || null);
    setHistorique(liste.filter((t) => t.statut === "cloturee"));
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  if (loading) {
    return (
      <div className="tt-wrap">
        <style>{CSS}</style>
        <div className="tt-sk" />
      </div>
    );
  }

  if (creation) {
    return (
      <CreationTontine
        onBack={() => setCreation(false)}
        onCree={() => { setCreation(false); charger(); }}
      />
    );
  }

  if (active) {
    return <FicheTontine tontine={active} onBack={null} onRefresh={charger} />;
  }

  return (
    <div className="tt-wrap">
      <style>{CSS}</style>

      <header className="tt-head">
        <div>
          <h1 className="tt-titre"><RefreshCw size={20} /> Tontine</h1>
          <p className="tt-sous">Épargne rotative entre membres</p>
        </div>
        <button className="btn-primary" onClick={() => setCreation(true)}>
          <Plus size={16} /> Nouvelle tontine
        </button>
      </header>

      <div className="tt-vide">
        <RefreshCw size={38} color={C.textSubtle} />
        <div className="tt-vide-titre">Aucune tontine en cours</div>
        <div className="tt-vide-sous">Créez un nouveau cycle pour démarrer.</div>
      </div>

      {historique.length > 0 && (
        <section className="tt-card">
          <h3 className="tt-card-titre"><History size={16} /> Cycles précédents</h3>
          <ul className="tt-histo">
            {historique.map((t) => (
              <li key={t.id}>
                <span className="tt-histo-titre">{t.titre}</span>
                <span className="tt-histo-meta">
                  {t.montant_part.toLocaleString("fr-FR")} FCFA · {PERIODICITES.find((p) => p.id === t.periodicite)?.label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ---------------- Création ---------------- */

function CreationTontine({ onBack, onCree }) {
  const { params } = useParametrage();
  const [form, setForm] = useState(VIDE);
  const [membres, setMembres] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState([]); // [{id, nom}]
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    supabase.from("membres")
      .select("id, nom")
      .eq("organisation_id", params.organisation_id)
      .eq("actif", true)
      .order("nom")
      .then(({ data }) => setMembres(data || []));
  }, [params.organisation_id]);

  const disponibles = membres.filter(
    (m) => !selection.some((s) => s.id === m.id)
      && m.nom.toLowerCase().includes(recherche.toLowerCase())
  );

  function ajouter(m) {
    setSelection((s) => [...s, m]);
    setRecherche("");
  }
  function retirer(id) {
    setSelection((s) => s.filter((m) => m.id !== id));
  }
  function deplacer(index, sens) {
    const cible = index + sens;
    if (cible < 0 || cible >= selection.length) return;
    const copie = [...selection];
    [copie[index], copie[cible]] = [copie[cible], copie[index]];
    setSelection(copie);
  }

  async function creer() {
    if (!form.titre.trim()) { setErreur("Le titre est obligatoire."); return; }
    if (!form.montant_part || Number(form.montant_part) <= 0) { setErreur("Le montant de la part doit être positif."); return; }
    if (!form.date_debut) { setErreur("La date de début est obligatoire."); return; }
    if (selection.length < 2) { setErreur("Il faut au moins deux participants."); return; }

    setEnvoi(true);
    setErreur("");

    const { error } = await supabase.rpc("creer_tontine", {
      p_organisation_id: params.organisation_id,
      p_titre: form.titre.trim(),
      p_montant_part: Number(form.montant_part),
      p_periodicite: form.periodicite,
      p_date_debut: form.date_debut,
      p_membre_ids: selection.map((m) => m.id),
    });

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }

    // Chaque participant est informé de sa position dans le cycle.
    // Un échec d'envoi individuel ne bloque jamais les suivants.
    selection.forEach((m, i) => {
      notifierMembre(m.id, {
        type: "tontine",
        titre: `Tontine — ${form.titre.trim()}`,
        message: `Vous participez à la tontine "${form.titre.trim()}" (${Number(form.montant_part).toLocaleString("fr-FR")} FCFA par tour). Votre position : ${i + 1}${i === 0 ? "re" : "e"}.`,
        organisationId: params.organisation_id,
      });
    });

    onCree();
  }

  return (
    <div className="tt-wrap">
      <style>{CSS}</style>

      <button className="tt-retour" onClick={onBack}><ChevronLeft size={16} /> Retour</button>

      <h1 className="tt-titre"><Plus size={20} /> Nouvelle tontine</h1>

      <section className="tt-card">
        <label className="tt-label">Titre</label>
        <input className="tt-input" value={form.titre}
          onChange={(e) => setForm({ ...form, titre: e.target.value })}
          placeholder="Tontine du Bureau — 2026" />

        <label className="tt-label">Montant de la part (FCFA)</label>
        <input className="tt-input" type="number" min={1} value={form.montant_part}
          onChange={(e) => setForm({ ...form, montant_part: e.target.value })}
          placeholder="5000" />

        <label className="tt-label">Périodicité</label>
        <div className="tt-choix">
          {PERIODICITES.map((p) => (
            <button
              key={p.id}
              className={`tt-choix-btn ${form.periodicite === p.id ? "tt-choix-actif" : ""}`}
              onClick={() => setForm({ ...form, periodicite: p.id })}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="tt-label">Date du premier tour</label>
        <input className="tt-input" type="date" value={form.date_debut}
          onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
      </section>

      <section className="tt-card">
        <h3 className="tt-card-titre"><Users size={16} /> Participants, dans l'ordre de passage</h3>

        {selection.length > 0 && (
          <ul className="tt-selection">
            {selection.map((m, i) => (
              <li key={m.id} className="tt-selection-item">
                <span className="tt-rang">{i + 1}</span>
                <span className="tt-selection-nom">{m.nom}</span>
                <div className="tt-selection-actions">
                  <button onClick={() => deplacer(i, -1)} disabled={i === 0}><ChevronUp size={15} /></button>
                  <button onClick={() => deplacer(i, 1)} disabled={i === selection.length - 1}><ChevronDown size={15} /></button>
                  <button onClick={() => retirer(m.id)} className="tt-retirer"><X size={15} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="tt-recherche">
          <Search size={15} />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Ajouter un membre…"
          />
        </div>
        {recherche && (
          <ul className="tt-suggestions">
            {disponibles.slice(0, 6).map((m) => (
              <li key={m.id} onClick={() => ajouter(m)}>{m.nom}</li>
            ))}
            {disponibles.length === 0 && <li className="tt-suggestion-vide">Aucun résultat</li>}
          </ul>
        )}
      </section>

      {erreur && <div className="tt-erreur"><AlertCircle size={15} /> {erreur}</div>}

      <button className="btn-primary btn-full" onClick={creer} disabled={envoi}>
        {envoi ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Créer la tontine
      </button>
    </div>
  );
}

/* ---------------- Fiche de la tontine active ---------------- */

function FicheTontine({ tontine, onRefresh }) {
  const { params } = useParametrage();
  const [participants, setParticipants] = useState([]);
  const [tours, setTours] = useState([]);
  const [versements, setVersements] = useState({});
  const [loading, setLoading] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function charger() {
    setLoading(true);
    const [pRes, tRes] = await Promise.all([
      supabase.from("tontine_participants")
        .select("*, membres(nom)")
        .eq("tontine_id", tontine.id)
        .order("rang"),
      supabase.from("tontine_tours")
        .select("*, membres:beneficiaire_membre_id(nom)")
        .eq("tontine_id", tontine.id)
        .order("numero_tour"),
    ]);
    setParticipants(pRes.data || []);
    setTours(tRes.data || []);

    const tourEnCours = (tRes.data || []).find((t) => t.statut === "en_cours");
    if (tourEnCours) {
      const { data: vData } = await supabase
        .from("tontine_versements")
        .select("*")
        .eq("tour_id", tourEnCours.id);
      const map = {};
      (vData || []).forEach((v) => { map[v.membre_id] = v; });
      setVersements(map);
    } else {
      setVersements({});
    }

    setLoading(false);
  }

  useEffect(() => { charger(); }, [tontine.id]);

  const tourActuel = tours.find((t) => t.statut === "en_cours");
  const totalCollecte = Object.keys(versements).length * tontine.montant_part;
  const totalAttendu = participants.length * tontine.montant_part;
  const tousPayes = participants.length > 0 && Object.keys(versements).length === participants.length;

  async function basculerVersement(membreId, dejaVerse) {
    if (!tourActuel) return;
    setEnCours(true);
    setErreur("");

    if (dejaVerse) {
      await supabase.from("tontine_versements")
        .delete()
        .eq("tour_id", tourActuel.id)
        .eq("membre_id", membreId);
    } else {
      const { error } = await supabase.rpc("enregistrer_versement_tontine", {
        p_tour_id: tourActuel.id,
        p_membre_id: membreId,
        p_montant: tontine.montant_part,
        p_mode: "cash",
      });
      if (error) { setEnCours(false); setErreur(error.message); return; }
    }

    setEnCours(false);
    charger();
  }

  async function cloturerTour() {
    if (!tourActuel) return;
    setEnCours(true);
    setErreur("");
    const { error } = await supabase.rpc("cloturer_tour_tontine", { p_tour_id: tourActuel.id });

    if (error) { setEnCours(false); setErreur(error.message); return; }

    // Notifie le bénéficiaire du tour qui vient de s'ouvrir, s'il y en a un
    // (rien à notifier si c'était le dernier tour — la tontine est close).
    const { data: nouveauTour } = await supabase
      .from("tontine_tours")
      .select("beneficiaire_membre_id, numero_tour")
      .eq("tontine_id", tontine.id)
      .eq("statut", "en_cours")
      .maybeSingle();

    if (nouveauTour) {
      notifierMembre(nouveauTour.beneficiaire_membre_id, {
        type: "tontine",
        titre: `Tontine — ${tontine.titre}`,
        message: `C'est votre tour ! Le tour ${nouveauTour.numero_tour} de la tontine "${tontine.titre}" commence.`,
        organisationId: params.organisation_id,
      });
    }

    setEnCours(false);
    onRefresh();
  }

  if (loading) {
    return (
      <div className="tt-wrap">
        <style>{CSS}</style>
        <div className="tt-sk" />
      </div>
    );
  }

  return (
    <div className="tt-wrap">
      <style>{CSS}</style>

      <header>
        <h1 className="tt-titre">{tontine.titre}</h1>
        <p className="tt-sous">
          <Coins size={13} /> {tontine.montant_part.toLocaleString("fr-FR")} FCFA · {PERIODICITES.find((p) => p.id === tontine.periodicite)?.label}
          {" · "}{participants.length} participant{participants.length > 1 ? "s" : ""}
        </p>
      </header>

      {tourActuel && (
        <section className="tt-card">
          <div className="tt-tour-head">
            <h3 className="tt-card-titre">
              <PartyPopper size={16} /> Tour {tourActuel.numero_tour} sur {tours.length}
            </h3>
            <span className="tt-tour-date">
              <Calendar size={13} /> {new Date(tourActuel.date_prevue).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
            </span>
          </div>

          <div className="tt-beneficiaire">
            Bénéficiaire de ce tour : <strong>{tourActuel.membres?.nom}</strong>
          </div>

          <div className="tt-progression">
            {totalCollecte.toLocaleString("fr-FR")} / {totalAttendu.toLocaleString("fr-FR")} FCFA collectés
          </div>

          <ul className="tt-participants">
            {participants.map((p) => {
              const verse = !!versements[p.membre_id];
              return (
                <li key={p.id} className="tt-participant-item">
                  <span className="tt-rang-petit">{p.rang}</span>
                  <span className="tt-participant-nom">{p.membres?.nom}</span>
                  <button
                    className={`tt-toggle ${verse ? "tt-toggle-on" : ""}`}
                    onClick={() => basculerVersement(p.membre_id, verse)}
                    disabled={enCours}
                  >
                    {verse ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                    {verse ? "Versé" : "En attente"}
                  </button>
                </li>
              );
            })}
          </ul>

          {erreur && <div className="tt-erreur"><AlertCircle size={15} /> {erreur}</div>}

          <button className="btn-primary btn-full" onClick={cloturerTour} disabled={enCours}>
            <PartyPopper size={16} /> Remettre la cagnotte et passer au tour suivant
          </button>
          {!tousPayes && (
            <div className="tt-avertissement">
              Tous les participants n'ont pas encore versé leur part — vous pouvez tout de même clôturer si le Bureau en décide ainsi.
            </div>
          )}
        </section>
      )}

      <section className="tt-card">
        <h3 className="tt-card-titre"><Users size={16} /> Ordre de passage</h3>
        <ul className="tt-timeline">
          {tours.map((t) => (
            <li key={t.id} className={`tt-timeline-item tt-timeline-${t.statut}`}>
              <span className="tt-rang-petit">{t.numero_tour}</span>
              <span className="tt-timeline-nom">{t.membres?.nom}</span>
              <span className="tt-timeline-statut">
                {t.statut === "cloture" ? "Perçu" : t.statut === "en_cours" ? "En cours" : "À venir"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const CSS = `
.tt-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .tt-wrap{ padding:${S.lg}px; } }

.tt-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; flex-wrap:wrap; }
.tt-titre{ display:flex; align-items:center; gap:8px; font-size:19px; margin:0; }
.tt-sous{ display:flex; align-items:center; gap:5px; font-size:13px; color:${C.textSubtle}; margin:5px 0 0; }

.btn-primary{
  display:flex; align-items:center; justify-content:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600;
  box-shadow:${SHADOW.sm};
}
.btn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.btn-primary:disabled{ opacity:.6; cursor:not-allowed; }
.btn-full{ width:100%; }

.tt-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
}
.tt-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.tt-vide-sous{ font-size:13.5px; color:${C.textSubtle}; }

.tt-card{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:${S.lg}px; box-shadow:${SHADOW.xs}; display:flex; flex-direction:column; gap:${S.md}px;
}
.tt-card-titre{ display:flex; align-items:center; gap:8px; margin:0; font-size:15px; font-weight:600; }

.tt-histo{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.tt-histo li{ display:flex; justify-content:space-between; font-size:13.5px; padding:6px 0; border-bottom:1px solid ${C.border}; }
.tt-histo li:last-child{ border-bottom:none; }
.tt-histo-titre{ font-weight:600; }
.tt-histo-meta{ color:${C.textSubtle}; }

.tt-retour{
  display:inline-flex; align-items:center; gap:5px; align-self:flex-start;
  background:none; border:none; color:${C.textMuted}; font-family:inherit;
  font-size:13.5px; cursor:pointer; padding:4px 0;
}

.tt-label{ font-size:12.5px; font-weight:600; color:${C.textMuted}; margin-top:6px; }
.tt-input{
  width:100%; border:1px solid ${C.border}; border-radius:${R.md}px; padding:10px 12px;
  font-family:inherit; font-size:14px; box-sizing:border-box;
}
.tt-choix{ display:flex; gap:8px; }
.tt-choix-btn{
  flex:1; border:1px solid ${C.border}; background:${C.surface}; color:${C.textMuted};
  border-radius:${R.md}px; padding:10px; cursor:pointer; font-family:inherit; font-size:13.5px; font-weight:600;
}
.tt-choix-actif{ background:${PALETTE.blue100}; border-color:${C.primary}; color:${C.primary}; }

.tt-selection{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.tt-selection-item{
  display:flex; align-items:center; gap:10px; padding:8px 10px;
  background:${C.bg}; border-radius:${R.md}px;
}
.tt-rang{
  width:24px; height:24px; border-radius:50%; background:${C.primary}; color:#fff;
  display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0;
}
.tt-selection-nom{ flex:1; font-size:14px; font-weight:500; }
.tt-selection-actions{ display:flex; gap:2px; }
.tt-selection-actions button{
  background:none; border:none; color:${C.textSubtle}; cursor:pointer; padding:4px;
  display:flex; align-items:center;
}
.tt-selection-actions button:disabled{ opacity:.3; cursor:not-allowed; }
.tt-retirer{ color:${C.danger} !important; }

.tt-recherche{
  display:flex; align-items:center; gap:8px; border:1px solid ${C.border}; border-radius:${R.md}px;
  padding:9px 12px; color:${C.textSubtle};
}
.tt-recherche input{ border:none; outline:none; flex:1; font-family:inherit; font-size:14px; }
.tt-suggestions{ list-style:none; margin:0; padding:0; border:1px solid ${C.border}; border-radius:${R.md}px; overflow:hidden; }
.tt-suggestions li{ padding:10px 12px; font-size:14px; cursor:pointer; }
.tt-suggestions li:hover{ background:${PALETTE.blue100}; }
.tt-suggestion-vide{ color:${C.textSubtle}; cursor:default !important; }
.tt-suggestions li:hover.tt-suggestion-vide{ background:none; }

.tt-erreur{
  display:flex; align-items:center; gap:8px; background:${C.dangerSoft}; color:${C.danger};
  border-radius:${R.md}px; padding:10px 14px; font-size:13.5px;
}

.tt-tour-head{ display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
.tt-tour-date{ display:flex; align-items:center; gap:5px; font-size:12.5px; color:${C.textSubtle}; }
.tt-beneficiaire{ font-size:14.5px; }
.tt-progression{ font-size:13px; color:${C.textMuted}; font-weight:600; }

.tt-participants{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.tt-participant-item{
  display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid ${C.border};
}
.tt-participant-item:last-child{ border-bottom:none; }
.tt-rang-petit{
  width:20px; height:20px; border-radius:50%; background:${C.bg}; color:${C.textMuted};
  display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0;
}
.tt-participant-nom{ flex:1; font-size:14px; font-weight:500; }
.tt-toggle{
  display:flex; align-items:center; gap:6px; font-family:inherit; font-size:12.5px; font-weight:600;
  border:1px solid ${C.border}; background:${C.surface}; color:${C.textSubtle};
  border-radius:${R.pill}px; padding:6px 12px; cursor:pointer;
}
.tt-toggle-on{ background:#DCFCE7; border-color:${C.success}; color:${C.success}; }

.tt-avertissement{ font-size:12.5px; color:${C.warning}; text-align:center; }

.tt-timeline{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
.tt-timeline-item{ display:flex; align-items:center; gap:10px; padding:7px 0; }
.tt-timeline-nom{ flex:1; font-size:13.5px; }
.tt-timeline-statut{ font-size:12px; font-weight:600; color:${C.textSubtle}; }
.tt-timeline-cloture .tt-timeline-statut{ color:${C.success}; }
.tt-timeline-en_cours .tt-timeline-statut{ color:${C.primary}; }

.spin{ animation:spin 1s linear infinite; }
@keyframes spin{ to{ transform:rotate(360deg); } }
.tt-sk{
  height:90px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:shimmer 1.4s infinite;
}
@keyframes shimmer{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
`;