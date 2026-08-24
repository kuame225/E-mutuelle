import React, { useEffect, useState } from "react";
import {
  ShieldCheck, UserPlus, X, Loader2, AlertCircle, CheckCircle2,
  Trash2, Search, Info, Users,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { useParametrage } from "./useParametrage";
import { consigner, EVENEMENTS } from "./journal";
import { C, R, S, SHADOW, PALETTE } from "./theme";

/**
 * Attribution des rôles du Bureau.
 *
 * Un rôle se donne à un membre qui a déjà activé son espace : sans compte,
 * il n'y a rien à rattacher. Une même personne peut cumuler plusieurs
 * rôles, ses permissions s'additionnent.
 */
export default function RolesPage() {
  const { params } = useParametrage();
  const orgId = params.organisation_id;

  const [catalogue, setCatalogue] = useState([]);
  const [attributions, setAttributions] = useState([]);
  const [membres, setMembres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ajout, setAjout] = useState(false);
  const [retrait, setRetrait] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function charger() {
    if (!orgId) return;
    setLoading(true);

    const [cat, attr, mem] = await Promise.all([
      supabase.from("roles_reference").select("*").order("ordre"),
      supabase.from("roles_admin").select("*").eq("organisation_id", orgId),
      // Seuls les membres ayant activé leur espace peuvent recevoir un rôle
      supabase.from("membres")
        .select("id, nom, poste, photo_url, user_id")
        .eq("organisation_id", orgId)
        .not("user_id", "is", null)
        .order("nom"),
    ]);

    setCatalogue(cat.data || []);
    setAttributions(attr.data || []);
    setMembres(mem.data || []);
    setLoading(false);
  }

  useEffect(() => { charger(); }, [orgId]);

  function notifier(texte, type = "ok") {
    setMessage({ type, texte });
    setTimeout(() => setMessage(null), 3500);
  }

  async function attribuer(userId, role) {
    setEnCours(true);

    const { error } = await supabase.from("roles_admin").insert({
      user_id: userId,
      organisation_id: orgId,
      role,
    });

    setEnCours(false);
    setAjout(false);

    if (error) {
      notifier(
        error.message.includes("duplicate")
          ? "Cette personne détient déjà ce rôle."
          : error.message,
        "err"
      );
      return;
    }

    consigner(EVENEMENTS.ROLE_ATTRIBUE, { organisation_id: orgId, role, user_id: userId });
    notifier("Rôle attribué.");
    charger();
  }

  async function retirer(attribution) {
    setEnCours(true);

    const { error } = await supabase
      .from("roles_admin")
      .delete()
      .eq("user_id", attribution.user_id)
      .eq("organisation_id", orgId)
      .eq("role", attribution.role);

    setEnCours(false);
    setRetrait(null);

    if (error) { notifier(error.message, "err"); return; }

    consigner(EVENEMENTS.ROLE_RETIRE, {
      organisation_id: orgId,
      role: attribution.role,
      user_id: attribution.user_id,
    });
    notifier("Rôle retiré.");
    charger();
  }

  const membreParUser = {};
  membres.forEach((m) => { membreParUser[m.user_id] = m; });

  const roleParCode = {};
  catalogue.forEach((r) => { roleParCode[r.code] = r; });

  // Regroupement par personne : une même personne peut cumuler des rôles
  const parPersonne = {};
  attributions.forEach((a) => {
    if (!parPersonne[a.user_id]) parPersonne[a.user_id] = [];
    parPersonne[a.user_id].push(a);
  });

  const personnes = Object.entries(parPersonne).map(([userId, roles]) => ({
    userId,
    membre: membreParUser[userId] || null,
    roles,
  }));

  // Le dernier administrateur technique ne peut pas être retiré : sans lui,
  // plus personne ne pourrait attribuer de rôles dans cette mutuelle.
  const nbAdminTech = attributions.filter(
    (a) => a.role === "administrateur_technique"
  ).length;

  function retraitPossible(attribution) {
    return !(attribution.role === "administrateur_technique" && nbAdminTech <= 1);
  }

  if (loading) {
    return (
      <div className="rp-wrap">
        <style>{CSS}</style>
        <div className="rp-skel" /><div className="rp-skel" />
      </div>
    );
  }

  return (
    <div className="rp-wrap">
      <style>{CSS}</style>

      {message && (
        <div className={`rp-msg is-${message.type}`}>
          {message.type === "ok" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <span>{message.texte}</span>
        </div>
      )}

      <div className="rp-intro">
        <Info size={16} />
        <span>
          Un rôle détermine les écrans auxquels un membre du Bureau accède.
          Seuls les membres ayant activé leur espace peuvent en recevoir un.
        </span>
      </div>

      <div className="rp-tools">
        <button className="rp-btn" onClick={() => setAjout(true)}>
          <UserPlus size={17} /> Attribuer un rôle
        </button>
      </div>

      {personnes.length === 0 ? (
        <div className="rp-vide">
          <Users size={36} color={PALETTE.grey300} />
          <div className="rp-vide-titre">Aucun rôle attribué</div>
          <div className="rp-vide-sub">
            Désignez les membres du Bureau et leurs attributions.
          </div>
        </div>
      ) : (
        <ul className="rp-liste">
          {personnes.map((p) => (
            <li key={p.userId} className="rp-carte">
              <div className="rp-carte-head">
                {p.membre?.photo_url ? (
                  <img src={p.membre.photo_url} alt="" className="rp-avatar-img" />
                ) : (
                  <span className="rp-avatar">
                    {p.membre ? initiales(p.membre.nom) : "?"}
                  </span>
                )}
                <div className="rp-carte-id">
                  <div className="rp-carte-nom">
                    {p.membre?.nom || "Compte sans fiche membre"}
                  </div>
                  <div className="rp-carte-poste">
                    {p.membre?.poste || "Rattaché à cette mutuelle sans y être adhérent"}
                  </div>
                </div>
              </div>

              <ul className="rp-roles">
                {p.roles.map((a) => {
                  const r = roleParCode[a.role];
                  const possible = retraitPossible(a);
                  return (
                    <li key={a.role} className="rp-role">
                      <div className="rp-role-texte">
                        <strong>{r?.libelle || a.role}</strong>
                        {r?.description && <em>{r.description}</em>}
                      </div>
                      <button
                        className="rp-role-suppr"
                        onClick={() => setRetrait(a)}
                        disabled={enCours || !possible}
                        title={possible
                          ? "Retirer ce rôle"
                          : "Dernier administrateur technique : ce rôle ne peut pas être retiré."}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {ajout && (
        <ModalAttribution
          membres={membres}
          catalogue={catalogue}
          attributions={attributions}
          enCours={enCours}
          onCancel={() => setAjout(false)}
          onConfirm={attribuer}
        />
      )}

      {retrait && (
        <div className="rp-overlay" onClick={() => setRetrait(null)}>
          <div className="rp-modal rp-modal-court" onClick={(e) => e.stopPropagation()}>
            <h3 className="rp-modal-titre">Retirer ce rôle ?</h3>
            <p className="rp-modal-texte">
              <strong>{roleParCode[retrait.role]?.libelle || retrait.role}</strong>
              {" — "}
              {membreParUser[retrait.user_id]?.nom || "cette personne"} perdra
              l'accès aux écrans correspondants.
            </p>
            <div className="rp-modal-actions">
              <button
                className="rp-mbtn rp-mbtn-ghost"
                onClick={() => setRetrait(null)}
                disabled={enCours}
              >
                Annuler
              </button>
              <button
                className="rp-mbtn rp-mbtn-danger"
                onClick={() => retirer(retrait)}
                disabled={enCours}
              >
                {enCours
                  ? <><Loader2 size={16} className="rp-spin" /> Retrait…</>
                  : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Attribution ---------------- */

function ModalAttribution({ membres, catalogue, attributions, enCours, onCancel, onConfirm }) {
  const [q, setQ] = useState("");
  const [choisi, setChoisi] = useState(null);
  const [role, setRole] = useState("");

  const liste = membres.filter((m) =>
    m.nom.toLowerCase().includes(q.toLowerCase().trim())
  );

  // Rôles déjà détenus par la personne sélectionnée : inutile de les
  // proposer une seconde fois.
  const dejaDetenus = choisi
    ? attributions.filter((a) => a.user_id === choisi).map((a) => a.role)
    : [];

  const disponibles = catalogue.filter((r) => !dejaDetenus.includes(r.code));

  return (
    <div className="rp-overlay" onClick={onCancel}>
      <div className="rp-modal" onClick={(e) => e.stopPropagation()}>
        <header className="rp-modal-head">
          <div>
            <h3 className="rp-modal-titre">Attribuer un rôle</h3>
            <p className="rp-modal-sub">
              Seuls les membres ayant activé leur espace apparaissent ici.
            </p>
          </div>
          <button className="rp-close" onClick={onCancel} aria-label="Fermer">
            <X size={20} />
          </button>
        </header>

        {membres.length === 0 ? (
          <div className="rp-vide-modal">
            Aucun membre n'a encore activé son espace. Remettez-leur un code
            d'activation depuis leur fiche.
          </div>
        ) : (
          <>
            <div className="rp-search">
              <Search size={16} className="rp-search-icon" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un membre…"
                className="rp-input"
              />
            </div>

            <ul className="rp-membres">
              {liste.slice(0, 30).map((m) => (
                <li key={m.id}>
                  <button
                    className={`rp-membre ${choisi === m.user_id ? "is-on" : ""}`}
                    onClick={() => { setChoisi(m.user_id); setRole(""); }}
                  >
                    {m.photo_url
                      ? <img src={m.photo_url} alt="" className="rp-avatar-img rp-avatar-sm" />
                      : <span className="rp-avatar rp-avatar-sm">{initiales(m.nom)}</span>}
                    <span className="rp-membre-texte">
                      <strong>{m.nom}</strong>
                      <em>{m.poste || "—"}</em>
                    </span>
                  </button>
                </li>
              ))}
              {liste.length === 0 && <li className="rp-membres-vide">Aucun résultat.</li>}
            </ul>

            {choisi && (
              <div className="rp-champ">
                <label className="rp-label" htmlFor="rp-role">Rôle à attribuer</label>
                {disponibles.length === 0 ? (
                  <p className="rp-aide">
                    Cette personne détient déjà tous les rôles disponibles.
                  </p>
                ) : (
                  <>
                    <select
                      id="rp-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="rp-input"
                    >
                      <option value="">Choisir…</option>
                      {disponibles.map((r) => (
                        <option key={r.code} value={r.code}>{r.libelle}</option>
                      ))}
                    </select>
                    {role && (
                      <p className="rp-aide">
                        {catalogue.find((r) => r.code === role)?.description}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        <div className="rp-modal-actions">
          <button className="rp-mbtn rp-mbtn-ghost" onClick={onCancel} disabled={enCours}>
            Annuler
          </button>
          <button
            className="rp-mbtn rp-mbtn-primary"
            onClick={() => onConfirm(choisi, role)}
            disabled={enCours || !choisi || !role}
          >
            {enCours
              ? <><Loader2 size={16} className="rp-spin" /> Attribution…</>
              : <><ShieldCheck size={16} /> Attribuer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Utilitaires ---------------- */

function initiales(nom) {
  return String(nom || "?").split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase();
}

/* ---------------- Styles ---------------- */

const CSS = `
.rp-wrap{
  padding:${S.xl}px; display:flex; flex-direction:column; gap:${S.lg}px;
  max-width:820px; font-family:'Inter','Poppins',system-ui,sans-serif; color:${C.text};
}
@media (max-width:640px){ .rp-wrap{ padding:${S.lg}px; } }

.rp-msg{
  display:flex; align-items:center; gap:10px;
  border-radius:${R.md}px; padding:13px 16px; font-size:14px;
}
.rp-msg.is-ok{ background:#DCFCE7; color:${C.success}; border:1px solid ${C.success}33; }
.rp-msg.is-err{ background:#FEE2E2; color:${C.danger}; border:1px solid ${C.danger}33; }

.rp-intro{
  display:flex; align-items:flex-start; gap:9px;
  background:${PALETTE.blue50}; border:1px solid ${PALETTE.blue100};
  border-radius:${R.md}px; padding:12px 15px;
  font-size:13px; color:${C.textMuted}; line-height:1.55;
}

.rp-tools{ display:flex; }
.rp-btn{
  margin-left:auto; display:flex; align-items:center; gap:8px;
  background:${C.primary}; color:#fff; border:none;
  border-radius:${R.md}px; padding:12px 18px; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; box-shadow:${SHADOW.sm};
}
.rp-btn:hover{ background:${C.primaryDark}; }

/* ---- Liste ---- */
.rp-liste{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:${S.md}px; }
.rp-carte{
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.lg}px; box-shadow:${SHADOW.xs};
}
.rp-carte-head{ display:flex; align-items:center; gap:${S.md}px; }
.rp-avatar, .rp-avatar-img{
  width:44px; height:44px; border-radius:50%; flex-shrink:0;
}
.rp-avatar{
  background:linear-gradient(135deg, ${PALETTE.blue800}, ${PALETTE.blue600});
  color:#fff; display:flex; align-items:center; justify-content:center;
  font-weight:700; font-size:15px;
}
.rp-avatar-img{ object-fit:cover; }
.rp-avatar-sm{ width:34px; height:34px; font-size:12px; }
.rp-carte-nom{ font-size:15.5px; font-weight:700; letter-spacing:-.01em; }
.rp-carte-poste{ font-size:12.5px; color:${C.textSubtle}; margin-top:2px; }

.rp-roles{
  list-style:none; margin:${S.md}px 0 0; padding:${S.md}px 0 0;
  border-top:1px solid ${C.border};
  display:flex; flex-direction:column; gap:${S.sm}px;
}
.rp-role{
  display:flex; align-items:center; gap:${S.md}px;
  background:${C.bg}; border-radius:${R.md}px; padding:11px 14px;
}
.rp-role-texte{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.rp-role-texte strong{ font-size:14px; font-weight:600; }
.rp-role-texte em{ font-style:normal; font-size:12px; color:${C.textSubtle}; line-height:1.45; }
.rp-role-suppr{
  flex-shrink:0; width:32px; height:32px; border-radius:${R.sm}px;
  background:${C.surface}; border:1px solid ${C.border};
  color:${C.textSubtle}; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
}
.rp-role-suppr:hover:not(:disabled){ border-color:${C.danger}; color:${C.danger}; background:#FEE2E2; }
.rp-role-suppr:disabled{ opacity:.35; cursor:not-allowed; }

/* ---- Modale ---- */
.rp-overlay{
  position:fixed; inset:0; z-index:180;
  background:rgba(10,20,40,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center;
  padding:${S.lg}px; overflow-y:auto;
}
.rp-modal{
  width:100%; max-width:480px; background:${C.surface};
  border-radius:${R.xxl}px; padding:${S.xl}px;
  box-shadow:${SHADOW.lg}; margin:auto;
}
.rp-modal-court{ max-width:400px; }
.rp-modal-head{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:${S.md}px; margin-bottom:${S.lg}px;
}
.rp-modal-titre{ font-size:19px; font-weight:700; letter-spacing:-.02em; margin:0; }
.rp-modal-sub{ font-size:13px; color:${C.textSubtle}; margin:4px 0 0; }
.rp-modal-texte{ font-size:14px; color:${C.textMuted}; line-height:1.6; margin:8px 0 ${S.xl}px; }
.rp-close{
  background:none; border:1px solid ${C.border}; border-radius:${R.sm}px;
  color:${C.textSubtle}; cursor:pointer; padding:6px; flex-shrink:0; display:flex;
}

.rp-search{ position:relative; margin-bottom:${S.md}px; }
.rp-search-icon{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:${C.textSubtle}; }
.rp-search .rp-input{ padding-left:42px; }
.rp-input{
  width:100%; box-sizing:border-box; padding:12px 14px;
  border:1.5px solid ${C.border}; border-radius:${R.md}px;
  background:${C.surface}; font-family:inherit; font-size:14.5px;
  color:${C.text}; outline:none;
}
.rp-input:focus{ border-color:${C.primary}; box-shadow:${SHADOW.focus}; }

.rp-membres{
  list-style:none; margin:0 0 ${S.md}px; padding:0;
  max-height:240px; overflow-y:auto;
  display:flex; flex-direction:column; gap:4px;
}
.rp-membre{
  display:flex; align-items:center; gap:11px; width:100%;
  background:${C.surface}; border:1.5px solid ${C.border};
  border-radius:${R.md}px; padding:9px 12px; cursor:pointer;
  font-family:inherit; text-align:left;
}
.rp-membre:hover{ border-color:${PALETTE.grey300}; }
.rp-membre.is-on{ border-color:${C.primary}; background:${PALETTE.blue50}; }
.rp-membre-texte{ display:flex; flex-direction:column; min-width:0; }
.rp-membre-texte strong{ font-size:13.5px; font-weight:600; }
.rp-membre-texte em{ font-style:normal; font-size:12px; color:${C.textSubtle}; }
.rp-membres-vide, .rp-vide-modal{
  font-size:13.5px; color:${C.textSubtle}; text-align:center;
  padding:${S.lg}px; line-height:1.55;
}

.rp-champ{ display:flex; flex-direction:column; gap:7px; margin-bottom:${S.md}px; }
.rp-label{ font-size:13px; font-weight:600; color:${C.textMuted}; }
.rp-aide{ font-size:12.5px; color:${C.textSubtle}; line-height:1.5; margin:0; }

.rp-modal-actions{ display:flex; gap:${S.md}px; margin-top:${S.lg}px; }
.rp-mbtn{
  display:flex; align-items:center; justify-content:center; gap:8px;
  border-radius:${R.md}px; padding:13px 20px; cursor:pointer; border:none;
  font-family:inherit; font-size:14.5px; font-weight:600;
}
.rp-mbtn:disabled{ opacity:.6; cursor:not-allowed; }
.rp-mbtn-primary{ flex:2; background:${C.primary}; color:#fff; }
.rp-mbtn-primary:hover:not(:disabled){ background:${C.primaryDark}; }
.rp-mbtn-danger{ flex:2; background:${C.danger}; color:#fff; }
.rp-mbtn-ghost{ flex:1; background:${C.surface}; color:${C.textMuted}; border:1.5px solid ${C.border}; }

/* ---- Divers ---- */
.rp-vide{
  display:flex; flex-direction:column; align-items:center; text-align:center;
  background:${C.surface}; border:1px solid ${C.border};
  border-radius:${R.xl}px; padding:${S.xxxl}px ${S.lg}px; gap:${S.sm}px;
}
.rp-vide-titre{ font-size:16px; font-weight:600; margin-top:${S.sm}px; }
.rp-vide-sub{ font-size:13.5px; color:${C.textSubtle}; max-width:40ch; line-height:1.6; }
.rp-skel{
  height:120px; border-radius:${R.xl}px;
  background:linear-gradient(90deg,#EDF1F6 25%,#F7F9FC 50%,#EDF1F6 75%);
  background-size:200% 100%; animation:rpShim 1.4s infinite;
}
.rp-spin{ animation:rpSpin 1s linear infinite; }
@keyframes rpSpin{ to{ transform:rotate(360deg); } }
@keyframes rpShim{ from{ background-position:200% 0; } to{ background-position:-200% 0; } }
*:focus-visible{ outline:2px solid ${C.primary}; outline-offset:2px; }
`;