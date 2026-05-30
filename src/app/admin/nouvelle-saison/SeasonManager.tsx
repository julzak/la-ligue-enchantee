"use client";

import { useEffect, useState } from "react";

interface Season {
  id: number;
  label: string;
  status: string;
  isCurrent: boolean;
  _count?: { clubs: number; players: number; leagues: number };
}
interface Movement {
  id: number;
  userId: number;
  pseudo: string;
  fromTier: number;
  toTier: number;
  type: string;
  rankFinal: number;
  overridden: boolean;
}
interface CloseResult {
  seasonLabel: string;
  podiumCount: number;
  movementCount: number;
  cupWinner: string | null;
  cupFinalist: string | null;
  warnings: string[];
}

// Transitions de statut autorisées (machine à états simple).
const NEXT_STATUS: Record<string, { to: string; label: string } | null> = {
  SETUP: { to: "AUCTION", label: "Ouvrir les enchères" },
  AUCTION: { to: "ACTIVE", label: "Démarrer la saison" },
  ACTIVE: { to: "WINTER", label: "Passer en mercato d'hiver" },
  WINTER: { to: "ACTIVE", label: "Reprendre la saison" },
  CLOSED: null,
};

const TYPE_LABEL: Record<string, string> = {
  PROMOTION: "Montée",
  RELEGATION: "Descente",
  STAY: "Maintien",
};

const btnGhost =
  "rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface-2 disabled:opacity-40";

export default function SeasonManager() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [openMovements, setOpenMovements] = useState<number | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null);

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
    try {
      const res = await fetch("/api/admin/seasons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: season.id, status: to, ...(to === "ACTIVE" ? { isCurrent: true } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setMsg(`Saison ${season.label} -> ${to}`);
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
        `Clôturer la saison ${season.label} ?\n\nCela fige le palmarès (podiums + coupe) et calcule les montées/descentes. L'action est rejouable.`
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

  async function loadMovements(seasonId: number) {
    if (openMovements === seasonId) {
      setOpenMovements(null);
      return;
    }
    setOpenMovements(seasonId);
    const res = await fetch(`/api/admin/seasons/movements?seasonId=${seasonId}`);
    const data = await res.json();
    setMovements(data.movements ?? []);
  }

  async function overrideMovement(m: Movement, patch: { toTier?: number; type?: string }) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/seasons/movements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, ...patch }),
      });
      if (res.ok) {
        setMovements((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...patch, overridden: true } : x)));
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Chargement des saisons...</p>;
  if (seasons.length === 0)
    return <p className="text-sm text-muted">Aucune saison. Crée la première ci-dessous.</p>;

  return (
    <div className="space-y-3">
      <h2 className="font-serif text-base text-gold">Saisons existantes</h2>
      {msg && <div className="rounded bg-gold/10 px-3 py-2 text-sm text-gold">{msg}</div>}
      {err && <div className="rounded border border-rouge/40 bg-rouge/10 px-3 py-2 text-sm text-rouge">{err}</div>}

      {closeResult && (
        <div className="rounded-lg border border-gold/30 bg-gold/[0.04] p-4 text-sm space-y-1">
          <p className="text-gold font-medium">Clôture {closeResult.seasonLabel} : palmarès figé.</p>
          <p className="text-foreground/80">
            {closeResult.podiumCount} places de podium, {closeResult.movementCount} mouvements.
            {closeResult.cupWinner && ` Coupe : ${closeResult.cupWinner}`}
            {closeResult.cupFinalist && ` (finaliste ${closeResult.cupFinalist})`}.
          </p>
          {closeResult.warnings.map((w, i) => (
            <p key={i} className="text-rouge/80 text-xs">⚠ {w}</p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {seasons.map((s) => {
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
                  {(s.status === "ACTIVE" || s.status === "WINTER") && (
                    <button
                      className="rounded border border-rouge/40 bg-rouge/10 px-3 py-1.5 text-xs text-rouge hover:bg-rouge/20 disabled:opacity-40"
                      onClick={() => close(s)}
                      disabled={busy}
                    >
                      Clôturer la saison
                    </button>
                  )}
                  {s.status === "CLOSED" && (
                    <button className={btnGhost} onClick={() => loadMovements(s.id)} disabled={busy}>
                      {openMovements === s.id ? "Masquer" : "Montées / descentes"}
                    </button>
                  )}
                </div>
              </div>

              {openMovements === s.id && (
                <div className="mt-3 border-t border-border pt-3">
                  {movements.length === 0 ? (
                    <p className="text-xs text-muted">Aucun mouvement calculé pour cette saison.</p>
                  ) : (
                    <div className="space-y-1">
                      <div className="grid grid-cols-[1fr_3rem_auto_auto] gap-2 px-1 text-[10px] uppercase tracking-wider text-muted">
                        <span>Joueur</span>
                        <span>Rang</span>
                        <span>Type</span>
                        <span>Tier cible</span>
                      </div>
                      {movements.map((m) => (
                        <div key={m.id} className="grid grid-cols-[1fr_3rem_auto_auto] items-center gap-2 text-sm">
                          <span className="text-foreground/90 truncate">
                            {m.pseudo}
                            {m.overridden && <span className="ml-1 text-[10px] text-gold">(modifié)</span>}
                          </span>
                          <span className="text-xs text-muted tabular-nums">{m.rankFinal}</span>
                          <select
                            className="rounded border border-border bg-surface-2 px-2 py-1 text-xs"
                            value={m.type}
                            onChange={(e) => overrideMovement(m, { type: e.target.value })}
                            disabled={busy}
                          >
                            {Object.entries(TYPE_LABEL).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            className="w-16 rounded border border-border bg-surface-2 px-2 py-1 text-xs"
                            value={m.toTier}
                            onChange={(e) => overrideMovement(m, { toTier: parseInt(e.target.value, 10) || m.toTier })}
                            disabled={busy}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
