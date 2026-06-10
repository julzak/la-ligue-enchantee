import { prisma } from "./prisma";

// Sync du calendrier Ligue 1 depuis TheSportsDB vers MATCH_SCHEDULE,
// déclenchable depuis l'admin (miroir de scripts/sync-match-schedule.ts,
// qui reste utilisable en CLI/cron). Les overrides admin (matchs reportés)
// sont préservés : seules les lignes non overridées sont mises à jour.

const LIGUE_1_ID = 4334; // id TheSportsDB de la Ligue 1

interface SportsDbEvent {
  dateEvent: string | null;
  strTime: string | null;
  strHomeTeam: string | null;
  strAwayTeam: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
}

export interface ScheduleSyncResult {
  synced: number;
  daysWithData: number;
  daysEmpty: number[];
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function syncMatchSchedule(seasonKey: string): Promise<ScheduleSyncResult> {
  let synced = 0;
  let daysWithData = 0;
  const daysEmpty: number[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (let day = 1; day <= 38; day++) {
    let events: SportsDbEvent[] = [];
    try {
      const res = await fetch(
        `https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=${LIGUE_1_ID}&r=${day}&s=${seasonKey}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      events = Array.isArray(data.events) ? data.events : [];
    } catch {
      events = [];
    }

    if (events.length === 0) {
      daysEmpty.push(day);
      continue;
    }
    daysWithData++;

    for (const e of events) {
      const matchDate = e.dateEvent ?? "";
      const homeTeam = e.strHomeTeam ?? "";
      const awayTeam = e.strAwayTeam ?? "";
      if (!matchDate || !homeTeam || !awayTeam) continue;

      const time = (e.strTime ?? "").slice(0, 5) || "20:00";
      const homeScore = e.intHomeScore != null ? parseInt(e.intHomeScore) : null;
      const awayScore = e.intAwayScore != null ? parseInt(e.intAwayScore) : null;
      const editionDate = nextDay(matchDate);

      // Override admin existant : on ne touche pas aux dates, score seulement.
      const existing = await prisma.$queryRawUnsafe<{ admin_override_date: string | null }[]>(
        "SELECT admin_override_date FROM MATCH_SCHEDULE WHERE season = ? AND matchday = ? AND home_team = ? AND away_team = ? LIMIT 1",
        seasonKey, day, homeTeam, awayTeam
      );
      if (existing.length > 0 && existing[0].admin_override_date) {
        if (homeScore !== null) {
          await prisma.$executeRawUnsafe(
            "UPDATE MATCH_SCHEDULE SET home_score = ?, away_score = ? WHERE season = ? AND matchday = ? AND home_team = ? AND away_team = ?",
            homeScore, awayScore, seasonKey, day, homeTeam, awayTeam
          );
        }
        continue;
      }

      const isPostponed = homeScore === null && matchDate < today ? 1 : 0;

      await prisma.$executeRawUnsafe(
        `INSERT INTO MATCH_SCHEDULE (season, matchday, home_team, away_team, match_date, match_time, edition_date, home_score, away_score, is_postponed, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'thesportsdb')
         ON DUPLICATE KEY UPDATE
           match_date = VALUES(match_date),
           match_time = VALUES(match_time),
           edition_date = VALUES(edition_date),
           home_score = COALESCE(VALUES(home_score), home_score),
           away_score = COALESCE(VALUES(away_score), away_score),
           is_postponed = VALUES(is_postponed)`,
        seasonKey, day, homeTeam, awayTeam, matchDate, time + ":00", editionDate,
        homeScore, awayScore, isPostponed
      );
      synced++;
    }

    // Rate limit : API gratuite, on espace un peu les appels.
    await new Promise((r) => setTimeout(r, 150));
  }

  return { synced, daysWithData, daysEmpty };
}
