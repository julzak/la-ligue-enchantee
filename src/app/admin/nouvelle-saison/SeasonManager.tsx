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
          return (
            <div key={s.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{s.label}</span>
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
                <div className="flex items-center gap-2">
                  {next && (
                    <button className={btnGhost} onClick={() => changeStatus(s, next.to)} disabled={busy}>
                      {next.label}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
