/**
 * Données de matchs Ligue 1 pour le pipeline de scraping. Sert à :
 * 1. connaître les dates des matchs → quelles éditions L'Équipe scraper ;
 * 2. contre-vérifier les scores extraits par Vision.
 *
 * SOURCE : football-data.org depuis le 2026-08-17 (token gratuit saisi dans
 * Admin → Configuration, fallback env FOOTBALL_DATA_TOKEN). AVANT : TheSportsDB
 * avec la clé de test publique "3", qui TRONQUE chaque round à 5 matchs sur 9.
 * Conséquence évitée de justesse : le cron du lundi n'aurait scrapé que 5
 * matchs de notes par journée dès la J1 du 21 août 2026. Ne JAMAIS revenir à
 * eventsround.php avec une clé gratuite. Le nom de fichier est conservé pour
 * ne pas toucher aux imports des 4 scripts consommateurs.
 */

import { getFootballDataToken } from "../../src/lib/football-api";
import { toParisDateTime, nextDay, seasonStartYear } from "../../src/lib/paris-time";

export interface L1MatchInfo {
  matchday: number;
  date: string; // YYYY-MM-DD (heure de Paris)
  time: string; // HH:MM (heure de Paris)
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  editionDate: string; // édition L'Équipe = lendemain du match
}

const FD_BASE = "https://api.football-data.org/v4";
const FD_COMPETITION = "FL1"; // Ligue 1

interface FdMatch {
  matchday: number | null;
  utcDate: string | null;
  homeTeam?: { name?: string | null };
  awayTeam?: { name?: string | null };
  score?: { fullTime?: { home: number | null; away: number | null } };
}

/**
 * Tous les matchs d'une journée. `season` au format clé "2026-2027".
 */
export async function getMatchday(
  matchday: number,
  season = "2025-2026"
): Promise<L1MatchInfo[]> {
  const year = seasonStartYear(season);
  if (!year) throw new Error(`[sportsdb] Clé de saison inexploitable : « ${season} »`);
  const token = await getFootballDataToken();
  if (!token) {
    throw new Error(
      "[sportsdb] Pas de token football-data.org (Admin → Configuration, champ Clé effectifs, ou env FOOTBALL_DATA_TOKEN)"
    );
  }

  const url = `${FD_BASE}/competitions/${FD_COMPETITION}/matches?matchday=${matchday}&season=${year}`;
  const res = await fetch(url, { headers: { "X-Auth-Token": token } });
  if (!res.ok) throw new Error(`[sportsdb] football-data.org HTTP ${res.status} (${url})`);
  const data = (await res.json()) as { matches?: FdMatch[] };
  const matches = Array.isArray(data.matches) ? data.matches : [];

  const out: L1MatchInfo[] = [];
  for (const m of matches) {
    const homeTeam = m.homeTeam?.name ?? "";
    const awayTeam = m.awayTeam?.name ?? "";
    if (!homeTeam || !awayTeam || !m.utcDate) continue;
    const local = toParisDateTime(m.utcDate);
    if (!local) continue;
    out.push({
      matchday,
      date: local.date,
      time: local.time,
      homeTeam,
      awayTeam,
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      editionDate: nextDay(local.date),
    });
  }
  return out;
}

/**
 * Get the L'Équipe edition dates needed for a matchday.
 * Returns unique dates sorted.
 */
export async function getEditionDates(
  matchday: number,
  season = "2025-2026"
): Promise<string[]> {
  const matches = await getMatchday(matchday, season);
  const dates = [...new Set(matches.map((m) => m.editionDate))].sort();
  return dates;
}

/**
 * Validate scraped scores against the API.
 * Returns warnings for mismatches.
 */
export function validateScores(
  scrapedMatches: { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number }[],
  apiMatches: L1MatchInfo[]
): { match: string; warning: string }[] {
  const warnings: { match: string; warning: string }[] = [];

  for (const scraped of scrapedMatches) {
    const api = apiMatches.find((m) => {
      const sHome = scraped.homeTeam.toLowerCase();
      const sAway = scraped.awayTeam.toLowerCase();
      const aHome = m.homeTeam.toLowerCase();
      const aAway = m.awayTeam.toLowerCase();
      return (
        (aHome.includes(sHome) || sHome.includes(aHome)) &&
        (aAway.includes(sAway) || sAway.includes(aAway))
      );
    });

    if (!api) continue;
    if (api.homeScore === null || api.awayScore === null) continue;

    if (scraped.homeScore !== api.homeScore || scraped.awayScore !== api.awayScore) {
      warnings.push({
        match: `${scraped.homeTeam} ${scraped.homeScore}-${scraped.awayScore} ${scraped.awayTeam}`,
        warning: `Score mismatch! Scraped: ${scraped.homeScore}-${scraped.awayScore}, API: ${api.homeScore}-${api.awayScore}`,
      });
    }
  }

  return warnings;
}
