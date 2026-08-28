import React, { useEffect, useMemo, useState } from "react";
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2, ArrowLeft,
  ChevronRight, PiggyBank, Check,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function ClotureAvecPage() {
  const { params } = useParametrage();
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creation, setCreation] = useState(false);
  const [selected, setSelected] = useState(null);

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from("cycles_avec")
      .select("*")
      .eq("organisation_id", params.organisation_id)
      .order("created_at", { ascending: false });
    setCycles(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  if (selected) {
    return (
      <FicheCycle
        cycle={selected}
        onBack={() => setSelected(null)}
        onDelete={() => { setSelected(null); charger(); }}
      />
    );
  }

  return (
    <div className="cl-wrap">
      <style>{CSS}</style>

      <div className="cl-intro">
        <PiggyBank size={16} />
        <span>
          À la clôture d'un cycle, l'épargne accumulée est répartie entre les membres
          du groupe au prorata de ce que chacun a épargné. La suggestion calculée
          correspond à l'épargne collectée seule — ajoutez-y vous-même les intérêts
          perçus sur les prêts remboursés avant de valider.
        </span>
      </div>

      <div className="cl-tools">
        <button className="cl-btn" onClick={() => setCreation(true)}>
          <Plus size={17} /> Nouveau cycle
        </button>
      </div>

      {loading ? (
        <div className="cl-skel" />
      ) : cycles.length === 0 ? (
        <div className="cl-vide">
          <PiggyBank size={36} color={PALETTE.grey300} />
          <div className="cl-vide-titre">Aucun cycle clôturé</div>
          <div className="cl-vide-sub">
            Préparez la clôture une fois le cycle d'épargne arrivé à son terme.
          </div>
        </div>
      ) : (
        <ul className="cl-liste">
          {cycles.map((c) => (
            <li key={c.id} className="cl-ligne" onClick={() => setSelected(c)}>
              <div className="cl-ligne-corps">
                <div className="cl-ligne-titre">{c.libelle}</div>
                <div className="cl-ligne-meta">
                  {c.date_debut && c.date_fin
                    ? `${new Date(c.date_debut).toLocaleDateString("fr-FR")} → ${new Date(c.date_fin).toLocaleDateString("fr-FR")}`
                    : new Date(c.created_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <strong>{montant(c.montant_a_repartir)} FCFA</strong>
              <ChevronRight size={18} color={PALETTE.grey300} />
            </li>
          ))}
        </ul>
      )}

      {creation && (
        <ModalNouveauCycle
          organisationId={params.organisation_id}
          cyclesExistants={cycles}
          onCancel={() => setCreation(false)}
          onCree={(c) => { setCreation(false); charger(); setSelected(c); }}
        />
      )}
    </div>
  );
}

/* ---------------- Préparation d'un nouveau cycle ---------------- */

function ModalNouveauCycle({ organisationId, cyclesExistants, onCancel, onCree }) {
  const [libelle, setLibelle] = useState("");
  const [dateDebut, setDateDebut] = useState(() => {
    // Reprend le lendemain de la fin du dernier cycle connu, pour éviter
    // par défaut tout chevauchement avec ce qui a déjà été clôturé.
    const dernier = [...(cyclesExistants || [])]
      .filter((c) => c.date_fin)
      .sort((a, b) => b.date_fin.localeCompare(a.date_fin))[0];
    if (!dernier) return "";
    const lendemain = new Date(dernier.date_fin);
    lendemain.setDate(lendemain.getDate() + 1);
    return lendemain.toISOString().slice(0, 10);
  });
  const [dateFin, setDateFin] = useState("");
  const [montantARepartir, setMontantARepartir] = useState("");
  const [montantModifieAMain, setMontantModifieAMain] = useState(false);
  const [epargnes, setEpargnes] = useState([]);
  const [epargnePeriode, setEpargnePeriode] = useState(null);
  const [calculEnCours, setCalculEnCours] = useState(false);
  const [calcule, setCalcule] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [err, setErr] = useState("");

  async function calculer() {
    if (!dateDebut || !dateFin) { setErr("Indiquez la période du cycle."); return; }
    if (dateFin < dateDebut) { setErr("La fin de période précède son début."); return; }

    setCalculEnCours(true);
    setErr("");

    const [{ data: paiements }, { data: membresListe }] = await Promise.all([
      supabase
        .from("paiements")
        .select("montant, cotisations(membre_id)")
        .gte("created_at", dateDebut)
        .lte("created_at", `${dateFin}T23:59:59`),
      supabase.from("membres").select("id, nom").eq("organisation_id", organisationId),
    ]);

    const parMembre = {};
    (paiements || []).forEach((p) => {
      const mid = p.cotisations?.membre_id;
      if (!mid) return;
      parMembre[mid] = (parMembre[mid] || 0) + Number(p.montant || 0);
    });

    const liste = Object.entries(parMembre)
      .map(([membre_id, total]) => ({
        membre_id,
        nom: membresListe?.find((m) => m.id === membre_id)?.nom || "—",
        epargne_total: total,
      }))
      .filter((e) => e.epargne_total > 0)
      .sort((a, b) => a.nom.localeCompare(b.nom));

    const total = liste.reduce((s, e) => s + e.epargne_total, 0);

    setEpargnePeriode(total);
    setEpargnes(liste);
    if (!montantModifieAMain) setMontantARepartir(String(total));
    setCalcule(true);
    setCalculEnCours(false);
  }

  const totalEpargne = epargnes.reduce((s, e) => s + e.epargne_total, 0);
  const previewLignes = useMemo(() => {
    const m = parseFloat(montantARepartir) || 0;
    return epargnes.map((e) => ({
      ...e,
      part: totalEpargne > 0 ? m * (e.epargne_total / totalEpargne) : 0,
    }));
  }, [epargnes, montantARepartir, totalEpargne]);

  // Chevauchement avec un cycle déjà clôturé : deux périodes se recoupent
  // dès que chacune commence avant la fin de l'autre.
  const cycleChevauche = dateDebut && dateFin
    ? (cyclesExistants || []).find((c) =>
        c.date_debut && c.date_fin &&
        dateDebut <= c.date_fin && c.date_debut <= dateFin
      )
    : null;

  async function valider() {
    if (!libelle.trim()) { setErr("Indiquez un libellé (ex : Cycle 2025)."); return; }
    const m = parseInt(montantARepartir, 10);
    if (!m || m <= 0) { setErr("Indiquez un montant à répartir."); return; }
    if (totalEpargne <= 0) { setErr("Aucune épargne enregistrée sur cette période."); return; }

    setEnCours(true);
    setErr("");

    const { data: cycle, error } = await supabase
      .from("cycles_avec")
      .insert({
        organisation_id: organisationId,
        libelle: libelle.trim(),
        date_debut: dateDebut || null,
        date_fin: dateFin || null,
        epargne_periode: epargnePeriode,
        montant_a_repartir: m,
      })
      .select()
      .single();

    if (error) { setEnCours(false); setErr(error.message); return; }

    const lignes = previewLignes
      .filter((l) => l.part > 0)
      .map((l) => ({
        cycle_id: cycle.id,
        membre_id: l.membre_id,
        epargne_a_la_date: l.epargne_total,
        montant_attribue: Math.round(l.part),
      }));

    const { error: errLignes } = await supabase.from("parts_cycle_avec").insert(lignes);

    setEnCours(false);

    if (errLignes) { setErr(errLignes.message); return; }

    onCree(cycle);
  }

  return (
    <div className="cl-overlay" onClick={onCancel}>
      <div className="cl-modal">
        <header className="cl-modal-head">
          <h3 className="cl-modal-titre">Nouveau cycle</h3>
          <button className="cl-close" onClick={onCancel} aria-label="Fermer"><X size={20} /></button>
        </header>

        <div className="cl-champ">
          <label className="cl-label" htmlFor="cl-libelle">Libellé</label>
          <input
            id="cl-libelle" className="cl-fld" value={libelle}
            onChange={(e) => setLibelle(e.target.value)} placeholder="Ex : Cycle 2025"
          />
        </div>

        <div className="cl-deux-champs">
          <div className="cl-champ">
            <label className="cl-label" htmlFor="cl-debut">Début du cycle</label>
            <input id="cl-debut" type="date" className="cl-fld" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </div>
          <div className="cl-champ">
            <label className="cl-label" htmlFor="cl-fin">Fin du cycle</label>
            <input id="cl-fin" type="date" className="cl-fld" max={new Date().toISOString().slice(0, 10)} value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </div>
        </div>

        <button className="cl-btn-calc" onClick={calculer} disabled={calculEnCours}>
          {calculEnCours ? <><Loader2 size={15} className="cl-spin" /> Calcul…</> : "Calculer la suggestion"}
        </button>

        {cycleChevauche && (
          <div className="cl-warn">
            <AlertCircle size={15} />
            <span>
              Cette période recoupe « {cycleChevauche.libelle} »
              {" "}({new Date(cycleChevauche.date_debut).toLocaleDateString("fr-FR")} → {new Date(cycleChevauche.date_fin).toLocaleDateString("fr-FR")}) :
              l'épargne commune aux deux périodes serait comptée deux fois.
            </span>
          </div>
        )}

        {calcule && (
          <>
            <div className="cl-suggestion">
              <span>{montant(epargnePeriode)} FCFA</span>
              <small>Épargne collectée sur la période</small>
            </div>

            <div className="cl-champ">
              <label className="cl-label" htmlFor="cl-montant">
                Montant à répartir <span className="cl-opt">— modifiable, ajoutez les intérêts perçus</span>
              </label>
              <div className="cl-fld-devise">
                <input
                  id="cl-montant" type="number" min="0" className="cl-fld"
                  value={montantARepartir}
                  onChange={(e) => { setMontantARepartir(e.target.value); setMontantModifieAMain(true); }}
                />
                <span>FCFA</span>
              </div>
            </div>

            {totalEpargne <= 0 ? (
              <div className="cl-err">
                <AlertCircle size={15} /> Aucune épargne enregistrée sur cette période : rien à répartir.
              </div>
            ) : (
              <div className="cl-apercu">
                <div className="cl-apercu-titre">
                  Aperçu — {previewLignes.filter((l) => l.part > 0).length} membre(s)
                </div>
                <ul className="cl-apercu-liste">
                  {previewLignes.filter((l) => l.part > 0).map((l) => (
                    <li key={l.membre_id}>
                      <span>{l.nom}</span>
                      <span className="cl-apercu-ep">{montant(l.epargne_total)} FCFA épargnés</span>
                      <strong>{montant(Math.round(l.part))} FCFA</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {err && <div className="cl-err"><AlertCircle size={15} /> {err}</div>}

        <div className="cl-modal-actions">
          <button className="cl-mbtn cl-mbtn-ghost" onClick={onCancel} disabled={enCours}>Annuler</button>
          <button
            className="cl-mbtn cl-mbtn-primary"
            onClick={valider}
            disabled={enCours || !calcule || totalEpargne <= 0}
          >
            {enCours ? <><Loader2 size={16} className="cl-spin" /> Enregistrement…</> : "Valider la répartition"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Fiche cycle (détail + suivi des paiements) ---------------- */

function FicheCycle({ cycle, onBack, onDelete }) {
  const [lignes, setLignes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suppression, setSuppression] = useState(false);
  const [enCours, setEnCours] = useState(false);

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from("parts_cycle_avec")
      .select("*, membres(nom)")
      .eq("cycle_id", cycle.id)
      .order("montant_attribue", { ascending: false });
    setLignes(data || []);
    setLoading(false);
  }

  useEffect(() => { charger(); }, [cycle.id]);

  async function basculerPaye(ligne) {
    setEnCours(true);
    const { error } = await supabase
      .from("parts_cycle_avec")
      .update({
        paye: !ligne.paye,
        paye_le: !ligne.paye ? new Date().toISOString().slice(0, 10) : null,
      })
      .eq("id", ligne.id);
    setEnCours(false);
    if (!error) charger();
  }

  async function supprimerCycle() {
    setEnCours(true);
    const { error } = await supabase.from("cycles_avec").delete().eq("id", cycle.id);
    setEnCours(false);
    if (!error) onDelete();
  }

  const totalPaye = lignes.filter((l) => l.paye).reduce((s, l) => s + Number(l.montant_attribue), 0);

  return (
    <div className="cl-wrap">
      <style>{CSS}</style>

      <button className="cl-retour" onClick={onBack}>
        <ArrowLeft size={16} /> Retour aux cycles
      </button>

      <header className="cl-entete">
        <div>
          <h1 className="cl-titre">{cycle.libelle}</h1>
          <div className="cl-sous-titre">
            {cycle.date_debut && cycle.date_fin
              ? `${new Date(cycle.date_debut).toLocaleDateString("fr-FR")} → ${new Date(cycle.date_fin).toLocaleDateString("fr-FR")}`
              : `Créé le ${new Date(cycle.created_at).toLocaleDateString("fr-FR")}`}
          </div>
        </div>
        <button className="cl-lien cl-lien-danger" onClick={() => setSuppression(true)}>
          <Trash2 size={13} /> Supprimer
        </button>
      </header>

      <div className="cl-resume">
        <div>
          <span>{montant(cycle.montant_a_repartir)} FCFA</span>
          <small>Total réparti</small>
        </div>
        <div>
          <span>{montant(totalPaye)} FCFA</span>
          <small>Déjà versé</small>
        </div>
        <div>
          <span>{montant(cycle.montant_a_repartir - totalPaye)} FCFA</span>
          <small>Restant à verser</small>
        </div>
      </div>

      {loading ? (
        <div className="cl-skel" />
      ) : (
        <ul className="cl-liste-repartition">
          {lignes.map((l) => (
            <li key={l.id} className="cl-ligne-repartition">
              <div className="cl-repartition-corps">
                <div className="cl-repartition-nom">{l.membres?.nom || "—"}</div>
                <div className="cl-repartition-meta">{montant(l.epargne_a_la_date)} FCFA épargnés</div>
              </div>
              <strong>{montant(l.montant_attribue)} FCFA</strong>
              <button
                className={`cl-paye ${l.paye ? "is-on" : ""}`}
                onClick={() => basculerPaye(l)}
                disabled={enCours}
              >
                {l.paye ? <><Check size={13} /> Versé</> : "Marquer versé"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {suppression && (
        <div className="cl-overlay" onClick={() => setSuppression(false)}>
          <div className="cl-modal cl-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="cl-modal-titre">Supprimer ce cycle ?</h3>
            <p className="cl-modal-texte">
              La répartition de <strong>{montant(cycle.montant_a_repartir)} FCFA</strong> entre
              {" "}{lignes.length} membre(s) sera définitivement supprimée.
            </p>
            <div className="cl-modal-actions">
              <button className="cl-mbtn cl-mbtn-ghost" onClick={() => setSuppression(false)} disabled={enCours}>
                Annuler
              </button>
              <button className="cl-mbtn cl-mbtn-danger" onClick={supprimerCycle} disabled={enCours}>
                {enCours ? <><Loader2 size={16} className="cl-spin" /> Suppression…</> : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Styles ---------------- */

const CSS = `
.cl-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .cl-wrap{ padding:${S.lg}px; } }

.cl-intro{
  display:flex; align-items:flex-start; gap:9px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:12px 15px;
  font-size:13px; color:${C.textMuted}; line-height:1.55;
}

.cl-tools{ display:flex; align-items:center; }
.cl-btn{
  margin-left:auto; display:flex; align-items:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
  transition:background .18s ease;
}
.cl-btn:hover{ background:${C.primaryDark}; }

.cl-liste{
  list-style:none; margin:0; padding:0;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; overflow:hidden; box-shadow:${SHADOW.xs};
}
.cl-ligne{
  display:flex; align-items:center; gap:${S.md}px;
  padding:${S.md}px ${S.lg}px; border-bottom:1px solid ${C.border};
  cursor:pointer; transition:background .14s ease;
}
.cl-ligne:hover{ background:${C.bg}; }
.cl-ligne:last-child{ border-bottom:none; }
.cl-ligne-corps{ flex:1; min-width:0; }
.cl-ligne-titre{ font-size:14.5px; font-weight:600; }
.cl-ligne-meta{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }

.cl-retour{
  display:flex; align-items:center; gap:7px; align-self:flex-start;
  background:none; border:none; color:${C.textMuted}; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; padding:0;
}
.cl-retour:hover{ color:${C.primary}; }

.cl-entete{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; }
.cl-titre{ font-size:22px; font-weight:700; letter-spacing:-.02em; margin:0; }
.cl-sous-titre{ font-size:13.5px; color:${C.textSubtle}; margin-top:4px; }
.cl-lien{
  display:flex; align-items:center; gap:6px; flex-shrink:0;
  background:none; border:none; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:600; padding:0;
}
.cl-lien-danger{ color:${C.danger}; }

.cl-resume{ display:flex; gap:${S.md}px; flex-wrap:wrap; }
.cl-resume > div{
  flex:1; min-width:140px; background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.lg}px;
  padding:${S.md}px ${S.lg}px; display:flex; flex-direction:column; gap:2px;
}
.cl-resume span{ font-size:18px; font-weight:700; letter-spacing:-.01em; }
.cl-resume small{ font-size:12px; color:${C.textSubtle}; }

.cl-liste-repartition{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.cl-ligne-repartition{
  display:flex; align-items:center; gap:${S.md}px; flex-wrap:wrap;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.md}px;
  padding:11px 15px;
}
.cl-repartition-corps{ flex:1; min-width:140px; }
.cl-repartition-nom{ font-size:14px; font-weight:600; }
.cl-repartition-meta{ font-size:12px; color:${C.textSubtle}; margin-top:2px; }
.cl-ligne-repartition strong{ font-size:14.5px; }
.cl-paye{
  flex-shrink:0; display:flex; align-items:center; gap:6px;
  background:${PALETTE.grey200}; color:${C.textMuted}; border:none;
  border-radius:${R.pill}px; padding:7px 13px; cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600;
  transition:background .16s ease, color .16s ease;
}
.cl-paye.is-on{ background:#DCFCE7; color:${C.success}; }
.cl-paye:disabled{ opacity:.6; cursor:not-allowed; }

/* ---- Modale ---- */
.cl-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; overflow-y:auto;
}
.cl-modal{ width:100%; max-width:560px; background:${C.surface}; border-radius:${R.xxl}px; padding:${S.xl}px; box-shadow:${SHADOW.lg}; margin:auto; }
.cl-modal-court{ max-width:440px; }
.cl-modal-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:${S.md}px; margin-bottom:${S.lg}px; }
.cl-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.cl-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:8px 0 ${S.md}px; }
.cl-close{ background:none; border:1px solid ${C.border}; border-radius:${R.sm}px; color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex; }
.cl-close:hover{ color:${C.danger}; border-color:${C.danger}; }

.cl-champ{ display:flex; flex-direction:column; gap:6px; margin-bottom:${S.md}px; }
.cl-deux-champs{ display:grid; grid-template-columns:1fr 1fr; gap:${S.md}px; }
.cl-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.cl-opt{ font-weight:400; color:${C.textSubtle}; }
.cl-fld{
  width:100%; box-sizing:border-box; padding:11px 13px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px; color:${C.text}; outline:none;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.cl-fld:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }
.cl-fld-devise{ display:flex; align-items:center; gap:8px; }
.cl-fld-devise span{ font-size:13px; color:${C.textSubtle}; flex-shrink:0; }

.cl-btn-calc{
  width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
  background:${PALETTE.blue50}; color:${C.primary}; border:1.5px dashed ${PALETTE.blue100};
  border-radius:${R.md}px; padding:11px; cursor:pointer;
  font-family:inherit; font-size:13.5px; font-weight:600; margin-bottom:${S.md}px;
}
.cl-btn-calc:hover:not(:disabled){ background:${PALETTE.blue100}; }
.cl-btn-calc:disabled{ opacity:.7; cursor:not-allowed; }

.cl-suggestion{
  background:${C.bg}; border-radius:${R.md}px; padding:10px 13px; margin-bottom:${S.md}px;
  display:flex; flex-direction:column; gap:2px;
}
.cl-suggestion span{ font-size:15px; font-weight:700; }
.cl-suggestion small{ font-size:11.5px; color:${C.textSubtle}; }

.cl-apercu{ background:${C.bg}; border-radius:${R.md}px; padding:${S.md}px; margin-bottom:${S.md}px; }
.cl-apercu-titre{ font-size:12.5px; font-weight:700; color:${C.textMuted}; margin-bottom:${S.sm}px; }
.cl-apercu-liste{ list-style:none; margin:0; padding:0; max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; }
.cl-apercu-liste li{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  background:${C.surface}; border-radius:${R.sm}px; padding:8px 11px; font-size:13px;
}
.cl-apercu-liste li > span:first-child{ font-weight:600; flex:1; min-width:100px; }
.cl-apercu-ep{ font-size:11.5px; color:${C.textSubtle}; }
.cl-apercu-liste strong{ color:${C.primary}; }

.cl-err{
  display:flex; align-items:flex-start; gap:8px;
  background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33;
  border-radius:${R.md}px; padding:11px 13px; font-size:13px; line-height:1.5; margin-bottom:${S.md}px;
}
.cl-warn{
  display:flex; align-items:flex-start; gap:8px;
  background:#FEF3C7; color:#92400E; border:1px solid ${C.warning}33;
  border-radius:${R.md}px; padding:11px 13px; font-size:13px; line-height:1.5; margin-bottom:${S.md}px;
}

.cl-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }
.cl-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
  transition:background .18s ease, border-color .18s ease;
}
.cl-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.cl-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; box-shadow:${SHADOW.sm}; }
.cl-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.cl-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.cl-mbtn-danger:hover:not(:disabled){ background:#B91C1C; }
.cl-mbtn-ghost{ flex:1; background:${C.surface}; color:${C.textMuted}; border:1.5px solid ${C.border}; }
.cl-mbtn-ghost:hover:not(:disabled){ border-color:${PALETTE.grey300}; }

/* ---- Divers ---- */
.cl-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.cl-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.cl-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:44ch; line-height:1.6; }
.cl-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:clShim 1.4s infinite;
}
.cl-spin{ animation:clSpin 1s linear infinite; }
@keyframes clSpin{ to{ transform:rotate(360deg); } }
@keyframes clShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;