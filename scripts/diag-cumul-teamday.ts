// Diag : pourquoi le cumul n'affiche qu'une journée pour certaines équipes
// (signalement Pierre 2026-08-31 : GeLo 59, Moktar L3, JRS=1 au lieu de 2).
// Hypothèse : pas de ligne TEAM_DAY pour une des journées (fallback publish
// non répliqué dans getParticipantCumulativeStats).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Journée courante
  const md = await prisma.$queryRawUnsafe<{ v: string }[]>(
    "SELECT VALUE AS v FROM CONFIG WHERE NAME = 'current_matchday'"
  ).catch(() => null);
  console.log("current_matchday config:", md);

  // Tous les participants : nombre de journées distinctes en TEAM_DAY
  const rows = await prisma.$queryRawUnsafe<
    { ID_LEAGUE: number; ID_USER: number; NAME: string; days: string; ndays: number }[]
  >(`
    SELECT td.ID_LEAGUE, td.ID_USER, u.NAME,
           GROUP_CONCAT(DISTINCT td.DAY ORDER BY td.DAY) AS days,
           COUNT(DISTINCT td.DAY) AS ndays
      FROM TEAM_DAY td
      JOIN USER u ON u.ID_USER = td.ID_USER
     GROUP BY td.ID_LEAGUE, td.ID_USER, u.NAME
     ORDER BY td.ID_LEAGUE, ndays, u.NAME
  `);
  for (const r of rows) {
    console.log(`L${r.ID_LEAGUE} ${r.NAME}: days=[${r.days}] (${Number(r.ndays)})`);
  }

  // Sanity : STATS_USER (classement autoritaire) pour les mêmes users
  const su = await prisma.$queryRawUnsafe<
    { ID_LEAGUE: number; ID_USER: number; NAME: string; days: string }[]
  >(`
    SELECT s.ID_LEAGUE, s.ID_USER, u.NAME, GROUP_CONCAT(DISTINCT s.DAY ORDER BY s.DAY) AS days
      FROM STATS_USER s JOIN USER u ON u.ID_USER = s.ID_USER
     GROUP BY s.ID_LEAGUE, s.ID_USER, u.NAME
     ORDER BY s.ID_LEAGUE, u.NAME
  `);
  console.log("\n--- STATS_USER (journées publiées par user) ---");
  for (const r of su) console.log(`L${r.ID_LEAGUE} ${r.NAME}: [${r.days}]`);
}

main().finally(() => prisma.$disconnect());
