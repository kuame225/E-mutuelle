import React, { useEffect, useState } from "react";
import { Megaphone, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { C, R, S, SHADOW, PALETTE } from "./theme";

export default function OffresBaamoPage() {
  const { params } = useParametrage();
  const [offres, setOffres] = useState([]);
  const [interets, setInterets] = useState([]); // offre_ids déjà exprimés par cette organisation
  const [loading, setLoading] = useState(true);
  const [offreOuverte, setOffreOuverte] = useState(null);
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  async function charger() {
    const [{ data: o }, { data: i }] = await Promise.all([
      supabase.from("offres_plateforme").select("*").eq("actif", true).order("ordre"),
      supabase.from("interets_offres").select("offre_id").eq("organisation_id", params.organisation_id),
    ]);
    setOffres(o || []);
    setInterets((i || []).map((x) => x.offre_id));
    setLoading(false);
  }

  useEffect(() => {
    if (!params.organisation_id) return;
    charger();
  }, [params.organisation_id]);

  async function envoyerInteret() {
    setEnvoi(true);
    setErreur("");

    const { error } = await supabase.rpc("exprimer_interet_offre", {
      p_offre_id: offreOuverte.id,
      p_organisation_id: params.organisation_id,
      p_message: message.trim() || null,
    });

    setEnvoi(false);
    if (error) { setErreur(error.message); return; }

    setOffreOuverte(null);
    setMessage("");
    setSucces("Votre intérêt a été transmis à Baamo.");
    setTimeout(() => setSucces(""), 4000);
    charger();
  }

  if (loading) return <div style={{ padding: 24, color: C.textSubtle }}>Chargement…</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Offres Baamo</h2>
      <p style={{ fontSize: 13.5, color: C.textSubtle, marginBottom: 20 }}>
        Des options que Baamo propose en plus, pour votre organisation.
      </p>

      {succes && (
        <div style={{ background: "#DCFCE7", color: C.success, borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 16 }}>
          {succes}
        </div>
      )}

      {offres.length === 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
          padding: 40, textAlign: "center", color: C.textSubtle, fontSize: 14,
        }}>
          Aucune offre pour le moment.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {offres.map((o) => {
            const dejaExprime = interets.includes(o.id);
            return (
              <div
                key={o.id}
                style={{
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
                  padding: 18, display: "flex", flexDirection: "column", gap: 10, boxShadow: SHADOW.xs,
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: PALETTE.blue100, color: C.primary,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Megaphone size={19} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{o.titre}</div>
                {o.description && (
                  <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>{o.description}</div>
                )}
                {o.prix_libelle && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{o.prix_libelle}</div>
                )}
                <button
                  onClick={() => !dejaExprime && setOffreOuverte(o)}
                  disabled={dejaExprime}
                  style={{
                    marginTop: 6,
                    background: dejaExprime ? C.bg : C.primary, color: dejaExprime ? C.textSubtle : "#fff",
                    border: dejaExprime ? `1px solid ${C.border}` : "none",
                    borderRadius: 8, padding: "9px 14px", cursor: dejaExprime ? "default" : "pointer",
                    fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  {dejaExprime
                    ? <><CheckCircle2 size={15} /> Intérêt transmis</>
                    : <><Send size={15} /> Je suis intéressé</>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {offreOuverte && (
        <div
          onClick={() => setOffreOuverte(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,20,40,.5)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 420 }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>Exprimer un intérêt</h3>
            <p style={{ fontSize: 13, color: C.textSubtle, margin: "0 0 16px" }}>{offreOuverte.titre}</p>

            <textarea
              value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              placeholder="Un mot pour préciser votre besoin — facultatif"
              style={{
                width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 10,
                border: `1.5px solid ${C.border}`, fontFamily: "inherit", fontSize: 14, marginBottom: 14,
              }}
            />

            {erreur && (
              <div style={{ background: C.dangerSoft, color: C.danger, borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 14 }}>
                {erreur}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setOffreOuverte(null)} disabled={envoi}
                style={{
                  flex: 1, background: "#fff", border: `1.5px solid ${C.border}`, color: C.textMuted,
                  borderRadius: 10, padding: "12px 0", cursor: "pointer",
                  fontFamily: "inherit", fontSize: 14, fontWeight: 600,
                }}
              >
                Annuler
              </button>
              <button
                onClick={envoyerInteret} disabled={envoi}
                style={{
                  flex: 2, background: C.primary, border: "none", color: "#fff",
                  borderRadius: 10, padding: "12px 0", cursor: "pointer",
                  fontFamily: "inherit", fontSize: 14, fontWeight: 600,
                }}
              >
                {envoi ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}