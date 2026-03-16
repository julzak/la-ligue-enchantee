import type { Performance, Position, PlayerPointsBreakdown } from "./types";

/**
 * Calculate points for a single player on a single matchday.
 */
export function calculatePlayerPoints(
  perf: Performance,
  position: Position
): PlayerPointsBreakdown {
  // Tapis vert
  if (perf.tapisVert) {
    const tv = perf.tapisVert;
    let base: number;

    if (!tv.withTeamSheet) {
      // Sans feuille de match
      base = tv.isWinningSide ? 5 : 4;
    } else {
      // Avec feuille de match
      if (tv.isStarter) {
        base = tv.isWinningSide ? 5 : 4;
      } else {
        base = 2; // remplacants des 2 equipes
      }
    }

    return {
      base,
      goalBonus: 0,
      assistBonus: 0,
      penaltySavedBonus: 0,
      ownGoalMalus: 0,
      redCardApplied: false,
      total: base,
    };
  }

  // Base: note L'Equipe ou forfait 2 pts
  let base: number;
  if (perf.rating === null || perf.rating === undefined) {
    base = 2; // forfait (joueur non note)
  } else if (perf.redCard) {
    base = 0; // carton rouge: note remplacee par 0
  } else {
    base = perf.rating;
  }

  // Primes buts
  let goalBonus = 0;
  if (perf.goals > 0) {
    let perGoal: number;
    switch (position) {
      case "GK":
        perGoal = 10;
        break;
      case "DEF":
        perGoal = 4;
        break;
      case "MID":
      case "ATT":
        perGoal = 2;
        break;
    }
    goalBonus = perf.goals * perGoal;
  }

  // Primes passes decisives
  const assistBonus = perf.assists * 1;

  // Primes penalty arrete (GK only)
  const penaltySavedBonus = perf.penaltySaved * 2;

  // Malus CSC
  const ownGoalMalus = perf.ownGoals * -2;

  const total = base + goalBonus + assistBonus + penaltySavedBonus + ownGoalMalus;

  return {
    base,
    goalBonus,
    assistBonus,
    penaltySavedBonus,
    ownGoalMalus,
    redCardApplied: perf.redCard,
    total,
  };
}

/**
 * Calculate total score for a lineup (11 starters) on a matchday.
 */
export function calculateLineupScore(
  starterIds: string[],
  performances: Performance[],
  getPosition: (playerId: string) => Position
): { total: number; playerScores: { playerId: string; breakdown: PlayerPointsBreakdown }[] } {
  const playerScores = starterIds.map((playerId) => {
    const perf = performances.find((p) => p.playerId === playerId);
    const position = getPosition(playerId);

    if (!perf) {
      // Joueur sans performance: forfait 2 pts
      const breakdown: PlayerPointsBreakdown = {
        base: 2,
        goalBonus: 0,
        assistBonus: 0,
        penaltySavedBonus: 0,
        ownGoalMalus: 0,
        redCardApplied: false,
        total: 2,
      };
      return { playerId, breakdown };
    }

    const breakdown = calculatePlayerPoints(perf, position);
    return { playerId, breakdown };
  });

  const total = playerScores.reduce((sum, ps) => sum + ps.breakdown.total, 0);
  return { total, playerScores };
}

/**
 * Calculate standings from all matchday scores.
 */
export function calculateStandings(
  allScores: { participantId: string; participantName: string; avatarInitials: string; total: number }[],
  previousRanks?: Map<string, number>
): { rank: number; participantId: string; participantName: string; avatarInitials: string; totalPoints: number; delta: number }[] {
  const sorted = [...allScores].sort((a, b) => b.total - a.total);

  return sorted.map((entry, i) => {
    const rank = i + 1;
    const prevRank = previousRanks?.get(entry.participantId) ?? rank;
    return {
      rank,
      participantId: entry.participantId,
      participantName: entry.participantName,
      avatarInitials: entry.avatarInitials,
      totalPoints: entry.total,
      delta: prevRank - rank, // positive = montee, negative = descente
    };
  });
}

/**
 * Calculate winter mercato budgets based on standings rank.
 * 1st gets 10 pts, then +2 per rank (10, 12, 14, ... up to 48 for 20th).
 */
export function calculateWinterBudgets(
  standings: { rank: number; participantId: string }[]
): { participantId: string; budget: number }[] {
  return standings.map((s) => ({
    participantId: s.participantId,
    budget: 10 + (s.rank - 1) * 2,
  }));
}
