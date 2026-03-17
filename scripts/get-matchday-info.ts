/**
 * Get matchday info from TheSportsDB.
 * Usage: npx tsx scripts/get-matchday-info.ts 26
 */

import { getMatchday, getEditionDates } from "./lib/sportsdb";

async function main() {
  const matchday = parseInt(process.argv[2] ?? "26");
  console.log(`\n=== Ligue 1 — Journée ${matchday} ===\n`);

  const matches = await getMatchday(matchday);

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

  const editions = await getEditionDates(matchday);
  console.log(`\n=== Éditions L'Équipe à scraper ===`);
  editions.forEach((d) => console.log(`  ${d}`));
  console.log(
    `\n  → npx tsx scripts/scrape-kiosque.ts --dates ${editions.join(",")}`
  );
}

main().catch(console.error);
