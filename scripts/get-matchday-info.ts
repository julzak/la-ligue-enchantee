/**
 * Get matchday info from football-data.org (saison courante en base).
 * Usage: ./node_modules/.bin/tsx scripts/get-matchday-info.ts 26
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import { prisma } from "../src/lib/prisma";
import { getMatchday, getEditionDates } from "./lib/sportsdb";
import { resolveSeasonKey } from "./lib/season";

async function main() {
  const matchday = parseInt(process.argv[2] ?? "26");
  const seasonKey = await resolveSeasonKey(prisma);
  console.log(`\n=== Ligue 1 — Journée ${matchday} (${seasonKey}) ===\n`);

  const matches = await getMatchday(matchday, seasonKey);

  if (matches.length === 0) {
    console.log("Aucun match trouvé.");
    return;
  }

  // Sort by date/time
  matches.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  for (const m of matches) {
    const score =
      m.homeScore !== null ? `${m.homeScore}-${m.awayScore}` : "à venir";
    console.log(
      `  ${m.date} ${m.time}  ${m.homeTeam.padEnd(20)} ${score.padStart(5)}  ${m.awayTeam}`
    );
  }

  const editions = await getEditionDates(matchday, seasonKey);
  console.log(`\n=== Éditions L'Équipe à scraper ===`);
  editions.forEach((d) => console.log(`  ${d}`));
  console.log(
    `\n  → npx tsx scripts/scrape-kiosque.ts --dates ${editions.join(",")}`
  );
}

main().catch(console.error);
