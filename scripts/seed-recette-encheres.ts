/**
 * Seed de l'environnement de recette E2E — module enchères.
 *
 * Ce script crée sur la base RECETTE uniquement :
 *   - 1 saison isCurrent=true (2026-2027, statut AUCTION)
 *   - 6 clubs fictifs rattachés à cette saison
 *   - 80 joueurs fictifs plausibles (G/DEF/MIL/ATT, noms fictifs)
 *   - 4 participants (users) de recette avec mots de passe connus (recette2026)
 *   - 1 ligue de recette rattachée à la saison, avec les 4 participants inscrits
 *
 * USAGE :
 *   DATABASE_URL="mysql://recette:recette2026@127.0.0.1:3310/ligueenc_recette" \
 *   ./node_modules/.bin/tsx scripts/seed-recette-encheres.ts [--apply]
 *
 *   Sans --apply : dry-run (aucune écriture).
 *   Avec --apply  : écriture effective sur la base recette.
 *
 * ORDRE d'exécution recommandé :
 *   1. Ce script (--apply)
 *   2. scripts/seed-gardiens-club.ts (--apply) — ajoute les pseudo-gardiens de clubs
 *
 * Idempotent : re-exécutable, détecte la saison/ligue recette existante et les skip.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const RECETTE_SEASON_LABEL = "2026-2027";
const RECETTE_LEAGUE_NAME = "Ligue Recette Enchères";
const RECETTE_PASSWORD = "recette2026";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

// ---------------------------------------------------------------------------
// Données fictives
// ---------------------------------------------------------------------------

const CLUBS = [
  { name: "Recette FC", idClubEq: "REC001" },
  { name: "Fictif Paris", idClubEq: "FIC001" },
  { name: "Mock United", idClubEq: "MCK001" },
  { name: "Test Olympique", idClubEq: "TST001" },
  { name: "Demo Athletic", idClubEq: "DEM001" },
  { name: "Sandbox City", idClubEq: "SND001" },
];

// Noms de famille + prénoms fictifs français plausibles
const LASTNAMES = [
  "Durand", "Martin", "Bernard", "Petit", "Leroy", "Simon", "Laurent",
  "Thomas", "Moreau", "Lefebvre", "Girard", "Fontaine", "Mercier",
  "Boyer", "Rousseau", "Blanc", "Garnier", "Dupont", "Chevallier", "Morin",
];
const FIRSTNAMES = [
  "Julien", "Nicolas", "Pierre", "Lucas", "Antoine", "Alexandre",
  "Thomas", "Mathieu", "Baptiste", "Romain", "Kevin", "Hugo",
  "Maxime", "Florian", "Quentin", "Sebastien", "Damien", "Cedric",
];

// Répartition par poste
// IMPORTANT : utiliser les intitulés du format prod (PLAYER.POSITION) pour cohérence
// avec isGkPosition() (cherche "gardien"), positionToLine() et checkGoalkeeperLimit().
// "G", "MIL" etc. (format court) sont reconnus par positionToLine côté UI mais PAS
// par isGkPosition côté serveur → incohérence silencieuse. Toujours utiliser le format prod.
const PLAYERS_PER_CLUB_BY_POS: Record<string, number> = {
  Gardien: 2, // 2 gardiens/club  (prod : "1 - Gardien" ou "Gardien")
  DEF:     5, // 5 défenseurs/club
  MIL:     4, // 4 milieux/club
  ATT:     3, // 3 attaquants/club
};
// Total : 14 joueurs/club × 6 clubs = 84 joueurs (> 80 demandés)

const PARTICIPANTS = [
  { name: "RecetteAdmin",  email: "admin@recette.test" },
  { name: "Joueur1",       email: "joueur1@recette.test" },
  { name: "Joueur2",       email: "joueur2@recette.test" },
  { name: "Joueur3",       email: "joueur3@recette.test" },
  { name: "Joueur4",       email: "joueur4@recette.test" },
];

function pickName(clubIdx: number, posIdx: number, seq: number): { fname: string; lname: string } {
  const lnameIdx = (clubIdx * 17 + posIdx * 7 + seq * 3) % LASTNAMES.length;
  const fnameIdx = (clubIdx * 13 + posIdx * 5 + seq * 11) % FIRSTNAMES.length;
  return {
    fname: FIRSTNAMES[fnameIdx],
    lname: LASTNAMES[lnameIdx],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[seed-recette-encheres] mode=${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`DATABASE_URL=${process.env.DATABASE_URL ?? "(non définie)"}`);
  console.log();

  // Garde-fou : ne pas écrire sur la prod
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.includes("3310") && !dbUrl.includes("ligueenc_recette")) {
    console.error(
      "ERREUR : DATABASE_URL ne semble pas pointer sur la base recette (port 3310 ou ligueenc_recette).\n" +
      "Valeur : " + dbUrl + "\n" +
      "Abandon."
    );
    process.exit(1);
  }

  // 1. Saison de recette
  let season = await prisma.season.findFirst({
    where: { label: RECETTE_SEASON_LABEL },
  });
  if (season) {
    console.log(`[SKIP] Saison "${RECETTE_SEASON_LABEL}" existe déjà (id #${season.id}).`);
  } else {
    console.log(`[CREATE] Saison "${RECETTE_SEASON_LABEL}" (isCurrent=true, status=AUCTION)`);
    if (apply) {
      // Dé-setter toute saison courante existante
      await prisma.season.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      season = await prisma.season.create({
        data: {
          label: RECETTE_SEASON_LABEL,
          status: "AUCTION",
          isCurrent: true,
          startedAt: new Date(),
        },
      });
      console.log(`  -> créée : id #${season.id}`);
    }
  }

  if (!season && !apply) {
    console.log("  [dry-run] Saison simulée avec id fictif = 9999");
    season = { id: 9999, label: RECETTE_SEASON_LABEL, status: "AUCTION", isCurrent: true, startedAt: new Date(), closedAt: null };
  }

  const seasonId = season!.id;

  // 2. Clubs fictifs
  const createdClubs: { id: number; name: string }[] = [];
  for (const c of CLUBS) {
    const existing = await prisma.club.findFirst({ where: { idClubEq: c.idClubEq, seasonId } });
    if (existing) {
      console.log(`[SKIP] Club "${c.name}" (${c.idClubEq}) déjà présent.`);
      createdClubs.push({ id: existing.id, name: existing.name });
    } else {
      console.log(`[CREATE] Club "${c.name}" (${c.idClubEq})`);
      if (apply) {
        const club = await prisma.club.create({
          data: { name: c.name, idClubEq: c.idClubEq, seasonId },
        });
        createdClubs.push({ id: club.id, name: club.name });
      } else {
        createdClubs.push({ id: 90000 + CLUBS.indexOf(c), name: c.name });
      }
    }
  }

  // 3. Joueurs fictifs
  let totalPlayersCreated = 0;
  let totalPlayersSkipped = 0;
  for (let ci = 0; ci < createdClubs.length; ci++) {
    const club = createdClubs[ci];
    let posIdx = 0;
    for (const [pos, count] of Object.entries(PLAYERS_PER_CLUB_BY_POS)) {
      for (let seq = 0; seq < count; seq++) {
        const { fname, lname } = pickName(ci, posIdx, seq);
        const linkKey = `recette_${club.id}_${pos.toLowerCase()}_${seq}`;

        const existing = await prisma.player.findFirst({ where: { link: linkKey } });
        if (existing) {
          totalPlayersSkipped++;
        } else {
          console.log(`[CREATE] Joueur ${fname} ${lname} (${pos}) @ ${club.name}`);
          if (apply) {
            await prisma.player.create({
              data: {
                clubId: club.id,
                fname,
                lname,
                position: pos,
                link: linkKey,
                seasonId,
              },
            });
          }
          totalPlayersCreated++;
        }
      }
      posIdx++;
    }
  }
  console.log(`Joueurs : ${totalPlayersCreated} créés, ${totalPlayersSkipped} ignorés (doublon).`);

  // 4. Participants (users)
  const hashedPwd = await bcrypt.hash(RECETTE_PASSWORD, 10);
  const userIds: number[] = [];
  for (const p of PARTICIPANTS) {
    const existing = await prisma.user.findFirst({ where: { email: p.email } });
    if (existing) {
      console.log(`[SKIP] User "${p.name}" (${p.email}) déjà présent.`);
      userIds.push(existing.id);
    } else {
      console.log(`[CREATE] User "${p.name}" (${p.email})`);
      if (apply) {
        const user = await prisma.user.create({
          data: { name: p.name, email: p.email, password: hashedPwd },
        });
        userIds.push(user.id);
      } else {
        userIds.push(80000 + PARTICIPANTS.indexOf(p));
      }
    }
  }

  // 5. Ligue de recette
  let league = await prisma.league.findFirst({
    where: { name: RECETTE_LEAGUE_NAME, seasonId },
  });
  if (league) {
    console.log(`[SKIP] Ligue "${RECETTE_LEAGUE_NAME}" déjà présente (id #${league.id}).`);
  } else {
    console.log(`[CREATE] Ligue "${RECETTE_LEAGUE_NAME}" (saison #${seasonId})`);
    if (apply) {
      league = await prisma.league.create({
        data: {
          name: RECETTE_LEAGUE_NAME,
          chiefId: userIds[0] ?? 0,
          forumId: 0,
          firstYear: 2026,
          seasonId,
          divisionLabel: "Division Recette",
          tier: 1,
        },
      });
      console.log(`  -> créée : id #${league.id}, slug attendu : "ligue-recette-encheres"`);
    }
  }

  // 6. Rattacher les participants à la ligue
  if (league) {
    for (const uid of userIds) {
      const already = await prisma.leagueUser.findFirst({
        where: { leagueId: league.id, userId: uid },
      });
      if (already) {
        console.log(`[SKIP] User #${uid} déjà dans la ligue.`);
      } else {
        console.log(`[CREATE] LeagueUser (league #${league.id}, user #${uid})`);
        if (apply) {
          await prisma.leagueUser.create({
            data: { leagueId: league.id, userId: uid },
          });
        }
      }
    }
  }

  console.log();
  console.log("=== RÉSUMÉ ===");
  console.log(`Saison recette : #${seasonId} "${RECETTE_SEASON_LABEL}" (isCurrent=true, AUCTION)`);
  console.log(`Clubs : ${createdClubs.map((c) => c.name).join(", ")}`);
  console.log(`Ligue : "${RECETTE_LEAGUE_NAME}" (slug = ligue-recette-encheres)`);
  console.log(`Participants :`);
  for (const p of PARTICIPANTS) {
    console.log(`  - login: "${p.name}" | password: "${RECETTE_PASSWORD}" | email: ${p.email}`);
  }
  if (!apply) {
    console.log();
    console.log("DRY-RUN — aucune donnée écrite. Relancer avec --apply pour écrire.");
  } else {
    console.log();
    console.log("Toutes les données ont été écrites.");
    console.log();
    console.log("Prochaine étape :");
    console.log(
      '  DATABASE_URL="mysql://recette:recette2026@127.0.0.1:3310/ligueenc_recette" ' +
      "./node_modules/.bin/tsx scripts/seed-gardiens-club.ts --apply"
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
