import React, { useMemo, useState } from "react";
import {
  LayoutGrid, FilePlus2, Users, Receipt, Wallet, HandHeart,
  Gift, Megaphone, Calendar, BarChart3, Settings, LogOut,
  Menu, X, ShieldAlert, ScrollText, UserCircle2, ArrowLeftRight,
  Scale, ChevronsUpDown, Check, Loader2, KeyRound, Users2, RefreshCw, Banknote,
  FileText, ShoppingCart,
} from "lucide-react";
import {
  useParametrage, moduleActif, LOGO_DEFAUT,
  mesOrganisationsAdministrees, changerOrganisationActive,
} from "./useParametrage";
import { usePermissions } from "./usePermissions";
import { useVocabulaire } from "./useVocabulaire";
import { C, R, S, SHADOW, PALETTE } from "./theme";

/* ============================================================
   Structure du menu

   Un libellé peut être une chaîne fixe (« Comptabilité » se dit
   pareil partout) ou une fonction du vocabulaire de l'organisation
   (« Membres » devient « Bénéficiaires » pour une ONG). Les
   identifiants et les modules, eux, ne varient jamais : c'est sur eux
   seuls que reposent ADMIN_PAGES et PAGES_MODULES, qui restent donc
   calculables une fois pour toutes, hors de tout composant.

   Une entrée sans « module » appartient au socle et reste présente
   dans toute organisation.
   ============================================================ */

export const NAV_GROUPS = [
  {
    titre: "Pilotage",
    items: [
      { id: "dashboard", label: "Tableau de bord", icon: LayoutGrid },
      { id: "rapports",  label: "Rapports",        icon: BarChart3 },
    ],
  },
  {
    titre: (mot) => mot("membres"),
    items: [
      { id: "adhesions", label: (mot) => mot("adhesions"), icon: FilePlus2 },
      { id: "membres",   label: (mot) => mot("membres"),   icon: Users },
    ],
  },
  {
    titre: "Finances",
    items: [
      { id: "cotisations",  label: (mot) => mot("cotisations"), icon: Receipt },
      { id: "operations",   label: "Opérations diverses",       icon: ArrowLeftRight },
      { id: "comptabilite", label: "Comptabilité",              icon: Wallet },
    ],
  },
  {
    titre: "Activités",
    items: [
      // Les aides ne font plus partie du socle : une ONG ou une
      // fédération qui n'en distribue pas ne voit ni l'instruction des
      // demandes, ni le barème.
      { id: "aides_admin", label: (mot) => mot("aides"),  icon: HandHeart, module: "module_aides" },
      { id: "bareme",      label: (mot) => mot("bareme"), icon: Scale,     module: "module_aides" },
      { id: "tombola",     label: "Tombola",          icon: Gift,        module: "module_tombola" },
      { id: "tontine",     label: "Tontine",          icon: RefreshCw,   module: "module_tontine" },
      { id: "prets",       label: "Prêts et avances", icon: Banknote,    module: "module_prets" },
      { id: "sanctions",   label: "Sanctions",        icon: ShieldAlert, module: "module_sanctions" },
      { id: "activite_eco", label: "Activité économique", icon: ShoppingCart, module: "module_activites_economiques" },
    ],
  },
  {
    titre: (mot) => `Vie ${mot("organisation_de")}`,
    items: [
      { id: "communication", label: "Communications", icon: Megaphone },
      { id: "agenda",        label: "Agenda",         icon: Calendar },
      { id: "assemblees",    label: (mot) => mot("assemblees"), icon: Users2, module: "module_assemblees" },
      { id: "documents",     label: "Documents", icon: FileText, module: "module_documents" },
    ],
  },
  {
    titre: "Système",
    items: [
      { id: "journal",     label: "Journal d'activité",             icon: ScrollText },
      { id: "roles",       label: (mot) => `Rôles ${mot("bureau_du")}`, icon: KeyRound },
      { id: "parametrage", label: "Paramètres",                     icon: Settings },
    ],
  },
];

// Toutes les pages existantes, modules compris : sert à reconnaître un
// identifiant de page valide, indépendamment de son activation.
export const ADMIN_PAGES = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));

// Pages relevant d'un module, avec le module dont elles dépendent
export const PAGES_MODULES = Object.fromEntries(
  NAV_GROUPS.flatMap((g) =>
    g.items.filter((i) => i.module).map((i) => [i.id, i.module])
  )
);

// Un libellé de menu est soit une chaîne, soit une fonction du
// vocabulaire. Cette fonction résout l'un comme l'autre.
function resoudre(valeur, mot) {
  return typeof valeur === "function" ? valeur(mot) : valeur;
}

// Sous-titre affiché sous le titre de chaque écran. Construit à partir
// du vocabulaire, donc recalculé quand le type d'organisation change.
function sousTitresPour(mot) {
  return {
    dashboard:     `Vue d'ensemble ${mot("organisation_de")}`,
    rapports:      "Générer et télécharger les rapports",
    adhesions:     "Demandes en attente de validation",
    membres:       "Annuaire et fiches individuelles",
    cotisations:   "Suivi des échéances et paiements",
    operations:    `Dons, subventions et frais ${mot("organisation_de")}`,
    comptabilite:  "Entrées, sorties et balance",
    aides_admin:   `Instruction des demandes (${mot("aides").toLowerCase()})`,
    bareme:        "Montants prévus par vos textes",
    tombola:       "Tickets et tirages trimestriels",
    activite_eco:  "Achats, ventes et suivi du stock",
    tontine:       "Cycles, ordre de passage et versements",
    prets:         "Demandes, échéances et remboursements",
    assemblees:    "Convocations, émargement et procès-verbaux",
    documents:     `Statuts, rapports et formulaires ${mot("organisation_de")}`,
    communication: `Communiqués aux ${mot("membres").toLowerCase()}`,
    agenda:        "Échéances et événements",
    parametrage:   "Configuration de la plateforme",
    journal:       "Connexions et actions sensibles",
    roles:         `Qui fait quoi dans ${mot("bureau_le")}`,
    sanctions:     "Suivi des sanctions d'accès",
  };
}

export default function AdminLayout({ page, onPage, onSignOut, onEspaceMembre, children }) {
  const { params } = useParametrage();
  const { peut, loading: permissionsEnCours } = usePermissions();
  const { mot } = useVocabulaire();
  const [open, setOpen] = useState(false);
  const [mesOrgs, setMesOrgs] = useState([]);
  const [selecteurOuvert, setSelecteurOuvert] = useState(false);
  const [changement, setChangement] = useState(null);

  React.useEffect(() => {
    mesOrganisationsAdministrees().then(setMesOrgs);
  }, []);

  const naviguer = (id) => { onPage(id); setOpen(false); };

  function ouvrirEspaceMembre() {
    setOpen(false);
    onEspaceMembre();
  }

  async function choisirOrganisation(id) {
    if (id === params.organisation_id) { setSelecteurOuvert(false); return; }
    setChangement(id);
    await changerOrganisationActive(id);
    setChangement(null);
    setSelecteurOuvert(false);
    setOpen(false);
  }

  // Une entrée disparaît si son module est désactivé, ou si la personne
  // n'a pas la permission correspondante. Le temps du chargement, on
  // n'affiche rien plutôt qu'un menu complet qui se réduirait ensuite.
  // Les libellés sont résolus ici, une fois le vocabulaire connu.
  const groupesVisibles = useMemo(() => (
    permissionsEnCours ? [] : NAV_GROUPS
      .map((groupe) => ({
        titre: resoudre(groupe.titre, mot),
        items: groupe.items
          .filter(
            (item) =>
              (!item.module || moduleActif(params, item.module)) &&
              peut(item.id)
          )
          .map((item) => ({ ...item, label: resoudre(item.label, mot) })),
      }))
      .filter((groupe) => groupe.items.length > 0)
  ), [permissionsEnCours, params, peut, mot]);

  // Titre de l'écran courant : même source que le menu, pour qu'un
  // libellé ne puisse jamais différer entre la barre latérale et l'en-tête.
  const titres = useMemo(() => Object.fromEntries(
    NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.id, resoudre(i.label, mot)]))
  ), [mot]);

  const sousTitres = useMemo(() => sousTitresPour(mot), [mot]);

  return (
    <div className="admin-shell">
      <style>{CSS}</style>

      {/* ---- Voile mobile ---- */}
      {open && <div className="admin-scrim" onClick={() => setOpen(false)} />}

      {/* ---- Barre latérale ---- */}
      <aside className={`admin-side ${open ? "is-open" : ""}`}>
        <div className="side-brand">
          <img
            src={params.logo_url || LOGO_DEFAUT}
            alt={`Logo ${params.nom_mutuelle}`}
            className="side-logo"
            onError={(e) => { e.currentTarget.src = LOGO_DEFAUT; }}
          />
          <div className="side-brand-text">
            <div className="side-name">{params.nom_mutuelle}</div>
            <div className="side-role">Administration</div>
          </div>
          <button className="side-close" onClick={() => setOpen(false)} aria-label="Fermer le menu">
            <X size={20} />
          </button>
        </div>

        {/* Un compte qui administre plusieurs organisations doit pouvoir
            choisir laquelle il regarde — invisible pour les autres. */}
        {mesOrgs.length > 1 && (
          <div className="side-selecteur-zone">
            <button
              className="side-selecteur"
              onClick={() => setSelecteurOuvert((v) => !v)}
            >
              <span>{mot("changer_organisation")}</span>
              <ChevronsUpDown size={14} />
            </button>

            {selecteurOuvert && (
              <ul className="side-orgs">
                {mesOrgs.map((o) => {
                  const active = o.organisation_id === params.organisation_id;
                  const enCours = changement === o.organisation_id;
                  return (
                    <li key={o.organisation_id}>
                      <button
                        className={`side-org ${active ? "is-active" : ""}`}
                        onClick={() => choisirOrganisation(o.organisation_id)}
                        disabled={enCours}
                      >
                        <span className="side-org-nom">{o.sigle || o.nom}</span>
                        {enCours
                          ? <Loader2 size={14} className="side-org-spin" />
                          : active && <Check size={14} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <nav className="side-nav">
          {groupesVisibles.map((groupe) => (
            <div key={groupe.titre} className="nav-group">
              <div className="nav-group-title">{groupe.titre}</div>
              {groupe.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${page === item.id ? "is-active" : ""}`}
                  onClick={() => naviguer(item.id)}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="side-foot">
          {/* Les membres du Bureau sont d'abord des adhérents : ils peuvent
              rejoindre leur espace personnel sans se déconnecter. */}
          {onEspaceMembre && (
            <button className="side-espace" onClick={ouvrirEspaceMembre}>
              <UserCircle2 size={17} /> {mot("espace_membre")}
            </button>
          )}

          <button className="side-logout" onClick={onSignOut}>
            <LogOut size={17} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* ---- Zone principale ---- */}
      <div className="admin-main">
        <header className="admin-head">
          <button className="burger" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Menu size={22} />
          </button>
          <div className="head-text">
            <h1 className="head-title">{titres[page] || "Administration"}</h1>
            <p className="head-sub">{sousTitres[page] || ""}</p>
          </div>
        </header>

        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}

const CSS = `
.admin-shell{
  min-height:100vh; display:flex; background:${C.bg};
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}

/* ---- Voile ---- */
.admin-scrim{
  position:fixed; inset:0; background:rgba(10,20,40,.45);
  z-index:60; animation:fade .18s ease;
}
@media (min-width:1024px){ .admin-scrim{ display:none; } }

/* ---- Barre latérale ---- */
.admin-side{
  position:fixed; inset:0 auto 0 0; z-index:70;
  width:264px; display:flex; flex-direction:column;
  background:linear-gradient(180deg, ${PALETTE.blue900} 0%, ${PALETTE.blue800} 100%);
  color:#fff; transform:translateX(-100%);
  transition:transform .26s cubic-bezier(.4,0,.2,1);
}
.admin-side.is-open{ transform:none; }
@media (min-width:1024px){
  .admin-side{ position:sticky; height:100vh; transform:none; flex-shrink:0; }
}

.side-brand{
  display:flex; align-items:center; gap:11px;
  padding:${S.lg}px ${S.lg}px ${S.md}px;
  border-bottom:1px solid rgba(255,255,255,.1);
}
.side-logo{
  width:40px; height:40px; object-fit:contain; flex-shrink:0;
  background:#fff; border-radius:${R.sm}px; padding:4px;
}
.side-brand-text{ flex:1; min-width:0; }
.side-name{
  font-size:17px; font-weight:700; letter-spacing:.02em; line-height:1.15;
  overflow-wrap:anywhere;
}
.side-role{ font-size:12px; opacity:.65; }

/* ---- Sélecteur d'organisation ---- */
.side-selecteur-zone{ position:relative; padding:0 ${S.lg}px ${S.md}px; }
.side-selecteur{
  display:flex; align-items:center; justify-content:space-between; gap:8px;
  width:100%; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.14);
  color:rgba(255,255,255,.85); border-radius:${R.sm}px; padding:8px 11px;
  cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:600;
}
.side-selecteur:hover{ background:rgba(255,255,255,.13); }
.side-orgs{
  list-style:none; margin:6px 0 0; padding:5px;
  background:${PALETTE.blue900}; border:1px solid rgba(255,255,255,.16);
  border-radius:${R.md}px; box-shadow:${SHADOW.lg};
  position:absolute; left:${S.lg}px; right:${S.lg}px; z-index:80;
}
.side-org{
  display:flex; align-items:center; justify-content:space-between; gap:8px;
  width:100%; background:none; border:none; cursor:pointer;
  padding:9px 10px; border-radius:${R.sm}px;
  font-family:inherit; font-size:13px; color:rgba(255,255,255,.8);
}
.side-org:hover:not(:disabled){ background:rgba(255,255,255,.1); color:#fff; }
.side-org.is-active{ color:#fff; font-weight:600; }
.side-org:disabled{ opacity:.6; cursor:not-allowed; }
.side-org-nom{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.side-org-spin{ animation:sideOrgSpin 1s linear infinite; flex-shrink:0; }
@keyframes sideOrgSpin{ to{ transform:rotate(360deg); } }
.side-close{
  background:none; border:none; color:#fff; cursor:pointer;
  padding:4px; opacity:.75; flex-shrink:0;
}
@media (min-width:1024px){ .side-close{ display:none; } }

.side-nav{ flex:1; overflow-y:auto; padding:${S.md}px ${S.md}px ${S.lg}px; }
.side-nav::-webkit-scrollbar{ width:4px; }
.side-nav::-webkit-scrollbar-thumb{ background:rgba(255,255,255,.16); border-radius:4px; }

.nav-group{ margin-bottom:${S.lg}px; }
.nav-group-title{
  font-size:10.5px; font-weight:600; letter-spacing:.1em;
  text-transform:uppercase; opacity:.45;
  padding:0 ${S.md}px; margin-bottom:6px;
}
.nav-item{
  display:flex; align-items:center; gap:11px; width:100%;
  background:none; border:none; cursor:pointer;
  padding:10px ${S.md}px; border-radius:${R.sm}px; margin-bottom:2px;
  font-family:inherit; font-size:14px; font-weight:500;
  color:rgba(255,255,255,.72); text-align:left;
  position:relative; transition:background .16s ease, color .16s ease;
}
.nav-item:hover{ background:rgba(255,255,255,.08); color:#fff; }
.nav-item.is-active{
  background:rgba(255,255,255,.14); color:#fff; font-weight:600;
}
.nav-item.is-active::before{
  content:""; position:absolute; left:0; top:8px; bottom:8px;
  width:3px; border-radius:0 3px 3px 0; background:${C.warning};
}

.side-foot{
  padding:${S.md}px; border-top:1px solid rgba(255,255,255,.1);
  display:flex; flex-direction:column; gap:${S.sm}px;
}
.side-espace{
  display:flex; align-items:center; justify-content:center; gap:8px; width:100%;
  background:${C.warning}; border:1px solid transparent;
  color:#fff; border-radius:${R.sm}px; padding:11px 0; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600;
  transition:background .16s ease;
}
.side-espace:hover{ background:#D97706; }
.side-logout{
  display:flex; align-items:center; justify-content:center; gap:8px; width:100%;
  background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.16);
  color:#fff; border-radius:${R.sm}px; padding:11px 0; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600;
  transition:background .16s ease;
}
.side-logout:hover{ background:rgba(255,255,255,.16); }

/* ---- Zone principale ---- */
.admin-main{ flex:1; min-width:0; display:flex; flex-direction:column; }
.admin-head{
  position:sticky; top:0; z-index:40;
  display:flex; align-items:center; gap:${S.md}px;
  background:${C.surface}; border-bottom:1px solid ${C.border};
  padding:${S.lg}px ${S.xl}px;
}
.burger{
  background:none; border:1px solid ${C.border}; border-radius:${R.sm}px;
  color:${C.textMuted}; cursor:pointer; padding:7px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
}
@media (min-width:1024px){ .burger{ display:none; } }
.head-text{ min-width:0; }
.head-title{
  font-size:22px; font-weight:700; letter-spacing:-.02em;
  margin:0; line-height:1.25;
}
.head-sub{ font-size:13.5px; color:${C.textSubtle}; margin:2px 0 0; }

.admin-content{ flex:1; }

@keyframes fade{ from{ opacity:0; } to{ opacity:1; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;