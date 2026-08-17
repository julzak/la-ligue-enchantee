/**
 * Sync du calendrier Ligue 1 → MATCH_SCHEDULE. Wrapper CLI du moteur partagé
 * src/lib/match-schedule-sync.ts (même code que le bouton admin) : plus aucune
 * logique ici.
 *
 * SOURCE : football-data.org (saison complète en 1 requête). L'ancienne version
 * appelait TheSportsDB round par round avec la clé de test publique "3", qui
 * tronque chaque journée à 5 matchs sur 9 : ne jamais y revenir.
 *
 * Usage :
 *   ./node_modules/.bin/tsx scripts/sync-match-schedule.ts          # sync complet
 *   ./node_modules/.bin/tsx scripts/sync-match-schedule.ts 26       # sync complet + éditions J26
 *   ./node_modules/.bin/tsx scripts/sync-match-schedule.ts --all    # idem sans arg
 *
 * Les arguments de journée des anciens crons restent acceptés : la synchro est
 * de toute façon TOUJOURS complète (1 seul appel API), l'argument ne sert plus
 * qu'à afficher les dates d'édition L'Équipe de la journée demandée.
 *
 * Les overrides admin (matchs reportés) sont préservés par le moteur.
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import { prisma } from "../src/lib/prisma";
import { resolveSeasonKey } from "./lib/season";
import { syncMatchSchedule } from "../src/lib/match-schedule-sync";

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--all");
  const focusDay = args.length > 0 ? parseInt(args[0]) : null;

  const seasonKey = await resolveSeasonKey(prisma);
  console.log(`Syncing full season ${seasonKey} from football-data.org...\n`);

  const result = await syncMatchSchedule(seasonKey);

  if (result.fetchErrors > 0) {
    console.error(`ÉCHEC : football-data.org indisponible ou token absent. Rien n'a été modifié.`);
    process.exit(1);
  }
  if (result.purged > 0) {
    console.log(`${result.purged} ligne(s) héritées de TheSportsDB purgées (tronquées, sans score ni override).`);
  }
  console.log(`Done. ${result.synced} matches synced sur ${result.daysWithData} journées.`);
  if (result.daysEmpty.length > 0) {
    console.log(`Journées sans données : ${result.daysEmpty.join(", ")}`);
  }

  // Dates d'édition L'Équipe pour la journée demandée (contrat des crons).
  if (focusDay && Number.isFinite(focusDay)) {
    const matches = await prisma.$queryRawUnsafe<{ edition_date: string; is_postponed: number; admin_override_date: string | null }[]>(
      "SELECT DISTINCT edition_date, is_postponed, admin_override_date FROM MATCH_SCHEDULE WHERE season = ? AND matchday = ? ORDER BY edition_date",
      seasonKey, focusDay
    );
    console.log(`\nEditions to scrape for J${focusDay}:`);
    matches.forEach((m) => {
      const date = m.admin_override_date ?? m.edition_date;
      const note = m.is_postponed ? " (POSTPONED)" : "";
      const override = m.admin_override_date ? " [admin override]" : "";
      console.log(`  ${date}${note}${override}`);
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
