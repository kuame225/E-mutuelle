import React, { useEffect, useState } from "react";
import { Heart, Copy, CheckCircle2, Wallet } from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

function montant(v) {
  return (v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function DonsPage() {
  const { params } = useParametrage();
  const [slug, setSlug] = useState(null);
  const [dons, setDons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    async function charger() {
      if (!params.organisation_id) return;

      const [{ data: org }, { data: donsData }] = await Promise.all([
        supabase.from("organisations").select("slug").eq("id", params.organisation_id).maybeSingle(),
        supabase.from("dons")
          .select("*")
          .eq("organisation_id", params.organisation_id)
          .order("created_at", { ascending: false }),
      ]);

      setSlug(org?.slug || null);
      setDons(donsData || []);
      setLoading(false);
    }
    charger();
  }, [params.organisation_id]);

  const lien = slug ? `${window.location.origin}${window.location.pathname}?don=${slug}` : "";
  const donsConfirmes = dons.filter((d) => d.statut === "complete");
  const totalRecu = donsConfirmes.reduce((s, d) => s + (d.montant || 0), 0);

  function copierLien() {
    navigator.clipboard.writeText(lien);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  if (loading) {
    return (
      <div className="dp-wrap">
        <style>{CSS}</style>
        <div className="dp-skel" />
      </div>
    );
  }

  return (
    <div className="dp-wrap">
      <style>{CSS}</style>

      <header className="dp-head">
        <h1 className="dp-titre">Dons publics</h1>
        <p className="dp-sub">
          Une page accessible à tous, sans connexion, pour recevoir des dons — l'argent
          est versé directement sur votre compte Wave, celui déjà configuré pour vos cotisations.
        </p>
      </header>

      <div className="dp-lien-carte">
        <div className="dp-lien-icon"><Heart size={20} /></div>
        <div className="dp-lien-corps">
          <div className="dp-lien-titre">Votre lien de collecte</div>
          <code className="dp-lien-val">{lien}</code>
        </div>
        <button className="dp-lien-btn" onClick={copierLien}>
          {copie ? <><CheckCircle2 size={15} /> Copié</> : <><Copy size={15} /> Copier</>}
        </button>
      </div>

      <div className="dp-total">
        <Wallet size={20} color={C.primary} />
        <div>
          <div className="dp-total-val">{montant(totalRecu)} FCFA</div>
          <div className="dp-total-sub">reçus au total, {donsConfirmes.length} don{donsConfirmes.length > 1 ? "s" : ""} confirmé{donsConfirmes.length > 1 ? "s" : ""}</div>
        </div>
      </div>

      {dons.length === 0 ? (
        <div className="dp-vide">
          <Heart size={34} color={PALETTE.grey300} />
          <div className="dp-vide-titre">Aucun don pour le moment</div>
          <div className="dp-vide-sub">Partagez le lien ci-dessus pour commencer à recevoir des dons.</div>
        </div>
      ) : (
        <ul className="dp-liste">
          {dons.map((d) => (
            <li key={d.id} className={`dp-ligne dp-ligne-${d.statut}`}>
              <div className="dp-ligne-corps">
                <strong>{d.nom_donateur || "Donateur anonyme"}</strong>
                {d.message && <span className="dp-message">« {d.message} »</span>}
                <span className="dp-date">
                  {new Date(d.created_at).toLocaleDateString("fr-FR")}
                  {d.statut !== "complete" && ` — ${d.statut === "creee" ? "en attente" : "échoué"}`}
                </span>
              </div>
              <div className="dp-montant">{montant(d.montant)} F</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CSS = `
.dp-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .dp-wrap{ padding:${S.lg}px; } }

.dp-titre{ font-size:22px; font-weight:700; letter-spacing:-.02em; margin:0; }
.dp-sub{ font-size:13.5px; color:${C.textSubtle}; line-height:1.55; margin:6px 0 0; max-width:60ch; }

.dp-lien-carte{
  display:flex; align-items:center; gap:${S.md}px;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.dp-lien-icon{
  width:40px; height:40px; border-radius:${R.md}px; flex-shrink:0;
  background:#FEE2E2; color:#DC2626; display:flex; align-items:center; justify-content:center;
}
.dp-lien-corps{ flex:1; min-width:0; }
.dp-lien-titre{ font-size:12.5px; font-weight:700; color:${C.textSubtle}; margin-bottom:3px; }
.dp-lien-val{ font-size:12.5px; color:${C.text}; word-break:break-all; }
.dp-lien-btn{
  display:flex; align-items:center; gap:6px; flex-shrink:0;
  background:${C.primary}; color:#fff; border:none; border-radius:${R.sm}px;
  padding:9px 14px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:600;
}

.dp-total{
  display:flex; align-items:center; gap:${S.md}px;
  background:${PALETTE.blue50}; border-radius:${R.xl}px; padding:${S.lg}px;
}
.dp-total-val{ font-size:20px; font-weight:700; }
.dp-total-sub{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }

.dp-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.dp-ligne{
  display:flex; align-items:center; justify-content:space-between; gap:${S.md}px;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.md}px;
  padding:12px 16px;
}
.dp-ligne-creee{ opacity:.7; }
.dp-ligne-echouee{ opacity:.5; }
.dp-ligne-corps{ display:flex; flex-direction:column; gap:2px; font-size:13.5px; min-width:0; }
.dp-message{ font-size:12.5px; color:${C.textMuted}; font-style:italic; }
.dp-date{ font-size:11.5px; color:${C.textSubtle}; }
.dp-montant{ font-size:15px; font-weight:700; color:${C.success}; flex-shrink:0; }

.dp-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center; gap:${S.sm}px;
  background:${C.surface}; border:1px solid ${C.border}; border-radius:${R.xl}px;
  padding:${S.xxxl}px ${S.lg}px;
}
.dp-vide-titre{ font-size:15.5px; font-weight:600; margin-top:${S.sm}px; }
.dp-vide-sub{ font-size:13px; color:${C.textSubtle}; max-width:42ch; line-height:1.55; }

.dp-skel{
  height:150px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:dpShim 1.4s infinite;
}
@keyframes dpShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
`;