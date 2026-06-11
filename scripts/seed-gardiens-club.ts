/**
 * Seed des pseudo-joueurs « Gardiens [Club] » (1 par club de la saison
 * courante) : règle 2.1 + décision 2026-06-10, docs/regles-encheres.md §7.
 *
 * ⚠️ NE JAMAIS exécuter via un agent : DATABASE_URL local pointe sur la base
 * de PRODUCTION. Ce script est appliqué MANUELLEMENT par Julien avant merge.
 *
 * Idempotent : la clé stable est PLAYER.LINK = `gardiens_<slug du club>`
 * (ex: gardiens_marseille). Re-exécutable sans doublon, y compris après
 * l'import des effectifs réels (juillet 2026) : il suffit de le relancer
 * une fois les clubs de la saison en base. Aucun ID en dur.
 *
 * Usage : ./node_modules/.bin/tsx scripts/seed-gardiens-club.ts [--apply]
 *   (sans --apply : dry-run, affiche ce qui serait créé sans rien écrire)
 *
 * Rollback : DELETE FROM PLAYER WHERE LINK LIKE 'gardiens\_%';
 *   (sans danger tant qu'aucune mise/compo ne pointe un pseudo-gardien ;
 *    sinon supprimer d'abord les lignes AUCTION_BID / TEAM / TEAM_DAY
 *    correspondantes)
 */

import { PrismaClient } from "@prisma/client";
import {
  clubGoalkeeperKey,
  CLUB_GK_POSITION,
  CLUB_GK_FNAME,
} from "../src/lib/club-goalkeeper";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  // Clubs de la saison courante (IS_CURRENT) si elle a des clubs rattachés,
  // sinon fallback legacy : tous les clubs (seasonId NULL, données mock).
  const currentSeason = await prisma.season.findFirst({ where: { isCurrent: true } });
  let clubs = currentSeason
    ? await prisma.club.findMany({ where: { seasonId: currentSeason.id, id: { gt: 0 } } })
    : [];
  if (clubs.length === 0) {
    clubs = await prisma.club.findMany({ where: { id: { gt: 0 } } });
  }
  if (clubs.length === 0) {
    console.error("Aucun club en base : rien à seeder.");
    process.exit(1);
  }

  // Garde-fou : collision de slug entre deux clubs = clé non stable, on arrête.
  const byKey = new Map<string, string>();
  for (const c of clubs) {
    const key = clubGoalkeeperKey(c.name);
    const existing = byKey.get(key);
    if (existing && existing !== c.name) {
      console.error(`Collision de clé "${key}" entre "${existing}" et "${c.name}". Abandon.`);
      process.exit(1);
    }
    byKey.set(key, c.name);
  }

  console.log(
    `${clubs.length} clubs (saison ${currentSeason ? `${currentSeason.label} #${currentSeason.id}` : "legacy/mock"})` +
      (apply ? "" : " — DRY-RUN (aucune écriture, relancer avec --apply)")
  );

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const club of clubs) {
    const key = clubGoalkeeperKey(club.name);
    const existing = await prisma.player.findFirst({ where: { link: key } });

    if (!existing) {
      console.log(`  + ${key} → « ${CLUB_GK_FNAME} ${club.name} » (club #${club.id})`);
      if (apply) {
        await prisma.player.create({
          data: {
            clubId: club.id,
            fname: CLUB_GK_FNAME,
            lname: club.name,
            position: CLUB_GK_POSITION,
            link: key,
            seasonId: club.seasonId,
          },
        });
      }
      created++;
      continue;
    }

    // Réalignement (changement d'ID de club ou de saison après ré-import).
    const needsUpdate =
      existing.clubId !== club.id ||
      existing.seasonId !== club.seasonId ||
      existing.position !== CLUB_GK_POSITION ||
      existing.fname !== CLUB_GK_FNAME ||
      existing.lname !== club.name;

    if (needsUpdate) {
      console.log(`  ~ ${key} : réalignement sur club #${club.id} (player #${existing.id})`);
      if (apply) {
        await prisma.player.update({
          where: { id: existing.id },
          data: {
            clubId: club.id,
            fname: CLUB_GK_FNAME,
            lname: club.name,
            position: CLUB_GK_POSITION,
            seasonId: club.seasonId,
          },
        });
      }
      updated++;
    } else {
      unchanged++;
    }
  }

  console.log(
    `Bilan : ${created} créé(s), ${updated} réaligné(s), ${unchanged} inchangé(s)` +
      (apply ? "" : " [dry-run]")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
