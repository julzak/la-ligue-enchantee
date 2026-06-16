/**
 * Bootstrap de la base E2E en CI (et rejouable en local).
 *
 * `prisma db push` crée les tables modélisées par Prisma (USER, SEASON, CLUB,
 * PLAYER, LEAGUE, LEAGUE_USER, TEAM...). MAIS les tables du module enchères
 * (AUCTION, AUCTION_BID, AUCTION_REMOVAL) et ADMIN_USER ne sont PAS dans le
 * schéma Prisma (SQL brut côté prod). On les recrée ici, à partir du DDL réel
 * de prod, puis on prépare la fixture d'enchère (admin opérateur, AUCTION
 * ouverte pour la ligue de recette).
 *
 * À lancer APRÈS le seed (seed-recette-encheres + seed-gardiens-club).
 * Idempotent. Exporte E2E_LEAGUE_ID vers $GITHUB_ENV pour les steps suivants.
 */
import { PrismaClient } from "@prisma/client";
import { appendFileSync } from "fs";

const prisma = new PrismaClient();

const DDL = [
  `CREATE TABLE IF NOT EXISTS ADMIN_USER (
     id INT UNSIGNED NOT NULL AUTO_INCREMENT,
     user_id INT UNSIGNED NOT NULL,
     PRIMARY KEY (id), UNIQUE KEY uq_user (user_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS AUCTION (
     id INT UNSIGNED NOT NULL AUTO_INCREMENT,
     league_id INT UNSIGNED NOT NULL,
     status VARCHAR(20) NOT NULL DEFAULT 'open',
     current_round INT NOT NULL DEFAULT 1,
     budget_per_user INT NOT NULL DEFAULT 130,
     players_per_user INT NOT NULL DEFAULT 13,
     type VARCHAR(20) DEFAULT 'summer',
     round_deadline DATETIME DEFAULT NULL,
     PRIMARY KEY (id), KEY league_id (league_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS AUCTION_BID (
     id INT UNSIGNED NOT NULL AUTO_INCREMENT,
     auction_id INT UNSIGNED NOT NULL,
     round INT NOT NULL DEFAULT 1,
     user_id INT UNSIGNED NOT NULL,
     player_id INT UNSIGNED NOT NULL,
     amount INT NOT NULL DEFAULT 0,
     status VARCHAR(20) NOT NULL DEFAULT 'pending',
     player_out_id INT UNSIGNED DEFAULT NULL,
     PRIMARY KEY (id), KEY auction_id (auction_id), KEY user_id (user_id), KEY player_id (player_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS AUCTION_REMOVAL (
     id INT UNSIGNED NOT NULL AUTO_INCREMENT,
     auction_id INT UNSIGNED NOT NULL,
     round INT NOT NULL,
     user_id INT UNSIGNED NOT NULL,
     player_id INT UNSIGNED NOT NULL,
     amount INT NOT NULL,
     reason VARCHAR(255) NOT NULL,
     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (id), UNIQUE KEY uq_removal (auction_id, round, user_id, player_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function main() {
  for (const ddl of DDL) await prisma.$executeRawUnsafe(ddl);

  // Admin opérateur : RecetteAdmin dans ADMIN_USER, et RETIRÉ des participants
  // de la ligue (il opère, il ne mise pas).
  const admin = await prisma.user.findFirst({ where: { name: "RecetteAdmin" } });
  if (!admin) throw new Error("Seed manquant : utilisateur RecetteAdmin introuvable");
  await prisma.$executeRawUnsafe("INSERT IGNORE INTO ADMIN_USER (user_id) VALUES (?)", admin.id);

  const league = await prisma.league.findFirst({ where: { name: { contains: "Recette" } } });
  if (!league) throw new Error("Seed manquant : ligue de recette introuvable");
  await prisma.$executeRawUnsafe(
    "DELETE FROM LEAGUE_USER WHERE ID_LEAGUE = ? AND ID_USER = ?",
    league.id, admin.id
  );

  // AUCTION ouverte (tour 1) pour la ligue, si absente.
  const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
    "SELECT id FROM AUCTION WHERE league_id = ? LIMIT 1", league.id
  );
  if (existing.length === 0) {
    await prisma.$executeRawUnsafe(
      "INSERT INTO AUCTION (league_id, status, current_round, budget_per_user, players_per_user, type) VALUES (?, 'open', 1, 130, 13, 'summer')",
      league.id
    );
  }

  // Expose l'id de ligue aux steps suivants (le harnais lit E2E_LEAGUE_ID).
  if (process.env.GITHUB_ENV) {
    appendFileSync(process.env.GITHUB_ENV, `E2E_LEAGUE_ID=${league.id}\n`);
  }
  console.log(`[ci-setup] OK — ligue de recette #${league.id}, admin #${admin.id}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
