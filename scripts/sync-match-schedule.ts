/**
 * Sync match schedule from TheSportsDB → DB.
 *
 * Usage:
 *   npx tsx scripts/sync-match-schedule.ts 26        # sync one matchday
 *   npx tsx scripts/sync-match-schedule.ts 26 38     # sync range
 *   npx tsx scripts/sync-match-schedule.ts --all      # sync all (1-38)
 *
 * Admin overrides (postponed matches) are preserved — only non-overridden rows are updated.
 */

import { PrismaClient } from "@prisma/client";
import { getMatchday } from "./lib/sportsdb";
import { resolveSeasonKey } from "./lib/season";

const prisma = new PrismaClient();

async function syncMatchday(day: number, seasonKey: string) {
  const matches = await getMatchday(day, seasonKey);
  if (matches.length === 0) {
    console.log(`  J${day}: no data from TheSportsDB`);
    return 0;
  }

  let synced = 0;
  for (const m of matches) {
    // Check if admin has overridden this match
    const existing = await prisma.$queryRawUnsafe<{ admin_override_date: string | null }[]>(
      "SELECT admin_override_date FROM MATCH_SCHEDULE WHERE season = ? AND matchday = ? AND home_team = ? AND away_team = ? LIMIT 1",
      seasonKey, day, m.homeTeam, m.awayTeam
    );

    if (existing.length > 0 && existing[0].admin_override_date) {
      // Admin override exists — don't touch it
      // But still update the score if available
      if (m.homeScore !== null) {
        await prisma.$executeRawUnsafe(
          "UPDATE MATCH_SCHEDULE SET home_score = ?, away_score = ? WHERE season = ? AND matchday = ? AND home_team = ? AND away_team = ?",
          m.homeScore, m.awayScore, seasonKey, day, m.homeTeam, m.awayTeam
        );
      }
      continue;
    }

    const editionDate = m.editionDate;
    const isPostponed = m.homeScore === null && m.date < new Date().toISOString().slice(0, 10) ? 1 : 0;

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
      seasonKey, day, m.homeTeam, m.awayTeam, m.date, m.time + ":00", editionDate,
      m.homeScore, m.awayScore, isPostponed
    );
    synced++;
  }

  console.log(`  J${day}: ${matches.length} matches, ${synced} synced`);
  return synced;
}

async function main() {
  const args = process.argv.slice(2);

  let startDay = 1, endDay = 38;

  if (args.includes("--all")) {
    // sync all
  } else if (args.length >= 2) {
    startDay = parseInt(args[0]);
    endDay = parseInt(args[1]);
  } else if (args.length === 1) {
    startDay = endDay = parseInt(args[0]);
  } else {
    console.log("Usage: npx tsx scripts/sync-match-schedule.ts <matchday> [end_matchday]");
    console.log("       npx tsx scripts/sync-match-schedule.ts --all");
    process.exit(0);
  }

  const seasonKey = await resolveSeasonKey(prisma);
  console.log(`Syncing matchdays ${startDay}-${endDay} (saison ${seasonKey}) from TheSportsDB...\n`);

  let total = 0;
  for (let day = startDay; day <= endDay; day++) {
    total += await syncMatchday(day, seasonKey);
    // Rate limit: TheSportsDB is free, be nice
    if (endDay - startDay > 2) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\nDone. ${total} matches synced.`);

  // Show edition dates for the requested matchdays
  if (endDay === startDay) {
    const matches = await prisma.$queryRawUnsafe<{ edition_date: string; is_postponed: number; admin_override_date: string | null }[]>(
      "SELECT DISTINCT edition_date, is_postponed, admin_override_date FROM MATCH_SCHEDULE WHERE season = ? AND matchday = ? ORDER BY edition_date",
      seasonKey, startDay
    );
    console.log(`\nEditions to scrape for J${startDay}:`);
    matches.forEach((m) => {
      const date = m.admin_override_date ?? m.edition_date;
      const note = m.is_postponed ? " (POSTPONED)" : "";
      const override = m.admin_override_date ? " [admin override]" : "";
      console.log(`  ${String(date).slice(0, 10)}${note}${override}`);
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
