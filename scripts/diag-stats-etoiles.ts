import { prisma } from "../src/lib/prisma";

async function main() {
  // Saison courante et journées publiées
  const seasons = await prisma.$queryRawUnsafe<{ ID_SEASON: number; LABEL: string; STATUS: string }[]>(
    "SELECT ID_SEASON, LABEL, STATUS FROM SEASON ORDER BY ID_SEASON"
  );
  console.log("SEASONS:", seasons);

  const days = await prisma.$queryRawUnsafe<{ day: number; n: bigint }[]>(
    "SELECT DAY as day, COUNT(*) as n FROM STATS_USER GROUP BY DAY ORDER BY day"
  );
  console.log("STATS_USER par journée:", days.map((d) => `J${d.day}:${d.n}`).join(" "));

  // Joueurs saison courante avec >=1 score et distribution du nb d'apparitions
  const cur = seasons.filter((s) => s.STATUS !== "CLOSED").map((s) => s.ID_SEASON);
  console.log("Saisons non closes:", cur);

  const appearances = await prisma.$queryRawUnsafe<{ days: bigint; n: bigint }[]>(
    `SELECT cnt as days, COUNT(*) as n FROM (
       SELECT s.ID_PLAYER, COUNT(DISTINCT s.DAY) as cnt
       FROM SCORE s JOIN PLAYER p ON p.ID_PLAYER = s.ID_PLAYER
       WHERE s.USED > 0 ${cur.length ? `AND p.ID_SEASON IN (${cur.join(",")})` : ""}
       GROUP BY s.ID_PLAYER
     ) t GROUP BY cnt ORDER BY cnt`
  ).catch(async (e) => {
    console.log("(requête avec p.ID_SEASON a échoué:", (e as Error).message.slice(0, 120), ") — fallback sans filtre saison");
    return prisma.$queryRawUnsafe<{ days: bigint; n: bigint }[]>(
      `SELECT cnt as days, COUNT(*) as n FROM (
         SELECT ID_PLAYER, COUNT(DISTINCT DAY) as cnt FROM SCORE WHERE USED > 0 GROUP BY ID_PLAYER
       ) t GROUP BY cnt ORDER BY cnt`
    );
  });
  console.log("Distribution apparitions (days -> nb joueurs):", appearances.map((a) => `${a.days}:${a.n}`).join(" "));

  // Users avec des balises img dans NAME (trophées)
  const users = await prisma.$queryRawUnsafe<{ ID_USER: number; NAME: string }[]>(
    "SELECT ID_USER, NAME FROM USER WHERE NAME LIKE '%<img%'"
  );
  console.log(`\nUsers avec trophées HTML (${users.length}):`);
  for (const u of users) {
    const clean = u.NAME.replace(/<[^>]*>/g, "").trim();
    const imgs = (u.NAME.match(/src="[^"]*"/g) ?? []).map((s) => s.slice(5, -1).split("/").pop());
    console.log(`  #${u.ID_USER} ${clean}: ${imgs.join(", ")}`);
  }
}

main().finally(() => prisma.$disconnect());
