"use client";

import { useParams } from "next/navigation";
import { JourneeScore } from "@/components/scoring/JourneeScore";
import {
  squads,
  getPerformances,
  getPlayer,
  getClub,
  getLeague,
  getLeagueStandings,
} from "@/lib/fixtures";
import { calculatePlayerPoints } from "@/lib/scoring";
import type { Player, Performance, PlayerPointsBreakdown } from "@/lib/types";

export default function JourneePage() {
  const params = useParams();
  const slug = params.slug as string;
  const league = getLeague(slug);
  const leagueStandings = getLeagueStandings(slug);
  const matchday = 25; // last published

  const perfs = getPerformances(matchday);

  if (!league || !leagueStandings) {
    return <div className="text-muted p-8">Ligue non trouvée</div>;
  }

  // Only show participants from this league
  const leagueParticipantIds = new Set(league.participants.map((p) => p.id));
  const leagueSquads = squads.filter((s) => leagueParticipantIds.has(s.participantId));

  const participantScores = leagueSquads.map((squad) => {
    const participant = league.participants.find((p) => p.id === squad.participantId);
    const standing = leagueStandings.standings.find((s) => s.participantId === squad.participantId);

    const starters = squad.players.filter((sp) => sp.isStarter);
    let total = 0;

    const playerScores = starters.map((sp) => {
      const player = getPlayer(sp.playerId);
      if (!player) return null;
      const perf = perfs.find((p) => p.playerId === sp.playerId);
      const breakdown = perf
        ? calculatePlayerPoints(perf, player.position)
        : ({
            base: 2, goalBonus: 0, assistBonus: 0,
            penaltySavedBonus: 0, ownGoalMalus: 0,
            redCardApplied: false, total: 2,
          } as PlayerPointsBreakdown);

      total += breakdown.total;
      const club = getClub(player.clubId);
      return {
        player,
        clubShortName: club?.shortName ?? "",
        performance: perf as Performance | undefined,
        breakdown,
      };
    }).filter((ps): ps is { player: Player; clubShortName: string; performance: Performance | undefined; breakdown: PlayerPointsBreakdown } => ps !== null);

    return {
      participantId: squad.participantId,
      participantName: participant?.name ?? squad.participantId,
      avatarInitials: participant?.avatarInitials ?? "??",
      totalScore: total,
      seasonRank: standing?.rank ?? 0,
      playerScores,
    };
  });

  const sorted = [...participantScores].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-serif text-xl text-white mb-1">Journée {matchday}</h2>
        <p className="text-sm text-muted">Publiée le lundi 3 mars 2025</p>
      </div>
      <div className="space-y-3">
        {sorted.map((ps, i) => (
          <JourneeScore
            key={ps.participantId}
            participantName={ps.participantName}
            avatarInitials={ps.avatarInitials}
            totalScore={ps.totalScore}
            seasonRank={ps.seasonRank}
            playerScores={ps.playerScores}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
