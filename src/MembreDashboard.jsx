import React, { useEffect, useState, } from "react";
import { supabase } from "./supabaseClient";
import { sauverCache, lireCache } from "./offlineCache";
import {
  Bell, LogOut, CreditCard, HandHeart, Gift, UserCircle2,
  CheckCircle2, Clock, AlertTriangle, CalendarDays, Wallet,
  Megaphone, Ticket, X, ChevronRight, Users, UserPlus, Users2, RefreshCw, Banknote,
  GraduationCap, Briefcase, Handshake, FileBadge, History, ChevronsUpDown, Check, Loader2, Coins, WifiOff,
} from "lucide-react";
import { C, R, S, SHADOW, PALETTE } from "./theme";
import CarteMembreModal from "./CarteMembreModal";
import {
  useParametrage, moduleActif, construireMatricule, LOGO_DEFAUT,
  mesOrganisationsMembre, changerOrganisationActive,
} from "./useParametrage";
import { useVocabulaire } from "./useVocabulaire";
import { pushDisponible, pushAutorise, pushRefuse, activerNotifications } from "./push";

const STATUT = {
  nouveau:  { label: "Nouveau",    color: C.primaryLight, soft: PALETTE.blue100, Icon: UserPlus },
  a_jour:   { label: "À jour",     color: C.success, soft: "#DCFCE7", Icon: CheckCircle2 },
  partiel:  { label: "Partiel",    color: C.warning, soft: "#FEF3C7", Icon: Clock },
  retard:   { label: "En retard",  color: C.danger,  soft: "#FEE2E2", Icon: AlertTriangle },
  suspendu: { label: "Suspendu",   color: C.danger,  soft: "#FEE2E2", Icon: AlertTriangle },
};

// Comme pour le menu d'administration, une entrée rattachée à un module
// disparaît lorsque celui-ci est désactivé. Les libellés dépendent du
// type d'organisation : une coopérative parle de parts sociales, une ONG
// de contributions — d'où une fonction plutôt qu'une liste figée.
function raccourcisPourType(mot) {
  return [
    { id: "cotisations",   icon: CreditCard,  l1: "Mes",      l2: mot("cotisations").toLowerCase(), color: C.primary },
    { id: "documents_membre", icon: FileBadge, l1: "Mes",      l2: "documents", color: C.success },
    { id: "calendrier_membre", icon: CalendarDays, l1: "Mon",   l2: "calendrier", color: C.primaryLight },
    { id: "historique_membre", icon: History, l1: "Mon",   l2: "historique", color: C.warning },
    { id: "aides",         icon: HandHeart,   l1: "Demander", l2: `${mot("aide").toLowerCase()}`,   color: C.success },
    { id: "tombola",       icon: Gift,        l1: "Tombola",  l2: "& récompenses", color: C.warning,
      module: "module_tombola" },
    { id: "assemblees",    icon: Users2,      l1: "Assemblées", l2: "générales",   color: C.primaryLight,
      module: "module_assemblees" },
    { id: "tontine",       icon: RefreshCw,   l1: "Tontine",  l2: "en cours",      color: C.primary,
      module: "module_tontine" },
    { id: "epargne_avec",  icon: Coins,       l1: "Épargne",  l2: "AVEC",          color: C.primary,
      module: "module_avec" },
    { id: "prets",         icon: Banknote,    l1: "Prêts",    l2: "& avances",     color: C.success,
      module: "module_prets" },
    { id: "formations",    icon: GraduationCap, l1: "Formations", l2: "à venir",   color: C.primaryLight,
      module: "module_formations" },
    { id: "services",      icon: Briefcase,   l1: "Services",  l2: "offerts",     color: C.warning,
      module: "module_services" },
    { id: "partenariats",  icon: Handshake,   l1: "Partenaires", l2: "de l'organisation", color: C.success,
      module: "module_partenariats" },
    { id: "beneficiaires", icon: Users,       l1: "Mes",      l2: "bénéficiaires", color: C.primaryLight },
  ];
}

export default function MembreDashboard({ membre, onPage, onSignOut }) {
  const { params } = useParametrage();
  const { mot } = useVocabulaire();
  const [mesOrgs, setMesOrgs] = useState([]);
  const [selecteurOuvert, setSelecteurOuvert] = useState(false);
  const [changement, setChangement] = useState(null);
  const [annuel, setAnnuel] = useState({ du: 0, paye: 0 });
  const [echeance, setEcheance] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [tickets, setTickets] = useState({ bonus: 0, payants: 0 });
  const [loading, setLoading] = useState(true);
  const [depuisCache, setDepuisCache] = useState(false);
  const [horodatageCache, setHorodatageCache] = useState(null);
  const [showCarte, setShowCarte] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [pushEtat, setPushEtat] = useState(
    () => (pushAutorise() ? "actif" : pushRefuse() ? "refuse" : "propose")
  );

  const CLE_LECTURE = `mephda_notifs_lu_${membre.id}`;
  const [derniereLecture, setDerniereLecture] = useState(
    () => Number(localStorage.getItem(CLE_LECTURE) || 0)
  );

  const tombolaActive = moduleActif(params, "module_tombola");
  const annee = new Date().getFullYear();

  useEffect(() => {
    mesOrganisationsMembre().then(setMesOrgs);
  }, []);

  async function choisirOrganisation(id) {
    if (id === params.organisation_id) { setSelecteurOuvert(false); return; }
    setChangement(id);
    await changerOrganisationActive(id);
    setChangement(null);
    setSelecteurOuvert(false);
  }

  useEffect(() => {
    async function charger() {
      const idCache = `dashboard_${membre.id}`;
      try {
      const trimestre = `${annee}-T${Math.ceil((new Date().getMonth() + 1) / 3)}`;

      const [cotRes, tickRes, aideRes, commRes, notifRes, baremeRes] = await Promise.all([
        supabase.from("cotisations").select("*")
          .eq("membre_id", membre.id)
          .gte("periode", `${annee}-01`).lte("periode", `${annee}-12`)
          .order("date_limite", { ascending: true }),
        tombolaActive
          ? supabase.from("tombola_tickets").select("*")
              .eq("membre_id", membre.id).eq("trimestre", trimestre)
          : Promise.resolve({ data: [] }),
        supabase.from("aides_sociales").select("*")
          .eq("membre_id", membre.id)
          .order("created_at", { ascending: false }).limit(3),
        supabase.from("communications_mutuelle").select("*")
          .or(`cible.eq.tous,cible.eq.${membre.statut_cotisation === "a_jour" ? "a_jour" : "retard"}`)
          .order("created_at", { ascending: false }).limit(3),
        supabase.from("notifications").select("*")
          .eq("membre_id", membre.id)
          .order("created_at", { ascending: false }).limit(5),
        supabase.from("bareme_prestations").select("type_aide, libelle"),
      ]);

      const cotisations = cotRes.data || [];
      const tks = tickRes.data || [];

      // Libellés officiels des prestations, tels que définis dans le barème
      const libellesAide = {};
      (baremeRes.data || []).forEach((b) => { libellesAide[b.type_aide] = b.libelle; });

      // Cumul annuel — projeté sur 12 mois à partir du taux de la
      // cotisation la plus récente, pas la simple somme des lignes déjà
      // générées. Les cotisations sont créées mois par mois par une
      // tâche automatique, pas les douze d'un coup en début d'année :
      // sommer les seules lignes existantes donnerait un total partiel
      // (souvent un seul mois) sous un libellé "Année 2026" qui laisse
      // pourtant entendre un total sur l'année entière.
      const tauxMensuel = cotisations.length > 0
        ? cotisations[cotisations.length - 1].montant_du
        : 0;
      setAnnuel({
        du: tauxMensuel * 12,
        paye: cotisations.reduce((s, c) => s + c.montant_paye, 0),
      });

      // Prochaine échéance non soldée
      setEcheance(
        cotisations.find((c) => c.statut !== "paye" && c.statut !== "exempte") || null
      );

      setTickets({
        bonus: tks.filter((t) => t.type_ticket === "bonus").length,
        payants: tks.filter((t) => t.type_ticket === "payant").length,
      });

      // Paiements du membre pour le flux de notifications
      const ids = cotisations.map((c) => c.id);
      let paiements = [];
      if (ids.length) {
        const { data } = await supabase.from("paiements").select("*")
          .in("cotisation_id", ids)
          .order("created_at", { ascending: false }).limit(4);
        paiements = data || [];
      }

      // Flux agrégé
      const flux = [
        ...paiements.map((p) => ({
          id: "p" + p.id,
          type: "paiement",
          titre: mot("cotisation") + " reçue",
          texte: `Votre paiement de ${montant(p.montant)} FCFA a été enregistré avec succès.`,
          date: p.created_at,
        })),
        ...tks.map((t) => ({
          id: "t" + t.id,
          type: "tombola",
          titre: t.type_ticket === "bonus" ? "Ticket bonus attribué" : "Ticket acheté",
          texte: t.type_ticket === "bonus"
            ? `Un ticket bonus vous a été attribué pour le trimestre ${t.trimestre}.`
            : `Votre ticket pour le trimestre ${t.trimestre} est enregistré.`,
          date: t.created_at,
        })),
        ...(aideRes.data || []).map((a) => ({
          id: "a" + a.id,
          type: "aide",
          titre: mot("demande_aide") + " " + libelleStatutAide(a.statut),
          texte: `${libellesAide[a.type_aide] || a.type_aide}${a.montant_valide ? ` — ${montant(a.montant_valide)} FCFA` : ""}`,
          date: a.decide_le || a.created_at,
        })),
        ...(commRes.data || []).map((c) => ({
          id: "c" + c.id,
          type: "communication",
          titre: c.titre,
          texte: c.message,
          date: c.created_at,
        })),
        ...(notifRes.data || []).map((n) => ({
          id: "n" + n.id,
          type: n.type === "tombola" ? "tombola" : "communication",
          titre: n.titre,
          texte: n.message,
          date: n.created_at,
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

      // Copie locale de tout ce qui vient d'être calculé — pas les
      // requêtes brutes, le résultat final déjà mis en forme, pour
      // pouvoir le réafficher tel quel si la prochaine ouverture
      // échoue faute de réseau.
      sauverCache(idCache, {
        annuel: { du: tauxMensuel * 12, paye: cotisations.reduce((s, c) => s + c.montant_paye, 0) },
        echeance: cotisations.find((c) => c.statut !== "paye" && c.statut !== "exempte") || null,
        tickets: {
          bonus: tks.filter((t) => t.type_ticket === "bonus").length,
          payants: tks.filter((t) => t.type_ticket === "payant").length,
        },
        notifs: flux,
      });

      setNotifs(flux);
      setDepuisCache(false);
      setLoading(false);
      } catch (e) {
        // Un throw ici signale une vraie coupure réseau (pas une
        // erreur applicative, qui aurait été renvoyée dans data/error
        // sans jamais atteindre ce catch) — on se rabat sur la
        // dernière copie locale connue, sans jamais en inventer une.
        const secours = lireCache(idCache);
        if (secours) {
          setAnnuel(secours.donnees.annuel);
          setEcheance(secours.donnees.echeance);
          setTickets(secours.donnees.tickets);
          setNotifs(secours.donnees.notifs);
          setDepuisCache(true);
          setHorodatageCache(secours.horodatage);
        }
        setLoading(false);
      }
    }
    charger();
  // « mot » figure dans les dépendances : le type d'organisation se résout
  // parfois après le premier rendu, et le flux d'activité doit alors être
  // reconstruit avec le bon vocabulaire plutôt que de rester figé sur
  // celui de la mutuelle.
  }, [membre.id, membre.statut_cotisation, annee, tombolaActive, mot]);

  const st = STATUT[membre.statut_cotisation] || STATUT.a_jour;
  const progression = annuel.du ? Math.min((annuel.paye / annuel.du) * 100, 100) : 0;
  const reste = Math.max(annuel.du - annuel.paye, 0);
  const initiales = membre.nom.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase();
  const matricule = construireMatricule(params, membre);
  const logo = params.logo_url || LOGO_DEFAUT;
  const qrActif = moduleActif(params, "module_qr_carte");

  const raccourcis = raccourcisPourType(mot).filter(
    (r) => !r.module || moduleActif(params, r.module)
  );

  const joursRestants = echeance
    ? Math.ceil((new Date(echeance.date_limite) - new Date()) / 86400000)
    : null;

  const recents = notifs.filter(
    (n) => new Date(n.date).getTime() > derniereLecture
  ).length;

  async function ouvrirNotifications() {
    setShowNotifs(true);
    const maintenant = Date.now();
    localStorage.setItem(CLE_LECTURE, String(maintenant));
    setDerniereLecture(maintenant);

    await supabase
      .from("notifications")
      .update({ lu: true })
      .eq("membre_id", membre.id)
      .eq("lu", false);
  }

  async function demanderPush() {
    setPushEtat("attente");
    const r = await activerNotifications(membre.id);
    setPushEtat(r.ok ? "actif" : r.motif === "refuse" ? "refuse" : "propose");
  }

  return (
    <div className="md-shell">
      <style>{CSS}</style>

      {/* ============ En-tête bleu ============ */}
      <header className="md-head">
        {/* Une personne membre de plusieurs organisations doit pouvoir
            choisir laquelle elle regarde — invisible pour les autres,
            même principe que le sélecteur admin dans AdminLayout.jsx. */}
        {mesOrgs.length > 1 && (
          <div className="md-selecteur-zone">
            <button
              className="md-selecteur"
              onClick={() => setSelecteurOuvert((v) => !v)}
            >
              <span>{mot("changer_organisation")}</span>
              <ChevronsUpDown size={13} />
            </button>

            {selecteurOuvert && (
              <ul className="md-orgs">
                {mesOrgs.map((o) => {
                  const active = o.organisation_id === params.organisation_id;
                  const enCours = changement === o.organisation_id;
                  return (
                    <li key={o.organisation_id}>
                      <button
                        className={`md-org ${active ? "is-active" : ""}`}
                        onClick={() => choisirOrganisation(o.organisation_id)}
                        disabled={enCours}
                      >
                        <span className="md-org-nom">{o.sigle || o.nom}</span>
                        {enCours
                          ? <Loader2 size={13} className="md-org-spin" />
                          : active && <Check size={13} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <div className="md-head-bar">
          <img
            src={logo}
            alt={params.nom_mutuelle}
            className="md-logo"
            onError={(e) => { e.currentTarget.src = LOGO_DEFAUT; }}
          />
          <div className="md-head-actions">
            <button
              className="md-bell"
              onClick={ouvrirNotifications}
              aria-label="Notifications"
            >
              <Bell size={20} />
              {recents > 0 && <span className="md-badge">{recents}</span>}
            </button>
            <button className="md-logout" onClick={onSignOut} aria-label="Déconnexion">
              <LogOut size={19} />
            </button>
          </div>
        </div>

        <div className="md-greeting">
          <div className="md-greet-text">
            <div className="md-hello">Bonjour,</div>
            <div className="md-name">{membre.nom}</div>
          </div>
          {membre.photo_url ? (
            <img src={membre.photo_url} alt={membre.nom} className="md-photo" />
          ) : (
            <div className="md-photo md-photo-fallback">{initiales}</div>
          )}
        </div>

        {/* ---- Bloc statut / échéance ---- */}
        <div className="md-info-card">
          <div className="md-info-col">
            <div className="md-info-label">Statut d'{mot("adhesion").toLowerCase()}</div>
            <span className="md-chip" style={{ background: st.soft, color: st.color }}>
              <st.Icon size={13} /> {st.label.toUpperCase()}
            </span>
            <div className="md-info-label md-mt">Matricule</div>
            <div className="md-info-value md-mono">{matricule}</div>
          </div>

          <div className="md-info-sep" />

          <div className="md-info-col">
            <div className="md-info-label">Prochaine échéance</div>
            <div className="md-info-value md-with-icon">
              <CalendarDays size={15} color={C.primary} />
              {echeance
                ? new Date(echeance.date_limite).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "long", year: "numeric",
                  })
                : "Aucune"}
            </div>
            <div className="md-info-label md-mt">Jours restants</div>
            <div
              className="md-info-value"
              style={{
                color: joursRestants === null ? C.textSubtle
                  : joursRestants < 0 ? C.danger
                  : joursRestants <= 7 ? C.warning : C.success,
              }}
            >
              {joursRestants === null ? "—"
                : joursRestants < 0 ? `${Math.abs(joursRestants)} jours de retard`
                : `${joursRestants} jours`}
            </div>
          </div>
        </div>
      </header>

      {/* ============ Corps ============ */}
      <main className="md-body">

        {depuisCache && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, background: "#FEF3C7",
            color: "#92400E", borderRadius: 10, padding: "10px 14px", fontSize: 12.5,
            marginBottom: 14, lineHeight: 1.4,
          }}>
            <WifiOff size={14} style={{ flexShrink: 0 }} />
            Dernières données connues du{" "}
            {new Date(horodatageCache).toLocaleDateString("fr-FR")} à{" "}
            {new Date(horodatageCache).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}

        {/* ---- Cotisation annuelle ---- */}
        <section className="md-cotis">
          <div className="md-cotis-glow" />
          <div className="md-cotis-top">
            <div>
              <div className="md-cotis-title">{mot("cotisation_ma")}</div>
              <div className="md-cotis-year">Année {annee}</div>
            </div>
            <div className="md-cotis-amount">
              {loading ? "…" : montant(annuel.du)} <span>FCFA</span>
            </div>
          </div>

          <div className="md-bar">
            <div
              className="md-bar-fill"
              style={{
                width: `${progression}%`,
                background: progression >= 100
                  ? "linear-gradient(90deg,#22C55E,#4ADE80)"
                  : "linear-gradient(90deg,#22C55E,#86EFAC)",
              }}
            />
          </div>

          <div className="md-cotis-foot">
            <span>
              Total payé : <strong>{montant(annuel.paye)} FCFA</strong>
              {annuel.du > 0 && ` (${Math.round(progression)}%)`}
            </span>
            <span className={reste === 0 ? "md-ok" : ""}>
              {reste === 0 ? "Année soldée" : `Reste : ${montant(reste)} FCFA`}
            </span>
          </div>
        </section>

        {/* ---- Activation des alertes ---- */}
        {pushDisponible() && pushEtat !== "actif" && pushEtat !== "refuse" && (
          <button
            className="md-push"
            onClick={demanderPush}
            disabled={pushEtat === "attente"}
          >
            <span className="md-push-icon"><Bell size={19} /></span>
            <span className="md-push-text">
              <strong>Activer les alertes</strong>
              <em>Soyez prévenu de vos échéances et des nouvelles de {mot("organisation_la")}.</em>
            </span>
            <ChevronRight size={18} className="md-cta-arrow" />
          </button>
        )}

        {/* ---- Accès rapides ---- */}
        <h2 className="md-section-title">Accès rapides</h2>
        <div className={`md-quick ${raccourcis.length === 3 ? "is-trois" : ""}`}>
          {raccourcis.map((r) => (
            <button key={r.id} className="md-tile" onClick={() => onPage(r.id)}>
              <span className="md-tile-icon" style={{ background: r.color }}>
                <r.icon size={22} color="#fff" />
              </span>
              <span className="md-tile-l1">{r.l1}</span>
              <span className="md-tile-l2">{r.l2}</span>
            </button>
          ))}
        </div>

        {/* ---- Carte de membre ---- */}
        <button className="md-card-cta" onClick={() => setShowCarte(true)}>
          <span className="md-cta-icon"><CreditCard size={20} /></span>
          <span className="md-cta-text">
            <span className="md-cta-title">Ma carte de membre</span>
            <span className="md-cta-sub">
              {qrActif ? "Carte numérique avec QR Code" : "Carte numérique"}
            </span>
          </span>
          <ChevronRight size={19} className="md-cta-arrow" />
        </button>

        {/* ---- Tombola ---- */}
        {tombolaActive && (
          <section className="md-panel">
            <div className="md-panel-head">
              <h3 className="md-panel-title"><Gift size={16} /> Tombola en cours</h3>
              <button className="md-panel-link" onClick={() => onPage("tombola")}>Voir</button>
            </div>
            <div className="md-tick-row">
              <div className="md-tick">
                <div className="md-tick-num" style={{ color: C.success }}>{tickets.bonus}</div>
                <div className="md-tick-lab">Ticket{tickets.bonus > 1 ? "s" : ""} bonus</div>
              </div>
              <div className="md-tick">
                <div className="md-tick-num" style={{ color: C.warning }}>{tickets.payants}</div>
                <div className="md-tick-lab">Ticket{tickets.payants > 1 ? "s" : ""} acheté{tickets.payants > 1 ? "s" : ""}</div>
              </div>
            </div>
            {membre.statut_cotisation === "nouveau" ? (
              <div className="md-warn" style={{ background: PALETTE.blue100, color: C.primary }}>
                <UserPlus size={15} />
                <span>
                  Votre première cotisation vous donnera droit à un ticket bonus.
                </span>
              </div>
            ) : membre.statut_cotisation !== "a_jour" ? (
              <div className="md-warn">
                <AlertTriangle size={15} />
                <span>Régularisez votre cotisation pour être éligible au tirage.</span>
              </div>
            ) : null}
          </section>
        )}

        {/* ---- Notifications récentes ---- */}
        <div className="md-section-row">
          <h2 className="md-section-title md-nomargin">Notifications récentes</h2>
          {notifs.length > 3 && (
            <button className="md-panel-link" onClick={ouvrirNotifications}>
              Voir tout
            </button>
          )}
        </div>

        {loading ? (
          <div className="md-skel" />
        ) : notifs.length === 0 ? (
          <div className="md-empty">Aucune activité récente.</div>
        ) : (
          <ul className="md-notif-list">
            {notifs.slice(0, 3).map((n) => <NotifItem key={n.id} n={n} />)}
          </ul>
        )}

        {/* ---- Profil ---- */}
        <button className="md-profile" onClick={() => onPage("profil")}>
          <UserCircle2 size={19} /> Mon profil et mes informations
          <ChevronRight size={18} style={{ marginLeft: "auto" }} />
        </button>
      </main>

      {/* ---- Panneau notifications ---- */}
      {showNotifs && (
        <div className="md-drawer-overlay" onClick={() => setShowNotifs(false)}>
          <aside className="md-drawer" onClick={(e) => e.stopPropagation()}>
            <header className="md-drawer-head">
              <h3>Notifications</h3>
              <button onClick={() => setShowNotifs(false)} aria-label="Fermer">
                <X size={20} />
              </button>
            </header>
            {notifs.length === 0 ? (
              <div className="md-empty">Aucune activité récente.</div>
            ) : (
              <ul className="md-notif-list">
                {notifs.map((n) => <NotifItem key={n.id} n={n} />)}
              </ul>
            )}
          </aside>
        </div>
      )}

      {showCarte && (
        <CarteMembreModal membre={membre} onClose={() => setShowCarte(false)} />
      )}
    </div>
  );
}

/* ---------------- Notification ---------------- */

function NotifItem({ n }) {
  const STYLES = {
    paiement:      { Icon: Wallet,    color: C.success,      soft: "#DCFCE7" },
    tombola:       { Icon: Ticket,    color: C.warning,      soft: "#FEF3C7" },
    aide:          { Icon: HandHeart, color: C.primaryLight, soft: PALETTE.blue100 },
    communication: { Icon: Megaphone, color: C.primary,      soft: PALETTE.blue100 },
    tontine:       { Icon: RefreshCw, color: C.primary,      soft: PALETTE.blue100 },
    pret:          { Icon: Banknote,  color: C.success,      soft: "#DCFCE7" },
  };
  const s = STYLES[n.type] || STYLES.communication;

  return (
    <li className="md-notif">
      <span className="md-notif-icon" style={{ background: s.soft, color: s.color }}>
        <s.Icon size={17} />
      </span>
      <div className="md-notif-body">
        <div className="md-notif-title">{n.titre}</div>
        <div className="md-notif-text">{n.texte}</div>
      </div>
      <span className="md-notif-time">{relatif(n.date)}</span>
    </li>
  );
}

/* ---------------- Utilitaires ---------------- */

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function relatif(date) {
  const diff = Date.now() - new Date(date);
  const min = Math.floor(diff / 60000);
  if (min < 60) return `Il y a ${Math.max(min, 1)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 31) return `Il y a ${j} j`;
  return new Date(date).toLocaleDateString("fr-FR");
}

function libelleStatutAide(s) {
  const map = {
    en_attente: "enregistrée",
    en_examen: "en cours d'examen",
    validee: "validée",
    payee: "payée",
    rejetee: "rejetée",
  };
  return map[s] || s;
}

/* ---------------- Styles ---------------- */

const CSS = `
.md-shell{
  min-height:100vh; background:${C.bg};
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}

/* ============ En-tête ============ */
.md-head{
  background:linear-gradient(160deg, ${PALETTE.blue800} 0%, ${PALETTE.blue900} 100%);
  padding:${S.md}px ${S.lg}px ${S.xxxl}px;
  border-bottom-left-radius:26px; border-bottom-right-radius:26px;
  color:#fff;
}
.md-head-bar{ display:flex; align-items:center; justify-content:space-between; }

.md-selecteur-zone{ position:relative; margin-bottom:${S.sm}px; }
.md-selecteur{
  display:flex; align-items:center; justify-content:space-between; gap:8px;
  width:100%; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.14);
  color:rgba(255,255,255,.85); border-radius:${R.sm}px; padding:8px 11px;
  cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:600;
}
.md-selecteur:hover{ background:rgba(255,255,255,.13); }
.md-orgs{
  list-style:none; margin:6px 0 0; padding:5px;
  background:${PALETTE.blue900}; border:1px solid rgba(255,255,255,.16);
  border-radius:${R.md}px; box-shadow:${SHADOW.lg};
  position:absolute; left:0; right:0; z-index:80;
}
.md-org{
  display:flex; align-items:center; justify-content:space-between; gap:8px;
  width:100%; background:none; border:none; cursor:pointer;
  padding:9px 10px; border-radius:${R.sm}px;
  font-family:inherit; font-size:13px; color:rgba(255,255,255,.8);
}
.md-org:hover:not(:disabled){ background:rgba(255,255,255,.1); color:#fff; }
.md-org.is-active{ color:#fff; font-weight:600; }
.md-org:disabled{ opacity:.6; cursor:not-allowed; }
.md-org-nom{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.md-org-spin{ animation:mdOrgSpin 1s linear infinite; flex-shrink:0; }
@keyframes mdOrgSpin{ to{ transform:rotate(360deg); } }

.md-logo{
  width:38px; height:38px; object-fit:contain;
  background:#fff; border-radius:9px; padding:4px;
}
.md-head-actions{ display:flex; align-items:center; gap:${S.sm}px; }
.md-bell, .md-logout{
  position:relative; width:40px; height:40px; border-radius:12px;
  background:rgba(255,255,255,.13); border:1px solid rgba(255,255,255,.18);
  color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center;
  transition:background .16s ease;
}
.md-bell:hover, .md-logout:hover{ background:rgba(255,255,255,.22); }
.md-badge{
  position:absolute; top:-5px; right:-5px; min-width:19px; height:19px;
  padding:0 5px; border-radius:10px; background:${C.danger};
  color:#fff; font-size:11px; font-weight:700;
  display:flex; align-items:center; justify-content:center;
  border:2px solid ${PALETTE.blue800};
}

.md-greeting{
  display:flex; align-items:center; justify-content:space-between;
  gap:${S.md}px; margin-top:${S.lg}px;
}
.md-hello{ font-size:14px; opacity:.78; }
.md-name{
  font-size:21px; font-weight:700; letter-spacing:-.02em; margin-top:2px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.md-photo{
  width:56px; height:56px; border-radius:50%; flex-shrink:0;
  object-fit:cover; border:2.5px solid rgba(255,255,255,.85);
}
.md-photo-fallback{
  display:flex; align-items:center; justify-content:center;
  background:rgba(255,255,255,.18); font-size:19px; font-weight:700;
}

/* ---- Bloc info ---- */
.md-info-card{
  display:flex; background:${C.surface}; color:${C.text};
  border-radius:${R.lg}px; padding:${S.lg}px; margin-top:${S.lg}px;
  box-shadow:0 6px 20px rgba(8,20,50,.16);
}
.md-info-col{ flex:1; min-width:0; }
.md-info-sep{ width:1px; background:${C.border}; margin:0 ${S.lg}px; flex-shrink:0; }
.md-info-label{ font-size:12px; color:${C.textSubtle}; }
.md-info-value{ font-size:14px; font-weight:600; margin-top:4px; }
.md-with-icon{ display:flex; align-items:center; gap:6px; }
.md-mono{ font-family:'JetBrains Mono',monospace; font-size:12.5px; letter-spacing:.02em; }
.md-mt{ margin-top:${S.md}px; }
.md-chip{
  display:inline-flex; align-items:center; gap:5px; margin-top:6px;
  padding:5px 11px; border-radius:${R.sm}px;
  font-size:11.5px; font-weight:700; letter-spacing:.03em;
}

/* ============ Corps ============ */
.md-body{
  max-width:640px; margin:0 auto;
  padding:${S.lg}px ${S.lg}px ${S.xxxl}px;
  display:flex; flex-direction:column; gap:${S.lg}px;
}

/* ---- Cotisation ---- */
.md-cotis{
  position:relative; overflow:hidden;
  background:linear-gradient(135deg, ${PALETTE.blue800}, ${PALETTE.blue600});
  color:#fff; border-radius:${R.xl}px; padding:${S.lg}px;
  box-shadow:${SHADOW.md};
}
.md-cotis-glow{
  position:absolute; width:200px; height:200px; border-radius:50%;
  background:rgba(255,255,255,.07); right:-60px; top:-80px;
}
.md-cotis-top{
  position:relative; display:flex; align-items:flex-start;
  justify-content:space-between; gap:${S.md}px;
}
.md-cotis-title{ font-size:16px; font-weight:600; }
.md-cotis-year{ font-size:13px; opacity:.75; margin-top:2px; }
.md-cotis-amount{ font-size:24px; font-weight:700; letter-spacing:-.02em; white-space:nowrap; }
.md-cotis-amount span{ font-size:13px; font-weight:600; opacity:.75; margin-left:3px; }
.md-bar{
  position:relative; height:9px; border-radius:${R.pill}px;
  background:rgba(255,255,255,.22); margin:${S.lg}px 0 ${S.md}px; overflow:hidden;
}
.md-bar-fill{ height:100%; border-radius:${R.pill}px; transition:width .6s cubic-bezier(.4,0,.2,1); }
.md-cotis-foot{
  position:relative; display:flex; justify-content:space-between;
  gap:${S.md}px; font-size:12.5px; opacity:.92; flex-wrap:wrap;
}
.md-ok{ color:#A7F3C0; font-weight:600; }

/* ---- Titres ---- */
.md-section-title{ font-size:16px; font-weight:700; margin:${S.sm}px 0 0; letter-spacing:-.01em; }
.md-nomargin{ margin:0; }
.md-section-row{ display:flex; align-items:center; justify-content:space-between; margin-top:${S.sm}px; }

/* ---- Tuiles ---- */
.md-quick{ display:grid; grid-template-columns:repeat(4,1fr); gap:${S.sm}px; }
.md-quick.is-trois{ grid-template-columns:repeat(3,1fr); }
@media (max-width:380px){
  .md-quick, .md-quick.is-trois{ grid-template-columns:repeat(2,1fr); gap:${S.md}px; }
}
.md-tile{
  display:flex; flex-direction:column; align-items:center; gap:3px;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.lg}px; padding:${S.md}px ${S.xs}px;
  cursor:pointer; font-family:inherit; box-shadow:${SHADOW.xs};
  transition:transform .14s ease, box-shadow .18s ease;
}
.md-tile:hover{ transform:translateY(-2px); box-shadow:${SHADOW.md}; }
.md-tile-icon{
  width:46px; height:46px; border-radius:14px; margin-bottom:5px;
  display:flex; align-items:center; justify-content:center;
}
.md-tile-l1{ font-size:12.5px; font-weight:600; color:${C.text}; text-align:center; line-height:1.25; }
.md-tile-l2{ font-size:11px; color:${C.textSubtle}; text-align:center; line-height:1.25; }

/* ---- CTA carte ---- */
.md-card-cta{
  display:flex; align-items:center; gap:${S.md}px; width:100%;
  background:${C.surface}; border:1.5px dashed ${C.warning}66;
  border-radius:${R.lg}px; padding:${S.md}px ${S.lg}px;
  cursor:pointer; font-family:inherit; text-align:left;
  transition:background .18s ease, border-color .18s ease;
}
.md-card-cta:hover{ background:#FEF6EC; border-color:${C.warning}; }
.md-cta-icon{
  width:42px; height:42px; border-radius:${R.md}px; flex-shrink:0;
  background:#FEF3C7; color:${C.warning};
  display:flex; align-items:center; justify-content:center;
}
.md-cta-text{ display:flex; flex-direction:column; flex:1; min-width:0; }
.md-cta-title{ font-size:14.5px; font-weight:600; }
.md-cta-sub{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }
.md-cta-arrow{ color:${C.textSubtle}; flex-shrink:0; }

/* ---- Alertes ---- */
.md-push{
  display:flex; align-items:center; gap:${S.md}px; width:100%;
  background:${C.surface}; border:1.5px solid ${C.primary}33;
  border-radius:${R.lg}px; padding:${S.md}px ${S.lg}px;
  cursor:pointer; font-family:inherit; text-align:left;
  transition:border-color .18s ease, background .18s ease;
}
.md-push:hover{ background:${PALETTE.blue50}; border-color:${C.primary}; }
.md-push:disabled{ opacity:.6; }
.md-push-icon{
  width:42px; height:42px; border-radius:${R.md}px; flex-shrink:0;
  background:${PALETTE.blue100}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.md-push-text{ display:flex; flex-direction:column; flex:1; min-width:0; }
.md-push-text strong{ font-size:14.5px; font-weight:600; }
.md-push-text em{ font-style:normal; font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }

/* ---- Panneaux ---- */
.md-panel{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.lg}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.md-panel-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:${S.md}px; }
.md-panel-title{ display:flex; align-items:center; gap:7px; font-size:15px; font-weight:600; margin:0; }
.md-panel-link{
  background:none; border:none; padding:0; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:600; color:${C.primary};
}
.md-panel-link:hover{ text-decoration:underline; }
.md-tick-row{ display:flex; gap:${S.md}px; }
.md-tick{ flex:1; text-align:center; background:${C.bg}; border-radius:${R.md}px; padding:${S.md}px ${S.sm}px; }
.md-tick-num{ font-size:26px; font-weight:700; line-height:1; }
.md-tick-lab{ font-size:12px; color:${C.textSubtle}; margin-top:5px; }
.md-warn{
  display:flex; align-items:flex-start; gap:8px; margin-top:${S.md}px;
  background:#FEF3C7; color:#B45309; border-radius:${R.md}px;
  padding:10px 12px; font-size:13px; line-height:1.45;
}

/* ---- Notifications ---- */
.md-notif-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:${S.sm}px; }
.md-notif{
  display:flex; align-items:flex-start; gap:${S.md}px;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.lg}px; padding:${S.md}px ${S.lg}px;
}
.md-notif-icon{
  width:38px; height:38px; border-radius:50%; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
.md-notif-body{ flex:1; min-width:0; }
.md-notif-title{ font-size:14px; font-weight:600; }
.md-notif-text{ font-size:12.5px; color:${C.textMuted}; line-height:1.5; margin-top:3px; }
.md-notif-time{ font-size:11.5px; color:${C.textSubtle}; flex-shrink:0; white-space:nowrap; }

/* ---- Profil ---- */
.md-profile{
  display:flex; align-items:center; gap:${S.md}px; width:100%;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.lg}px; padding:${S.lg}px; cursor:pointer;
  font-family:inherit; font-size:14.5px; font-weight:600; color:${C.textMuted};
  transition:border-color .18s ease, color .18s ease;
}
.md-profile:hover{ border-color:${C.primary}; color:${C.primary}; }

/* ---- Tiroir ---- */
.md-drawer-overlay{
  position:fixed; inset:0; z-index:150;
  background:rgba(10,20,40,.5); backdrop-filter:blur(2px);
  display:flex; justify-content:flex-end; animation:mdFade .18s ease;
}
.md-drawer{
  width:100%; max-width:420px; background:${C.bg};
  height:100%; overflow-y:auto; padding:${S.lg}px;
  animation:mdSlide .26s cubic-bezier(.4,0,.2,1);
}
.md-drawer-head{
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:${S.lg}px;
}
.md-drawer-head h3{ font-size:18px; font-weight:700; margin:0; }
.md-drawer-head button{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.sm}px;
  color:${C.textMuted}; cursor:pointer; padding:6px; display:flex;
}

/* ---- Divers ---- */
.md-empty{
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px;
  padding:${S.xl}px; text-align:center; color:${C.textSubtle}; font-size:13.5px;
}
.md-skel{
  height:82px; border-radius:${R.lg}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:mdShimmer 1.4s infinite;
}
@keyframes mdShimmer{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
@keyframes mdFade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes mdSlide{ from{ transform:translateX(100%); } to{ transform:none; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;