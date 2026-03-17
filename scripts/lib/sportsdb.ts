/**
 * TheSportsDB free API — Ligue 1 match data.
 * No API key needed. Used for:
 * 1. Getting match dates → which L'Équipe editions to scrape
 * 2. Double-checking scores from Vision extraction
 */

export interface L1MatchInfo {
  matchday: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  editionDate: string; // L'Équipe edition = match date + 1 day
}

const LIGUE_1_ID = 4334; // TheSportsDB league ID for Ligue 1

/**
 * Fetch all matches for a given matchday.
 */
export async function getMatchday(
  matchday: number,
  season = "2025-2026"
): Promise<L1MatchInfo[]> {
  const url = `https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=${LIGUE_1_ID}&r=${matchday}&s=${season}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.events) return [];

  return data.events.map((e: Record<string, string | null>) => {
    const matchDate = e.dateEvent ?? "";
    // L'Équipe publishes notes the day AFTER the match
    const editionDate = nextDay(matchDate);

    return {
      matchday,
      date: matchDate,
      time: (e.strTime ?? "").slice(0, 5),
      homeTeam: e.strHomeTeam ?? "",
      awayTeam: e.strAwayTeam ?? "",
      homeScore: e.intHomeScore !== null ? parseInt(e.intHomeScore) : null,
      awayScore: e.intAwayScore !== null ? parseInt(e.intAwayScore) : null,
      editionDate,
    };
  });
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
 * Validate scraped scores against TheSportsDB.
 * Returns warnings for mismatches.
 */
export function validateScores(
  scrapedMatches: { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number }[],
  apiMatches: L1MatchInfo[]
): { match: string; warning: string }[] {
  const warnings: { match: string; warning: string }[] = [];

  for (const scraped of scrapedMatches) {
    // Fuzzy match by team name
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

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
