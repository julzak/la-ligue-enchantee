// Geste admin du 2026-08-18 (demande Pierre Berthet) : renomme les fils forum
// jokers de la saison courante de « Jokers <saison> » vers
// « Jokers <ligue> <saison> » (ex. « Jokers L1 2026-2027 »).
// Idempotent : ne touche que les fils encore à l'ancien titre.
// Exécution : ./node_modules/.bin/tsx scripts/geste-rename-fils-jokers-2026.ts
import { prisma } from "../src/lib/prisma";
import { getCurrentSeason, getCurrentSeasonKey } from "../src/lib/season";
import { leagueSlug } from "../src/lib/season-key";
import { jokerTopicTitle } from "../src/lib/joker-forum";

async function main() {
  const season = await getCurrentSeason();
  const seasonKey = await getCurrentSeasonKey();
  if (!season) throw new Error("Aucune saison courante");

  const leagues = await prisma.league.findMany({ where: { seasonId: season.id } });
  const legacyTitle = `Jokers ${seasonKey}`;

  for (const league of leagues) {
    const slug = leagueSlug(league.name);
    const newTitle = jokerTopicTitle(league.name, seasonKey);
    const updated = await prisma.$executeRawUnsafe(
      "UPDATE FORUM_TOPIC SET title = ? WHERE category = ? AND title = ?",
      newTitle, slug, legacyTitle
    );
    console.log(`${league.name} (${slug}) : ${updated} fil(s) renommé(s) en « ${newTitle} »`);
  }

  const check = await prisma.$queryRawUnsafe(
    "SELECT id, category, title FROM FORUM_TOPIC WHERE title LIKE ? ORDER BY id",
    `Jokers %${seasonKey}`
  );
  console.log("État final :", check);
}

main().finally(() => prisma.$disconnect());
