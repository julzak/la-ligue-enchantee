"use client";

import { useState, useMemo, useCallback } from "react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { FormBadge } from "@/components/ui/FormBadge";
import { Check, AlertTriangle, Loader2, Zap, Search } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Position, FormIndicator } from "@/lib/types";

// ── Types matching db.ts returns ──────────────────────────

interface TeamPlayer {
  playerId: number;
  playerName: string;
  position: Position;
  clubName: string;
  clubShort: string;
  clubLogo: string | null;
  clubId: number;
  isStarter: boolean;
  indx: number;
  isSubs: boolean;
  dayFirst: number;
  dayLast: number;
}

interface DayScore {
  playerId: number;
  playerName: string;
  position: Position;
  clubName: string;
  indx: number;
  rating: number | null;
  goals: number;
  passes: number;
  total: number;
}

interface MonEquipeContentProps {
  team: TeamPlayer[];
  lastDayScores: DayScore[];
  currentDay: number;
  leagueId: number;
  userName: string;
  adminOverrideUserId?: number;
}

const positionOrder: Position[] = ["GK", "DEF", "MID", "ATT"];
const positionLabels: Record<Position, string> = {
  GK: "Gardien",
  DEF: "Defenseurs",
  MID: "Milieux",
  ATT: "Attaquants",
};

// Position constraints
const CONSTRAINTS = {
  GK: { min: 1, max: 1 },
  DEF: { min: 3, max: 5 },
  MID: { min: 3, max: 5 },
  ATT: { min: 1, max: 3 },
} as const;

function getPositionCounts(starters: TeamPlayer[]): Record<Position, number> {
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const p of starters) counts[p.position]++;
  return counts;
}

function getConstraintErrors(counts: Record<Position, number>): string[] {
  const errors: string[] = [];
  if (counts.GK !== 1) errors.push(`1 gardien requis (${counts.GK} selectionne${counts.GK > 1 ? "s" : ""})`);
  if (counts.DEF < 3) errors.push(`Min. 3 defenseurs (${counts.DEF} selectionne${counts.DEF > 1 ? "s" : ""})`);
  if (counts.MID < 3) errors.push(`Min. 3 milieux (${counts.MID} selectionne${counts.MID > 1 ? "s" : ""})`);
  if (counts.ATT < 1) errors.push(`Min. 1 attaquant (${counts.ATT} selectionne)`);
  if (counts.ATT > 3) errors.push(`Max. 3 attaquants (${counts.ATT} selectionnes)`);
  if (counts.DEF > 5) errors.push(`Max. 5 defenseurs (${counts.DEF} selectionnes)`);
  if (counts.MID > 5) errors.push(`Max. 5 milieux (${counts.MID} selectionnes)`);
  return errors;
}

export function MonEquipeContent({
  team,
  lastDayScores,
  currentDay,
  leagueId,
  userName,
  adminOverrideUserId,
}: MonEquipeContentProps) {
  const params = useParams();
  const slug = params.slug as string;

  // Track which players are starters locally
  const [starterIds, setStarterIds] = useState<Set<number>>(() => {
    const ids = new Set<number>();
    for (const p of team) {
      if (p.isStarter) ids.add(p.playerId);
    }
    return ids;
  });
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Build score map for form indicator
  const scoreMap = useMemo(() => {
    const map = new Map<number, DayScore>();
    for (const s of lastDayScores) map.set(s.playerId, s);
    return map;
  }, [lastDayScores]);

  // Current starters and bench
  const starters = useMemo(
    () => team.filter((p) => starterIds.has(p.playerId)),
    [team, starterIds]
  );
  const bench = useMemo(
    () => team.filter((p) => !starterIds.has(p.playerId)),
    [team, starterIds]
  );

  const starterCount = starters.length;
  const counts = useMemo(() => getPositionCounts(starters), [starters]);
  const constraintErrors = useMemo(() => getConstraintErrors(counts), [counts]);
  const isValid = starterCount === 11 && constraintErrors.length === 0;

  // Summary from last matchday
  const summary = useMemo(() => {
    let totalPts = 0;
    let bestPlayer = { name: "", points: 0 };
    let playedCount = 0;

    for (const p of starters) {
      const score = scoreMap.get(p.playerId);
      if (score) {
        totalPts += score.total;
        playedCount++;
        if (score.total > bestPlayer.points) {
          bestPlayer = { name: score.playerName, points: score.total };
        }
      }
    }

    return { totalPts, playedCount, bestPlayer };
  }, [starters, scoreMap]);

  // Toggle a player starter/bench
  const handleToggle = useCallback(
    (playerId: number) => {
      setSaveResult(null);
      setStarterIds((prev) => {
        const next = new Set(prev);
        if (next.has(playerId)) {
          next.delete(playerId);
        } else {
          // Don't allow more than 11 starters
          if (next.size >= 11) return prev;
          next.add(playerId);
        }
        return next;
      });
    },
    []
  );

  // Save lineup
  const handleSave = useCallback(async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setSaveResult(null);

    // Assign indx by position order
    const sorted = [...starters].sort((a, b) => {
      const posA = positionOrder.indexOf(a.position);
      const posB = positionOrder.indexOf(b.position);
      return posA - posB;
    });

    const payload = {
      leagueId,
      day: currentDay + 1,
      starters: sorted.map((p, i) => ({
        playerId: p.playerId,
        indx: i + 1,
      })),
      ...(adminOverrideUserId ? { userId: adminOverrideUserId } : {}),
    };

    try {
      const res = await fetch("/api/lineup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSaveResult({ ok: true, message: "Equipe validee pour la journee " + (currentDay + 1) + " !" });
      } else {
        setSaveResult({ ok: false, message: data.error || "Erreur inconnue" });
      }
    } catch {
      setSaveResult({ ok: false, message: "Erreur de connexion" });
    } finally {
      setSaving(false);
    }
  }, [isValid, saving, starters, leagueId, currentDay]);

  function getForm(playerId: number): FormIndicator {
    const score = scoreMap.get(playerId);
    if (!score || score.rating === null) return null;
    if (score.rating >= 7) return "hot";
    if (score.rating <= 4) return "cold";
    return null;
  }

  function renderPlayerCard(player: TeamPlayer, isStarter: boolean) {
    const score = scoreMap.get(player.playerId);
    const form = getForm(player.playerId);

    return (
      <button
        key={player.playerId}
        onClick={() => handleToggle(player.playerId)}
        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-left ${
          isStarter
            ? "bg-gold/[0.06] border-2 border-gold/25 shadow-[inset_0_0_20px_rgba(200,168,75,0.03)]"
            : "bg-surface-2 border border-white/[0.07]"
        } hover:bg-white/[0.04] cursor-pointer active:scale-[0.98]`}
      >
        <PlayerAvatar playerId={player.playerId} name={player.playerName} size={44} clubLogoUrl={player.clubLogo} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <PositionBadge position={player.position} />
            <span className="text-sm font-medium text-white truncate">{player.playerName}</span>
            <FormBadge form={form} />
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-muted">{player.clubName}</span>
            {score && (
              <span
                className={`text-xs tabular-nums font-medium ml-auto ${
                  score.total >= 8 ? "text-gold" : score.total <= 3 ? "text-rouge" : "text-white/50"
                }`}
              >
                {score.total.toFixed(1)} pts J{currentDay}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }

  // Group starters by position
  const groupedStarters = positionOrder.map((pos) => ({
    position: pos,
    label: positionLabels[pos],
    count: counts[pos],
    constraint: CONSTRAINTS[pos],
    players: starters.filter((p) => p.position === pos),
  }));

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-serif text-xl text-white mb-1">Mon equipe</h2>
          <p className="text-sm text-muted">
            {userName} - Composition pour la journee {currentDay + 1}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/ligue/${slug}/explorateur`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-gold bg-surface border border-white/[0.07] rounded-lg transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            Explorateur
          </Link>
          <Link
            href={`/ligue/${slug}/jokers`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-gold bg-surface border border-white/[0.07] rounded-lg transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            Jokers
          </Link>
        </div>
      </div>

      {/* Summary last matchday */}
      <div className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <h3 className="text-xs uppercase tracking-wider text-muted mb-3">
          Resume derniere journee (J{currentDay})
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-2xl font-serif font-bold text-gold">
              {summary.totalPts.toFixed(1)}
            </span>
            <p className="text-xs text-muted mt-0.5">Score total</p>
          </div>
          <div>
            <span className="text-2xl font-serif font-bold text-white">
              {summary.playedCount}/11
            </span>
            <p className="text-xs text-muted mt-0.5">Titu. ayant joue</p>
          </div>
          <div>
            <span className="text-lg font-medium text-white">
              {summary.bestPlayer.name || "-"}
            </span>
            <p className="text-xs text-muted mt-0.5">
              Meilleur : {summary.bestPlayer.points.toFixed(1)} pts
            </p>
          </div>
        </div>
      </div>

      {/* Constraint violations */}
      {constraintErrors.length > 0 && starterCount > 0 && (
        <div className="bg-rouge/10 border border-rouge/20 rounded-lg px-4 py-3 space-y-1">
          {constraintErrors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-rouge">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Starters grouped by position */}
      <div className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm uppercase tracking-wider text-muted">
            Titulaires ({starterCount}/11)
          </h3>
          {starterCount === 11 && constraintErrors.length === 0 && (
            <span className="text-xs text-vert font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              Composition valide
            </span>
          )}
          {starterCount < 11 && (
            <span className="text-xs text-muted">
              Cliquez sur un remplacant pour l&apos;ajouter
            </span>
          )}
        </div>

        <div className="space-y-5">
          {groupedStarters.map((group) => (
            <div key={group.position}>
              <div className="flex items-center gap-2 mb-2 pl-1">
                <p className="text-[10px] uppercase tracking-widest text-muted">
                  {group.label}
                </p>
                <span
                  className={`text-[10px] tabular-nums ${
                    group.count < group.constraint.min
                      ? "text-rouge"
                      : group.count > group.constraint.max
                        ? "text-rouge"
                        : "text-vert"
                  }`}
                >
                  ({group.count}/{group.constraint.min}-{group.constraint.max})
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.players.map((p) => renderPlayerCard(p, true))}
                {group.players.length === 0 && (
                  <div className="text-xs text-muted/50 italic px-3 py-2">
                    Aucun {group.label.toLowerCase()} selectionne
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bench */}
      <div className="bg-surface rounded-lg border border-white/[0.07] p-5">
        <h3 className="text-sm uppercase tracking-wider text-muted mb-4">
          Remplacants ({bench.length})
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {bench.map((p) => renderPlayerCard(p, false))}
          {bench.length === 0 && (
            <p className="text-xs text-muted/50 italic px-3 py-2">
              Tous les joueurs sont titulaires
            </p>
          )}
        </div>
      </div>

      {/* Save result message */}
      {saveResult && (
        <div
          className={`rounded-lg px-4 py-3 text-sm text-center font-medium ${
            saveResult.ok
              ? "bg-vert/10 border border-vert/20 text-vert"
              : "bg-rouge/10 border border-rouge/20 text-rouge"
          }`}
        >
          {saveResult.message}
        </div>
      )}

      {/* Validate button */}
      <button
        onClick={handleSave}
        disabled={!isValid || saving}
        className={`w-full h-12 rounded-lg font-semibold text-sm transition-all ${
          isValid && !saving
            ? "bg-gold text-night hover:bg-gold/90 active:scale-[0.99]"
            : "bg-muted/20 text-muted cursor-not-allowed"
        }`}
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Enregistrement...
          </span>
        ) : (
          "Valider mon equipe"
        )}
      </button>
    </div>
  );
}
