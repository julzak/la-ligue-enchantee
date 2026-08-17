import { prisma } from "../src/lib/prisma";

async function main() {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    "SELECT * FROM MATCH_SCHEDULE WHERE matchday = 26 AND (home_team LIKE '%Paris SG%' OR home_team LIKE '%PSG%' OR away_team LIKE '%Nantes%')"
  );
  console.log(`\nPSG/Nantes match j26 in MATCH_SCHEDULE:\n`);
  for (const r of rows) console.log(r);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
