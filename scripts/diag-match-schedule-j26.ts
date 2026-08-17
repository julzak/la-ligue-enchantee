import { prisma } from "../src/lib/prisma";

async function main() {
  const matches = await prisma.$queryRawUnsafe<{
    matchday: number; home_team: string; away_team: string; match_date: Date; match_time: Date | null;
  }[]>(
    "SELECT matchday, home_team, away_team, match_date, match_time FROM MATCH_SCHEDULE WHERE matchday = 26 ORDER BY match_date, match_time"
  );
  console.log(`\nMATCH_SCHEDULE j26 (${matches.length} matches):\n`);
  for (const m of matches) {
    const d = new Date(m.match_date).toISOString().slice(0, 10);
    const t = m.match_time ? new Date(m.match_time).toISOString().slice(11, 16) : "--:--";
    console.log(`  ${d} ${t}  ${m.home_team.padEnd(25)} vs ${m.away_team}`);
  }

  // Check table definition
  const cols = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string; DATA_TYPE: string }[]>(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'MATCH_SCHEDULE'"
  );
  console.log(`\nMATCH_SCHEDULE columns:`, cols.map((c) => c.COLUMN_NAME).join(", "));

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
