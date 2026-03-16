"use client";

import Link from "next/link";
import { TrophyBadges } from "@/components/ui/TrophyBadges";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import type { Position, TrophyType } from "@/lib/types";

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

interface CumulativeStat {
  playerId: number;
  playerName: string;
  position: Position;
  clubName: string;
  clubShort: string;
  clubLogo: string | null;
  daysPlayed: number;
  daysInLineup: number;
  notes: number;
  goals: number;
  passes: number;
  total: number;
  ratio: number;
}

interface EquipeContentProps {
  slug: string;
  participantId: number;
  participantName: string;
  participantTrophies: TrophyType[];
  team: TeamPlayer[];
  dayScores: DayScore[] | null;
  cumulativeStats: CumulativeStat[] | null;
  selectedJournee: number | null;
  currentMatchday: number;
  leagueRank: number | null;
  interleagueRank: number | null;
}

const positionOrder: Position[] = ["GK", "DEF", "MID", "ATT"];
const positionLabels: Record<Position, string> = {
  GK: "Gardien",
  DEF: "Défense",
  MID: "Milieu",
  ATT: "Attaque",
};

export function EquipeContent({
  slug,
  participantId,
  participantName,
  participantTrophies,
  team,
  dayScores,
  cumulativeStats,
  selectedJournee,
  currentMatchday,
  leagueRank,
  interleagueRank,
}: EquipeContentProps) {
  const showCumul = selectedJournee === null;

  // Build score map for day view
  const scoreMap = new Map<number, DayScore>();
  if (dayScores) {
    dayScores.forEach((s) => scoreMap.set(s.playerId, s));
  }

  // Separate starters and bench
  const starters = team.filter((p) => p.isStarter);
  const bench = team.filter((p) => !p.isStarter);

  // Group by position
  const grouped = positionOrder.map((pos) => ({
    position: pos,
    label: positionLabels[pos],
    starters: starters.filter((p) => p.position === pos),
    bench: bench.filter((p) => p.position === pos),
  }));

  let totalPoints = 0;
  let totalNotes = 0;
  let totalButs = 0;
  let totalPasses = 0;
  let rowIndex = 0;

  function renderPlayerRow(player: TeamPlayer, isStarter: boolean, index: number) {
    if (showCumul) {
      const cumul = cumulativeStats?.find((c) => c.playerId === player.playerId);
      const daysPlayed = cumul?.daysPlayed ?? 0;
      const notes = cumul?.notes ?? 0;
      const goals = cumul?.goals ?? 0;
      const passes = cumul?.passes ?? 0;
      const total = cumul?.total ?? 0;
      const ratio = cumul?.ratio ?? 0;

      totalPoints += total;
      totalNotes += notes;
      totalButs += goals;
      totalPasses += passes;
      rowIndex++;

      return (
        <div
          key={player.playerId}
          className={`grid grid-cols-[2rem_2.5rem_minmax(8rem,1fr)_3.5rem_4rem_3rem_3rem_4rem_3.5rem] items-center px-3 py-2 text-sm border-b border-white/[0.05] ${
            !isStarter ? "text-white/40" : ""
          } ${index % 2 === 0 ? "" : "bg-white/[0.01]"}`}
        >
          <span className="text-muted text-xs">{isStarter ? index : ""}</span>
          <PlayerAvatar playerId={player.playerId} name={player.playerName} size={28} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-medium">{player.playerName}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="flex items-center gap-1 text-xs text-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {player.clubLogo && <img src={player.clubLogo} alt="" className="w-3 h-3 object-contain" />}
                {player.clubShort || player.clubName}
              </span>
            </div>
          </div>
          <span className="text-center tabular-nums">{daysPlayed}</span>
          <span className="text-center tabular-nums">{notes.toFixed(1)}</span>
          <span className={`text-center tabular-nums ${goals > 0 ? "text-vert font-medium" : ""}`}>{goals}</span>
          <span className={`text-center tabular-nums ${passes > 0 ? "text-gold font-medium" : ""}`}>{passes}</span>
          <span className="text-center tabular-nums font-medium">{total.toFixed(1)}</span>
          <span className="text-right tabular-nums text-muted">{ratio.toFixed(2)}</span>
        </div>
      );
    }

    // Single journee view
    const score = scoreMap.get(player.playerId);
    if (!score) {
      return (
        <div
          key={player.playerId}
          className="grid grid-cols-[2rem_2.5rem_minmax(8rem,1fr)_3.5rem_4rem_3rem_3rem_4rem_3.5rem] items-center px-3 py-2 text-sm border-b border-white/[0.05] text-white/30"
        >
          <span className="text-xs">{isStarter ? index : ""}</span>
          <PlayerAvatar playerId={player.playerId} name={player.playerName} size={28} />
          <div className="min-w-0">
            <span className="text-white/30">{player.playerName}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-white/20">{player.clubName}</span>
            </div>
          </div>
          <span className="text-center">-</span>
          <span className="text-center">-</span>
          <span className="text-center">-</span>
          <span className="text-center">-</span>
          <span className="text-center">2.0</span>
          <span className="text-right">-</span>
        </div>
      );
    }

    totalPoints += score.total;
    totalNotes += score.rating ?? 0;
    totalButs += score.goals;
    totalPasses += score.passes;

    return (
      <div
        key={player.playerId}
        className={`grid grid-cols-[2rem_2.5rem_minmax(8rem,1fr)_3.5rem_4rem_3rem_3rem_4rem_3.5rem] items-center px-3 py-2 text-sm border-b border-white/[0.05] ${
          index % 2 === 0 ? "" : "bg-white/[0.01]"
        }`}
      >
        <span className="text-muted text-xs">{isStarter ? index : ""}</span>
        <PlayerAvatar name={player.playerName} size={28} />
        <div className="min-w-0">
          <span className="text-white font-medium">{player.playerName}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-muted">{player.clubName}</span>
          </div>
        </div>
        <span className="text-center tabular-nums">1</span>
        <span className={`text-center tabular-nums ${(score.rating ?? 0) >= 7 ? "text-gold font-medium" : ""}`}>
          {score.rating?.toFixed(1) ?? "-"}
        </span>
        <span className={`text-center tabular-nums ${score.goals > 0 ? "text-vert font-medium" : ""}`}>
          {score.goals}
        </span>
        <span className={`text-center tabular-nums ${score.passes > 0 ? "text-gold font-medium" : ""}`}>
          {score.passes}
        </span>
        <span className="text-center tabular-nums font-medium">{score.total.toFixed(1)}</span>
        <span className="text-right tabular-nums text-muted">{score.total.toFixed(2)}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-lg sm:text-xl text-white flex flex-wrap items-center gap-2">
              {participantName}
              <TrophyBadges trophies={participantTrophies} />
              <span className="text-muted text-sm font-sans">
                - {showCumul ? "Cumul" : `Resultats de la journee ${selectedJournee}`}
              </span>
            </h1>
          </div>

          {/* Journee selector */}
          <div className="flex items-center gap-2">
            <Link
              href={`/ligue/${slug}/equipe/${participantId}`}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${
                showCumul ? "bg-gold text-night font-medium" : "bg-surface-2 text-muted hover:text-white"
              }`}
            >
              Cumulé
            </Link>
            <select
              value={selectedJournee ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  window.location.href = `/ligue/${slug}/equipe/${participantId}?j=${val}`;
                } else {
                  window.location.href = `/ligue/${slug}/equipe/${participantId}`;
                }
              }}
              className="bg-surface-2 border border-white/[0.07] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-gold"
            >
              <option value="">Journee...</option>
              {Array.from({ length: currentMatchday }, (_, i) => i + 1).map((j) => (
                <option key={j} value={j}>
                  J{j}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface rounded-lg border border-white/[0.07] overflow-x-auto">
          <div className="min-w-[650px]">
            {/* Column headers */}
            <div className="grid grid-cols-[2rem_2.5rem_minmax(8rem,1fr)_3.5rem_4rem_3rem_3rem_4rem_3.5rem] px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted border-b border-white/[0.07] bg-surface-2">
              <span></span>
              <span></span>
              <span>Joueur</span>
              <span className="text-center">Jrs</span>
              <span className="text-center">Notes</span>
              <span className="text-center">Buts</span>
              <span className="text-center">Passes</span>
              <span className="text-center">Total</span>
              <span className="text-right">Ratio</span>
            </div>

            {showCumul && cumulativeStats ? (
              <>
                {/* Cumul view: show ALL players who contributed this season */}
                {(() => {
                  // Current team player IDs
                  const currentIds = new Set(team.map((t) => t.playerId));
                  // Former players (in cumulative but not in current team)
                  const formerPlayers = cumulativeStats
                    .filter((c) => !currentIds.has(c.playerId) && c.total > 0)
                    .sort((a, b) => b.total - a.total);

                  return (
                    <>
                      {/* Current squad by position */}
                      {grouped.map((group) => (
                        <div key={group.position}>
                          <div className="px-3 py-1.5 bg-surface-2/50 border-b border-white/[0.05]">
                            <div className="flex items-center gap-2">
                              <PositionBadge position={group.position} />
                              <span className="text-xs text-muted">{group.label}</span>
                            </div>
                          </div>
                          {group.starters.map((sp) => {
                            rowIndex++;
                            return renderPlayerRow(sp, true, rowIndex);
                          })}
                          {group.bench.map((sp) => renderPlayerRow(sp, false, 0))}
                        </div>
                      ))}

                      {/* Former players */}
                      {formerPlayers.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 bg-surface-2/50 border-b border-white/[0.05]">
                            <span className="text-xs text-muted italic">Anciens joueurs</span>
                          </div>
                          {formerPlayers.map((c) => {
                            totalPoints += c.total;
                            totalNotes += c.notes;
                            totalButs += c.goals;
                            totalPasses += c.passes;
                            rowIndex++;
                            return (
                              <div
                                key={c.playerId}
                                className="grid grid-cols-[2rem_2.5rem_minmax(8rem,1fr)_3.5rem_4rem_3rem_3rem_4rem_3.5rem] items-center px-3 py-2 text-sm border-b border-white/[0.05] text-white/40"
                              >
                                <span className="text-muted text-xs">{rowIndex}</span>
                                <PlayerAvatar playerId={c.playerId} name={c.playerName} size={28} />
                                <div className="min-w-0">
                                  <span className="font-medium">{c.playerName}</span>
                                  <div className="text-xs opacity-60">{c.clubName}</div>
                                </div>
                                <span className="text-center tabular-nums">{c.daysPlayed}</span>
                                <span className="text-center tabular-nums">{c.notes.toFixed(1)}</span>
                                <span className="text-center tabular-nums">{c.goals}</span>
                                <span className="text-center tabular-nums">{c.passes}</span>
                                <span className="text-center tabular-nums">{c.total.toFixed(1)}</span>
                                <span className="text-right tabular-nums">{c.ratio.toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              /* Day view or cumul without data: show by position */
              <>
                {grouped.map((group) => (
                  <div key={group.position}>
                    <div className="px-3 py-1.5 bg-surface-2/50 border-b border-white/[0.05]">
                      <div className="flex items-center gap-2">
                        <PositionBadge position={group.position} />
                        <span className="text-xs text-muted">{group.label}</span>
                      </div>
                    </div>
                    {group.starters.map((sp) => {
                      rowIndex++;
                      return renderPlayerRow(sp, true, rowIndex);
                    })}
                    {group.bench.map((sp) => renderPlayerRow(sp, false, 0))}
                  </div>
                ))}
              </>
            )}

            {/* Total row */}
            <div className="grid grid-cols-[2rem_2.5rem_minmax(8rem,1fr)_3.5rem_4rem_3rem_3rem_4rem_3.5rem] items-center px-3 py-3 bg-surface-2 text-sm font-semibold border-t border-white/[0.07]">
              <span></span>
              <span></span>
              <span className="text-gold">Total des points : {totalPoints.toFixed(1)}</span>
              <span></span>
              <span className="text-center tabular-nums">{totalNotes.toFixed(1)}</span>
              <span className="text-center tabular-nums">{totalButs}</span>
              <span className="text-center tabular-nums">{totalPasses}</span>
              <span className="text-center tabular-nums text-gold">{totalPoints.toFixed(1)}</span>
              <span className="text-right tabular-nums text-muted">
                {rowIndex > 0 ? (totalPoints / rowIndex).toFixed(2) : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar - Fiche technique */}
      <aside className="w-full xl:w-64 xl:shrink-0 space-y-4">
        <div className="bg-surface rounded-lg border border-white/[0.07] p-4">
          <h3 className="font-serif text-sm text-rouge mb-3">Fiche technique</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Classement ligue</span>
              <span className="text-white font-medium">{leagueRank ?? "-"}e</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Classement interligue</span>
              <span className="text-white font-medium">{interleagueRank ?? "-"}e</span>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-white/[0.07] p-4 space-y-2">
          <Link href={`/ligue/${slug}/classement`} className="text-sm text-gold hover:underline block">
            Accueil de la ligue
          </Link>
          <Link href={`/ligue/${slug}/forum`} className="text-sm text-gold hover:underline block">
            Forum de la ligue
          </Link>
          <Link href={`/ligue/${slug}/mon-equipe`} className="text-sm text-gold hover:underline block">
            Choix des titulaires
          </Link>
        </div>
      </aside>
    </div>
  );
}
