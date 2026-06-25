"use client";

import { useEffect, useState } from "react";

interface Season {
  id: number;
  label: string;
  status: string;
  isCurrent: boolean;
  _count?: { clubs: number; players: number; leagues: number };
}
interface CloseResult {
  seasonLabel: string;
  podiumCount: number;
  cupWinner: string | null;
  cupFinalist: string | null;
  warnings: string[];
}
interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  detail: string;
}

// Transitions de statut autorisées (machine à états simple).
const NEXT_STATUS: Record<string, { to: string; label: string } | null> = {
  SETUP: { to: "AUCTION", label: "Ouvrir les enchères" },
  AUCTION: { to: "ACTIVE", label: "Démarrer la saison" },
  ACTIVE: { to: "WINTER", label: "Passer en mercato d'hiver" },
  WINTER: { to: "ACTIVE", label: "Reprendre la saison" },
  CLOSED: null,
};

const btnGhost =
  "rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface-2 disabled:opacity-40";

export default function SeasonManager() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null);
  // État d'édition inline du label (renommage)
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/seasons");
      const data = await res.json();
      setSeasons(data.seasons ?? []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeStatus(season: Season, to: string) {
    setBusy(true);
    setErr("");
    setMsg("");
    setChecklist(null);
    try {
      // Le lancement (passage en ACTIVE depuis SETUP/AUCTION) passe par la route
      // dédiée : checklist de readiness + création des configs de la saison.
      // La reprise après mercato d'hiver (WINTER -> ACTIVE) reste un simple PATCH.
      const isLaunch = to === "ACTIVE" && (season.status === "SETUP" || season.status === "AUCTION");
      if (isLaunch) {
        const res = await fetch("/api/admin/seasons/launch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seasonId: season.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (Array.isArray(data.items)) setChecklist(data.items);
          throw new Error(data.error || "Erreur");
        }
        setChecklist(data.items ?? null);
        setMsg(data.message ?? `Saison ${season.label} lancée`);
      } else {
        const res = await fetch("/api/admin/seasons", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: season.id, status: to, ...(to === "ACTIVE" ? { isCurrent: true } : {}) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur");
        setMsg(`Saison ${season.label} -> ${to}`);
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function syncSchedule(season: Season) {
    setBusy(true);
    setErr("");
    setMsg(`Synchronisation du calendrier ${season.label} en cours (30 à 60 secondes)...`);
    try {
      const res = await fetch("/api/admin/seasons/sync-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: season.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setMsg(data.message);
    } catch (e) {
      setMsg("");
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function close(season: Season) {
    if (
      !confirm(
        `Clôturer la saison ${season.label} ?\n\nCela fige le palmarès (podiums de chaque ligue + vainqueur et finaliste de la coupe). L'action est rejouable.`
      )
    )
      return;
    setBusy(true);
    setErr("");
    setMsg("");
    setCloseResult(null);
    try {
      const res = await fetch("/api/admin/seasons/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: season.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setCloseResult(data);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  // --- Renommage ---
  function startRename(season: Season) {
    setRenamingId(season.id);
    setRenameValue(season.label);
    setErr("");
    setMsg("");
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  async function confirmRename(season: Season) {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === season.label) {
      cancelRename();
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/seasons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: season.id, label: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setMsg(`Saison renommée en "${trimmed}"`);
      cancelRename();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  // --- Réinitialisation ---
  async function resetSeason(season: Season) {
    const confirmation = window.prompt(
      `RÉINITIALISER la saison "${season.label}" ?\n\nCette action supprime tous ses clubs, joueurs, ligues et participants, mais conserve la coquille (id et label).\n\nPour confirmer, saisissez le label exact : ${season.label}`
    );
    if (confirmation === null) return; // annulé
    if (confirmation.trim() !== season.label) {
      setErr(`Annulé : le label saisi ("${confirmation.trim()}") ne correspond pas.`);
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/seasons/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: season.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setMsg(`Saison "${season.label}" réinitialisée (clubs, joueurs, ligues et participants supprimés).`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  // --- Suppression ---
  async function deleteSeason(season: Season) {
    const confirmation = window.prompt(
      `SUPPRIMER DÉFINITIVEMENT la saison "${season.label}" ?\n\nCette action efface la saison ET toutes ses données de préparation (clubs, joueurs, ligues, participants). Irréversible.\n\nPour confirmer, saisissez le label exact : ${season.label}`
    );
    if (confirmation === null) return; // annulé
    if (confirmation.trim() !== season.label) {
      setErr(`Annulé : le label saisi ("${confirmation.trim()}") ne correspond pas.`);
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/seasons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: season.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setMsg(`Saison "${season.label}" supprimée définitivement.`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Chargement des saisons...</p>;
  // On masque les saisons "archive" : clôturées et sans aucune ligue rattachée
  // (= palmarès historique importé via CSV, 2017-2025, le site n'existait pas).
  // Leurs boutons ne servent à rien. Une saison gérable a au moins une ligue,
  // ou n'est pas encore clôturée.
  const managedSeasons = seasons.filter(
    (s) => !(s.status === "CLOSED" && (s._count?.leagues ?? 0) === 0)
  );

  if (seasons.length === 0)
    return <p className="text-sm text-muted">Aucune saison. Crée la première ci-dessous.</p>;

  return (
    <div className="space-y-3">
      <h2 className="font-serif text-base text-gold">Saisons existantes</h2>
      {managedSeasons.length === 0 && (
        <p className="text-sm text-muted">
          Aucune saison active à gérer. Crée la prochaine saison ci-dessous.
        </p>
      )}
      {msg && <div className="rounded bg-gold/10 px-3 py-2 text-sm text-gold">{msg}</div>}
      {err && <div className="rounded border border-rouge/40 bg-rouge/10 px-3 py-2 text-sm text-rouge">{err}</div>}

      {checklist && (
        <div className="rounded-lg border border-border bg-surface-2/50 p-4 space-y-1.5">
          <p className="text-xs uppercase tracking-wider text-muted">Checklist de lancement</p>
          {checklist.map((item) => (
            <div key={item.key} className="flex items-start gap-2 text-sm">
              <span className={item.ok ? "text-gold" : item.blocking ? "text-rouge" : "text-muted"}>
                {item.ok ? "✓" : item.blocking ? "✗" : "○"}
              </span>
              <span className="text-foreground">
                {item.label}
                <span className="text-muted"> : {item.detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {closeResult && (
        <div className="rounded-lg border border-gold/30 bg-gold/[0.04] p-4 text-sm space-y-1">
          <p className="text-gold font-medium">Clôture {closeResult.seasonLabel} : palmarès figé.</p>
          <p className="text-foreground/80">
            {closeResult.podiumCount} places de podium.
            {closeResult.cupWinner && ` Coupe : ${closeResult.cupWinner}`}
            {closeResult.cupFinalist && ` (finaliste ${closeResult.cupFinalist})`}.
          </p>
          {closeResult.warnings.map((w, i) => (
            <p key={i} className="text-rouge/80 text-xs">⚠ {w}</p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {managedSeasons.map((s) => {
          const next = NEXT_STATUS[s.status];
          const isSetup = s.status === "SETUP" && !s.isCurrent;
          const isRenaming = renamingId === s.id;
          return (
            <div key={s.id} className="rounded-lg border border-border bg-surface p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {isRenaming ? (
                    // Inline rename input
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmRename(s);
                          if (e.key === "Escape") cancelRename();
                        }}
                        className="rounded border border-gold/40 bg-surface-2 px-2 py-1 text-sm text-foreground focus:outline-none focus:border-gold w-36"
                        autoFocus
                        disabled={busy}
                      />
                      <button
                        className="rounded bg-gold/20 px-2 py-1 text-xs text-gold hover:bg-gold/30 disabled:opacity-40"
                        onClick={() => confirmRename(s)}
                        disabled={busy}
                      >
                        OK
                      </button>
                      <button
                        className="rounded bg-surface-2 px-2 py-1 text-xs text-muted hover:bg-surface disabled:opacity-40"
                        onClick={cancelRename}
                        disabled={busy}
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <span className="font-medium text-foreground">{s.label}</span>
                  )}
                  <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                    {s.status}
                  </span>
                  {s.isCurrent && <span className="text-[10px] text-gold">● courante</span>}
                  {s._count && (
                    <span className="text-xs text-muted">
                      {s._count.leagues} ligues · {s._count.clubs} clubs · {s._count.players} joueurs
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Retour arrière : une saison en enchères peut revenir en préparation
                      pour retoucher clubs/joueurs/ligues (bloqués hors SETUP). */}
                  {s.status === "AUCTION" && (
                    <button className={btnGhost} onClick={() => changeStatus(s, "SETUP")} disabled={busy}>
                      Revenir en préparation
                    </button>
                  )}
                  {next && (
                    <button className={btnGhost} onClick={() => changeStatus(s, next.to)} disabled={busy}>
                      {next.label}
                    </button>
                  )}
                  {s.status !== "CLOSED" && (
                    <button
                      className={btnGhost}
                      onClick={() => syncSchedule(s)}
                      disabled={busy}
                      title="Récupère les dates des matchs de Ligue 1 (J1 à J38) depuis TheSportsDB. Rejouable à volonté, indispensable pour les deadlines de composition."
                    >
                      Synchroniser le calendrier
                    </button>
                  )}
                  {/* Bouton clôture toujours visible avec le libellé de la saison.
                      Grisé si déjà clôturée (CLOSED) ou pas encore jouable. */}
                  {(() => {
                    const closable = s.status === "ACTIVE" || s.status === "WINTER";
                    const isClosed = s.status === "CLOSED";
                    return (
                      <button
                        className="rounded border border-rouge/40 bg-rouge/10 px-3 py-1.5 text-xs text-rouge hover:bg-rouge/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={() => close(s)}
                        disabled={busy || !closable}
                        title={
                          isClosed
                            ? "Saison déjà clôturée"
                            : closable
                            ? ""
                            : "La saison doit être démarrée (ACTIVE) avant de pouvoir être clôturée"
                        }
                      >
                        {isClosed ? `Saison ${s.label} clôturée` : `Clôturer la saison ${s.label}`}
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Actions destructives : SETUP uniquement (jamais ACTIVE/WINTER/CLOSED/isCurrent) */}
              {isSetup && !isRenaming && (
                <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                  <span className="text-[10px] text-muted uppercase tracking-wider mr-1">Préparation :</span>
                  <button
                    className={btnGhost}
                    onClick={() => startRename(s)}
                    disabled={busy}
                    title="Changer le label de cette saison en préparation"
                  >
                    Renommer
                  </button>
                  <button
                    className="rounded border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-400 hover:bg-orange-500/20 disabled:opacity-40"
                    onClick={() => resetSeason(s)}
                    disabled={busy}
                    title="Vide les clubs, joueurs, ligues et participants — conserve la coquille Season"
                  >
                    Réinitialiser
                  </button>
                  <button
                    className="rounded border border-rouge/50 bg-rouge/15 px-3 py-1.5 text-xs text-rouge hover:bg-rouge/25 disabled:opacity-40 font-medium"
                    onClick={() => deleteSeason(s)}
                    disabled={busy}
                    title="Supprime définitivement cette saison et toutes ses données de préparation"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
