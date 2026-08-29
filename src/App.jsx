import React, { useEffect, useState } from "react";
import {
  LogOut, UserCircle2, ArrowLeft, PowerOff, ShieldOff, ShieldCheck,
} from "lucide-react";
import { AuthProvider, useAuth } from "./AuthContext";
import { supabase } from "./supabaseClient";
import { C, R, S, SHADOW, PALETTE } from "./theme";

import WelcomeScreen from "./WelcomeScreen";
import LandingPage from "./LandingPage";
import InscriptionOrganisationScreen from "./InscriptionOrganisationScreen";
import LoginScreen from "./LoginScreen";
import AdhesionFlow from "./AdhesionFlow";

import MembreDashboard from "./MembreDashboard";
import MembreAides from "./MembreAides";
import MembreProfil from "./MembreProfil";
import MembreBeneficiaires from "./MembreBeneficiaires";

import AdminLayout, { ADMIN_PAGES, PAGES_MODULES } from "./AdminLayout";
import TableauBordFinancier from "./TableauBordFinancier";
import AdhesionsPanel from "./AdhesionsPanel";
import MembresPage from "./MembresPage";
import CotisationsPage from "./CotisationsPage";
import TombolaPage from "./TombolaPage";
import ComptabilitePage from "./ComptabilitePage";
import OperationsDiversesPage from "./OperationsDiversesPage";
import BaremePage from "./BaremePage";
import DocumentsPage from "./DocumentsPage";
import ServicesPage from "./ServicesPage";
import ActiviteEconomiquePage from "./ActiviteEconomiquePage";
import ProjetsPage from "./ProjetsPage";
import PartageBeneficesPage from "./PartageBeneficesPage";
import ClotureAvecPage from "./ClotureAvecPage";
import MoyensPaiementPage from "./MoyensPaiementPage";
import DeclarationsPaiementPage from "./DeclarationsPaiementPage";
import AgendaPage from "./AgendaPage";
import CommunicationPage from "./CommunicationPage";
import AssembleesPage from "./AssembleesPage";
import TontinePage from "./TontinePage";
import PretsPage from "./PretsPage";
import ParametragePage from "./ParametragePage";
import RapportsPage from "./RapportsPage";
import SanctionsPage from "./SanctionsPage";
import SplashScreen from "./SplashScreen";
import ActivationScreen from "./ActivationScreen";
import RecuperationScreen from "./RecuperationScreen";
import PinSetupScreen from "./PinSetupScreen";
import PinLockScreen from "./PinLockScreen";
import JournalPage from "./JournalPage";
import RolesPage from "./RolesPage";
import ExploitantConsole from "./ExploitantConsole";
import { consigner, EVENEMENTS } from "./journal";
import { pinEstDefini } from "./pinLock";
import { useParametrage, moduleActif, LOGO_DEFAUT } from "./useParametrage";
import { usePermissions } from "./usePermissions";

// Pages de l'espace membre relevant d'un module
const PAGES_MEMBRE_MODULES = {
  tombola: "module_tombola",
  assemblees: "module_assemblees",
  tontine: "module_tontine",
  prets: "module_prets",
};

function Shell() {
  const { session, isAdmin, isExploitant, signOut, loading } = useAuth();
  const { params, loading: parametrageEnCours } = useParametrage();
  const { peut, loading: permissionsEnCours } = usePermissions();
  const [page, setPage] = useState("dashboard");
  const [vuePublique, setVuePublique] = useState("accueil");
  const [membre, setMembre] = useState(null);
  const [loadingMembre, setLoadingMembre] = useState(false);
  const [splash, setSplash] = useState(() => !sessionStorage.getItem("splash_vu"));
  const [pinDeverrouille, setPinDeverrouille] = useState(false);
  const [pinEtat, setPinEtat] = useState({ pret: false, configure: false });
  const [espaceAdmin, setEspaceAdmin] = useState(true);
  const [orgActif, setOrgActif] = useState(null); // null = pas encore vérifié

  const userId = session?.user?.id ?? null;

  // Une organisation en attente de validation (nouvelle inscription) ou
  // suspendue (impayé) ne doit donner accès à rien de l'application —
  // ni à la configuration du PIN, ni au tableau de bord. Vérifié à part de
  // useParametrage (qui lit "parametrage", pas le statut "actif" de
  // l'organisation elle-même) pour ne pas toucher un mécanisme partagé
  // par tout le reste de l'application.
  useEffect(() => {
    if (!session || isExploitant || !params.organisation_id) {
      setOrgActif(null);
      return;
    }
    supabase
      .from("organisations")
      .select("actif")
      .eq("id", params.organisation_id)
      .maybeSingle()
      .then(({ data }) => setOrgActif(data ? data.actif : null));
  }, [session, isExploitant, params.organisation_id]);

  // Charger la fiche membre. Les administrateurs sont d'abord des adhérents :
  // on charge leur fiche aussi, pour leur permettre de consulter leur espace.
  useEffect(() => {
    if (!session) {
      setMembre(null);
      return;
    }

    // On attend que l'organisation active soit connue : sans elle, la
    // requête filtrerait sur organisation_id = null et manquerait la fiche.
    if (!params.organisation_id) return;

    setLoadingMembre(true);
    supabase
      .from("membres")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("organisation_id", params.organisation_id)
      .maybeSingle()
      .then(({ data }) => {
        setMembre(data || null);
        setLoadingMembre(false);
        if (data && !isAdmin) setPage("accueil");
      });
  }, [session, isAdmin, params.organisation_id]);

  // État du verrouillage, recalculé uniquement au changement de compte
  useEffect(() => {
    if (!userId) {
      setPinEtat({ pret: false, configure: false });
      setPinDeverrouille(false);
      setVuePublique("accueil");
      setEspaceAdmin(true);
      setPage("dashboard");
      return;
    }
    setPinEtat({ pret: true, configure: pinEstDefini(userId) });
    setPinDeverrouille(false);
  }, [userId]);

  // Un administrateur ne peut basculer que s'il possède une fiche membre
  const peutBasculer = isAdmin && Boolean(membre);
  const enEspaceMembre = !isAdmin || (peutBasculer && !espaceAdmin);

  function versEspaceMembre() {
    setEspaceAdmin(false);
    setPage("accueil");
  }

  function versEspaceAdmin() {
    setEspaceAdmin(true);
    setPage("dashboard");
  }

  // L'écran de démarrage s'efface dès que la session est connue, plutôt
  // qu'au bout d'un délai fixe.
  if (splash) {
    return (
      <SplashScreen
        pret={!loading}
        onDone={() => {
          sessionStorage.setItem("splash_vu", "1");
          setSplash(false);
        }}
      />
    );
  }

  if (loading || loadingMembre) {
    return (
      <div style={ecranAttente}>
        Chargement…
      </div>
    );
  }

  // ---------- Juste après une inscription de mutuelle ----------
  // Drapeau posé explicitement par InscriptionOrganisationScreen, plutôt
  // que de parier sur la rapidité de useParametrage : tant qu'il est
  // présent, aucun écran de PIN n'est jamais montré, quelle que soit la
  // vitesse à laquelle l'organisation se résout. Retiré ci-dessous dès
  // que l'état de l'organisation (actif ou non) est connu avec certitude,
  // pour que le comportement normal reprenne ensuite, y compris pour ce
  // même compte lors d'une connexion future.
  const venantDInscription = session && !isExploitant
    && sessionStorage.getItem("post_inscription_org") === "1";

  if (venantDInscription && (parametrageEnCours || orgActif === null)) {
    return <div style={ecranAttente}>Chargement…</div>;
  }

  if (venantDInscription && orgActif !== null) {
    sessionStorage.removeItem("post_inscription_org");
  }

  // ---------- Organisation en cours de résolution ----------
  // Le vrai point manqué par le garde-fou précédent : useParametrage()
  // expose un état "loading" propre, jamais lu jusqu'ici par Shell(). Sans
  // ce contrôle, params.organisation_id peut encore valoir null pendant
  // une fraction de seconde après l'ouverture de session (le temps que
  // useParametrage retrouve l'organisation nouvellement créée) — et dans
  // cette fenêtre précise, aucune des conditions ci-dessous ne s'applique
  // encore, laissant passer l'écran de configuration du PIN avant que
  // tout ne se stabilise. Le drapeau ci-dessus couvre déjà le cas d'une
  // inscription fraîche ; ce contrôle reste utile pour toute autre
  // situation où organisation_id tarde à se résoudre.
  if (session && !isExploitant && parametrageEnCours) {
    return <div style={ecranAttente}>Chargement…</div>;
  }

  // ---------- Organisation pas encore active ----------
  // Couvre à la fois une inscription tout juste soumise (en attente de
  // validation par l'exploitant) et une organisation suspendue pour
  // impayé : dans les deux cas, rien d'autre ne doit être accessible —
  // ni la configuration du PIN, ni le tableau de bord. Placé avant les
  // écrans de PIN pour qu'une inscription toute fraîche n'y soit jamais
  // poussée automatiquement. Un état d'attente supplémentaire évite qu'un
  // écran de PIN ne s'affiche brièvement pendant que la vérification est
  // encore en cours (orgActif vaut null tant qu'elle n'a pas répondu).
  if (session && !isExploitant && params.organisation_id && orgActif === null) {
    return <div style={ecranAttente}>Chargement…</div>;
  }

  if (session && !isExploitant && params.organisation_id && orgActif === false) {
    return (
      <div style={ecranAttenteOrg}>
        <ShieldOff size={32} color={C.textSubtle} />
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: "14px 0 8px" }}>
          Espace non actif
        </h1>
        <p style={{ fontSize: 14.5, color: C.textMuted, maxWidth: "36ch", lineHeight: 1.6, margin: 0 }}>
          L'espace de votre mutuelle n'est pas encore actif. Si vous venez de
          l'inscrire, notre équipe la valide sous peu et vous préviendra.
          Pour toute question, contactez-nous directement.
        </p>
        <div
          style={{
            marginTop: 20, display: "flex", alignItems: "flex-start", gap: 10,
            background: PALETTE.blue50, border: `1px solid ${PALETTE.blue100}`,
            borderRadius: 12, padding: "13px 15px", maxWidth: "36ch", textAlign: "left",
          }}
        >
          <ShieldCheck size={16} color={C.primary} style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: C.textMuted }}>
            <strong style={{ color: C.text }}>2 mois d'essai gratuit</strong> dès l'activation,
            accès complet, sans paiement. La facturation (forfait + variable,
            et d'éventuels frais de mise en service) ne commence qu'à l'issue
            de cet essai.
          </p>
        </div>
        <button
          onClick={signOut}
          style={{
            marginTop: 22, display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, color: C.textMuted,
          }}
        >
          <LogOut size={15} /> Se déconnecter
        </button>
      </div>
    );
  }

  // ---------- Verrouillage par code PIN ----------
  if (session && !pinEtat.pret) {
    return <div style={ecranAttente}>Chargement…</div>;
  }

  if (session && !pinEtat.configure) {
    return (
      <PinSetupScreen
        userId={session.user.id}
        membreId={membre?.id}
        nomAffiche={membre?.nom}
        onTermine={() => {
          setPinEtat({ pret: true, configure: true });
          setPinDeverrouille(true);
        }}
      />
    );
  }

  if (session && !pinDeverrouille) {
    return (
      <PinLockScreen
        userId={session.user.id}
        nomAffiche={membre?.nom}
        onDeverrouille={() => setPinDeverrouille(true)}
      />
    );
  }

  // ---------- Console d'exploitant ----------
  // Un exploitant n'appartient à aucune mutuelle : il ne voit jamais
  // l'espace membre ni l'espace administrateur d'une organisation.
  if (session && isExploitant) {
    return <ExploitantConsole onSignOut={signOut} />;
  }

  // ---------- Parcours public ----------
  if (!session) {
    if (vuePublique === "accueil") {
      // Aucune organisation résolue (visite du domaine nu, sans ?org=) :
      // c'est la page vitrine de la plateforme qui s'affiche, pas
      // WelcomeScreen (qui est propre à une mutuelle précise et resterait
      // vide de contenu tant qu'aucune organisation n'est connue).
      if (!params.organisation_id) {
        return (
          <LandingPage
            onCreationMutuelle={() => setVuePublique("creation_mutuelle")}
            onConnexion={() => setVuePublique("connexion")}
          />
        );
      }

      return (
        <WelcomeScreen
          onLogin={() => setVuePublique("connexion")}
          onAdhesion={() => setVuePublique("adhesion")}
          onActivation={() => setVuePublique("activation")}
          onRecuperation={() => setVuePublique("recuperation")}
          onCreationMutuelle={() => setVuePublique("creation_mutuelle")}
        />
      );
    }

    if (vuePublique === "adhesion") {
      return (
        <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 16px" }}>
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <button onClick={() => setVuePublique("accueil")} style={lienRetour}>
              ← Retour à l'accueil
            </button>
            <AdhesionFlow />
          </div>
        </div>
      );
    }

    if (vuePublique === "activation") {
      return <ActivationScreen onBack={() => setVuePublique("accueil")} />;
    }

    if (vuePublique === "recuperation") {
      return (
        <RecuperationScreen
          onBack={() => setVuePublique("accueil")}
          onConnecte={() => window.location.reload()}
        />
      );
    }

    if (vuePublique === "creation_mutuelle") {
      return (
        <InscriptionOrganisationScreen onBack={() => setVuePublique("accueil")} />
      );
    }

    return (
      <LoginScreen
        onAdhesion={() => setVuePublique("adhesion")}
        onBack={() => setVuePublique("accueil")}
      />
    );
  }

  // ---------- Espace membre ----------
  if (enEspaceMembre) {
    if (!membre) {
      return (
        <div style={{ minHeight: "100vh", background: C.bg }}>
          <TopBar
            onSignOut={signOut}
            logo={params.logo_url}
            title={params.nom_mutuelle}
            subtitle="Espace membre"
          />
          <div style={messageAttente}>
            Votre adhésion est en attente de validation par le Bureau.
            Vous recevrez une notification dès qu'elle sera traitée.
          </div>
        </div>
      );
    }

    // Une page dont le module a été désactivé n'est plus accessible, même en
    // conservant l'écran ouvert : on ramène le membre à son accueil.
    const moduleMembre = PAGES_MEMBRE_MODULES[page];
    const pageMembreOuverte = !moduleMembre || moduleActif(params, moduleMembre);

    return (
      <div style={{ minHeight: "100vh", background: C.bg }}>
        {/* Rappel discret pour un membre du Bureau consultant son espace */}
        {peutBasculer && (
          <BandeauBascule onRetour={versEspaceAdmin} />
        )}

        {page !== "accueil" && (
          <TopBar
            onSignOut={signOut}
            logo={params.logo_url}
            title={params.nom_mutuelle}
            subtitle={params.adresse}
          />
        )}

        {!pageMembreOuverte ? (
          <PageMembre onBack={() => setPage("accueil")}>
            <ModuleDesactive />
          </PageMembre>
        ) : (
          <>
            {page === "accueil" && (
              <MembreDashboard membre={membre} onPage={setPage} onSignOut={signOut} />
            )}

            {page === "aides" && (
              <MembreAides membre={membre} onBack={() => setPage("accueil")} />
            )}

            {page === "profil" && (
              <MembreProfil
                membre={membre}
                onBack={() => setPage("accueil")}
                onSignOut={signOut}
              />
            )}

            {page === "beneficiaires" && (
              <MembreBeneficiaires membre={membre} onBack={() => setPage("accueil")} />
            )}

            {page === "cotisations" && (
              <PageMembre onBack={() => setPage("accueil")}>
                <MembreCotisations membre={membre} />
              </PageMembre>
            )}

            {page === "tombola" && (
              <PageMembre onBack={() => setPage("accueil")}>
                <MembreTombola membre={membre} />
              </PageMembre>
            )}

            {page === "assemblees" && (
              <PageMembre onBack={() => setPage("accueil")}>
                <MembreAssemblees membre={membre} />
              </PageMembre>
            )}

            {page === "tontine" && (
              <PageMembre onBack={() => setPage("accueil")}>
                <MembreTontine membre={membre} />
              </PageMembre>
            )}

            {page === "prets" && (
              <PageMembre onBack={() => setPage("accueil")}>
                <MembrePrets membre={membre} />
              </PageMembre>
            )}
          </>
        )}
      </div>
    );
  }

  // ---------- Espace administrateur ----------
  // Masquer une entrée de menu ne suffit pas : la page elle-même doit
  // refuser de s'afficher si son module a été désactivé, ou si la personne
  // n'a pas le rôle qui y donne accès.
  const moduleAdmin = PAGES_MODULES[page];
  const moduleOuvert = !moduleAdmin || moduleActif(params, moduleAdmin);
  const permissionAccordee = permissionsEnCours || peut(page);
  const pageAdminOuverte = moduleOuvert && permissionAccordee;

  return (
    <AdminLayout
      page={page}
      onPage={setPage}
      onSignOut={signOut}
      onEspaceMembre={peutBasculer ? versEspaceMembre : null}
    >
      {!pageAdminOuverte ? (
        <div style={{ padding: 28 }}>
          {!moduleOuvert
            ? <ModuleDesactive administrateur onRetour={() => setPage("dashboard")} />
            : <AccesRefuse onRetour={() => setPage("dashboard")} />}
        </div>
      ) : (
        <>
          {page === "dashboard"     && <TableauBordFinancier />}
          {page === "adhesions"     && <AdhesionsPanel />}
          {page === "membres"       && <MembresPage />}
          {page === "cotisations"   && <CotisationsPage />}
          {page === "moyens_paiement" && <MoyensPaiementPage />}
          {page === "declarations_paiement" && <DeclarationsPaiementPage />}
          {page === "tombola"       && <TombolaPage />}
          {page === "sanctions"     && <SanctionsPage />}
          {page === "aides_admin"   && <AidesAdminPage />}
          {page === "bareme"        && <BaremePage />}
          {page === "documents"     && <DocumentsPage />}
          {page === "services"      && <ServicesPage />}
          {page === "activite_eco"  && <ActiviteEconomiquePage />}
          {page === "projets"       && <ProjetsPage />}
          {page === "partage_benefices" && <PartageBeneficesPage />}
          {page === "cloture_avec" && <ClotureAvecPage />}
          {page === "operations"    && <OperationsDiversesPage />}
          {page === "comptabilite"  && <ComptabilitePage />}
          {page === "agenda"        && <AgendaPage />}
          {page === "communication" && <CommunicationPage />}
          {page === "assemblees"    && <AssembleesPage />}
          {page === "tontine"       && <TontinePage />}
          {page === "prets"         && <PretsPage />}
          {page === "parametrage"   && <ParametragePage />}
          {page === "rapports"      && <RapportsPage />}
          {page === "journal"       && <JournalPage />}
          {page === "roles"         && <RolesPage />}
          {!ADMIN_PAGES.includes(page) && <TableauBordFinancier />}
        </>
      )}
    </AdminLayout>
  );
}

/* ---------------- Module désactivé ---------------- */

function ModuleDesactive({ administrateur, onRetour }) {
  return (
    <div style={carteVide}>
      <PowerOff size={34} color={C.textSubtle} style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>
        Cette fonction n'est pas activée
      </div>
      <div style={{ marginTop: 8, maxWidth: "44ch", marginInline: "auto" }}>
        {administrateur
          ? "Ce module n'est pas activé pour votre mutuelle. Il peut l'être depuis les paramètres, si vos textes le prévoient."
          : "Cette fonction n'est pas proposée par votre mutuelle."}
      </div>
      {administrateur && onRetour && (
        <button onClick={onRetour} style={{ ...lienRetour, marginTop: 18, justifyContent: "center", width: "100%" }}>
          Revenir au tableau de bord
        </button>
      )}
    </div>
  );
}

/* ---------------- Accès refusé ---------------- */

function AccesRefuse({ onRetour }) {
  return (
    <div style={carteVide}>
      <ShieldOff size={34} color={C.textSubtle} style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>
        Cet écran ne vous est pas accessible
      </div>
      <div style={{ marginTop: 8, maxWidth: "44ch", marginInline: "auto" }}>
        Votre rôle dans cette mutuelle ne donne pas accès à cette partie de la
        gestion. Rapprochez-vous de l'administrateur si vous pensez qu'il
        s'agit d'une erreur.
      </div>
      {onRetour && (
        <button
          onClick={onRetour}
          style={{ ...lienRetour, marginTop: 18, justifyContent: "center", width: "100%" }}
        >
          Revenir au tableau de bord
        </button>
      )}
    </div>
  );
}

/* ---------------- Bandeau de bascule ---------------- */

function BandeauBascule({ onRetour }) {
  return (
    <>
      <style>{`
        .bascule{
          position:sticky; top:0; z-index:60;
          display:flex; align-items:center; gap:10px;
          background:${C.primary}; color:#fff;
          padding:9px 16px; font-size:13px;
          font-family:'Inter','Poppins',system-ui,sans-serif;
        }
        .bascule-texte{ flex:1; min-width:0; opacity:.92; }
        .bascule-btn{
          display:flex; align-items:center; gap:6px; flex-shrink:0;
          background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.28);
          color:#fff; border-radius:8px; padding:7px 12px;
          font-family:inherit; font-size:12.5px; font-weight:600; cursor:pointer;
          transition:background .16s ease;
        }
        .bascule-btn:hover{ background:rgba(255,255,255,.26); }
        @media (max-width:520px){
          .bascule-texte{ font-size:12px; }
        }
      `}</style>

      <div className="bascule">
        <UserCircle2 size={16} />
        <span className="bascule-texte">Vous consultez votre espace personnel</span>
        <button className="bascule-btn" onClick={onRetour}>
          <ArrowLeft size={13} /> Administration
        </button>
      </div>
    </>
  );
}

/* ---------------- Barre supérieure ---------------- */

function TopBar({ onSignOut, logo, title, subtitle }) {
  return (
    <>
      <style>{`
        .topbar{
          position:sticky; top:0; z-index:50;
          background:${C.surface}; border-bottom:1px solid ${C.border};
          padding:12px 20px; display:flex; align-items:center; gap:12px;
          font-family:'Inter','Poppins',system-ui,sans-serif;
        }
        .topbar-logo{ width:38px; height:38px; object-fit:contain; flex-shrink:0; }
        .topbar-text{ flex:1; min-width:0; }
        .topbar-title{
          font-size:15px; font-weight:700; color:${C.primary};
          letter-spacing:-.01em; line-height:1.2;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .topbar-sub{
          font-size:12px; color:${C.textSubtle}; line-height:1.3;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .topbar-btn{
          display:flex; align-items:center; gap:7px; flex-shrink:0;
          background:transparent; border:1.5px solid ${C.border};
          color:${C.textMuted}; border-radius:10px;
          padding:8px 14px; font-family:inherit; font-size:13.5px;
          font-weight:600; cursor:pointer;
          transition:border-color .18s ease, color .18s ease, background .18s ease;
        }
        .topbar-btn:hover{
          border-color:${C.danger}; color:${C.danger}; background:${C.dangerSoft};
        }
        @media (max-width:520px){
          .topbar-btn span{ display:none; }
          .topbar-btn{ padding:8px 10px; }
        }
      `}</style>

      <header className="topbar">
        <img
          src={logo || LOGO_DEFAUT}
          alt={`Logo ${title}`}
          className="topbar-logo"
          onError={(e) => { e.currentTarget.src = LOGO_DEFAUT; }}
        />
        <div className="topbar-text">
          <div className="topbar-title">{title}</div>
          {subtitle && <div className="topbar-sub">{subtitle}</div>}
        </div>
        <button onClick={onSignOut} className="topbar-btn">
          <LogOut size={15} /> <span>Déconnexion</span>
        </button>
      </header>
    </>
  );
}

/* ---------------- Conteneur de page membre ---------------- */

function PageMembre({ onBack, children }) {
  return (
    <div style={{ padding: "20px 16px", maxWidth: 640, margin: "0 auto" }}>
      <button onClick={onBack} style={lienRetour}>← Retour</button>
      {children}
    </div>
  );
}

/* ---------------- Cotisations du membre ---------------- */

function MembreCotisations({ membre }) {
  const [cotisations, setCotisations] = useState([]);
  const [moyens, setMoyens] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [waveActif, setWaveActif] = useState(false);
  const [loading, setLoading] = useState(true);
  const [declarationOuverte, setDeclarationOuverte] = useState(null); // cotisation ciblée
  const [waveEnCours, setWaveEnCours] = useState(null); // cotisation.id en cours de redirection
  const [waveErreur, setWaveErreur] = useState("");

  async function charger() {
    const [{ data: cot }, { data: moy }, { data: decl }, { data: wave }] = await Promise.all([
      supabase.from("cotisations").select("*").eq("membre_id", membre.id).order("periode", { ascending: false }),
      supabase.from("moyens_paiement").select("*").eq("organisation_id", membre.organisation_id).eq("actif", true).order("ordre"),
      supabase.from("declarations_paiement").select("cotisation_id, statut").eq("membre_id", membre.id).eq("statut", "en_attente"),
      supabase.from("integrations_paiement").select("actif").eq("organisation_id", membre.organisation_id).eq("fournisseur", "wave").maybeSingle(),
    ]);
    setCotisations(cot || []);
    setMoyens(moy || []);
    setDeclarations(decl || []);
    setWaveActif(Boolean(wave?.actif));
    setLoading(false);
  }

  useEffect(() => { charger(); }, [membre.id]);

  async function payerAvecWave(cotisation) {
    setWaveEnCours(cotisation.id);
    setWaveErreur("");

    const { data, error } = await supabase.functions.invoke("creer-session-wave", {
      body: {
        organisationId: membre.organisation_id,
        cotisationId: cotisation.id,
        origine: window.location.origin,
      },
    });

    if (error || !data?.wave_launch_url) {
      setWaveEnCours(null);
      setWaveErreur(data?.error || "Impossible de démarrer le paiement Wave pour le moment.");
      return;
    }

    window.location.href = data.wave_launch_url;
  }

  if (loading) return <div style={{ color: C.textSubtle }}>Chargement…</div>;

  const declarationEnAttentePour = (cotisationId) =>
    declarations.some((d) => d.cotisation_id === cotisationId);

  return (
    <div>
      <h2 style={titrePage}>Mes cotisations</h2>

      {moyens.length > 0 && <MoyensPaiementApercu moyens={moyens} />}

      {waveErreur && (
        <div style={{ background: C.dangerSoft, color: C.danger, borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 14 }}>
          {waveErreur}
        </div>
      )}

      {cotisations.length === 0 ? (
        <div style={carteVide}>Aucune cotisation pour le moment.</div>
      ) : (
        <div style={carteListe}>
          {cotisations.map((c, i) => {
            const st = c.statut === "paye"
              ? { bg: C.successSoft, fg: C.success, label: "Payé" }
              : c.statut === "partiel"
                ? { bg: C.warningSoft, fg: C.warning, label: "Partiel" }
                : { bg: C.dangerSoft, fg: C.danger, label: "En attente" };
            const enAttente = declarationEnAttentePour(c.id);

            return (
              <div
                key={c.id}
                style={{
                  padding: "14px 18px",
                  borderBottom: i < cotisations.length - 1
                    ? `1px solid ${C.border}` : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                      {formatPeriode(c.periode)}
                    </div>
                    <div style={{ fontSize: 12.5, color: C.textSubtle, marginTop: 2 }}>
                      {montant(c.montant_paye)} / {montant(c.montant_du)} FCFA
                    </div>
                  </div>
                  <span style={{ ...badge, background: st.bg, color: st.fg }}>
                    {st.label}
                  </span>
                </div>

                {c.statut !== "paye" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {waveActif && (
                      <button
                        onClick={() => payerAvecWave(c)}
                        disabled={waveEnCours === c.id}
                        style={{
                          background: C.primary, border: "none", color: "#fff",
                          borderRadius: 8, padding: "7px 13px", cursor: "pointer",
                          fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
                        }}
                      >
                        {waveEnCours === c.id ? "Redirection…" : "Payer avec Wave"}
                      </button>
                    )}

                    {moyens.length > 0 && (
                      enAttente ? (
                        <span style={{ fontSize: 12.5, color: C.textSubtle, alignSelf: "center" }}>
                          Déclaration envoyée, en attente de confirmation.
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeclarationOuverte(c)}
                          style={{
                            background: "none", border: `1.5px solid ${C.primary}`,
                            color: C.primary, borderRadius: 8, padding: "7px 13px", cursor: "pointer",
                            fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
                          }}
                        >
                          J'ai payé
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {declarationOuverte && (
        <DeclarationPaiementModal
          cotisation={declarationOuverte}
          membre={membre}
          moyens={moyens}
          onClose={() => setDeclarationOuverte(null)}
          onDone={() => { setDeclarationOuverte(null); charger(); }}
        />
      )}
    </div>
  );
}

// Récapitulatif compact des moyens de paiement de l'organisation, affiché
// en haut de l'écran — pour que le membre sache où envoyer l'argent avant
// même d'avoir besoin de déclarer un paiement.
function MoyensPaiementApercu({ moyens }) {
  const LABELS = { wave: "Wave", orange_money: "Orange Money", mtn_money: "MTN Money", moov_money: "Moov Money", autre: "Autre" };
  return (
    <div style={{ ...carteVide, textAlign: "left", padding: "14px 18px", marginBottom: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 10 }}>Comment payer</div>
      {moyens.map((m) => {
        const logoUrl = m.logo_chemin
          ? supabase.storage.from("qr-paiement").getPublicUrl(m.logo_chemin).data.publicUrl
          : null;
        const nom = m.libelle || LABELS[m.type] || m.type;

        return (
          <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
            {m.lien ? (
              <a href={m.lien} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                {logoUrl ? (
                  <img
                    src={logoUrl} alt={nom}
                    style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", cursor: "pointer", border: `1px solid ${C.border}` }}
                  />
                ) : (
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, cursor: "pointer",
                    background: C.primaryLight + "22", color: C.primary,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 13,
                  }}>
                    {(nom || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </a>
            ) : logoUrl ? (
              <img
                src={logoUrl} alt={nom}
                style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.border}` }}
              />
            ) : (
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: C.primaryLight + "22", color: C.primary,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 13,
              }}>
                {(nom || "?").charAt(0).toUpperCase()}
              </div>
            )}

            <div style={{ flex: 1, fontSize: 13, color: C.textMuted }}>
              <strong style={{ color: C.text }}>{nom}</strong>
              {m.numero && <div style={{ marginTop: 2 }}>{m.numero}</div>}
              {m.instructions && <div style={{ fontSize: 12.5, marginTop: 2 }}>{m.instructions}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Déclaration d'un paiement par le membre — ne crée jamais de paiement
// réel : seulement une demande que le Bureau confirme ou rejette dans
// "Paiements déclarés", exactement comme aujourd'hui pour un règlement
// signalé par un autre canal, sans la ressaisie manuelle.
function DeclarationPaiementModal({ cotisation, membre, moyens, onClose, onDone }) {
  const restant = (cotisation.montant_du || 0) - (cotisation.montant_paye || 0);
  const [moyenId, setMoyenId] = useState(moyens[0]?.id || "");
  const [montantSaisi, setMontantSaisi] = useState(String(restant));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function envoyer() {
    const m = parseInt(montantSaisi, 10);
    if (!m || m <= 0) { setErreur("Indiquez le montant payé."); return; }

    setEnCours(true);
    setErreur("");

    const { error } = await supabase.from("declarations_paiement").insert({
      organisation_id: membre.organisation_id,
      membre_id: membre.id,
      cotisation_id: cotisation.id,
      moyen_paiement_id: moyenId || null,
      montant: m,
      reference: reference.trim() || null,
      note: note.trim() || null,
    });

    setEnCours(false);

    if (error) { setErreur(error.message); return; }
    onDone();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,20,40,.5)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 420 }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>J'ai payé</h3>
        <p style={{ fontSize: 13, color: C.textSubtle, margin: "0 0 16px" }}>
          {formatPeriode(cotisation.periode)} — reste dû {montant(restant)} FCFA
        </p>

        {moyens.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: C.textMuted }}>Moyen utilisé</label>
            <select
              value={moyenId}
              onChange={(e) => setMoyenId(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "inherit", fontSize: 14 }}
            >
              {moyens.map((m) => (
                <option key={m.id} value={m.id}>{m.libelle || m.type}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: C.textMuted }}>Montant payé</label>
          <input
            type="number" value={montantSaisi} onChange={(e) => setMontantSaisi(e.target.value)}
            style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: C.textMuted }}>Référence — facultative</label>
          <input
            value={reference} onChange={(e) => setReference(e.target.value)}
            placeholder="Numéro de transaction, si vous l'avez"
            style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: C.textMuted }}>Note — facultative</label>
          <input
            value={note} onChange={(e) => setNote(e.target.value)}
            style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }}
          />
        </div>

        {erreur && (
          <div style={{ background: C.dangerSoft, color: C.danger, borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 14 }}>
            {erreur}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose} disabled={enCours}
            style={{ flex: 1, background: "#fff", border: `1.5px solid ${C.border}`, color: C.textMuted, borderRadius: 10, padding: "12px 0", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600 }}
          >
            Annuler
          </button>
          <button
            onClick={envoyer} disabled={enCours}
            style={{ flex: 2, background: C.primary, border: "none", color: "#fff", borderRadius: 10, padding: "12px 0", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600 }}
          >
            {enCours ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tombola du membre ---------------- */

function MembreTombola({ membre }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("tombola_tickets")
      .select("*")
      .eq("membre_id", membre.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTickets(data || []);
        setLoading(false);
      });
  }, [membre.id]);

  if (loading) return <div style={{ color: C.textSubtle }}>Chargement…</div>;

  return (
    <div>
      <h2 style={titrePage}>Mes tickets tombola</h2>

      {tickets.length === 0 ? (
        <div style={carteVide}>
          Aucun ticket pour le moment. Un ticket bonus vous est attribué
          automatiquement dès qu'une cotisation est réglée.
        </div>
      ) : (
        <div style={carteListe}>
          {tickets.map((t, i) => (
            <div
              key={t.id}
              style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "14px 18px",
                borderBottom: i < tickets.length - 1
                  ? `1px solid ${C.border}` : "none",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                  {t.type_ticket === "bonus" ? "Ticket bonus" : "Ticket acheté"}
                </div>
                <div style={{ fontSize: 12.5, color: C.textSubtle, marginTop: 2 }}>
                  Trimestre {t.trimestre}
                </div>
              </div>
              <span
                style={{
                  ...badge,
                  background: t.eligible_gain ? C.successSoft : C.dangerSoft,
                  color: t.eligible_gain ? C.success : C.danger,
                }}
              >
                {t.eligible_gain ? "Éligible" : "Non éligible"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Assemblées générales — vue membre ---------------- */

function MembreAssemblees({ membre }) {
  const { params } = useParametrage();
  const [assemblees, setAssemblees] = useState([]);
  const [presences, setPresences] = useState({});
  const [loading, setLoading] = useState(true);
  const [codeSaisi, setCodeSaisi] = useState({});
  const [enCours, setEnCours] = useState(null);
  const [messages, setMessages] = useState({});

  async function charger() {
    const [aRes, pRes] = await Promise.all([
      supabase.from("assemblees")
        .select("*")
        .eq("organisation_id", params.organisation_id)
        .order("date_prevue", { ascending: false }),
      supabase.from("assemblee_presences")
        .select("*")
        .eq("membre_id", membre.id),
    ]);
    setAssemblees(aRes.data || []);
    const map = {};
    (pRes.data || []).forEach((p) => { map[p.assemblee_id] = p; });
    setPresences(map);
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id, membre.id]);

  async function pointer(assembleeId) {
    const code = (codeSaisi[assembleeId] || "").trim();
    if (code.length !== 6) {
      setMessages((m) => ({ ...m, [assembleeId]: { type: "err", texte: "Le code comporte 6 chiffres." } }));
      return;
    }

    setEnCours(assembleeId);
    const { error } = await supabase.rpc("emarger_avec_code", {
      p_assemblee_id: assembleeId,
      p_code: code,
    });
    setEnCours(null);

    if (error) {
      setMessages((m) => ({ ...m, [assembleeId]: { type: "err", texte: error.message } }));
      return;
    }

    setMessages((m) => ({ ...m, [assembleeId]: { type: "ok", texte: "Présence enregistrée." } }));
    charger();
  }

  if (loading) return <div style={{ color: C.textSubtle }}>Chargement…</div>;

  return (
    <div>
      <h2 style={titrePage}>Assemblées générales</h2>

      {assemblees.length === 0 ? (
        <div style={carteVide}>Aucune assemblée générale annoncée pour le moment.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {assemblees.map((a) => {
            const presence = presences[a.id];
            const message = messages[a.id];
            const passee = new Date(a.date_prevue) < new Date();

            return (
              <div key={a.id} style={carteListe}>
                <div style={{ padding: "16px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: 15.5 }}>{a.titre}</div>
                    <span
                      style={{
                        ...badge,
                        background: presence?.present ? C.successSoft : C.warningSoft,
                        color: presence?.present ? C.success : C.warning,
                      }}
                    >
                      {presence?.present ? "Présence enregistrée" : "Non pointé"}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: C.textSubtle, marginTop: 4 }}>
                    {new Date(a.date_prevue).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}
                    {a.lieu ? ` · ${a.lieu}` : ""}
                  </div>

                  {a.ordre_du_jour && (
                    <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 10, whiteSpace: "pre-line", lineHeight: 1.6 }}>
                      {a.ordre_du_jour}
                    </div>
                  )}

                  {!presence?.present && !passee && (
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <input
                        value={codeSaisi[a.id] || ""}
                        onChange={(e) => setCodeSaisi((c) => ({ ...c, [a.id]: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                        placeholder="Code à 6 chiffres"
                        style={{
                          flex: 1, border: `1px solid ${C.border}`, borderRadius: R.md,
                          padding: "10px 12px", fontSize: 15, letterSpacing: "0.15em",
                          fontFamily: "'Inter', system-ui, sans-serif",
                        }}
                      />
                      <button
                        onClick={() => pointer(a.id)}
                        disabled={enCours === a.id}
                        style={{
                          background: C.primary, color: "#fff", border: "none",
                          borderRadius: R.md, padding: "10px 16px", fontWeight: 600,
                          fontSize: 13.5, cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif",
                          opacity: enCours === a.id ? 0.6 : 1,
                        }}
                      >
                        Pointer
                      </button>
                    </div>
                  )}

                  {message && (
                    <div
                      style={{
                        ...encart, marginTop: 10,
                        background: message.type === "ok" ? C.successSoft : C.dangerSoft,
                        color: message.type === "ok" ? C.success : C.danger,
                      }}
                    >
                      {message.texte}
                    </div>
                  )}

                  {a.statut === "cloturee" && (a.pv_texte || a.pv_url) && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>Procès-verbal</div>
                      {a.pv_texte && (
                        <div style={{ fontSize: 13.5, color: C.textMuted, whiteSpace: "pre-line", lineHeight: 1.6 }}>
                          {a.pv_texte}
                        </div>
                      )}
                      {a.pv_url && (
                        <a href={a.pv_url} target="_blank" rel="noreferrer" style={{ color: C.primary, fontSize: 13.5, fontWeight: 600 }}>
                          Voir le document joint
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Tontine — vue membre ---------------- */

function MembreTontine({ membre }) {
  const { params } = useParametrage();
  const [tontine, setTontine] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [tours, setTours] = useState([]);
  const [versements, setVersements] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.organisation_id) return;
    (async () => {
      const { data: tData } = await supabase
        .from("tontines")
        .select("*")
        .eq("organisation_id", params.organisation_id)
        .eq("statut", "en_cours")
        .maybeSingle();

      if (!tData) { setLoading(false); return; }
      setTontine(tData);

      const [pRes, tRes] = await Promise.all([
        supabase.from("tontine_participants").select("*, membres(nom)").eq("tontine_id", tData.id).order("rang"),
        supabase.from("tontine_tours").select("*, membres:beneficiaire_membre_id(nom)").eq("tontine_id", tData.id).order("numero_tour"),
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
      }

      setLoading(false);
    })();
  }, [params.organisation_id]);

  if (loading) return <div style={{ color: C.textSubtle }}>Chargement…</div>;

  if (!tontine) {
    return (
      <div>
        <h2 style={titrePage}>Tontine</h2>
        <div style={carteVide}>Aucune tontine en cours pour le moment.</div>
      </div>
    );
  }

  const monRang = participants.find((p) => p.membre_id === membre.id)?.rang;
  const tourActuel = tours.find((t) => t.statut === "en_cours");
  const jaiVerse = tourActuel && !!versements[membre.id];

  return (
    <div>
      <h2 style={titrePage}>{tontine.titre}</h2>

      <div style={carteVide}>
        <div style={{ fontSize: 14, color: C.text, marginBottom: 6 }}>
          {tontine.montant_part.toLocaleString("fr-FR")} FCFA par tour
          {monRang && <> · votre position : {monRang}ᵉ</>}
        </div>
      </div>

      {tourActuel && (
        <div style={{ ...carteListe, marginTop: 14, padding: "16px 18px" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Tour {tourActuel.numero_tour}</div>
          <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 4 }}>
            Bénéficiaire : {tourActuel.membres?.nom}
          </div>
          <span
            style={{
              ...badge, marginTop: 10, display: "inline-flex",
              background: jaiVerse ? C.successSoft : C.warningSoft,
              color: jaiVerse ? C.success : C.warning,
            }}
          >
            {jaiVerse ? "Votre part est versée" : "Votre part n'est pas encore enregistrée"}
          </span>
        </div>
      )}

      <div style={{ ...carteListe, marginTop: 14 }}>
        {tours.map((t, i) => (
          <div
            key={t.id}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 18px",
              borderBottom: i < tours.length - 1 ? `1px solid ${C.border}` : "none",
            }}
          >
            <div style={{ fontSize: 13.5 }}>
              <strong>{t.numero_tour}.</strong> {t.membres?.nom}
            </div>
            <span style={{ fontSize: 12, color: t.statut === "cloture" ? C.success : t.statut === "en_cours" ? C.primary : C.textSubtle, fontWeight: 600 }}>
              {t.statut === "cloture" ? "Perçu" : t.statut === "en_cours" ? "En cours" : "À venir"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Prêts — vue membre ---------------- */

function MembrePrets({ membre }) {
  const { params } = useParametrage();
  const [prets, setPrets] = useState([]);
  const [types, setTypes] = useState([]);
  const [echeances, setEcheances] = useState({});
  const [loading, setLoading] = useState(true);
  const [demande, setDemande] = useState(false);
  const [typeChoisi, setTypeChoisi] = useState(null);
  const [montant, setMontant] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function charger() {
    setLoading(true);
    const [pRes, tRes] = await Promise.all([
      supabase.from("prets").select("*").eq("membre_id", membre.id).order("demande_le", { ascending: false }),
      supabase.from("types_pret").select("*").eq("organisation_id", params.organisation_id).eq("actif", true).order("ordre"),
    ]);
    setPrets(pRes.data || []);
    setTypes(tRes.data || []);

    const enCoursIds = (pRes.data || []).filter((p) => p.statut === "approuve").map((p) => p.id);
    if (enCoursIds.length > 0) {
      const { data: eData } = await supabase.from("pret_echeances").select("*").in("pret_id", enCoursIds).order("numero_echeance");
      const map = {};
      (eData || []).forEach((e) => { (map[e.pret_id] ||= []).push(e); });
      setEcheances(map);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id, membre.id]);

  async function soumettre() {
    if (!typeChoisi) { setErreur("Choisissez un type de prêt."); return; }
    if (!montant || Number(montant) <= 0) { setErreur("Montant invalide."); return; }
    if (typeChoisi.plafond_montant && Number(montant) > typeChoisi.plafond_montant) {
      setErreur(`Ce type de prêt est plafonné à ${typeChoisi.plafond_montant.toLocaleString("fr-FR")} FCFA.`);
      return;
    }

    setEnvoi(true);
    setErreur("");

    const { error } = await supabase.from("prets").insert({
      organisation_id: params.organisation_id,
      membre_id: membre.id,
      type_pret_id: typeChoisi.id,
      libelle_type: typeChoisi.libelle,
      taux_interet_pct: typeChoisi.taux_interet_pct,
      mode_remboursement: typeChoisi.mode_remboursement,
      nombre_echeances: typeChoisi.mode_remboursement === "echelonne" ? typeChoisi.nombre_echeances : 1,
      montant_principal: Number(montant),
      statut: "en_attente",
      initiee_par: "membre",
    });

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }
    setDemande(false);
    setTypeChoisi(null);
    setMontant("");
    charger();
  }

  if (loading) return <div style={{ color: C.textSubtle }}>Chargement…</div>;

  if (demande) {
    return (
      <div>
        <button style={lienRetour} onClick={() => setDemande(false)}>‹ Annuler</button>
        <h2 style={titrePage}>Demander un prêt</h2>

        {types.length === 0 ? (
          <div style={carteVide}>Aucun type de prêt n'est disponible pour le moment.</div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTypeChoisi(t)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    border: `1px solid ${typeChoisi?.id === t.id ? C.primary : C.border}`,
                    background: typeChoisi?.id === t.id ? PALETTE.blue100 : C.surface,
                    borderRadius: R.md, padding: "12px 14px", cursor: "pointer",
                    fontFamily: "'Inter', system-ui, sans-serif", textAlign: "left",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{t.libelle}</span>
                  <span style={{ fontSize: 12, color: C.textSubtle }}>
                    {t.taux_interet_pct}% · {t.mode_remboursement === "unique" ? "en une fois" : `${t.nombre_echeances} échéances`}
                  </span>
                </button>
              ))}
            </div>

            <label style={{ fontSize: 12.5, fontWeight: 600, color: C.textMuted }}>Montant souhaité (FCFA)</label>
            <input
              type="number" min={1} value={montant} onChange={(e) => setMontant(e.target.value)}
              style={{
                width: "100%", border: `1px solid ${C.border}`, borderRadius: R.md, padding: "10px 12px",
                fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, boxSizing: "border-box", marginTop: 6, marginBottom: 14,
              }}
            />

            {erreur && (
              <div style={{ ...encart, background: C.dangerSoft, color: C.danger, marginBottom: 12 }}>{erreur}</div>
            )}

            <button
              onClick={soumettre} disabled={envoi}
              style={{
                width: "100%", background: C.primary, color: "#fff", border: "none",
                borderRadius: R.md, padding: "13px", fontWeight: 600, fontSize: 14.5,
                cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif", opacity: envoi ? 0.6 : 1,
              }}
            >
              {envoi ? "Envoi…" : "Soumettre la demande"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ ...titrePage, margin: 0 }}>Mes prêts</h2>
        <button
          onClick={() => setDemande(true)}
          style={{
            background: C.primary, color: "#fff", border: "none", borderRadius: R.md,
            padding: "9px 15px", fontWeight: 600, fontSize: 13, cursor: "pointer",
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          Demander
        </button>
      </div>

      {prets.length === 0 ? (
        <div style={carteVide}>Vous n'avez aucune demande de prêt pour le moment.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {prets.map((p) => {
            const couleurs = {
              en_attente: { bg: C.warningSoft, fg: C.warning, label: "En attente" },
              approuve:   { bg: PALETTE.blue100, fg: C.primary, label: "En cours" },
              solde:      { bg: C.successSoft, fg: C.success, label: "Soldé" },
              rejete:     { bg: C.dangerSoft, fg: C.danger, label: "Rejeté" },
            }[p.statut];

            return (
              <div key={p.id} style={carteListe}>
                <div style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.libelle_type}</div>
                    <span style={{ ...badge, background: couleurs.bg, color: couleurs.fg }}>{couleurs.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.textSubtle, marginTop: 4 }}>
                    {p.montant_principal.toLocaleString("fr-FR")} FCFA
                    {p.taux_interet_pct > 0 && ` + ${p.taux_interet_pct}% d'intérêt`}
                    {" · total "}{p.montant_total_a_rembourser.toLocaleString("fr-FR")} FCFA
                  </div>

                  {p.statut === "rejete" && p.motif_rejet && (
                    <div style={{ ...encart, marginTop: 10, background: C.dangerSoft, color: C.danger }}>
                      {p.motif_rejet}
                    </div>
                  )}

                  {p.statut === "approuve" && echeances[p.id] && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                      {echeances[p.id].map((e) => (
                        <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                          <span>Échéance {e.numero_echeance} — {new Date(e.date_prevue).toLocaleDateString("fr-FR")}</span>
                          <span style={{ color: e.montant_paye ? C.success : C.textSubtle, fontWeight: 600 }}>
                            {e.montant_paye ? "Réglée" : "En attente"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Aides — vue administrateur ---------------- */

const STATUTS_AIDE = ["en_attente", "en_examen", "validee", "payee", "rejetee"];

const LIBELLES_STATUT = {
  en_attente: "En attente",
  en_examen: "En examen",
  validee: "Validée",
  payee: "Payée",
  rejetee: "Rejetée",
};

const COULEURS_STATUT = {
  en_attente: C.textMuted,
  en_examen: C.warning,
  validee: C.success,
  payee: C.success,
  rejetee: C.danger,
};

function AidesAdminPage() {
  const { params } = useParametrage();
  const [aides, setAides] = useState([]);
  const [membres, setMembres] = useState({});
  const [bareme, setBareme] = useState({});
  const [controles, setControles] = useState({});
  const [decision, setDecision] = useState(null);
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState("");
  const [loading, setLoading] = useState(true);

  async function charger() {
    const [aidesRes, membresRes, baremeRes] = await Promise.all([
      supabase.from("aides_sociales").select("*")
        .eq("organisation_id", params.organisation_id)
        .order("created_at", { ascending: false }),
      supabase.from("membres").select("id, nom")
        .eq("organisation_id", params.organisation_id),
      supabase.from("bareme_prestations").select("*")
        .eq("organisation_id", params.organisation_id),
    ]);

    const listeAides = aidesRes.data || [];

    const mapMembres = {};
    (membresRes.data || []).forEach((x) => { mapMembres[x.id] = x; });

    const mapBareme = {};
    (baremeRes.data || []).forEach((b) => { mapBareme[b.type_aide] = b; });

    setAides(listeAides);
    setMembres(mapMembres);
    setBareme(mapBareme);
    setLoading(false);

    // Contrôle de conformité, limité aux dossiers encore ouverts
    const aInstruire = listeAides.filter(
      (a) => a.statut === "en_attente" || a.statut === "en_examen"
    );

    const resultats = await Promise.all(
      aInstruire.map((a) =>
        supabase
          .rpc("verifier_eligibilite_prestation", {
            p_membre_id: a.membre_id,
            p_type_aide: a.type_aide,
            p_date: String(a.created_at).slice(0, 10),
          })
          .then(({ data }) => ({ id: a.id, resultat: data?.[0] || null }))
      )
    );

    const mapControles = {};
    resultats.forEach((r) => { mapControles[r.id] = r.resultat; });
    setControles(mapControles);
  }

  useEffect(() => { charger(); }, []);

  function choisirStatut(aide, statut) {
    setErreur("");

    if (statut === "validee" || statut === "payee" || statut === "rejetee") {
      const prevu = controles[aide.id]?.montant_prevu
        ?? bareme[aide.type_aide]?.montant_membre
        ?? aide.montant_demande
        ?? 0;

      setDecision({
        id: aide.id,
        statut,
        montant: statut === "rejetee" ? "" : String(prevu || ""),
        motif: "",
      });
      return;
    }

    enregistrerStatut(aide.id, statut, {});
  }

  async function enregistrerStatut(id, statut, complements) {
    setEnregistre(true);
    setErreur("");

    const maj = {
      statut,
      decide_le: new Date().toISOString(),
      ...complements,
    };

    const cible = aides.find((a) => a.id === id);

    const { error } = await supabase.from("aides_sociales").update(maj).eq("id", id);

    setEnregistre(false);

    if (error) { setErreur(error.message); return; }

    setAides((liste) => liste.map((x) => (x.id === id ? { ...x, ...maj } : x)));
    setDecision(null);

    // Traçabilité : tout changement de statut, et séparément le montant
    // lorsqu'il est arrêté à la validation
    consigner(EVENEMENTS.AIDE_STATUT_MODIFIE, {
      membre_id: cible?.membre_id,
      organisation_id: cible?.organisation_id,
      aide_id: id,
      statut,
    });
    if (complements.montant_valide) {
      consigner(EVENEMENTS.AIDE_MONTANT_VALIDE, {
        membre_id: cible?.membre_id,
        organisation_id: cible?.organisation_id,
        aide_id: id,
        montant: complements.montant_valide,
      });
    }
  }

  function confirmerDecision() {
    if (decision.statut === "rejetee") {
      if (!decision.motif.trim()) {
        setErreur("Indiquez le motif du rejet, il sera visible par le membre.");
        return;
      }
      enregistrerStatut(decision.id, decision.statut, {
        motif_rejet: decision.motif.trim(),
      });
      return;
    }

    enregistrerStatut(decision.id, decision.statut, {
      montant_valide: parseInt(decision.montant, 10) || 0,
    });
  }

  if (loading) {
    return <div style={{ padding: 28, color: C.textSubtle }}>Chargement…</div>;
  }

  return (
    <div style={{ padding: 28 }}>
      {erreur && (
        <div style={{
          background: C.dangerSoft, color: C.danger,
          border: `1px solid ${C.danger}33`, borderRadius: R.md,
          padding: "12px 15px", fontSize: 13.5, marginBottom: 16,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}>
          {erreur}
        </div>
      )}

      {aides.length === 0 ? (
        <div style={carteVide}>Aucune demande d'aide pour le moment.</div>
      ) : (
        <div style={carteListe}>
          {aides.map((a, i) => {
            const ligne = bareme[a.type_aide];
            const controle = controles[a.id];
            const ouvert = a.statut === "en_attente" || a.statut === "en_examen";
            const enDecision = decision?.id === a.id;

            const montantPrevu = controle?.montant_prevu
              ?? ligne?.montant_membre
              ?? null;

            return (
              <div
                key={a.id}
                style={{
                  padding: "18px 20px",
                  borderBottom: i < aides.length - 1 ? `1px solid ${C.border}` : "none",
                }}
              >
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", gap: 16, flexWrap: "wrap",
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>
                      {membres[a.membre_id]?.nom || "—"}
                    </div>

                    <div style={{ fontSize: 13, color: C.textSubtle, marginTop: 3 }}>
                      {ligne ? ligne.libelle : a.type_aide}
                      {ligne?.article ? ` · ${ligne.article}` : ""}
                      {" · "}
                      {new Date(a.created_at).toLocaleDateString("fr-FR")}
                    </div>

                    {ligne && ligne.actif === false && (
                      <div style={{ ...encart, background: C.warningSoft, color: "#B45309" }}>
                        Catégorie hors règlement intérieur — demande antérieure à la mise
                        en conformité.
                      </div>
                    )}

                    {a.description && (
                      <div style={{
                        fontSize: 13.5, color: C.textMuted,
                        marginTop: 8, lineHeight: 1.5,
                      }}>
                        {a.description}
                      </div>
                    )}

                    {ouvert && controle && (
                      <div style={{
                        ...encart,
                        background: controle.eligible ? C.successSoft : C.dangerSoft,
                        color: controle.eligible ? C.success : C.danger,
                      }}>
                        {controle.eligible ? (
                          <>Conditions remplies au dépôt (articles 18 et 34).</>
                        ) : (
                          <>
                            <strong>Conditions non remplies : </strong>
                            {controle.motif}
                            {controle.periodes_dues?.length > 0 && (
                              <> Cotisations dues : {controle.periodes_dues
                                .map(formatPeriode).join(", ")}.</>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 10 }}>
                      {montantPrevu !== null && (
                        <span style={{ fontSize: 13.5, color: C.textSubtle }}>
                          Prévu par les textes :{" "}
                          <strong style={{ color: C.text }}>
                            {montant(montantPrevu)} FCFA
                          </strong>
                        </span>
                      )}
                      {ligne?.montant_don > 0 && (
                        <span style={{ fontSize: 13.5, color: C.textSubtle }}>
                          Don à la famille :{" "}
                          <strong style={{ color: C.text }}>
                            {montant(ligne.montant_don)} FCFA
                          </strong>
                        </span>
                      )}
                      {a.montant_valide ? (
                        <span style={{ fontSize: 13.5, color: C.textSubtle }}>
                          Accordé :{" "}
                          <strong style={{ color: C.success }}>
                            {montant(a.montant_valide)} FCFA
                          </strong>
                        </span>
                      ) : null}
                    </div>

                    {a.motif_rejet && (
                      <div style={{ ...encart, background: C.dangerSoft, color: C.danger }}>
                        <strong>Motif du rejet : </strong>{a.motif_rejet}
                      </div>
                    )}
                  </div>

                  <select
                    value={a.statut}
                    onChange={(e) => choisirStatut(a, e.target.value)}
                    disabled={enregistre}
                    style={{
                      border: `1.5px solid ${COULEURS_STATUT[a.statut]}44`,
                      background: COULEURS_STATUT[a.statut] + "11",
                      color: COULEURS_STATUT[a.statut],
                      borderRadius: R.sm, padding: "8px 12px",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                      fontFamily: "inherit", outline: "none", flexShrink: 0,
                    }}
                  >
                    {STATUTS_AIDE.map((s) => (
                      <option key={s} value={s}>{LIBELLES_STATUT[s]}</option>
                    ))}
                  </select>
                </div>

                {enDecision && (
                  <div style={panneauDecision}>
                    {decision.statut === "rejetee" ? (
                      <>
                        <label style={etiquette} htmlFor={`motif-${a.id}`}>
                          Motif du rejet — il sera lu par le membre
                        </label>
                        <textarea
                          id={`motif-${a.id}`}
                          rows={3}
                          value={decision.motif}
                          onChange={(e) =>
                            setDecision((d) => ({ ...d, motif: e.target.value }))}
                          placeholder="Expliquez la décision du Bureau…"
                          style={champ}
                        />
                      </>
                    ) : (
                      <>
                        <label style={etiquette} htmlFor={`montant-${a.id}`}>
                          Montant accordé
                          {montantPrevu !== null && (
                            <span style={{ fontWeight: 400, color: C.textSubtle }}>
                              {" "}— {montant(montantPrevu)} FCFA prévus par
                              {ligne?.article ? ` ${ligne.article}` : " les textes"}
                            </span>
                          )}
                        </label>
                        <input
                          id={`montant-${a.id}`}
                          type="number"
                          value={decision.montant}
                          onChange={(e) =>
                            setDecision((d) => ({ ...d, montant: e.target.value }))}
                          style={champ}
                        />
                        {montantPrevu !== null &&
                          parseInt(decision.montant, 10) !== montantPrevu && (
                          <div style={{
                            fontSize: 12.5, color: "#B45309",
                            marginTop: 6, lineHeight: 1.5,
                          }}>
                            Ce montant s'écarte de celui prévu par le règlement intérieur.
                            L'écart devra être justifié devant l'Assemblée Générale.
                          </div>
                        )}
                      </>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                      <button
                        onClick={() => { setDecision(null); setErreur(""); }}
                        disabled={enregistre}
                        style={boutonSecondaire}
                      >
                        Annuler
                      </button>
                      <button
                        onClick={confirmerDecision}
                        disabled={enregistre}
                        style={boutonPrincipal}
                      >
                        {enregistre ? "Enregistrement…" : "Confirmer"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Styles partagés ---------------- */

const ecranAttente = {
  minHeight: "100vh", display: "flex", alignItems: "center",
  justifyContent: "center", background: C.bg, color: C.textSubtle,
  fontFamily: "'Inter', system-ui, sans-serif", fontSize: 15,
};

const ecranAttenteOrg = {
  minHeight: "100vh", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", textAlign: "center",
  background: C.bg, padding: "32px 24px",
  fontFamily: "'Inter', system-ui, sans-serif", color: C.text,
};

const messageAttente = {
  maxWidth: 520, margin: "48px auto", padding: "0 20px",
  textAlign: "center", color: C.textMuted, fontSize: 15, lineHeight: 1.6,
  fontFamily: "'Inter', system-ui, sans-serif",
};

const lienRetour = {
  background: "none", border: "none", color: C.primary,
  fontWeight: 600, fontSize: 14, cursor: "pointer",
  marginBottom: 20, display: "flex", alignItems: "center",
  gap: 6, padding: 0, fontFamily: "'Inter', system-ui, sans-serif",
};

const titrePage = {
  fontSize: 20, fontWeight: 700, color: C.text,
  letterSpacing: "-0.02em", margin: "0 0 16px",
  fontFamily: "'Inter', system-ui, sans-serif",
};

const carteListe = {
  background: C.surface, borderRadius: R.xl,
  border: `1px solid ${C.border}`, overflow: "hidden",
  boxShadow: SHADOW.xs, fontFamily: "'Inter', system-ui, sans-serif",
};

const carteVide = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: R.xl, padding: 44, textAlign: "center",
  color: C.textSubtle, fontSize: 14, lineHeight: 1.6,
  fontFamily: "'Inter', system-ui, sans-serif",
};

const badge = {
  fontSize: 12, fontWeight: 600, padding: "5px 12px",
  borderRadius: R.pill, flexShrink: 0, whiteSpace: "nowrap",
};

const encart = {
  marginTop: 10, borderRadius: R.md,
  padding: "9px 12px", fontSize: 13, lineHeight: 1.5,
};

const panneauDecision = {
  marginTop: 16, background: C.bg,
  border: `1px solid ${C.border}`, borderRadius: R.md,
  padding: "14px 16px",
};

const etiquette = {
  display: "block", fontSize: 13.5, fontWeight: 600,
  color: C.textMuted, marginBottom: 8,
};

const champ = {
  width: "100%", boxSizing: "border-box", padding: "11px 13px",
  border: `1.5px solid ${C.border}`, borderRadius: R.sm,
  background: C.surface, fontFamily: "inherit", fontSize: 14.5,
  color: C.text, outline: "none", lineHeight: 1.5, resize: "vertical",
};

const boutonPrincipal = {
  flex: 2, background: C.primary, color: "#fff", border: "none",
  borderRadius: R.sm, padding: "11px 18px", cursor: "pointer",
  fontFamily: "inherit", fontSize: 14, fontWeight: 600,
};

const boutonSecondaire = {
  flex: 1, background: C.surface, color: C.textMuted,
  border: `1.5px solid ${C.border}`, borderRadius: R.sm,
  padding: "11px 18px", cursor: "pointer",
  fontFamily: "inherit", fontSize: 14, fontWeight: 600,
};

/* ---------------- Utilitaires ---------------- */

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatPeriode(periode) {
  const mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const [annee, m] = String(periode).split("-");
  const index = parseInt(m, 10) - 1;
  return mois[index] ? `${mois[index]} ${annee}` : periode;
}

/* ---------------- Racine ---------------- */

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}