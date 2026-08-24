// Diag bug Thomas 2026-08-24 : interligue 108 participants + ligues "?"
// + Onze des Saucisses. Vérifie que STATS_USER/SCORE contiennent des rows
// des saisons précédentes qui polluent les requêtes non scopées.
import { prisma } from "../src/lib/prisma";

async function main() {
  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  console.log("Saison courante:", season?.id, season?.label ?? season);

  const leagues = await prisma.league.findMany({ where: { seasonId: season!.id } });
  console.log("Ligues saison courante:", leagues.map((l) => `${l.id}:${l.name}`));

  const currentIds = leagues.map((l) => l.id);

  // Interligue : distinct user-league dans STATS_USER day<=currentDay
  const maxDayRows = await prisma.$queryRawUnsafe<{ maxDay: number | null }[]>(
    "SELECT MAX(s.DAY) AS maxDay FROM SCORE s JOIN PLAYER p ON p.ID_PLAYER = s.ID_PLAYER WHERE p.ID_SEASON = ?",
    season!.id
  );
  const currentDay = Number(maxDayRows[0]?.maxDay ?? 0);
  console.log("currentDay (saison courante):", currentDay);

  const all = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    "SELECT COUNT(DISTINCT CONCAT(ID_USER,'-',ID_LEAGUE)) n FROM STATS_USER WHERE ID_LEAGUE > 0 AND DAY <= ?",
    currentDay
  );
  const cur = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(DISTINCT CONCAT(ID_USER,'-',ID_LEAGUE)) n FROM STATS_USER WHERE DAY <= ? AND ID_LEAGUE IN (${currentIds.join(",")})`,
    currentDay
  );
  console.log("Participants interligue SANS filtre saison:", Number(all[0].n));
  console.log("Participants interligue AVEC filtre saison:", Number(cur[0].n));

  // Répartition par ligue des rows STATS_USER hors saison courante
  const orphans = await prisma.$queryRawUnsafe<{ ID_LEAGUE: number; n: bigint }[]>(
    `SELECT ID_LEAGUE, COUNT(DISTINCT ID_USER) n FROM STATS_USER WHERE ID_LEAGUE > 0 AND DAY <= ? AND ID_LEAGUE NOT IN (${currentIds.join(",")}) GROUP BY ID_LEAGUE`,
    currentDay
  );
  console.log("Ligues hors saison présentes (-> '?'):", orphans.map((o) => `${o.ID_LEAGUE} (${Number(o.n)} users)`));

  // Saucisses : scores day=currentDay dont le joueur n'est PAS de la saison courante
  const badScores = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    "SELECT COUNT(*) n FROM SCORE s JOIN PLAYER p ON p.ID_PLAYER = s.ID_PLAYER WHERE s.DAY = ? AND s.USED > 0 AND (p.ID_SEASON IS NULL OR p.ID_SEASON <> ?)",
    currentDay, season!.id
  );
  const goodScores = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    "SELECT COUNT(*) n FROM SCORE s JOIN PLAYER p ON p.ID_PLAYER = s.ID_PLAYER WHERE s.DAY = ? AND s.USED > 0 AND p.ID_SEASON = ?",
    currentDay, season!.id
  );
  console.log(`SCORE day=${currentDay} used>0 : saison courante=${Number(goodScores[0].n)}, hors saison=${Number(badScores[0].n)}`);

  // Exemple des 5 pires perfs polluées (ce que voit la carte Saucisses)
  const worst = await prisma.$queryRawUnsafe<{ ID_PLAYER: number; POINTS: string; FNAME: string | null; LNAME: string | null; ID_SEASON: number | null }[]>(
    "SELECT s.ID_PLAYER, s.POINTS, p.FNAME, p.LNAME, p.ID_SEASON FROM SCORE s LEFT JOIN PLAYER p ON p.ID_PLAYER = s.ID_PLAYER WHERE s.DAY = ? AND s.USED > 0 AND s.POINTS > 0 AND s.POINTS <> 2 ORDER BY s.POINTS ASC LIMIT 8",
    currentDay
  );
  console.log("Pires perfs brutes day courant:", worst);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
