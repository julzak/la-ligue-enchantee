import { prisma } from "../src/lib/prisma";
async function main() {
  const rows = await prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string; LEAGUE: string; SEASON: number }[]>(
    `SELECT u.ID_USER, u.NAME, l.NAME as LEAGUE, l.ID_SEASON as SEASON
     FROM USER u
     LEFT JOIN LEAGUE_USER lu ON lu.ID_USER = u.ID_USER
     LEFT JOIN LEAGUE l ON l.ID_LEAGUE = lu.ID_LEAGUE
     WHERE u.NAME LIKE '%LST%' OR u.NAME LIKE '%Batistuta%'`
  );
  for (const r of rows) console.log(`#${r.ID_USER} "${r.NAME}" -> ${r.LEAGUE} (saison ${r.SEASON})`);
}
main().finally(() => prisma.$disconnect());
