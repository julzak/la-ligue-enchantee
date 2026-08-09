/**
 * Seed des pseudo-joueurs « Gardiens [Club] » (1 par club de la saison
 * courante) : règle 2.1 + décision 2026-06-10, docs/regles-encheres.md §7.
 *
 * ⚠️ NE JAMAIS exécuter via un agent : DATABASE_URL local pointe sur la base
 * de PRODUCTION. Ce script est appliqué MANUELLEMENT par Julien avant merge.
 *
 * ORDRE OBLIGATOIRE — respecter impérativement cette séquence :
 *   1. Importer les clubs de la saison (table CLUB, seasonId renseigné).
 *   2. Importer les joueurs nommés (table PLAYER, lien L'Équipe).
 *   3. Exécuter CE script : seed des pseudo-gardiens.
 * Le seed AVANT l'import des joueurs ferait de chaque pseudo-gardien le seul
 * joueur de sa saison : le scoping saison exclurait alors tous les vrais
 * joueurs du périmètre enchères. Le script le détecte et refuse --apply.
 *
 * Vérification préalable recommandée (s'assurer qu'aucun pseudo ne traîne) :
 *   SELECT ID_PLAYER, LINK FROM PLAYER WHERE LINK LIKE 'gardiens\_%';
 *   → doit rendre 0 ligne si c'est la première exécution.
 *
 * Idempotent : la clé stable est PLAYER.LINK = `gardiens_<slug du club>`
 * (ex: gardiens_marseille). Re-exécutable sans doublon, y compris après
 * l'import des effectifs réels (juillet 2026). Aucun ID en dur.
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
  CLUB_GK_KEY_PREFIX,
  CLUB_GK_POSITION,
  CLUB_GK_FNAME,
} from "../src/lib/club-goalkeeper";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  // M2 (a) : clubs de la saison courante UNIQUEMENT.
  // Le fallback "tous clubs de toutes saisons" est supprimé : s'il n'y a pas
  // de clubs dans la saison courante, c'est un signe que l'import des clubs
  // n'a pas encore été fait. Abort avec message clair.
  const currentSeason = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (!currentSeason) {
    console.error("Aucune saison courante (isCurrent=true) : créez la saison avant de seeder.");
    process.exit(1);
  }
  const clubs = await prisma.club.findMany({ where: { seasonId: currentSeason.id, id: { gt: 0 } } });
  if (clubs.length === 0) {
    console.error(
      `Aucun club rattaché à la saison courante « ${currentSeason.label} » (id #${currentSeason.id}).\n` +
      "Importez d'abord les clubs (étape 1 de l'ordre obligatoire) puis relancez ce script."
    );
    process.exit(1);
  }

  // M2 (b) : garde-fou « aucun joueur nommé ».
  // Si la saison courante ne contient que des pseudo-gardiens (ou aucun
  // joueur du tout), seeder créerait un périmètre où les pseudo-joueurs sont
  // les seuls joueurs scopés, excluant tous les vrais joueurs.
  // Attention SQL trois valeurs : `NOT (link LIKE ...)` exclut aussi les LINK
  // NULL. Or l'import 2026-2027 ne renseigne pas LINK (contrairement aux
  // anciens joueurs scrapés L'Équipe) : la garde voyait "0 joueur nommé" avec
  // 471 joueurs en base et refusait le seed (trouvé en répétition P2).
  const namedPlayersCount = await prisma.player.count({
    where: {
      seasonId: currentSeason.id,
      OR: [
        { link: null },
        { NOT: { link: { startsWith: CLUB_GK_KEY_PREFIX } } },
      ],
    },
  });
  if (namedPlayersCount === 0 && apply) {
    console.error(
      "Aucun joueur nommé dans la saison courante.\n" +
      "Importez d'abord les joueurs (étape 2 de l'ordre obligatoire) puis relancez ce script.\n" +
      "Sans joueurs nommés, les pseudo-gardiens seraient les seuls joueurs scopés et\n" +
      "excluraient tous les vrais joueurs du périmètre enchères."
    );
    process.exit(1);
  }
  if (namedPlayersCount === 0) {
    console.warn(
      "[AVERTISSEMENT dry-run] Aucun joueur nommé dans la saison courante.\n" +
      "L'application du seed (--apply) sera refusée tant que les joueurs ne sont pas importés."
    );
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
