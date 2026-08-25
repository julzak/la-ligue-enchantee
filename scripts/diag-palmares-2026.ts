import { prisma } from "../src/lib/prisma";

async function main() {
  const palmares = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    "SELECT * FROM PALMARES WHERE ID_SEASON = 1"
  );
  console.log("PALMARES saison 1 (2025-2026):");
  console.log(palmares);

  // Les 6 porteurs de feuille / ballon d'or : étaient-ils dans une ligue de la saison 1 ?
  const suspects = [190, 807, 1360, 193, 1346, 1318];
  const membership = await prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string; LEAGUE: string; SEASON: number | null }[]>(
    `SELECT lu.ID_USER, u.NAME, l.NAME as LEAGUE, l.ID_SEASON as SEASON
     FROM LEAGUE_USER lu
     JOIN LEAGUE l ON l.ID_LEAGUE = lu.ID_LEAGUE
     JOIN USER u ON u.ID_USER = lu.ID_USER
     WHERE lu.ID_USER IN (${suspects.join(",")})`
  );
  console.log("\nAppartenance aux ligues des porteurs feuille/ballon d'or:");
  for (const m of membership) {
    console.log(`  #${m.ID_USER} ${m.NAME.replace(/<[^>]*>/g, "").trim()} -> ${m.LEAGUE} (saison ${m.SEASON})`);
  }
}

main().finally(() => prisma.$disconnect());
