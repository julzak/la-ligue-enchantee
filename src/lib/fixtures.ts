import type {
  Club,
  Player,
  League,
  Participant,
  Matchday,
  Performance,
  Squad,
  CupMatch,
  InterleagueStanding,
  LeagueStandings,
  BestPerformance,
  DayStats,
} from "./types";

import clubsData from "@/fixtures/clubs.json";
import playersData from "@/fixtures/players.json";
import leagueData from "@/fixtures/league.json";
import matchdaysData from "@/fixtures/matchdays.json";
import performancesData from "@/fixtures/performances.json";
import squadsData from "@/fixtures/squads.json";
import standingsData from "@/fixtures/standings.json";
import cupData from "@/fixtures/cup.json";

export const clubs: Club[] = clubsData as Club[];
export const players: Player[] = playersData as Player[];

// Multi-league data
const leagueRoot = leagueData as {
  currentMatchday: number;
  season: string;
  leagues: League[];
  bestPerformances: BestPerformance[];
  dayStats: DayStats;
};

export const currentMatchday: number = leagueRoot.currentMatchday;
export const season: string = leagueRoot.season;
export const leagues: League[] = leagueRoot.leagues;
export const bestPerformances: BestPerformance[] = leagueRoot.bestPerformances;
export const dayStats: DayStats = leagueRoot.dayStats;

// Standings data
const standingsRoot = standingsData as {
  matchday: number;
  leagues: Record<string, LeagueStandings>;
  interleague: InterleagueStanding[];
};

export const leagueStandings: Record<string, LeagueStandings> = standingsRoot.leagues;
export const interleagueStandings: InterleagueStanding[] = standingsRoot.interleague;

export const matchdays: Matchday[] = matchdaysData as Matchday[];
export const performances: Performance[] = performancesData as Performance[];
export const squads: Squad[] = squadsData as Squad[];
export const cupMatches: CupMatch[] = cupData as CupMatch[];

// Helpers
export function getClub(clubId: string): Club | undefined {
  return clubs.find((c) => c.id === clubId);
}

export function getPlayer(playerId: string): Player | undefined {
  return players.find((p) => p.id === playerId);
}

export function getLeague(slug: string): League | undefined {
  return leagues.find((l) => l.slug === slug);
}

export function getLeagueStandings(slug: string): LeagueStandings | undefined {
  return leagueStandings[slug];
}

export function getLeagueForParticipant(participantId: string): League | undefined {
  return leagues.find((l) => l.participants.some((p) => p.id === participantId));
}

export function getParticipant(participantId: string): Participant | undefined {
  for (const league of leagues) {
    const p = league.participants.find((p) => p.id === participantId);
    if (p) return p;
  }
  return undefined;
}

export function getSquad(participantId: string): Squad | undefined {
  return squads.find((s) => s.participantId === participantId);
}

export function getMatchday(number: number): Matchday | undefined {
  return matchdays.find((m) => m.number === number);
}

export function getPerformances(matchday: number): Performance[] {
  return performances.filter((p) => p.matchday === matchday);
}

export function getPlayerPosition(playerId: string): "GK" | "DEF" | "MID" | "ATT" {
  const player = getPlayer(playerId);
  return player?.position ?? "MID";
}

export function getCurrentMatchday(): Matchday | undefined {
  return matchdays.find((m) => m.status === "LOCKED") ?? matchdays.find((m) => m.status === "UPCOMING");
}

export function getLastPublishedMatchday(): Matchday | undefined {
  const published = matchdays.filter((m) => m.status === "PUBLISHED");
  return published[published.length - 1];
}
