// Republie STATS_USER (classement) pour une plage de journées, sans relancer
// la chronique Lia. Même calcul que POST /api/admin/publish (recomputeStatsForDay).
// Usage : ./node_modules/.bin/tsx scripts/republish-stats-user.ts <jourDebut> <jourFin>
// Toujours dans l'ordre croissant : le rang ligue d'une journée s'appuie sur
// les journées précédentes. Sauvegarder STATS_USER avant.
import { prisma } from "../src/lib/prisma";
import { recomputeStatsForDay } from "../src/lib/publish-stats";

async function main() {
  const from = Number(process.argv[2]);
  const to = Number(process.argv[3]);
  if (!from || !to || from > to) throw new Error("usage : republish-stats-user.ts <jourDebut> <jourFin>");
  const published = await prisma.statsUser.aggregate({ _max: { day: true } });
  if (to > (published._max.day ?? 0)) throw new Error(`J${to} n'a jamais été publiée (max J${published._max.day})`);
  for (let day = from; day <= to; day++) {
    const leagues = await recomputeStatsForDay(day);
    console.log(`J${day} republiée (${leagues.length} ligues)`);
  }
}

main().finally(() => prisma.$disconnect());
