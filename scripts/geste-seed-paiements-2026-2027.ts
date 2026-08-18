// Geste admin du 2026-08-18 : seed des lignes de pointage cotisations pour
// 2026-2027. La page Admin -> Paiements était vide (remontée Pierre Berthet)
// car ces lignes ne sont créées que par le « Lancer la saison »
// (api/admin/seasons/launch), jamais exécuté : la saison est restée en statut
// AUCTION. Même INSERT IGNORE que le lancement (idempotent, aucun doublon si
// le lancement est fait ensuite).
// Exécution : ./node_modules/.bin/tsx scripts/geste-seed-paiements-2026-2027.ts
import { prisma } from "../src/lib/prisma";
import { getCurrentSeason, getCurrentSeasonKey } from "../src/lib/season";

async function main() {
  const season = await getCurrentSeason();
  const seasonKey = await getCurrentSeasonKey();
  if (!season) throw new Error("Aucune saison courante");
  console.log(`Saison courante : ${season.label} (id ${season.id}, statut ${season.status}), clé ${seasonKey}`);

  const inserted = await prisma.$executeRawUnsafe(
    `INSERT IGNORE INTO PAYMENT (user_id, season)
     SELECT lu.ID_USER, ? FROM LEAGUE_USER lu
     JOIN LEAGUE l ON l.ID_LEAGUE = lu.ID_LEAGUE
     WHERE l.ID_SEASON = ?`,
    seasonKey, season.id
  );
  console.log(`${inserted} ligne(s) PAYMENT créée(s) pour ${seasonKey}`);

  const check = await prisma.$queryRawUnsafe(
    "SELECT season, COUNT(*) as n, SUM(paid) as paid FROM PAYMENT GROUP BY season ORDER BY season"
  );
  console.log("État final :", check);
}

main().finally(() => prisma.$disconnect());
