"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getLeague,
  getLeagueStandings,
  getParticipant,
  squads,
  getPlayer,
  getClub,
  getPerformances,
  currentMatchday,
  interleagueStandings,
} from "@/lib/fixtures";
import { calculatePlayerPoints } from "@/lib/scoring";
import { TrophyBadges } from "@/components/ui/TrophyBadges";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import type { Position } from "@/lib/types";

// Mock cumulative data per player (in prod this would be computed from all matchdays)
function getMockCumulativeData(playerId: string) {
  // Deterministic mock based on player id hash
  const hash = playerId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const joursJoues = 15 + (hash % 11); // 15-25
  const notesCum = joursJoues * (4.5 + (hash % 30) / 10); // realistic cumulative notes
  const buts = hash % 8;
  const passes = hash % 5;
  const total = notesCum + buts * 2 + passes;
  const ratio = total / joursJoues;
  const periode = `j01 --> j${currentMatchday}`;
  return { joursJoues, notesCum: Math.round(notesCum * 10) / 10, buts, passes, total: Math.round(total * 10) / 10, ratio: Math.round(ratio * 100) / 100, periode };
}

const positionOrder: Position[] = ["GK", "DEF", "MID", "ATT"];
const positionLabels: Record<Position, string> = {
  GK: "Gardien",
  DEF: "Défense",
  MID: "Milieu",
  ATT: "Attaque",
};

export default function EquipeParticipantPage() {
  return (
    <Suspense fallback={<div className="text-muted p-8">Chargement...</div>}>
      <EquipeContent />
    </Suspense>
  );
}

function EquipeContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const participantId = params.participantId as string;

  const league = getLeague(slug);
  const standings = getLeagueStandings(slug);
  const participant = getParticipant(participantId);
  const squad = squads.find((s) => s.participantId === participantId);

  if (!league || !standings || !participant) {
    return <div className="text-muted p-8">Participant non trouvé</div>;
  }

  if (!squad) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-xl text-white flex items-center gap-2">
          {participant.name}
          <TrophyBadges trophies={participant.trophies} />
        </h1>
        <div className="bg-surface rounded-lg border border-white/[0.07] p-8 text-center text-muted">
          Effectif non disponible pour cette ligue (données mock limitées à la Ligue 1)
        </div>
      </div>
    );
  }

  const standing = standings.standings.find((s) => s.participantId === participantId);
  const interRank = interleagueStandings.find((s) => s.participantId === participantId);

  // Selected matchday from query params
  const selectedJournee = searchParams.get("j") ? Number(searchParams.get("j")) : null;
  const showCumul = selectedJournee === null;

  // Build player rows
  const starters = squad.players.filter((sp) => sp.isStarter);
  const bench = squad.players.filter((sp) => !sp.isStarter);

  // Group by position
  const grouped = positionOrder.map((pos) => ({
    position: pos,
    label: positionLabels[pos],
    starters: starters.filter((sp) => {
      const p = getPlayer(sp.playerId);
      return p && p.position === pos;
    }),
    bench: bench.filter((sp) => {
      const p = getPlayer(sp.playerId);
      return p && p.position === pos;
    }),
  }));

  // Compute per-journee scores if a specific day is selected
  const journeePerfs = selectedJournee ? getPerformances(selectedJournee) : null;

  let totalPoints = 0;
  let totalNotes = 0;
  let totalButs = 0;
  let totalPasses = 0;

  // Best perf
  let bestPerfJournee = "";
  let bestPerfPts = 0;

  function renderPlayerRow(playerId: string, isStarter: boolean, index: number) {
    const player = getPlayer(playerId);
    if (!player) return null;
    const club = getClub(player.clubId);

    if (showCumul) {
      const data = getMockCumulativeData(playerId);
      totalPoints += data.total;
      totalNotes += data.notesCum;
      totalButs += data.buts;
      totalPasses += data.passes;

      // Track best perf (mock)
      if (data.ratio > bestPerfPts) {
        bestPerfPts = data.ratio;
        bestPerfJournee = `j5 (${(data.ratio * 12).toFixed(1)} pts)`;
      }

      return (
        <div
          key={playerId}
          className={`grid grid-cols-[2rem_2.5rem_minmax(8rem,1fr)_3.5rem_4rem_3rem_3rem_4rem_3.5rem] items-center px-3 py-2 text-sm border-b border-white/[0.05] ${
            !isStarter ? "text-white/40" : ""
          } ${index % 2 === 0 ? "" : "bg-white/[0.01]"}`}
        >
          <span className="text-muted text-xs">{isStarter ? index + 1 : ""}</span>
          <PlayerAvatar imageUrl={player.imageUrl} name={player.name} size={28} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-medium">{player.name}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {club && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={club.logoUrl} alt={club.shortName} className="w-3 h-3 object-contain" />
              )}
              <span className="text-xs text-muted">{club?.shortName}</span>
            </div>
          </div>
          <span className="text-center tabular-nums">{data.joursJoues}</span>
          <span className="text-center tabular-nums">{data.notesCum.toFixed(1)}</span>
          <span className={`text-center tabular-nums ${data.buts > 0 ? "text-vert font-medium" : ""}`}>{data.buts}</span>
          <span className={`text-center tabular-nums ${data.passes > 0 ? "text-gold font-medium" : ""}`}>{data.passes}</span>
          <span className="text-center tabular-nums font-medium">{data.total.toFixed(1)}</span>
          <span className="text-right tabular-nums text-muted">{data.ratio.toFixed(2)}</span>
        </div>
      );
    } else {
      // Single journee view
      const perf = journeePerfs?.find((p) => p.playerId === playerId);
      if (!perf) {
        return (
          <div key={playerId} className="grid grid-cols-[2rem_2.5rem_minmax(8rem,1fr)_3.5rem_4rem_3rem_3rem_4rem_3.5rem] items-center px-3 py-2 text-sm border-b border-white/[0.05] text-white/30">
            <span className="text-xs">{isStarter ? index + 1 : ""}</span>
            <PlayerAvatar imageUrl={player.imageUrl} name={player.name} size={28} />
            <div className="min-w-0">
              <span className="text-white/30">{player.name}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {club && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={club.logoUrl} alt={club.shortName} className="w-3 h-3 object-contain opacity-30" />
                )}
                <span className="text-xs text-white/20">{club?.shortName}</span>
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

      const breakdown = calculatePlayerPoints(perf, player.position);
      totalPoints += breakdown.total;
      totalNotes += perf.rating ?? 0;
      totalButs += perf.goals;
      totalPasses += perf.assists;

      return (
        <div
          key={playerId}
          className={`grid grid-cols-[2rem_2.5rem_minmax(8rem,1fr)_3.5rem_4rem_3rem_3rem_4rem_3.5rem] items-center px-3 py-2 text-sm border-b border-white/[0.05] ${
            perf.redCard ? "bg-rouge/[0.06]" : index % 2 === 0 ? "" : "bg-white/[0.01]"
          }`}
        >
          <span className="text-muted text-xs">{isStarter ? index + 1 : ""}</span>
          <PlayerAvatar imageUrl={player.imageUrl} name={player.name} size={28} />
          <div className="min-w-0">
            <span className="text-white font-medium">{player.name}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {club && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={club.logoUrl} alt={club.shortName} className="w-3 h-3 object-contain" />
              )}
              <span className="text-xs text-muted">{club?.shortName}</span>
            </div>
          </div>
          <span className="text-center tabular-nums">1</span>
          <span className={`text-center tabular-nums ${(perf.rating ?? 0) >= 7 ? "text-gold font-medium" : ""}`}>{perf.rating?.toFixed(1) ?? "-"}</span>
          <span className={`text-center tabular-nums ${perf.goals > 0 ? "text-vert font-medium" : ""}`}>{perf.goals}</span>
          <span className={`text-center tabular-nums ${perf.assists > 0 ? "text-gold font-medium" : ""}`}>{perf.assists}</span>
          <span className="text-center tabular-nums font-medium">{breakdown.total.toFixed(1)}</span>
          <span className="text-right tabular-nums text-muted">{breakdown.total.toFixed(2)}</span>
        </div>
      );
    }
  }

  let rowIndex = 0;

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-lg sm:text-xl text-white flex flex-wrap items-center gap-2">
              {participant.name}
              <TrophyBadges trophies={participant.trophies} />
              <span className="text-muted text-sm font-sans">- Résultats de la journée {selectedJournee ?? currentMatchday}</span>
            </h1>
          </div>

          {/* Journee selector */}
          <div className="flex items-center gap-2">
            <Link
              href={`/ligue/${slug}/equipe/${participantId}`}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${showCumul ? "bg-gold text-night font-medium" : "bg-surface-2 text-muted hover:text-white"}`}
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
              <option value="">Journée...</option>
              {Array.from({ length: currentMatchday }, (_, i) => i + 1).map((j) => (
                <option key={j} value={j}>J{j}</option>
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

          {/* Rows grouped by position */}
          {grouped.map((group) => (
            <div key={group.position}>
              {/* Position header */}
              <div className="px-3 py-1.5 bg-surface-2/50 border-b border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <PositionBadge position={group.position} />
                  <span className="text-xs text-muted">{group.label}</span>
                </div>
              </div>
              {/* Starters */}
              {group.starters.map((sp) => {
                rowIndex++;
                return renderPlayerRow(sp.playerId, true, rowIndex);
              })}
              {/* Bench players in this position */}
              {group.bench.map((sp) => renderPlayerRow(sp.playerId, false, 0))}
            </div>
          ))}

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
            <span className="text-right tabular-nums text-muted">{rowIndex > 0 ? (totalPoints / rowIndex).toFixed(2) : "-"}</span>
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
              <span className="text-white font-medium">{standing?.rank ?? "-"}e</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Classement interligue</span>
              <span className="text-white font-medium">{interRank?.rank ?? "-"}e</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Meilleure perf</span>
              <span className="text-white text-xs">{bestPerfJournee || "j5 (72.0 pts)"}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-white/[0.07] p-4 space-y-2">
          <Link href={`/ligue/${slug}/classement`} className="text-sm text-gold hover:underline block">Accueil de la ligue</Link>
          <Link href={`/ligue/${slug}/forum`} className="text-sm text-gold hover:underline block">Forum de la ligue</Link>
          <Link href={`/ligue/${slug}/mon-equipe`} className="text-sm text-gold hover:underline block">Choix des titulaires</Link>
        </div>
      </aside>
    </div>
  );
}
