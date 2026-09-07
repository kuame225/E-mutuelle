import React from "react";
import {
  Target, TrendingUp, CheckCircle2, Wallet, HandHeart, Users,
  HandCoins, Coins, Briefcase, Heart, Banknote, PiggyBank,
} from "lucide-react";
import { C, R, S, SHADOW, PALETTE } from "./theme";

function montant(v) {
  return Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/* ---------------- Bandeau de tête ---------------- */

// Un seul composant pour tous les bandeaux : seul le contenu change
// d'un type à l'autre, jamais la mise en forme. La jauge et le badge
// ne s'affichent que si on leur donne quelque chose à montrer.
export function BandeauTete({
  label, Icone, valeur, unite, detail,
  jauge, badge, teinte = "primaire",
}) {
  return (
    <section className={`hero ${teinte === "accent" ? "hero-accent" : ""}`}>
      <div className="hero-glow" />
      <div className="hero-inner">
        <div className="hero-left">
          <div className="hero-label">
            {Icone && <Icone size={14} />} {label}
          </div>
          <div className="hero-value">
            {valeur}{unite && <span className="hero-pct">{unite}</span>}
          </div>
          {detail && <div className="hero-detail">{detail}</div>}
        </div>

        {badge && (
          <div className={`hero-badge ${badge.ok ? "is-ok" : ""}`}>
            {badge.ok ? <CheckCircle2 size={26} /> : <TrendingUp size={26} />}
            <div className="hero-badge-text">
              <div className="hero-badge-title">{badge.titre}</div>
              {badge.sous && <div className="hero-badge-sub">{badge.sous}</div>}
            </div>
          </div>
        )}
      </div>

      {jauge && (
        <>
          <div className="gauge">
            <div
              className="gauge-fill"
              style={{
                width: `${Math.min(jauge.pourcentage, 100)}%`,
                background: jauge.atteint
                  ? `linear-gradient(90deg, ${C.success}, #4ADE80)`
                  : `linear-gradient(90deg, ${C.warning}, #FBBF24)`,
              }}
            />
            {jauge.repere != null && (
              <div className="gauge-mark" style={{ left: `${jauge.repere}%` }} />
            )}
          </div>
          {jauge.legende && <div className="gauge-legend">{jauge.legende}</div>}
        </>
      )}
    </section>
  );
}

/* ---------------- Carte d'indicateur ---------------- */

export function CarteKpi({ label, valeur, unite, hint, Icone, couleur }) {
  return (
    <div className="kpi">
      <div className="kpi-head">
        <span className="kpi-icon" style={{ background: `${couleur}18`, color: couleur }}>
          {Icone && <Icone size={18} />}
        </span>
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: couleur }}>
        {valeur}{unite && <span className="kpi-unit">{unite}</span>}
      </div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

/* ---------------- Blocs prêts à l'emploi ---------------- */

export function BlocRecouvrement({ stats, objectif }) {
  const atteint = stats.taux >= objectif;
  return (
    <BandeauTete
      label="Membres à jour" Icone={Target}
      valeur={stats.taux} unite="%"
      detail={
        <>
          {stats.aJour} membre{stats.aJour > 1 ? "s" : ""} à jour sur {stats.totalMembres}
          {stats.nouveaux > 0 && (
            <> · dont {stats.nouveaux} nouveau{stats.nouveaux > 1 ? "x" : ""} sans cotisation</>
          )}
        </>
      }
      badge={{
        ok: atteint,
        titre: atteint ? "Objectif atteint" : "En progression",
        sous: `Cible : ${objectif} %`,
      }}
      jauge={{
        pourcentage: stats.taux, atteint, repere: objectif,
        legende: (
          <>
            <span>0 %</span>
            <span className="gauge-obj">Objectif {objectif} %</span>
            <span>100 %</span>
          </>
        ),
      }}
    />
  );
}

export function BlocCapitalSocial({ statsCoop }) {
  return (
    <BandeauTete
      label="Capital social" Icone={PiggyBank} teinte="accent"
      valeur={montant(statsCoop.capitalSocial)} unite=" FCFA"
      detail={`${statsCoop.societaires} sociétaire${statsCoop.societaires > 1 ? "s" : ""} détenant des parts`}
    />
  );
}

export function BlocEpargneAvec({ statsAvec }) {
  return (
    <BandeauTete
      label="Capital cumulé" Icone={Coins} teinte="accent"
      valeur={montant(statsAvec.capital)} unite=" FCFA"
      detail={
        statsAvec.cycleEnCours
          ? `${statsAvec.societaires} sociétaire${statsAvec.societaires > 1 ? "s" : ""} — cycle en cours`
          : "Aucun cycle en cours"
      }
    />
  );
}

export function BlocAppuisAgr({ statsAgr }) {
  return (
    <BandeauTete
      label="Appuis accordés" Icone={HandCoins} teinte="accent"
      valeur={montant(statsAgr.totalAccorde)} unite=" FCFA"
      detail={
        <>
          {statsAgr.beneficiaires} bénéficiaire{statsAgr.beneficiaires > 1 ? "s" : ""} suivi
          {statsAgr.beneficiaires > 1 ? "s" : ""}
          {statsAgr.enAttente > 0 && (
            <> · {statsAgr.enAttente} demande{statsAgr.enAttente > 1 ? "s" : ""} à traiter</>
          )}
        </>
      }
      jauge={
        statsAgr.totalARembourser > 0
          ? {
              pourcentage: Math.round((statsAgr.totalRembourse / statsAgr.totalARembourser) * 100),
              atteint: statsAgr.totalRembourse >= statsAgr.totalARembourser,
              legende: (
                <>
                  <span>Remboursé : {montant(statsAgr.totalRembourse)} F</span>
                  <span>Attendu : {montant(statsAgr.totalARembourser)} F</span>
                </>
              ),
            }
          : null
      }
    />
  );
}

export function BlocTresorerie({ stats }) {
  return (
    <>
      <CarteKpi
        label="Solde de la caisse" valeur={montant(stats.solde)} unite=" FCFA"
        hint={stats.hintSolde} Icone={Wallet} couleur={C.primary}
      />
      <CarteKpi
        label="Total encaissé" valeur={montant(stats.totalPaye)} unite=" FCFA"
        hint={stats.hintEncaisse} Icone={TrendingUp} couleur={C.success}
      />
    </>
  );
}

export function BlocAides({ stats }) {
  return (
    <CarteKpi
      label="Aides versées" valeur={montant(stats.totalAides)} unite=" FCFA"
      hint={stats.hintAides} Icone={HandHeart} couleur={C.warning}
    />
  );
}

export function BlocPrets({ statsPrets }) {
  return (
    <>
      <CarteKpi
        label="Encours de prêts" valeur={montant(statsPrets.encours)} unite=" FCFA"
        hint={`${statsPrets.enCours} prêt${statsPrets.enCours > 1 ? "s" : ""} en cours`}
        Icone={Banknote} couleur={C.primary}
      />
      <CarteKpi
        label="Demandes en attente" valeur={statsPrets.enAttente}
        hint="À instruire" Icone={HandHeart} couleur={C.warning}
      />
    </>
  );
}

export function BlocProjets({ statsProjets }) {
  return (
    <CarteKpi
      label="Projets en cours" valeur={statsProjets.enCours}
      hint={statsProjets.budgetTotal > 0 ? `${montant(statsProjets.budgetTotal)} FCFA de budget` : null}
      Icone={Briefcase} couleur={C.primaryLight}
    />
  );
}

export function BlocDons({ statsDons }) {
  return (
    <CarteKpi
      label="Dons reçus" valeur={montant(statsDons.total)} unite=" FCFA"
      hint={`${statsDons.nombre} don${statsDons.nombre > 1 ? "s" : ""}`}
      Icone={Heart} couleur={C.danger}
    />
  );
}

export function BlocEffectif({ stats }) {
  return (
    <CarteKpi
      label="Membres actifs" valeur={stats.totalMembres}
      hint={stats.nouveaux > 0 ? `${stats.nouveaux} nouveau${stats.nouveaux > 1 ? "x" : ""}` : null}
      Icone={Users} couleur={C.primary}
    />
  );
}