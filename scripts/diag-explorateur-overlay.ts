/**
 * Diag ad-hoc : vérifie sur données réelles que l'overlay enchères de
 * l'explorateur produit des propriétaires pendant la phase active.
 * Lecture seule (SELECT uniquement). Reproduit les requêtes de
 * getActiveAuctionWonOwners (src/lib/db.ts) sans passer par db.ts
 * (react.cache plante hors RSC).
 *
 * Usage : ./node_modules/.bin/tsx scripts/diag-explorateur-overlay.ts <leagueId>
 */
import { prisma } from "../src/lib/prisma";
import {
  isAuctionPhaseActive,
  overlayAuctionOwners,
} from "../src/lib/explorer-auction-overlay";

async function main() {
  const leagueId = Number(process.argv[2] ?? 40);

  const auctions = await prisma.$queryRawUnsafe<{ id: number; status: string }[]>(
    "SELECT id, status FROM AUCTION WHERE league_id = ? AND COALESCE(type, 'summer') = 'summer' ORDER BY id DESC LIMIT 1",
    leagueId
  );
  console.log("Ligue", leagueId, "- enchère:", auctions[0] ?? "aucune");
  const active = isAuctionPhaseActive(auctions[0]?.status);
  console.log("Phase active:", active);
  if (!active) return;

  const wonBids = await prisma.$queryRawUnsafe<{ user_id: number; player_id: number }[]>(
    "SELECT user_id, player_id FROM AUCTION_BID WHERE auction_id = ? AND status = 'won'",
    Number(auctions[0].id)
  );
  const teamRows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    "SELECT COUNT(*) as cnt FROM TEAM WHERE ID_LEAGUE = ?",
    leagueId
  );
  console.log("Mises won:", wonBids.length, "| lignes TEAM:", Number(teamRows[0].cnt));

  const userIds = Array.from(new Set(wonBids.map((b) => Number(b.user_id))));
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const merged = overlayAuctionOwners(
    new Map(),
    wonBids.map((b) => ({
      playerId: Number(b.player_id),
      ownerName: nameById.get(Number(b.user_id)) ?? "?",
    }))
  );
  console.log("Joueurs pris après overlay:", merged.size);
  const sample = Array.from(merged.entries()).slice(0, 5);
  for (const [pid, owner] of sample) console.log("  player", pid, "→", owner);
}

main().finally(() => prisma.$disconnect());
