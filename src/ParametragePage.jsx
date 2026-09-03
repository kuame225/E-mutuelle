import React, { useEffect, useRef, useState } from "react";
import {
  Save, Loader2, CheckCircle2, AlertCircle, Building2, Receipt,
  Gift, ShieldAlert, Target, RotateCcw, Info, Image as ImageIcon,
  Upload, Trash2, Blocks, Check, ShieldCheck,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import {
  useParametrage, PARAMS_DEFAUT, LOGO_DEFAUT, MODULES, moduleActif, rafraichirIdentite,
} from "./useParametrage";
import { consigner, EVENEMENTS } from "./journal";
import { C, R, S, SHADOW, PALETTE } from "./theme";

const BUCKET_LOGOS = "logos-organisations";

export default function ParametragePage() {
  // L'organisation actuellement affichée, résolue par le sélecteur de la
  // barre latérale pour un compte qui en administre plusieurs.
  const { params: paramsActifs } = useParametrage();
  const orgId = paramsActifs.organisation_id;

  const [params, setParams] = useState(PARAMS_DEFAUT);
  const [initial, setInitial] = useState(PARAMS_DEFAUT);
  const [nbMembres, setNbMembres] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoEnCours, setLogoEnCours] = useState(false);
  const [succes, setSucces] = useState(false);
  const [erreur, setErreur] = useState("");
  const [slug, setSlug] = useState("");
  const [lienCopie, setLienCopie] = useState(false);
  const fichierRef = useRef(null);

  useEffect(() => {
    // L'organisation active n'est pas encore connue au tout premier rendu :
    // on attend qu'elle le soit plutôt que d'interroger sans filtre.
    if (!orgId) return;

    setLoading(true);
    Promise.all([
      supabase.from("parametrage").select("*").eq("organisation_id", orgId).maybeSingle(),
      supabase.from("membres").select("id", { count: "exact", head: true })
        .eq("organisation_id", orgId).eq("actif", true),
      // Le slug vit sur organisations, pas sur parametrage : c'est lui qui
      // permet de construire le lien propre à cette mutuelle.
      supabase.from("organisations").select("slug").eq("id", orgId).maybeSingle(),
    ]).then(([p, m, o]) => {
      const valeurs = p.data ? { ...PARAMS_DEFAUT, ...p.data } : { ...PARAMS_DEFAUT, organisation_id: orgId };
      setParams(valeurs);
      setInitial(valeurs);
      setNbMembres(m.count || 0);
      setSlug(o.data?.slug || "");
      setLoading(false);

      // Si le préfixe déjà enregistré ne correspond pas à ce que le sigle
      // donnerait automatiquement, il a été choisi volontairement — on ne
      // le resynchronisera jamais tout seul dans ce cas.
      if (valeurs.prefixe_matricule && valeurs.prefixe_matricule !== deriverPrefixe(valeurs.nom_mutuelle)) {
        prefixeToucheRef.current = true;
      }
    });
  }, [orgId]);


  const modifie = JSON.stringify(params) !== JSON.stringify(initial);

  function valider() {
    if (!params.nom_mutuelle?.trim()) return "Le sigle de la mutuelle est obligatoire.";
    if (params.nom_mutuelle.trim().length > 20)
      return "Le sigle doit rester court : 20 caractères au maximum.";
    if (!params.prefixe_matricule?.trim()) return "Le préfixe de matricule est obligatoire.";
    if (params.montant_cotisation < 100) return "La cotisation doit être d'au moins 100 FCFA.";
    if (params.droit_adhesion < 0) return "Le droit d'adhésion ne peut pas être négatif.";
    if (params.carence_mois < 0 || params.carence_mois > 24)
      return "Le délai de carence doit être compris entre 0 et 24 mois.";
    if (params.mois_a_jour_requis < 0 || params.mois_a_jour_requis > 24)
      return "Le nombre de mois à jour exigé doit être compris entre 0 et 24.";

    if (params.max_fractions < 1 || params.max_fractions > 4)
      return "Le nombre de versements doit être compris entre 1 et 4.";

    if (moduleActif(params, "module_tombola") && params.prix_ticket_tombola < 100)
      return "Le ticket de tombola doit coûter au moins 100 FCFA.";

    if (moduleActif(params, "module_sanctions")) {
      if (params.seuil_sanction_tombola >= params.seuil_sanction_aides)
        return "Le seuil de suspension des aides doit être supérieur à celui de la tombola.";
      if (params.seuil_sanction_aides >= params.seuil_suspension)
        return "Le seuil de suspension du membre doit être le plus élevé.";
    }

    return null;
  }

  async function enregistrer() {
    const probleme = valider();
    if (probleme) { setErreur(probleme); setSucces(false); return; }

    setSaving(true);
    setErreur("");
    setSucces(false);

    const { data: existant } = await supabase.from("parametrage")
      .select("id").eq("organisation_id", orgId).maybeSingle();

    // type_organisation vit sur organisations, jamais sur parametrage — il
    // n'existe dans params que parce que PARAMS_DEFAUT le porte pour les
    // besoins du vocabulaire ailleurs dans l'appli. L'envoyer tel quel à
    // parametrage.update()/.insert() échoue : PostgREST refuse une colonne
    // qui n'existe pas sur cette table.
    const { type_organisation, ...paramsAEnregistrer } = params;

    const { error } = existant
      ? await supabase.from("parametrage").update(paramsAEnregistrer)
          .eq("id", existant.id).eq("organisation_id", orgId)
      : await supabase.from("parametrage").insert({ ...paramsAEnregistrer, organisation_id: orgId });

    setSaving(false);
    if (error) { setErreur(error.message); return; }

    // Les autres écrans servent l'identité depuis un cache partagé :
    // on le rafraîchit pour qu'ils prennent en compte la modification.
    rafraichirIdentite();

    // Traçabilité : chaque module dont l'état a changé prend son propre
    // événement, le reste des réglages en prend un seul, commun.
    MODULES.forEach((m) => {
      const avant = moduleActif(initial, m.id);
      const apres = moduleActif(params, m.id);
      if (avant !== apres) {
        consigner(apres ? EVENEMENTS.MODULE_ACTIVE : EVENEMENTS.MODULE_DESACTIVE, {
          organisation_id: params.organisation_id,
          module: m.id,
          libelle: m.label,
        });
      }
    });

    const champsModules = new Set(MODULES.map((m) => m.id));
    const autresChamps = Object.keys(params).filter(
      (k) => !champsModules.has(k) && params[k] !== initial[k]
    );
    if (autresChamps.length > 0) {
      consigner(EVENEMENTS.PARAMETRAGE_MODIFIE, {
        organisation_id: params.organisation_id,
        champs: autresChamps,
      });
    }

    setInitial(params);
    setSucces(true);
    setTimeout(() => setSucces(false), 3500);
  }

  /* ---- Logo ---- */

  async function televerserLogo(e) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;

    if (!fichier.type.startsWith("image/")) {
      setErreur("Le fichier doit être une image.");
      return;
    }
    if (fichier.size > 2 * 1024 * 1024) {
      setErreur("Image trop lourde (2 Mo maximum).");
      return;
    }

    setLogoEnCours(true);
    setErreur("");

    const ext = fichier.name.split(".").pop().toLowerCase();
    // Le chemin doit être propre à l'organisation — un nom générique ferait
    // qu'un logo au même format écraserait celui de toute autre organisation
    // partageant ce même chemin, sans qu'aucune erreur ne le signale.
    const chemin = `${orgId}/organisation.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET_LOGOS)
      .upload(chemin, fichier, { upsert: true, contentType: fichier.type });

    if (upErr) {
      setLogoEnCours(false);
      setErreur("Échec du téléversement : " + upErr.message);
      return;
    }

    const { data } = supabase.storage.from(BUCKET_LOGOS).getPublicUrl(chemin);
    // Le suffixe force le navigateur à recharger l'image après remplacement
    const url = `${data.publicUrl}?v=${Date.now()}`;

    setLogoEnCours(false);
    maj("logo_url", url);
    if (fichierRef.current) fichierRef.current.value = "";
  }

  function retirerLogo() {
    maj("logo_url", null);
  }

  const maj = (champ, valeur) => setParams((p) => ({ ...p, [champ]: valeur }));

  // Le préfixe se déduit automatiquement du sigle tant que la personne ne
  // l'a pas modifié elle-même — dès qu'elle y touche directement, on arrête
  // de le resynchroniser, pour ne jamais écraser un choix volontaire.
  const prefixeToucheRef = useRef(false);
  const deriverPrefixe = (sigle) =>
    (sigle || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "MUT";
  const basculer = (id) => maj(id, !moduleActif(params, id));

  const attenduMensuel = params.montant_cotisation * nbMembres;

  const apercuMatricule =
    `${(params.prefixe_matricule || "MUT").toUpperCase()}-${new Date().getFullYear()}-A1B2`;

  const tombolaActive = moduleActif(params, "module_tombola");
  const sanctionsActives = moduleActif(params, "module_sanctions");

  if (loading) {
    return (
      <div className="pm-wrap">
        <style>{CSS}</style>
        <div className="pm-skel" /><div className="pm-skel" />
      </div>
    );
  }

  return (
    <div className="pm-wrap">
      <style>{CSS}</style>

      <header className="pm-head">
        <div>
          <h1 className="pm-titre">Paramètres</h1>
          <p className="pm-sub">
            Ces réglages s'appliquent immédiatement à l'ensemble de la plateforme.
          </p>
        </div>

        <div className="pm-head-actions">
          {modifie && (
            <button className="pm-btn-ghost" onClick={() => { setParams(initial); setErreur(""); }}>
              <RotateCcw size={15} /> Annuler
            </button>
          )}
          <button
            className={`pm-btn ${modifie ? "is-actif" : ""}`}
            onClick={enregistrer}
            disabled={saving || !modifie}
          >
            {saving
              ? <><Loader2 size={16} className="pm-spin" /> Enregistrement…</>
              : <><Save size={16} /> Enregistrer</>}
          </button>
        </div>
      </header>

      {modifie && !succes && (
        <div className="pm-alerte-modif">
          <Info size={16} /> Des modifications ne sont pas encore enregistrées.
        </div>
      )}

      {succes && (
        <div className="pm-succes">
          <CheckCircle2 size={17} /> Les paramètres ont été enregistrés.
        </div>
      )}

      {erreur && (
        <div className="pm-erreur">
          <AlertCircle size={17} /> {erreur}
        </div>
      )}

      {/* ---- Identité ---- */}
      <Section Icon={Building2} titre="Identité de la mutuelle"
        aide="Ces informations figurent sur les reçus, les rapports, la carte de membre et l'écran d'accueil.">

        <Champ label="Sigle" value={params.nom_mutuelle}
          onChange={(v) => {
            maj("nom_mutuelle", v);
            if (!prefixeToucheRef.current) maj("prefixe_matricule", deriverPrefixe(v));
          }} placeholder="Ex : MAEPHDA"
          aide="Nom court, affiché en tête des documents et sur la carte de membre. Vingt caractères au maximum." />

        <Champ label="Dénomination complète" value={params.adresse}
          onChange={(v) => maj("adresse", v)}
          placeholder="Ex : Mutuelle des Agents de l'EPHD de Dabakala"
          aide="Nom officiel, tel qu'il figure dans les statuts." />

        <Champ label="Localité" value={params.localite}
          onChange={(v) => maj("localite", v)}
          placeholder="Ex : Dabakala, Côte d'Ivoire"
          aide="Siège de la mutuelle, mentionné sur les reçus et les rapports." />

        <Champ label="Contact" value={params.contact}
          onChange={(v) => maj("contact", v)}
          placeholder="Téléphone ou adresse e-mail du Bureau"
          aide="Facultatif — affiché aux membres en cas de besoin." />

        {/* Lien public */}
        {slug && (
          <div className="pm-champ">
            <label className="pm-label">Lien de votre mutuelle</label>
            <div className="pm-lien-zone">
              <code className="pm-lien-valeur">
                {window.location.origin}/?org={slug}
              </code>
              <button
                type="button"
                className="pm-lien-copier"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/?org=${slug}`);
                  setLienCopie(true);
                  setTimeout(() => setLienCopie(false), 2200);
                }}
              >
                {lienCopie ? <><Check size={14} /> Copié</> : <><Upload size={14} /> Copier</>}
              </button>
            </div>
            <span className="pm-aide">
              À transmettre aux futurs adhérents : c'est l'adresse à ouvrir
              pour rejoindre spécifiquement votre mutuelle sur la plateforme.
            </span>
          </div>
        )}

        {/* Logo */}
        <div className="pm-champ">
          <label className="pm-label">Logo</label>
          <div className="pm-logo-zone">
            <div className="pm-logo-apercu">
              <img
                src={params.logo_url || LOGO_DEFAUT}
                alt="Logo de la mutuelle"
                onError={(e) => { e.currentTarget.src = LOGO_DEFAUT; }}
              />
            </div>

            <div className="pm-logo-actions">
              <button
                className="pm-btn-fichier"
                onClick={() => fichierRef.current?.click()}
                disabled={logoEnCours}
              >
                {logoEnCours
                  ? <><Loader2 size={15} className="pm-spin" /> Téléversement…</>
                  : <><Upload size={15} /> Choisir une image</>}
              </button>

              {params.logo_url && (
                <button className="pm-lien-danger" onClick={retirerLogo} disabled={logoEnCours}>
                  <Trash2 size={13} /> Retirer
                </button>
              )}

              <span className="pm-aide">
                Format carré de préférence, 512 pixels minimum, 2 Mo maximum.
                Un logo trop petit apparaîtra flou sur la carte de membre.
              </span>
            </div>

            <input
              ref={fichierRef}
              type="file"
              accept="image/*"
              onChange={televerserLogo}
              style={{ display: "none" }}
            />
          </div>
        </div>

        {/* Préfixe de matricule */}
        <div className="pm-champ">
          <label className="pm-label">Préfixe de matricule</label>
          <input
            value={params.prefixe_matricule || ""}
            onChange={(e) => {
              prefixeToucheRef.current = true;
              maj("prefixe_matricule", e.target.value.toUpperCase().slice(0, 10));
            }}
            placeholder="Ex : MAEPHDA"
            className="pm-input pm-input-mono"
          />
          <span className="pm-aide">
            Se déduit automatiquement du sigle, modifiable si besoin.
          </span>
          <div className="pm-apercu">
            <ImageIcon size={13} /> Aperçu d'un matricule :{" "}
            <strong>{apercuMatricule}</strong>
          </div>
          <span className="pm-aide">
            Ce préfixe compose le matricule de chaque membre. Le modifier change
            l'affichage des matricules existants, y compris sur les cartes déjà
            remises.
          </span>
        </div>
      </Section>

      {/* ---- Modules ---- */}
      <Section Icon={Blocks} titre="Fonctions activées"
        aide="Le socle — membres, cotisations, aides, comptabilité, communication, agenda, carte, rapports et journal — est toujours présent. Les fonctions ci-dessous s'activent au cas par cas.">

        <div className="pm-modules">
          {MODULES.map((m) => {
            const actif = moduleActif(params, m.id);
            return (
              <button
                key={m.id}
                className={`pm-module ${actif ? "is-on" : ""}`}
                onClick={() => basculer(m.id)}
                aria-pressed={actif}
              >
                <span className="pm-case">{actif && <Check size={14} />}</span>
                <span className="pm-module-text">
                  <strong>{m.label}</strong>
                  <em>{m.aide}</em>
                </span>
              </button>
            );
          })}
        </div>

        <div className="pm-avertissement">
          <AlertCircle size={15} />
          <span>
            N'activez une fonction que si les textes de votre mutuelle la
            prévoient. Une tombola ou un barème de sanctions sans base
            réglementaire serait difficile à défendre devant l'Assemblée
            Générale.
          </span>
        </div>
      </Section>

      {/* ---- Cotisations ---- */}
      <Section Icon={Receipt} titre="Cotisations"
        aide="Le montant s'applique aux cotisations générées à partir de maintenant.">
        <div className="pm-duo">
          <ChampNombre label="Montant mensuel" unite="FCFA"
            value={params.montant_cotisation}
            onChange={(v) => maj("montant_cotisation", v)} />
          <ChampNombre label="Versements maximum" unite="fois"
            value={params.max_fractions} min={1} max={4}
            onChange={(v) => maj("max_fractions", v)}
            aide="Pour le paiement fractionné." />
        </div>

        <ChampNombre label="Droit d'adhésion" unite="FCFA"
          value={params.droit_adhesion} min={0}
          onChange={(v) => maj("droit_adhesion", v)}
          aide="Versé une seule fois à l'entrée dans la mutuelle. Article 15 pour la MAEPHDA : 2 000 francs." />

        <div className="pm-projection">
          <span className="pm-proj-label">Recette mensuelle attendue</span>
          <span className="pm-proj-val">
            {montant(attenduMensuel)} <em>FCFA</em>
          </span>
          <span className="pm-proj-detail">
            {montant(params.montant_cotisation)} F × {nbMembres} membre{nbMembres > 1 ? "s" : ""} actif{nbMembres > 1 ? "s" : ""}
          </span>
        </div>
      </Section>

      {/* ---- Conditions d'accès aux prestations ---- */}
      <Section Icon={ShieldCheck} titre="Accès aux prestations"
        aide="Ces règles déterminent à partir de quand un membre peut déposer une demande d'aide, et ce qu'il doit avoir réglé.">

        <div className="pm-duo">
          <ChampNombre label="Délai de carence" unite="mois"
            value={params.carence_mois} min={0} max={24}
            onChange={(v) => maj("carence_mois", v)}
            aide="Durée de participation exigée avant toute prestation. Article 18 pour la MAEPHDA : trois mois." />
          <ChampNombre label="Mois à jour exigés" unite="mois"
            value={params.mois_a_jour_requis} min={0} max={24}
            onChange={(v) => maj("mois_a_jour_requis", v)}
            aide="Cotisations à jour sur les mois précédant l'événement. Article 34." />
        </div>

        <div className="pm-champ">
          <span className="pm-label">Point de départ du délai de carence</span>
          <div className="pm-choix">
            <button
              className={`pm-choix-btn ${params.depart_carence === "droit_adhesion" ? "is-on" : ""}`}
              onClick={() => maj("depart_carence", "droit_adhesion")}
            >
              <strong>Versement du droit d'adhésion</strong>
              <em>Le délai court à compter du paiement effectif</em>
            </button>
            <button
              className={`pm-choix-btn ${params.depart_carence === "date_adhesion" ? "is-on" : ""}`}
              onClick={() => maj("depart_carence", "date_adhesion")}
            >
              <strong>Date d'adhésion</strong>
              <em>Le délai court dès la validation de la demande</em>
            </button>
          </div>
          <span className="pm-aide">
            {params.depart_carence === "droit_adhesion"
              ? "Tant qu'un versement n'est pas enregistré, l'éligibilité du membre est calculée à titre provisoire depuis sa date d'adhésion."
              : "Le droit d'adhésion reste suivi, mais il ne conditionne pas l'accès aux prestations."}
          </span>
        </div>

        <div className="pm-recap">
          <Info size={14} />
          <span>
            Un membre inscrit aujourd'hui pourrait déposer sa première demande à
            partir du{" "}
            <strong>{dansXMois(params.carence_mois)}</strong>, à condition
            d'être à jour sur {params.mois_a_jour_requis} mois de cotisation.
          </span>
        </div>
      </Section>

      {/* ---- Objectif ---- */}
      <Section Icon={Target} titre="Objectif de recouvrement"
        aide="Repère affiché sur le tableau de bord financier.">
        <div className="pm-curseur">
          <input
            type="range" min={50} max={100} step={5}
            value={params.objectif_recouvrement}
            onChange={(e) => maj("objectif_recouvrement", parseInt(e.target.value))}
            className="pm-range"
          />
          <div className="pm-curseur-val">{params.objectif_recouvrement}<em>%</em></div>
        </div>
        <div className="pm-curseur-info">
          Soit <strong>{Math.round((nbMembres * params.objectif_recouvrement) / 100)}</strong> membres
          à jour sur {nbMembres}.
        </div>
      </Section>

      {/* ---- Tombola ---- */}
      {tombolaActive && (
        <Section Icon={Gift} titre="Tombola"
          aide="Les tickets bonus restent gratuits et automatiques pour les membres à jour.">
          <ChampNombre label="Prix du ticket payant" unite="FCFA"
            value={params.prix_ticket_tombola}
            onChange={(v) => maj("prix_ticket_tombola", v)} />

          <div className="pm-champ">
            <span className="pm-label">Nombre de tickets par trimestre</span>
            <div className="pm-choix">
              <button
                className={`pm-choix-btn ${params.plafond_tickets_tombola == null ? "is-on" : ""}`}
                onClick={() => maj("plafond_tickets_tombola", null)}
              >
                <strong>Illimité</strong>
                <em>Autant de tickets que les membres en achètent</em>
              </button>
              <button
                className={`pm-choix-btn ${params.plafond_tickets_tombola != null ? "is-on" : ""}`}
                onClick={() =>
                  maj("plafond_tickets_tombola", params.plafond_tickets_tombola ?? 200)}
              >
                <strong>Plafonné</strong>
                <em>Un nombre maximal de tickets vendables</em>
              </button>
            </div>

            {params.plafond_tickets_tombola != null && (
              <div className="pm-input-wrap" style={{ marginTop: 9 }}>
                <input
                  type="number" min={1}
                  value={params.plafond_tickets_tombola}
                  onChange={(e) =>
                    maj("plafond_tickets_tombola", parseInt(e.target.value) || 1)}
                  className="pm-input"
                />
                <span className="pm-unite">tickets</span>
              </div>
            )}

            <span className="pm-aide">
              Les tickets bonus ne sont pas comptés dans ce plafond : ils
              récompensent une cotisation déjà réglée, ce n'est pas un achat
              que l'on pourrait refuser.
            </span>
          </div>
        </Section>
      )}

      {/* ---- Sanctions ---- */}
      {sanctionsActives && (
        <Section Icon={ShieldAlert} titre="Seuils de sanctions"
          aide="Exprimés en mois de retard. Toute sanction est levée automatiquement dès régularisation.">
          <div className="pm-trio">
            <ChampNombre label="Tombola suspendue" unite="mois"
              value={params.seuil_sanction_tombola} min={1} max={12}
              onChange={(v) => maj("seuil_sanction_tombola", v)} />
            <ChampNombre label="Aides suspendues" unite="mois"
              value={params.seuil_sanction_aides} min={1} max={12}
              onChange={(v) => maj("seuil_sanction_aides", v)} />
            <ChampNombre label="Membre suspendu" unite="mois"
              value={params.seuil_suspension} min={1} max={12}
              onChange={(v) => maj("seuil_suspension", v)} />
          </div>

          {/* Frise du barème */}
          <div className="pm-frise">
            <div className="pm-frise-titre">Barème appliqué</div>
            <ul className="pm-frise-liste">
              <li>
                <span className="pm-pastille" style={{ background: C.success }} />
                <strong>Moins de {params.seuil_sanction_tombola} mois</strong>
                <em>Aucune sanction, simple rappel</em>
              </li>
              {tombolaActive && (
                <li>
                  <span className="pm-pastille" style={{ background: C.warning }} />
                  <strong>{params.seuil_sanction_tombola} mois</strong>
                  <em>Éligibilité à la tombola suspendue</em>
                </li>
              )}
              <li>
                <span className="pm-pastille" style={{ background: C.danger }} />
                <strong>{params.seuil_sanction_aides} mois</strong>
                <em>Accès aux aides sociales suspendu</em>
              </li>
              <li>
                <span className="pm-pastille" style={{ background: "#7F1D1D" }} />
                <strong>{params.seuil_suspension} mois</strong>
                <em>Statut de membre actif suspendu</em>
              </li>
            </ul>
          </div>
        </Section>
      )}
    </div>
  );
}

/* ---------------- Sous-composants ---------------- */

function Section({ Icon, titre, aide, children }) {
  return (
    <section className="pm-section">
      <header className="pm-section-head">
        <span className="pm-section-icon"><Icon size={19} /></span>
        <div>
          <h2 className="pm-section-titre">{titre}</h2>
          {aide && <p className="pm-section-aide">{aide}</p>}
        </div>
      </header>
      <div className="pm-section-body">{children}</div>
    </section>
  );
}

function Champ({ label, value, onChange, placeholder, aide }) {
  return (
    <div className="pm-champ">
      <label className="pm-label">{label}</label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pm-input"
      />
      {aide && <span className="pm-aide">{aide}</span>}
    </div>
  );
}

function ChampNombre({ label, value, onChange, unite, min = 0, max, aide }) {
  return (
    <div className="pm-champ">
      <label className="pm-label">{label}</label>
      <div className="pm-input-wrap">
        <input
          type="number" value={value} min={min} max={max}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="pm-input"
        />
        {unite && <span className="pm-unite">{unite}</span>}
      </div>
      {aide && <span className="pm-aide">{aide}</span>}
    </div>
  );
}

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function dansXMois(mois) {
  const d = new Date();
  d.setMonth(d.getMonth() + (mois || 0));
  return d.toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

/* ---------------- Styles ---------------- */

const CSS = `
.pm-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  max-width:820px; font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .pm-wrap{ padding:${S.lg}px; } }

.pm-head{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:${S.md}px; flex-wrap:wrap;
}
.pm-titre{ font-size:22px; font-weight:700; letter-spacing:-.02em; margin:0; }
.pm-sub{ font-size:14px; color:${C.textSubtle}; margin:4px 0 0; }
.pm-head-actions{ display:flex; gap:${S.sm}px; flex-shrink:0; }
.pm-btn{
  display:flex; align-items:center; gap:8px;
  background:${PALETTE.grey300}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:not-allowed;
  font-family:inherit; font-size:14px; font-weight:600;
  transition:background .18s ease;
}
.pm-btn.is-actif{ background:${C.primary}; cursor:pointer; box-shadow:${SHADOW.sm}; }
.pm-btn.is-actif:hover:not(:disabled){ background:${C.primaryDark}; }
.pm-btn:disabled{ opacity:.75; }
.pm-btn-ghost{
  display:flex; align-items:center; gap:7px;
  background:${C.surface}; border:1.5px solid ${C.border}; color:${C.textMuted};
  border-radius:${R.md}px; padding:12px 16px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600;
  transition:border-color .16s ease, color .16s ease;
}
.pm-btn-ghost:hover{ border-color:${C.danger}; color:${C.danger}; }

/* ---- Bandeaux ---- */
.pm-alerte-modif, .pm-succes, .pm-erreur{
  display:flex; align-items:center; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
  animation:pmIn .2s ease;
}
.pm-alerte-modif{ background:#FEF3C7; color:#92400E; border:1px solid ${C.warning}44; }
.pm-succes{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.pm-erreur{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }

/* ---- Sections ---- */
.pm-section{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.pm-section-head{
  display:flex; align-items:flex-start; gap:${S.md}px;
  margin-bottom:${S.lg}px;
}
.pm-section-icon{
  width:40px; height:40px; border-radius:${R.md}px; flex-shrink:0;
  background:${PALETTE.blue50}; color:${C.primary};
  display:flex; align-items:center; justify-content:center;
}
.pm-section-titre{ font-size:16.5px; font-weight:600; margin:0; letter-spacing:-.01em; }
.pm-section-aide{
  font-size:13px; color:${C.textSubtle}; margin:3px 0 0;
  line-height:1.5; max-width:62ch;
}
.pm-section-body{ display:flex; flex-direction:column; gap:${S.lg}px; }

/* ---- Modules ---- */
.pm-modules{
  display:grid; gap:${S.sm}px; grid-template-columns:1fr;
}
@media (min-width:600px){ .pm-modules{ grid-template-columns:1fr 1fr; } }
.pm-module{
  display:flex; align-items:flex-start; gap:11px;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:13px 15px; cursor:pointer;
  font-family:inherit; text-align:left; transition:all .16s ease;
}
.pm-module:hover{ border-color:${PALETTE.grey300}; }
.pm-module.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.pm-case{
  width:19px; height:19px; border-radius:5px; flex-shrink:0; margin-top:1px;
  border:2px solid ${PALETTE.grey300}; color:#fff;
  display:flex; align-items:center; justify-content:center;
  transition:all .16s ease;
}
.pm-module.is-on .pm-case{ background:${C.primary}; border-color:${C.primary}; }
.pm-module-text{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.pm-module-text strong{ font-size:14px; font-weight:600; }
.pm-module-text em{
  font-style:normal; font-size:12.5px; color:${C.textSubtle}; line-height:1.45;
}

.pm-choix{ display:grid; gap:${S.sm}px; grid-template-columns:1fr; }
@media (min-width:520px){ .pm-choix{ grid-template-columns:1fr 1fr; } }
.pm-choix-btn{
  display:flex; flex-direction:column; gap:3px; text-align:left;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:12px 14px; cursor:pointer;
  font-family:inherit; transition:all .16s ease;
}
.pm-choix-btn:hover{ border-color:${PALETTE.grey300}; }
.pm-choix-btn.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.pm-choix-btn strong{ font-size:13.5px; font-weight:600; color:${C.text}; }
.pm-choix-btn em{ font-style:normal; font-size:12px; color:${C.textSubtle}; line-height:1.4; }

.pm-recap{
  display:flex; align-items:flex-start; gap:8px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:12px 14px;
  font-size:13px; color:${C.textMuted}; line-height:1.55;
}
.pm-recap strong{ color:${C.text}; }

.pm-avertissement{
  display:flex; align-items:flex-start; gap:9px;
  background:#FEF3C7; color:#92400E; border-radius:${R.md}px;
  padding:12px 14px; font-size:13px; line-height:1.55;
}

/* ---- Champs ---- */
.pm-duo{ display:grid; gap:${S.lg}px; grid-template-columns:1fr; }
@media (min-width:560px){ .pm-duo{ grid-template-columns:1fr 1fr; } }
.pm-trio{ display:grid; gap:${S.md}px; grid-template-columns:1fr; }
@media (min-width:560px){ .pm-trio{ grid-template-columns:repeat(3, 1fr); } }

.pm-champ{ display:flex; flex-direction:column; gap:7px; }
.pm-label{ font-size:13.5px; font-weight:600; color:${C.textMuted}; }
.pm-input-wrap{ position:relative; }
.pm-input{
  width:100%; box-sizing:border-box; padding:13px 15px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:15px;
  color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.pm-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.pm-input-mono{
  font-family:'JetBrains Mono', monospace; letter-spacing:.1em;
  text-transform:uppercase;
}
.pm-input-wrap .pm-input{ padding-right:62px; }
.pm-unite{
  position:absolute; right:15px; top:50%; transform:translateY(-50%);
  font-size:12.5px; font-weight:600; color:${C.textSubtle}; pointer-events:none;
}
.pm-aide{ font-size:12.5px; color:${C.textSubtle}; line-height:1.5; }

.pm-lien-zone{
  display:flex; align-items:center; gap:${S.sm}px;
  background:${C.bg}; border:1px solid ${C.border};
  border-radius:${R.md}px; padding:${S.sm}px ${S.md}px; flex-wrap:wrap;
}
.pm-lien-valeur{
  flex:1; min-width:180px; font-family:'JetBrains Mono', monospace;
  font-size:12.5px; color:${C.text}; word-break:break-all;
}
.pm-lien-copier{
  display:flex; align-items:center; gap:6px; flex-shrink:0;
  background:${C.surface}; border:1px solid ${C.border}; color:${C.primary};
  border-radius:${R.sm}px; padding:7px 12px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600;
}
.pm-lien-copier:hover{ border-color:${C.primary}; }

/* ---- Logo ---- */
.pm-logo-zone{
  display:flex; align-items:flex-start; gap:${S.lg}px;
  background:${C.bg}; border-radius:${R.lg}px; padding:${S.lg}px;
  flex-wrap:wrap;
}
.pm-logo-apercu{
  width:88px; height:88px; flex-shrink:0;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.md}px; padding:9px;
  display:flex; align-items:center; justify-content:center;
}
.pm-logo-apercu img{ max-width:100%; max-height:100%; object-fit:contain; }
.pm-logo-actions{
  flex:1; min-width:190px; display:flex; flex-direction:column;
  align-items:flex-start; gap:9px;
}
.pm-btn-fichier{
  display:flex; align-items:center; gap:8px;
  background:${C.surface}; border:1.5px solid ${C.border}; color:${C.textMuted};
  border-radius:${R.md}px; padding:11px 16px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600;
  transition:border-color .16s ease, color .16s ease;
}
.pm-btn-fichier:hover:not(:disabled){ border-color:${C.primary}; color:${C.primary}; }
.pm-btn-fichier:disabled{ opacity:.65; cursor:not-allowed; }
.pm-lien-danger{
  display:flex; align-items:center; gap:6px;
  background:none; border:none; padding:0; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600; color:${C.danger};
}
.pm-lien-danger:hover:not(:disabled){ text-decoration:underline; }
.pm-lien-danger:disabled{ opacity:.6; cursor:not-allowed; }

/* ---- Aperçu du matricule ---- */
.pm-apercu{
  display:flex; align-items:center; gap:7px;
  background:${C.bg}; border-radius:${R.sm}px;
  padding:9px 12px; font-size:12.5px; color:${C.textSubtle};
}
.pm-apercu strong{
  font-family:'JetBrains Mono', monospace; font-size:13px;
  color:${C.text}; letter-spacing:.04em;
}

/* ---- Projection ---- */
.pm-projection{
  display:flex; flex-direction:column; gap:3px;
  background:linear-gradient(135deg, ${PALETTE.blue800}, ${PALETTE.blue600});
  color:#fff; border-radius:${R.lg}px; padding:${S.lg}px;
}
.pm-proj-label{ font-size:12px; opacity:.8; letter-spacing:.05em; text-transform:uppercase; }
.pm-proj-val{ font-size:26px; font-weight:700; letter-spacing:-.02em; }
.pm-proj-val em{ font-style:normal; font-size:13px; font-weight:600; opacity:.7; margin-left:5px; }
.pm-proj-detail{ font-size:13px; opacity:.8; }

/* ---- Curseur ---- */
.pm-curseur{ display:flex; align-items:center; gap:${S.lg}px; }
.pm-range{
  flex:1; accent-color:${C.primary}; height:6px; cursor:pointer;
}
.pm-curseur-val{
  flex-shrink:0; font-size:30px; font-weight:700;
  color:${C.primary}; letter-spacing:-.02em; min-width:82px; text-align:right;
}
.pm-curseur-val em{ font-style:normal; font-size:16px; opacity:.6; }
.pm-curseur-info{ font-size:13.5px; color:${C.textSubtle}; }

/* ---- Frise ---- */
.pm-frise{
  background:${C.bg}; border-radius:${R.lg}px; padding:${S.lg}px;
}
.pm-frise-titre{
  font-size:12px; font-weight:600; color:${C.textSubtle};
  text-transform:uppercase; letter-spacing:.06em; margin-bottom:${S.md}px;
}
.pm-frise-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:11px; }
.pm-frise-liste li{
  display:flex; align-items:center; gap:${S.md}px;
  font-size:13.5px; flex-wrap:wrap;
}
.pm-pastille{ width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.pm-frise-liste strong{ font-weight:600; min-width:130px; }
.pm-frise-liste em{ font-style:normal; color:${C.textSubtle}; }

/* ---- Divers ---- */
.pm-skel{
  height:180px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:pmShim 1.4s infinite;
}
.pm-spin{ animation:pmSpin 1s linear infinite; }
@keyframes pmSpin{ to{ transform:rotate(360deg); } }
@keyframes pmShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
@keyframes pmIn{ from{ opacity:0; transform:translateY(-4px); } to{ opacity:1; transform:none; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;